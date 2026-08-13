import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import { MailService } from 'src/mail/mail.service';
import { SmsService, parsePhoneToE164 } from 'src/sms/sms.service';
import { SubmitLeadDto } from './dto/submit-lead.dto';
import { ListLeadsDto } from './dto/list-leads.dto';
import { MarkLeadStatusDto } from './dto/mark-lead-status.dto';
import { RequestLeadVerificationDto } from './dto/request-lead-verification.dto';
import { VerifyLeadDto } from './dto/verify-lead.dto';
import { RequestSmsVerificationDto } from './dto/request-sms-verification.dto';
import { VerifySmsDto } from './dto/verify-sms.dto';
import { RecordPrivacyConsentDto } from './dto/record-privacy-consent.dto';
import { LeadDestination } from 'src/bot/lead-destination.constants';
import { LegalDocumentService } from 'src/legal-document/legal-document.service';
import { ChatFlowService, TransitionArgs } from 'src/chat-flow/chat-flow.service';
import { FlowKind } from '../../generated/prisma/client';
import { PushNotificationService } from 'src/push-notification/push-notification.service';

const CODE_TTL_MINUTES = 5;
const VERIFICATION_TOKEN_TTL_SECONDS = 30 * 60;
const MAX_CODE_REQUESTS_PER_WINDOW = 3;
const CODE_REQUEST_WINDOW_MINUTES = 15;
const MAX_VERIFY_ATTEMPTS = 5;
// Separate from the 15-minute/3-request abuse window: that guards SMS
// credit, this blocks a *duplicate* send seconds apart — the class of bug
// observed 2026-08-11 where the agent re-triggered SMS verification twice
// in close succession within the same window, well under the abuse cap.
const SMS_RESEND_COOLDOWN_SECONDS = 60;

// Fallback used only if no "kvkk" LegalDocument has a published version yet
// (e.g. before the admin has migrated the legacy static text into the new
// legal-document editor). Once that seeding is done this is never reached.
const LEGACY_KVKK_VERSION_FALLBACK = process.env.KVKK_TEXT_VERSION || 'v1.0';

// How long a KVKK consent counts as "fresh enough" to gate an SMS OTP
// request without requiring the visitor to accept again mid-conversation.
const CONSENT_FRESHNESS_MINUTES = 60;

type VerifyFailureReason = 'not_found' | 'expired' | 'too_many_attempts' | 'wrong_code';

@Injectable()
export class LeadService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
    private smsService: SmsService,
    private jwt: JwtService,
    private legalDocumentService: LegalDocumentService,
    private chatFlowService: ChatFlowService,
    private pushNotificationService: PushNotificationService,
  ) { }

  /**
   * Fire-and-log wrapper for ChatFlowService.transition. The state
   * store is authoritative for orchestration (P2 refactor, plan Faz 1)
   * but MUST NOT block or roll back the existing lead-capture path
   * if it fails — a Prisma error here would drop leads on the floor.
   * Any failure is logged and swallowed. The next transition attempt
   * for the same chat will surface the drift via `INVALID_TRANSITION`
   * (optimistic lock catches stale reads).
   */
  private async safeTransition(
    botId: string,
    chatId: string | null | undefined,
    flowKind: typeof FlowKind.LEAD,
    args: TransitionArgs<typeof FlowKind.LEAD>,
  ): Promise<void> {
    if (!chatId) return; // flow state is per-chat; entry sites without chatId (email OTP) skip silently
    try {
      await this.chatFlowService.transition(botId, chatId, flowKind, args);
    } catch (err) {
      console.warn(
        `[lead-service] chat-flow transition failed for ${botId}/${chatId} ${flowKind} → ${args.to}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async submit(dto: SubmitLeadDto) {
    const { botId, chatId, leadData, verificationToken, smsVerificationToken } = dto;

    if (!leadData?.email && !leadData?.phone) {
      throw new BadRequestException(
        'leadData must include at least one contact field (email or phone)',
      );
    }

    const bot = await this.prisma.customerBots.findUnique({
      where: { id: botId, isDeleted: false },
    });

    if (!bot) {
      throw new NotFoundException('Bot not found');
    }

    // Whitespace-only optional fields are dropped before persisting/sending.
    const cleanLeadData: Record<string, string> = {};
    for (const [key, value] of Object.entries(leadData)) {
      if (typeof value === 'string' && value.trim().length > 0) {
        cleanLeadData[key] = value.trim();
      }
    }

    let verified = false;
    if (bot.leadVerificationRequired) {
      if (!verificationToken) {
        await this.recordVerificationRejection(botId, chatId, cleanLeadData, 'verification_required');
        throw new BadRequestException({ code: 'VERIFICATION_REQUIRED' });
      }
      try {
        const payload = await this.jwt.verifyAsync<{
          email: string;
          botId: string;
          kind?: string;
        }>(verificationToken, {
          secret: process.env.BOOKING_VERIFICATION_SECRET || process.env.JWT_SECRET,
        });
        if (
          payload.kind !== 'lead_verification' ||
          payload.botId !== botId ||
          payload.email !== leadData.email
        ) {
          throw new Error('TOKEN_MISMATCH');
        }
        verified = true;
      } catch {
        await this.recordVerificationRejection(botId, chatId, cleanLeadData, 'verification_invalid');
        throw new BadRequestException({ code: 'VERIFICATION_INVALID' });
      }
    }

    let smsVerified = false;
    let privacyConsentId: string | null = null;
    if (bot.smsVerificationRequired && leadData.phone) {
      if (!smsVerificationToken) {
        await this.recordVerificationRejection(botId, chatId, cleanLeadData, 'sms_verification_required');
        throw new BadRequestException({ code: 'SMS_VERIFICATION_REQUIRED' });
      }
      try {
        const payload = await this.jwt.verifyAsync<{
          phone: string;
          botId: string;
          kind?: string;
        }>(smsVerificationToken, {
          secret: process.env.BOOKING_VERIFICATION_SECRET || process.env.JWT_SECRET,
        });
        if (
          payload.kind !== 'lead_sms_verification' ||
          payload.botId !== botId ||
          payload.phone !== leadData.phone
        ) {
          throw new Error('TOKEN_MISMATCH');
        }
        smsVerified = true;
      } catch {
        await this.recordVerificationRejection(botId, chatId, cleanLeadData, 'sms_verification_invalid');
        throw new BadRequestException({ code: 'SMS_VERIFICATION_INVALID' });
      }

      const consent = await this.prisma.leadPrivacyConsent.findFirst({
        where: { botId, chatId: chatId || undefined, otpVerified: true },
        orderBy: { createdAt: 'desc' },
      });
      privacyConsentId = consent?.id ?? null;
    }

    let destinations = ((bot.leadDestinations as unknown as LeadDestination[]) || []).filter(
      (d) => d.enabled,
    );

    // Fallback: an unconfigured `leadDestinations` (new bot, or bot owner
    // never opened the Lead Notifications tab) still delivers to the team
    // owner's account email. Without this, a successful calendar booking
    // silently drops the notification and the bot owner never learns a
    // lead came in. Explicit user-configured destinations always win.
    if (destinations.length === 0) {
      const ownerMembership = await this.prisma.teamMember.findFirst({
        where: { teamId: bot.teamId, role: 'TEAM_OWNER' },
        include: { user: true },
      });
      const ownerEmail = ownerMembership?.user?.email || ownerMembership?.email || '';
      if (ownerEmail) {
        console.log(
          `[LeadCapture] leadDestinations empty for bot ${botId}, ` +
            `falling back to team owner ${ownerEmail}`,
        );
        destinations = [
          { channel: 'email', target: ownerEmail, enabled: true } as LeadDestination,
        ];
      } else {
        const lead = await this.prisma.botLeads.create({
          data: {
            botId,
            chatId: chatId || null,
            leadData: cleanLeadData,
            channelsAttempted: [],
            channelsSucceeded: [],
            deliveryErrors: [{ channel: 'none', error: 'no_destinations_and_no_team_owner' }],
            status: 'NEW',
            verified,
            smsVerified,
            privacyConsentId,
          },
        });
        if (privacyConsentId) {
          await this.prisma.leadPrivacyConsent.update({
            where: { id: privacyConsentId },
            data: { leadId: lead.id },
          });
        }
        return {
          status: 'failed',
          leadId: lead.id,
          channelsAttempted: [],
          channelsSucceeded: [],
        };
      }
    }

    const channelsAttempted: string[] = [];
    const channelsSucceeded: string[] = [];
    const deliveryErrors: { channel: string; error: string; target?: string }[] = [];

    await Promise.all(
      destinations.map(async (destination) => {
        channelsAttempted.push(destination.channel);
        try {
          if (destination.channel === 'email') {
            await this.mailService.sendLeadNotification(
              destination.target,
              bot.botName,
              cleanLeadData,
              'en',
            );
          }
          channelsSucceeded.push(destination.channel);
        } catch (error) {
          deliveryErrors.push({
            channel: destination.channel,
            error: error instanceof Error ? error.message : 'unknown_error',
            target: destination.target,
          });
        }
      }),
    );

    const status =
      channelsSucceeded.length === channelsAttempted.length
        ? 'delivered'
        : channelsSucceeded.length > 0
          ? 'partial'
          : 'failed';

    const lead = await this.prisma.botLeads.create({
      data: {
        botId,
        chatId: chatId || null,
        leadData: cleanLeadData,
        channelsAttempted,
        channelsSucceeded,
        deliveryErrors: deliveryErrors.length > 0 ? deliveryErrors : null,
        status: 'NEW',
        verified,
        smsVerified,
        privacyConsentId,
      },
    });

    if (privacyConsentId) {
      await this.prisma.leadPrivacyConsent.update({
        where: { id: privacyConsentId },
        data: { leadId: lead.id },
      });
    }

    // Push notification: unlike leadDestinations (arbitrary configured
    // emails, not necessarily tied to any User account), push always
    // targets the team's actual app users, so an agent gets alerted on
    // their phone regardless of where the email routing points.
    try {
      const teamMembers = await this.prisma.teamMember.findMany({
        where: { teamId: bot.teamId, userId: { not: null }, status: 'active' },
        select: { userId: true },
      });
      const team = await this.prisma.team.findUnique({
        where: { id: bot.teamId },
        select: { ownerId: true },
      });
      const recipientIds = new Set(teamMembers.map((m) => m.userId as string));
      if (team?.ownerId) recipientIds.add(team.ownerId);

      await this.pushNotificationService.sendToUsers([...recipientIds], {
        title: 'Yeni lead',
        body: `${bot.botName} için yeni bir lead alındı.`,
        data: { type: 'new_lead', botId, leadId: lead.id },
      });
    } catch (pushError) {
      console.warn('[lead-service] push notification failed:', pushError);
    }

    // Terminal LEAD transition. `delivered`/`partial` → SUBMITTED
    // (owner got at least one channel); pure `failed` → FAILED.
    // `from: null` because this is the terminal write; whatever
    // state we're leaving is fine (OTP_VERIFIED for the SMS path,
    // any state at all for the email path where mid-flow transitions
    // are not wired yet).
    await this.safeTransition(botId, chatId, FlowKind.LEAD, {
      to: status === 'failed' ? 'FAILED' : 'SUBMITTED',
      payload: { lead_id: lead.id, status, channelsSucceeded },
    });

    return {
      status,
      leadId: lead.id,
      channelsAttempted,
      channelsSucceeded,
    };
  }

  /**
   * Audit invariant: every submit() attempt is persisted, even ones rejected
   * before delivery is attempted. Without this, a bot owner debugging "why
   * didn't my lead show up" via the leads inbox sees nothing for visitors
   * who never made it past email verification.
   */
  private async recordVerificationRejection(
    botId: string,
    chatId: string | null | undefined,
    cleanLeadData: Record<string, string>,
    reason:
      | 'verification_required'
      | 'verification_invalid'
      | 'sms_verification_required'
      | 'sms_verification_invalid',
  ) {
    await this.prisma.botLeads.create({
      data: {
        botId,
        chatId: chatId || null,
        leadData: cleanLeadData,
        channelsAttempted: [],
        channelsSucceeded: [],
        deliveryErrors: [{ channel: 'none', error: reason }],
        status: 'NEW',
        verified: false,
      },
    });
  }

  async list(dto: ListLeadsDto, teamId: string) {
    const bot = await this.prisma.customerBots.findUnique({
      where: { id: dto.botId, isDeleted: false },
    });

    if (!bot) {
      throw new NotFoundException('Bot not found');
    }

    if (bot.teamId !== teamId) {
      throw new ForbiddenException('Bot not owned by your team');
    }

    const limit = dto.limit ?? 25;

    const leads = await this.prisma.botLeads.findMany({
      where: {
        botId: dto.botId,
        ...(dto.status ? { status: dto.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(dto.cursor ? { cursor: { id: dto.cursor }, skip: 1 } : {}),
    });

    const hasMore = leads.length > limit;
    const page = hasMore ? leads.slice(0, limit) : leads;

    return {
      leads: page,
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  async markStatus(dto: MarkLeadStatusDto, teamId: string) {
    const lead = await this.prisma.botLeads.findUnique({
      where: { id: dto.leadId },
      include: { bot: true },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    if (lead.bot.teamId !== teamId) {
      throw new ForbiddenException('Lead not owned by your team');
    }

    const updated = await this.prisma.botLeads.update({
      where: { id: dto.leadId },
      data: { status: dto.status },
    });

    return { message: 'Lead status updated', lead: updated };
  }

  /**
   * Generate a 6-digit code, persist its hash, and email it to the visitor.
   * Mirrors BookingService.requestVerification.
   */
  async requestVerification(dto: RequestLeadVerificationDto) {
    const bot = await this.prisma.customerBots.findUnique({
      where: { id: dto.botId, isDeleted: false },
    });

    if (!bot) {
      throw new NotFoundException('Bot not found');
    }

    if (!bot.leadVerificationRequired) {
      throw new BadRequestException({ code: 'NOT_REQUIRED' });
    }

    const windowStart = new Date(Date.now() - CODE_REQUEST_WINDOW_MINUTES * 60 * 1000);
    const recentCount = await this.prisma.leadVerification.count({
      where: { botId: dto.botId, email: dto.email, createdAt: { gte: windowStart } },
    });

    if (recentCount >= MAX_CODE_REQUESTS_PER_WINDOW) {
      return { status: 'rate_limited' as const };
    }

    const code = crypto.randomInt(100000, 999999).toString();
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

    await this.prisma.leadVerification.create({
      data: { botId: dto.botId, email: dto.email, codeHash, expiresAt },
    });

    await this.mailService.sendLeadVerificationCode(dto.email, code, bot.botName, 'en');

    return { status: 'sent' as const, expiresAt: expiresAt.toISOString() };
  }

  /**
   * Validate a code and, on success, issue a short-lived `lead_verification` JWT
   * that `submit()` will accept as proof of email ownership.
   */
  async verifyCode(
    dto: VerifyLeadDto,
  ): Promise<
    | { verified: true; verificationToken: string }
    | { verified: false; reason: VerifyFailureReason }
  > {
    const record = await this.prisma.leadVerification.findFirst({
      where: { botId: dto.botId, email: dto.email, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      return { verified: false, reason: 'not_found' };
    }

    if (record.expiresAt < new Date()) {
      return { verified: false, reason: 'expired' };
    }

    if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
      return { verified: false, reason: 'too_many_attempts' };
    }

    await this.prisma.leadVerification.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });

    const codeHash = crypto.createHash('sha256').update(dto.code).digest('hex');
    const hashesMatch =
      codeHash.length === record.codeHash.length &&
      crypto.timingSafeEqual(Buffer.from(codeHash), Buffer.from(record.codeHash));

    if (!hashesMatch) {
      return { verified: false, reason: 'wrong_code' };
    }

    await this.prisma.leadVerification.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    const verificationToken = await this.jwt.signAsync(
      { email: dto.email, botId: dto.botId, kind: 'lead_verification', sub: record.id },
      {
        secret: process.env.BOOKING_VERIFICATION_SECRET || process.env.JWT_SECRET,
        expiresIn: VERIFICATION_TOKEN_TTL_SECONDS,
      },
    );

    return { verified: true, verificationToken };
  }

  /**
   * Record that a visitor accepted the KVKK Aydınlatma Metni + Kullanım
   * Şartları, *before* their phone number is known. `requestSmsVerification`
   * requires a fresh row here for the same (botId, chatId) before it will
   * ever send an OTP - this is the deterministic, server-verified gate; it
   * is never inferred from anything the model or the visitor typed in chat.
   */
  async recordPrivacyConsent(dto: RecordPrivacyConsentDto, ipAddress: string | null, userAgent: string | null) {
    const bot = await this.prisma.customerBots.findUnique({
      where: { id: dto.botId, isDeleted: false },
    });

    if (!bot) {
      throw new NotFoundException('Bot not found');
    }

    const locale = 'tr';
    let legalDocumentVersionId: string | null = null;
    let privacyVersion = LEGACY_KVKK_VERSION_FALLBACK;
    try {
      const published = await this.legalDocumentService.getPublished('kvkk', locale);
      legalDocumentVersionId = published.versionId;
      privacyVersion = `v${published.versionNumber}`;
    } catch {
      // No published "kvkk" LegalDocumentVersion yet — fall back to the
      // legacy hardcoded label until the admin publishes one.
    }

    const consent = await this.prisma.leadPrivacyConsent.create({
      data: {
        botId: dto.botId,
        teamId: bot.teamId,
        chatId: dto.chatId ?? null,
        source: 'chatbot',
        privacyVersion,
        legalDocumentVersionId,
        locale,
        privacyAcceptedAt: new Date(),
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
    });

    // Enter LEAD flow at CONSENT_OK — only if we already have a chatId to
    // key on. In the provisional flow (widget records consent BEFORE the
    // first chat POST) `dto.chatId` is undefined; the transition is
    // written later when the chat POST arrives with `provisionalConsentId`
    // and this row gets bound. `safeTransition` early-returns on falsy
    // chatId so this is a no-op then.
    await this.safeTransition(dto.botId, dto.chatId, FlowKind.LEAD, {
      to: 'CONSENT_OK',
      payload: { source: 'widget_kvkk_accept', consent_id: consent.id },
    });

    return { accepted: true, consentId: consent.id, privacyVersion: consent.privacyVersion };
  }

  /**
   * Bind a previously-recorded LeadPrivacyConsent (created with chatId=null
   * by the widget's provisional flow) to a real chatId. Called from the
   * chat POST handler as soon as FastAPI has allocated a session_id, so
   * the gateway's next `has_fresh_kvkk_consent` probe finds the consent
   * keyed on botId+chatId and stops short-circuiting.
   */
  async bindProvisionalConsent(
    consentId: string,
    botId: string,
    chatId: string,
  ): Promise<boolean> {
    const consent = await this.prisma.leadPrivacyConsent.findUnique({
      where: { id: consentId },
    });
    if (!consent) return false;
    // Reject cross-bot binds — a caller MUST NOT be able to steal another
    // bot's consent row by guessing its id.
    if (consent.botId !== botId) return false;
    // Already bound to a chatId — either the same one (idempotent) or a
    // different one (misuse). Either way, do nothing.
    if (consent.chatId) return consent.chatId === chatId;
    await this.prisma.leadPrivacyConsent.update({
      where: { id: consentId },
      data: { chatId },
    });
    await this.safeTransition(botId, chatId, FlowKind.LEAD, {
      to: 'CONSENT_OK',
      payload: { source: 'provisional_bind', consent_id: consentId },
    });
    return true;
  }

  /**
   * Cheap idempotent probe used by the gateway's pre-agent PII scrub
   * (chat_endpoint.py) to decide whether it's safe to invoke the agent
   * on a message that contains a phone-number pattern. Same 60-minute
   * freshness window as `requestSmsVerification` below, so a `fresh:true`
   * answer here guarantees the OTP path won't reject on
   * `KVKK_CONSENT_REQUIRED` a moment later. No PII in the response.
   */
  async hasFreshKvkkConsent(botId: string, chatId: string): Promise<{ fresh: boolean }> {
    if (!botId || !chatId) return { fresh: false };
    const consentWindowStart = new Date(Date.now() - CONSENT_FRESHNESS_MINUTES * 60 * 1000);
    const consent = await this.prisma.leadPrivacyConsent.findFirst({
      where: { botId, chatId, createdAt: { gte: consentWindowStart } },
      select: { id: true },
    });
    return { fresh: !!consent };
  }

  /**
   * Generate a 6-digit code, persist its hash, and text it to the visitor
   * via NETGSM. Mirrors requestVerification(), gated additionally on a
   * fresh KVKK consent record for this chat.
   */
  async requestSmsVerification(dto: RequestSmsVerificationDto) {
    const bot = await this.prisma.customerBots.findUnique({
      where: { id: dto.botId, isDeleted: false },
    });

    if (!bot) {
      throw new NotFoundException('Bot not found');
    }

    if (!bot.smsVerificationRequired) {
      throw new BadRequestException({ code: 'NOT_REQUIRED' });
    }

    const consentWindowStart = new Date(Date.now() - CONSENT_FRESHNESS_MINUTES * 60 * 1000);
    const consent = await this.prisma.leadPrivacyConsent.findFirst({
      where: { botId: dto.botId, chatId: dto.chatId, createdAt: { gte: consentWindowStart } },
      orderBy: { createdAt: 'desc' },
    });

    if (!consent) {
      throw new BadRequestException({ code: 'KVKK_CONSENT_REQUIRED' });
    }

    const windowStart = new Date(Date.now() - CODE_REQUEST_WINDOW_MINUTES * 60 * 1000);
    const recentCount = await this.prisma.leadSmsVerification.count({
      where: { botId: dto.botId, phone: dto.phone, createdAt: { gte: windowStart } },
    });

    if (recentCount >= MAX_CODE_REQUESTS_PER_WINDOW) {
      return { status: 'rate_limited' as const };
    }

    // Cooldown gate: block a second SMS for the same (botId, phone) within
    // SMS_RESEND_COOLDOWN_SECONDS of the last one, independent of the
    // 15-minute abuse window above. Reuses the 'rate_limited' status so
    // gateway callers (already handling that status) need no changes.
    const lastRequest = await this.prisma.leadSmsVerification.findFirst({
      where: { botId: dto.botId, phone: dto.phone },
      orderBy: { createdAt: 'desc' },
    });
    if (
      lastRequest &&
      Date.now() - lastRequest.createdAt.getTime() < SMS_RESEND_COOLDOWN_SECONDS * 1000
    ) {
      return { status: 'rate_limited' as const };
    }

    await this.prisma.leadPrivacyConsent.update({
      where: { id: consent.id },
      data: { phone: dto.phone },
    });

    const code = crypto.randomInt(100000, 999999).toString();
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

    // Parse country to persist alongside the verification row (Slice 2,
    // 2026-08-13). SmsService will parse again inside sendOtpSms — the
    // parse is idempotent and cheap (~microseconds), and doing it here
    // lets us store the country BEFORE the SMS attempt so a partial
    // failure (SMS send throws) still leaves a queryable audit row.
    // parsePhoneToE164 returns null for unparseable input; we tolerate
    // that by writing `country: null` (schema is nullable) — the sms
    // send below still runs, and under `netgsm_only` strategy the
    // SmsService's legacy fallback preserves today's behaviour. Under
    // `route_by_country` the send will throw INVALID_PHONE_E164 and
    // the visitor will see a friendly retry sentinel.
    const parsed = parsePhoneToE164(dto.phone);
    const country = parsed?.country ?? null;

    await this.prisma.leadSmsVerification.create({
      data: { botId: dto.botId, phone: dto.phone, codeHash, expiresAt, country },
    });

    // Country → OTP body language. TR bots get the Turkish body; every
    // other country gets the English fallback. This is the minimal
    // Slice 2 shape — full i18n (per-visitor language, more locales)
    // ships in Slice 3 alongside the KVKK card i18n. Deliberately no
    // per-bot language override yet: bot owners today can't set a
    // "preferred SMS language" and every existing TR bot with an
    // international visitor is better served by an English body than
    // by Turkish they can't read.
    const smsLang: 'tr' | 'en' = country === 'TR' ? 'tr' : 'en';
    await this.smsService.sendOtpSms(dto.phone, code, bot.botName, smsLang);

    // Advance LEAD flow to OTP_SENT. Optimistic-lock on CONSENT_OK
    // — if the state isn't there yet (backfill hasn't seen this
    // chat, or an older session predates the state machine) the
    // safeTransition logs and continues.
    await this.safeTransition(dto.botId, dto.chatId, FlowKind.LEAD, {
      from: 'CONSENT_OK',
      to: 'OTP_SENT',
      payload: { phone: dto.phone, code_sent_at: new Date().toISOString() },
    });

    return { status: 'sent' as const, expiresAt: expiresAt.toISOString() };
  }

  /**
   * Validate an SMS code and, on success, issue a short-lived
   * `lead_sms_verification` JWT that `submit()` will accept as proof of
   * phone ownership, and mark the linked KVKK consent row as OTP-verified.
   */
  async verifySmsCode(
    dto: VerifySmsDto,
  ): Promise<
    | { verified: true; verificationToken: string }
    | { verified: false; reason: VerifyFailureReason }
  > {
    const record = await this.prisma.leadSmsVerification.findFirst({
      where: { botId: dto.botId, phone: dto.phone, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      return { verified: false, reason: 'not_found' };
    }

    if (record.expiresAt < new Date()) {
      return { verified: false, reason: 'expired' };
    }

    if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
      return { verified: false, reason: 'too_many_attempts' };
    }

    await this.prisma.leadSmsVerification.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });

    const codeHash = crypto.createHash('sha256').update(dto.code).digest('hex');
    const hashesMatch =
      codeHash.length === record.codeHash.length &&
      crypto.timingSafeEqual(Buffer.from(codeHash), Buffer.from(record.codeHash));

    if (!hashesMatch) {
      return { verified: false, reason: 'wrong_code' };
    }

    await this.prisma.leadSmsVerification.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    const consent = await this.prisma.leadPrivacyConsent.findFirst({
      where: { botId: dto.botId, phone: dto.phone, otpVerified: false },
      orderBy: { createdAt: 'desc' },
    });
    if (consent) {
      await this.prisma.leadPrivacyConsent.update({
        where: { id: consent.id },
        data: { otpVerified: true, otpVerifiedAt: new Date() },
      });
      // Advance LEAD flow to OTP_VERIFIED. Consent row carries the
      // chatId; verifySmsCode's own DTO doesn't (it's keyed on
      // botId + phone), so we key the transition on the consent's chat.
      await this.safeTransition(dto.botId, consent.chatId, FlowKind.LEAD, {
        from: 'OTP_SENT',
        to: 'OTP_VERIFIED',
      });
    }

    const verificationToken = await this.jwt.signAsync(
      { phone: dto.phone, botId: dto.botId, kind: 'lead_sms_verification', sub: record.id },
      {
        secret: process.env.BOOKING_VERIFICATION_SECRET || process.env.JWT_SECRET,
        expiresIn: VERIFICATION_TOKEN_TTL_SECONDS,
      },
    );

    return { verified: true, verificationToken };
  }
}
