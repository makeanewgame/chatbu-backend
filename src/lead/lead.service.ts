import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MailService } from 'src/mail/mail.service';
import { SubmitLeadDto } from './dto/submit-lead.dto';
import { ListLeadsDto } from './dto/list-leads.dto';
import { MarkLeadStatusDto } from './dto/mark-lead-status.dto';
import { LeadDestination } from 'src/bot/lead-destination.constants';

@Injectable()
export class LeadService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
  ) { }

  async submit(dto: SubmitLeadDto) {
    const { botId, chatId, leadData } = dto;

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
      },
    });

    return {
      status,
      leadId: lead.id,
      channelsAttempted,
      channelsSucceeded,
    };
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
}
