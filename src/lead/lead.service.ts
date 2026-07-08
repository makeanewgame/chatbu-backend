import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import { MailService } from 'src/mail/mail.service';
import { SubmitLeadDto } from './dto/submit-lead.dto';
import { ListLeadsDto } from './dto/list-leads.dto';
import { MarkLeadStatusDto } from './dto/mark-lead-status.dto';
import { RequestLeadVerificationDto } from './dto/request-lead-verification.dto';
import { VerifyLeadDto } from './dto/verify-lead.dto';
import { LeadDestination } from 'src/bot/lead-destination.constants';

const CODE_TTL_MINUTES = 5;
const VERIFICATION_TOKEN_TTL_SECONDS = 30 * 60;
const MAX_CODE_REQUESTS_PER_WINDOW = 3;
const CODE_REQUEST_WINDOW_MINUTES = 15;
const MAX_VERIFY_ATTEMPTS = 5;

type VerifyFailureReason = 'not_found' | 'expired' | 'too_many_attempts' | 'wrong_code';

@Injectable()
export class LeadService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
    private jwt: JwtService,
  ) { }

  async submit(dto: SubmitLeadDto) {
    const { botId, chatId, leadData, verificationToken } = dto;

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

    const destinations = ((bot.leadDestinations as unknown as LeadDestination[]) || []).filter(
      (d) => d.enabled,
    );

    if (destinations.length === 0) {
      const lead = await this.prisma.botLeads.create({
        data: {
          botId,
          chatId: chatId || null,
          leadData: cleanLeadData,
          channelsAttempted: [],
          channelsSucceeded: [],
          deliveryErrors: [{ channel: 'none', error: 'no_destinations_configured' }],
          status: 'NEW',
          verified,
        },
      });

      return {
        status: 'failed',
        leadId: lead.id,
        channelsAttempted: [],
        channelsSucceeded: [],
      };
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
      },
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
    reason: 'verification_required' | 'verification_invalid',
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
}
