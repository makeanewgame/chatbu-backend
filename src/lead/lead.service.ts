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
import {
  Jurisdiction,
  resolveConsentLocale,
  resolveJurisdiction,
} from './jurisdiction.util';
import {
  ConsentTextPack,
  getConsentPack,
  renderControllerNotice,
} from './consent-text.constants';
import { LeadDestination } from 'src/bot/lead-destination.constants';
import { LegalDocumentService } from 'src/legal-document/legal-document.service';
import { ChatFlowService, TransitionArgs, normalizePhoneForDedup } from 'src/chat-flow/chat-flow.service';
import { FlowKind } from '../../generated/prisma/client';
import { PushNotificationService } from 'src/push-notification/push-notification.service';
import { MixpanelService } from 'src/analytics/mixpanel.service';

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

// Read the bot owner's configured default jurisdiction out of the free-form
// settings JSON. Silent-null on missing/invalid so the resolver can fall
// through to the browser locale + generic default; we deliberately do not
// throw here — a mis-set field must not break consent flow.
function readBotDefaultJurisdiction(settings: unknown): Jurisdiction | null {
  if (!settings || typeof settings !== 'object') return null;
  const raw = (settings as { defaultJurisdiction?: unknown }).defaultJurisdiction;
  if (typeof raw !== 'string') return null;
  const lower = raw.toLowerCase() as Jurisdiction;
  return (['gdpr', 'kvkk', 'ccpa', 'pdpl', 'generic'] as const).includes(lower)
    ? lower
    : null;
}

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
    private mixpanel: MixpanelService,
  ) { }

  /**
   * `Lead Created` (+ `Lead Qualified` when the contact was OTP-verified).
   * Attributed to the team owner's Mixpanel profile. Fire-and-forget.
   */
  private async emitLeadAnalytics(params: {
    teamId: string;
    botId: string;
    leadId: string;
    verified: boolean;
    smsVerified: boolean;
    deliveryStatus: string;
    channelsSucceeded: string[];
  }): Promise<void> {
    try {
      const { ownerId } = await this.mixpanel.resolveTeamOwner(params.teamId);
      if (!ownerId) return;
      const base = {
        organization_id: params.teamId,
        team_id: params.teamId,
        chatbot_id: params.botId,
        lead_source: 'widget',
        channel: params.channelsSucceeded[0] ?? 'none',
      };
      this.mixpanel.track('Lead Created', ownerId, {
        ...base,
        verified: params.verified,
        sms_verified: params.smsVerified,
        delivery_status: params.deliveryStatus,
      });
      if (params.verified || params.smsVerified) {
        this.mixpanel.track('Lead Qualified', ownerId, base);
      }
    } catch (err) {
      console.warn('[lead-service] emitLeadAnalytics failed:', err);
    }
  }

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
    const { botId, chatId, leadData, verificationToken, smsVerificationToken, sourceChannel } = dto;

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

    // Calendar bookings (`create_appointment`) can never satisfy either
    // verification gate below: `create_appointment` refuses to run at all
    // without a phone SMS-OTP `verification_token` already validated
    // against NETGSM, and the lead-notify bridge that lands here
    // (`_notify_lead_capture` in calendar_tools.py) fires fire-and-forget
    // right after the booking is already committed — there's no further
    // chat turn to challenge the visitor with a second, differently-scoped
    // OTP. Blocking on these gates made every booking on a bot with either
    // verification flag enabled permanently drop the owner's "new lead"
    // email (channelsAttempted stayed empty) and show as unverified in the
    // inbox despite the visitor having just proven their phone. Reported
    // by a bot owner 2026-08-26.
    const isCalendarBookingSource = cleanLeadData.source_bot === 'create_appointment';

    // Legal Slice 2 (2026-09-05): deterministic privacy-consent gate.
    // A lead row IS collected PII, so a LeadPrivacyConsent row for this
    // chat session must exist BEFORE we persist anything — regardless of
    // whether the bot uses SMS/email OTP. Until now only the SMS flow
    // enforced consent; email-OTP and no-verification bots captured PII
    // with zero consent record. Placed BEFORE the verification gates so
    // the visitor sees the consent card first, then any OTP round-trip.
    //
    // Deliberately independent of `CustomerBots.kvkkConsentRequired` —
    // that flag governs the pre-agent consent wall (UX preference); this
    // gate is the platform-level floor for writing PII.
    //
    // Scoped to the chat session (no freshness TTL — unlike the 60-min
    // `hasFreshKvkkConsent` card-UX window): one accepted card per chat
    // is enough to write leads in that chat. No chatId ⇒ no way to
    // verify consent ⇒ rejected (every real capture path carries one).
    //
    // Calendar bookings bypass (same reason as the verification gates
    // above): the lead-notify bridge fires AFTER the booking committed,
    // and the booking flow runs its own consent probe up front.
    //
    // Rollout flag: default OFF; enabled via chatbu-config
    // LEAD_PRIVACY_CONSENT_GATE_ENABLED (configMapKeyRef in
    // k8s/deployment.yaml). MCP capture_lead maps the 400 code to a
    // sentinel that renders the consent card and retries after accept.
    const consentGateEnabled = process.env.LEAD_PRIVACY_CONSENT_GATE_ENABLED === 'true';
    let gateConsentId: string | null = null;
    if (consentGateEnabled && !isCalendarBookingSource) {
      if (chatId) {
        const consentRow = await this.prisma.leadPrivacyConsent.findFirst({
          where: { botId, chatId },
          orderBy: { createdAt: 'desc' },
        });
        gateConsentId = consentRow?.id ?? null;
      }
      if (!gateConsentId) {
        await this.recordVerificationRejection(botId, chatId, cleanLeadData, 'privacy_consent_required');
        throw new BadRequestException({ code: 'PRIVACY_CONSENT_REQUIRED' });
      }
    }

    // Slice 6 of backlog #23: sourceChannel is still forwarded (used
    // below for the audit-trail lead source label), but it NO LONGER
    // bypasses the verification gates. Reason: platform identity (WA/
    // IG/FB account) verifies who the visitor IS, not that the phone/
    // email they typed in DM actually belongs to them. A visitor can
    // easily give someone else's phone from DM — the anti-fraud goal
    // of smsVerificationRequired holds regardless of channel. So on
    // Meta channels the same SMS/email OTP round-trips run; the
    // difference from widget is purely presentation: the code lands
    // on the visitor's phone/inbox as usual, and the agent asks them
    // to type the code back into the DM (guided by the revised
    // channel_guard_block prompt on the gateway side).
    //
    // Consent record for the KVKK gate: MCP capture_lead posts to
    // POST /widget/lead/privacy-consent right before the SMS trigger
    // on Meta channels, so the row already exists by the time the
    // has_fresh_kvkk_consent probe runs here. No inline creation
    // needed anymore.

    let verified = false;
    if (bot.leadVerificationRequired && !isCalendarBookingSource) {
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
    if (isCalendarBookingSource && cleanLeadData.phone) {
      // The phone was already SMS-OTP-verified as a hard prerequisite of
      // the booking itself — see comment above `isCalendarBookingSource`.
      smsVerified = true;
    } else if (bot.smsVerificationRequired && leadData.phone) {
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

    // Legal Slice 2: non-SMS paths link the gate's consent row so every
    // lead carries its consent reference, not just SMS-verified ones.
    // The SMS branch's otpVerified row (above) still wins when present.
    if (!privacyConsentId && gateConsentId) {
      privacyConsentId = gateConsentId;
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
            // Bot's primary language (wizard v2 CustomerBots.primaryLanguage,
            // docs/WIZARD_V2.md) selects the notification locale. v1 bots
            // never set this field — null falls through to MailService's
            // 'en' fallback. Unknown locale strings also fall back to 'en'
            // inside MailService.
            await this.mailService.sendLeadNotification(
              destination.target,
              bot.botName,
              cleanLeadData,
              bot.primaryLanguage ?? 'en',
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

    void this.emitLeadAnalytics({
      teamId: bot.teamId,
      botId,
      leadId: lead.id,
      verified,
      smsVerified,
      deliveryStatus: status,
      channelsSucceeded,
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
      | 'sms_verification_invalid'
      | 'privacy_consent_required',
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

    // A team member opening/actioning the lead (NEW → READ) is the closest
    // signal we have that the lead was followed up on.
    if (dto.status === 'READ' && lead.status !== 'READ') {
      const { ownerId } = await this.mixpanel.resolveTeamOwner(teamId);
      if (ownerId) {
        this.mixpanel.track('Lead Contacted', ownerId, {
          organization_id: teamId,
          team_id: teamId,
          lead_id: dto.leadId,
        });
      }
    }

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
   * Record that a visitor accepted the Privacy Notice + Terms of Use,
   * *before* their phone number is known. `requestSmsVerification`
   * requires a fresh row here for the same (botId, chatId) before it will
   * ever send an OTP - this is the deterministic, server-verified gate; it
   * is never inferred from anything the model or the visitor typed in chat.
   *
   * Slice 3 (2026-08-20): jurisdiction-aware. When the widget sends
   * `locale` / `jurisdiction`, we persist exactly what was shown. When
   * not (legacy widget, or when Accept-Language is the only signal), we
   * resolve server-side via bot default + browser locale. The persisted
   * `country` stays NULL here — it is joined in later via
   * `bindProvisionalConsent` once the OTP phone parse gives us one.
   */
  async recordPrivacyConsent(
    dto: RecordPrivacyConsentDto,
    ipAddress: string | null,
    userAgent: string | null,
    acceptLanguage: string | null = null,
  ) {
    const bot = await this.prisma.customerBots.findUnique({
      where: { id: dto.botId, isDeleted: false },
    });

    if (!bot) {
      throw new NotFoundException('Bot not found');
    }

    // Resolve jurisdiction: DTO wins if the widget sent one; else server
    // derives from bot's configured default and the browser's locale.
    const botDefault = readBotDefaultJurisdiction(bot.settings);
    const jurisdiction: Jurisdiction =
      dto.jurisdiction ??
      resolveJurisdiction({
        botDefault,
        browserLocale: acceptLanguage,
      });
    const locale = resolveConsentLocale({
      jurisdiction,
      explicit: dto.locale ?? null,
      browserLocale: acceptLanguage,
    });

    // Try the LegalDocument admin table first (source of truth once
    // seeded), fall back to the hardcoded pack version so a bot without
    // legal-doc rows still gets an audit-quality version string.
    let legalDocumentVersionId: string | null = null;
    let privacyVersion = getConsentPack(jurisdiction, locale).version;
    try {
      // Composite slug encodes jurisdiction so KVKK/GDPR/CCPA/PDPL live
      // as sibling LegalDocuments; the pre-Slice-3 slug 'kvkk' is still
      // consulted for backward compat when the jurisdiction is 'kvkk'.
      const slug = jurisdiction === 'kvkk' ? 'kvkk' : `privacy-${jurisdiction}`;
      const published = await this.legalDocumentService.getPublished(slug, locale);
      legalDocumentVersionId = published.versionId;
      privacyVersion = `v${published.versionNumber}`;
    } catch {
      // No published version yet — hardcoded pack version is authoritative.
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
        jurisdiction,
        country: null, // filled by bindProvisionalConsent when OTP parses
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

    return {
      accepted: true,
      consentId: consent.id,
      privacyVersion: consent.privacyVersion,
      jurisdiction: consent.jurisdiction,
      locale: consent.locale,
    };
  }

  /**
   * Serve the consent-card text pack the widget needs to render before
   * the user has accepted anything. Server-side jurisdiction/locale
   * resolution mirrors `recordPrivacyConsent` so the visitor sees the
   * same pack we will later persist.
   *
   * Cache-safe: response is fully derivable from (botId, resolved
   * jurisdiction, resolved locale) — the controller sets a short
   * `Cache-Control: public, max-age=300` on top.
   */
  async getConsentText(
    botId: string,
    input: {
      explicitLocale?: string | null;
      explicitJurisdiction?: Jurisdiction | null;
      acceptLanguage?: string | null;
    },
  ) {
    const bot = await this.prisma.customerBots.findUnique({
      where: { id: botId, isDeleted: false },
      select: { id: true, teamId: true, settings: true },
    });
    if (!bot) throw new NotFoundException('Bot not found');

    const team = await this.prisma.team.findUnique({
      where: { id: bot.teamId },
      select: { businessName: true, name: true },
    });

    const botDefault = readBotDefaultJurisdiction(bot.settings);
    const jurisdiction: Jurisdiction =
      input.explicitJurisdiction ??
      resolveJurisdiction({
        botDefault,
        browserLocale: input.acceptLanguage ?? null,
      });
    const locale = resolveConsentLocale({
      jurisdiction,
      explicit: input.explicitLocale ?? null,
      browserLocale: input.acceptLanguage ?? null,
    });

    const pack = getConsentPack(jurisdiction, locale);
    // Prefer businessName (customer-set brand) → team.name (fallback) →
    // empty (renderControllerNotice substitutes a neutral phrase).
    const controllerName = team?.businessName?.trim() || team?.name?.trim() || '';
    const controllerNotice = renderControllerNotice(pack, controllerName);

    // Return the resolved pack — jurisdiction/locale echoed so the widget
    // can persist exactly what it rendered on the follow-up POST.
    return {
      botId,
      jurisdiction: pack.jurisdiction,
      locale: pack.locale,
      version: pack.version,
      title: pack.title,
      intro: pack.intro,
      controllerNotice,
      checkboxLabel: pack.checkboxLabel,
      continueButton: pack.continueButton,
      submitting: pack.submitting,
      acceptedLabel: pack.acceptedLabel,
      errorMessage: pack.errorMessage,
      privacyPolicyUrl: pack.privacyPolicyUrl,
      termsOfUseUrl: pack.termsOfUseUrl,
    };
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
    // Per-bot opt-out: when the owner collects KVKK consent out-of-band
    // (CustomerBots.kvkkConsentRequired = false), report "fresh" so every
    // downstream probe (gateway pre-agent scrub, MCP request_contact_form
    // gate) treats consent as already satisfied and skips the card. This
    // single early-return covers both callers of GET
    // /lead/kvkk-consent/:botId/:chatId.
    const bot = await this.prisma.customerBots.findUnique({
      where: { id: botId, isDeleted: false },
      select: { kvkkConsentRequired: true },
    });
    if (bot && !bot.kvkkConsentRequired) return { fresh: true };
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

    // KVKK consent gate — skipped when the bot owner opts out
    // (kvkkConsentRequired = false) and collects consent out-of-band.
    // SMS OTP verification itself still runs; only the in-widget
    // consent card requirement is relaxed. `consent` stays null in the
    // opt-out case, so the phone-backfill update further down is guarded.
    let consent: { id: string } | null = null;
    if (bot.kvkkConsentRequired) {
      const consentWindowStart = new Date(Date.now() - CONSENT_FRESHNESS_MINUTES * 60 * 1000);
      consent = await this.prisma.leadPrivacyConsent.findFirst({
        where: { botId: dto.botId, chatId: dto.chatId, createdAt: { gte: consentWindowStart } },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });

      if (!consent) {
        throw new BadRequestException({ code: 'KVKK_CONSENT_REQUIRED' });
      }
    }

    // Cross-flow SMS dedup: this phone may already have been
    // SMS-verified earlier in this same conversation, via the booking
    // flow (PerChatFlowState.verifiedPhone, see
    // ChatFlowService.getVerifiedPhoneForChat). Consent is still
    // required above (chat-scoped, not phone-scoped) — this only skips
    // a redundant OTP send once that's confirmed.
    if (dto.chatId) {
      const alreadyVerifiedPhone = await this.chatFlowService.getVerifiedPhoneForChat(
        dto.botId,
        dto.chatId,
        dto.phone,
      );
      if (alreadyVerifiedPhone) {
        const verificationToken = await this.jwt.signAsync(
          { phone: dto.phone, botId: dto.botId, kind: 'lead_sms_verification', sub: 'cross-flow-verified' },
          {
            secret: process.env.BOOKING_VERIFICATION_SECRET || process.env.JWT_SECRET,
            expiresIn: VERIFICATION_TOKEN_TTL_SECONDS,
          },
        );
        console.log(`[lead:requestSmsVerification] phone already verified this chat, skipping SMS (bot=${dto.botId} chat=${dto.chatId})`);
        return { status: 'already_verified' as const, verificationToken };
      }
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

    if (consent) {
      await this.prisma.leadPrivacyConsent.update({
        where: { id: consent.id },
        data: { phone: dto.phone },
      });
    }

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
      // Slice 3: fill in `country` on the consent row from the
      // just-verified SMS record. Only set if consent.country is still
      // null — never overwrite a value that was persisted earlier.
      await this.prisma.leadPrivacyConsent.update({
        where: { id: consent.id },
        data: {
          otpVerified: true,
          otpVerifiedAt: new Date(),
          ...(consent.country == null && record.country
            ? { country: record.country }
            : {}),
        },
      });
      // Advance LEAD flow to OTP_VERIFIED. Consent row carries the
      // chatId; verifySmsCode's own DTO doesn't (it's keyed on
      // botId + phone), so we key the transition on the consent's chat.
      await this.safeTransition(dto.botId, consent.chatId, FlowKind.LEAD, {
        from: 'OTP_SENT',
        to: 'OTP_VERIFIED',
        verifiedPhone: normalizePhoneForDedup(dto.phone),
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
