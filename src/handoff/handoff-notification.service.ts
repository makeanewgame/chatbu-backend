import { Inject, Injectable } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { PrismaService } from 'src/prisma/prisma.service';
import { EventsGateway } from 'src/events/events.gateway';
import { MailService } from 'src/mail/mail.service';
import { PushNotificationService } from 'src/push-notification/push-notification.service';

export interface HandoffNotifyParams {
    /** CustomerChats.id (the internal row id, not the public chatId) */
    chatRowId: string;
    /** The user the chat has actually been assigned to */
    agentUserId: string;
    /** Display name of the bot the visitor was talking to */
    botName: string;
    /**
     * Wizard v2 `CustomerBots.primaryLanguage`. Drives the owner-facing
     * email locale (8 supported: en/tr/de/es/fr/it/ru/ar). Unlisted /
     * omitted → English fallback in MailService. When absent the email
     * still ships; only the language default changes.
     */
    botPrimaryLanguage?: string | null;
}

/**
 * Single place that decides WHO gets told about a live-chat handover and
 * fans the "this chat is now yours" event out across every channel the
 * agent might be reachable on: live socket, mobile push, email.
 *
 * Previously this logic was copy-pasted into three call sites (batch
 * chat, streaming chat, manual dashboard handover) and each copy had
 * drifted — the streaming path never sent push, the manual path sent
 * nothing at all. Everything now routes through here.
 */
@Injectable()
export class HandoffNotificationService {
    constructor(
        private prisma: PrismaService,
        private eventsGateway: EventsGateway,
        private mailService: MailService,
        private pushNotificationService: PushNotificationService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) { }

    /**
     * The agent a handover should land on.
     *
     * Team-wide round-robin: every active member with `canLiveChat = true`
     * is in the rotation. We order the pool by `TeamMember.createdAt` and
     * pick the member right after `Team.lastLiveChatAgentId` (the cursor
     * updated by {@link recordLiveChatAssignment} after each assignment),
     * wrapping around — so consecutive handoffs land on A → B → C → A …
     *
     * When nobody is flagged we fall back, in order, to
     * `Team.defaultLiveChatAgentId` → the bot's legacy
     * `settings.defaultAgentId` → the team owner. This keeps brand-new
     * accounts (and accounts that never opened Team Settings) working.
     */
    async resolveAssigneeId(
        teamId: string,
        botSettings: unknown,
    ): Promise<string | null> {
        const team = await this.prisma.team.findUnique({
            where: { id: teamId },
            select: {
                ownerId: true,
                defaultLiveChatAgentId: true,
                lastLiveChatAgentId: true,
            },
        });

        const pool = await this.prisma.teamMember.findMany({
            where: {
                teamId,
                status: 'active',
                canLiveChat: true,
                userId: { not: null },
            },
            select: { userId: true },
            orderBy: { createdAt: 'asc' },
        });
        const poolIds = pool
            .map((m) => m.userId)
            .filter((id): id is string => !!id);

        if (poolIds.length > 0) {
            const lastIdx = team?.lastLiveChatAgentId
                ? poolIds.indexOf(team.lastLiveChatAgentId)
                : -1;
            // lastIdx === -1 (cursor unset or no longer in the pool) → start at 0
            return poolIds[(lastIdx + 1) % poolIds.length];
        }

        const legacy = (botSettings as { defaultAgentId?: string } | null)
            ?.defaultAgentId;
        return team?.defaultLiveChatAgentId ?? legacy ?? team?.ownerId ?? null;
    }

    /**
     * Advance the team's round-robin cursor after a successful auto-handoff
     * assignment. Best-effort: a failure here only means the next handoff
     * may repeat the same agent, so it must never derail the flow.
     */
    async recordLiveChatAssignment(
        teamId: string,
        agentUserId: string,
    ): Promise<void> {
        try {
            await this.prisma.team.update({
                where: { id: teamId },
                data: { lastLiveChatAgentId: agentUserId },
            });
        } catch (err) {
            this.logger.error(
                `[handoff] failed to advance round-robin cursor for team ${teamId}: ${err}`,
            );
        }
    }

    /**
     * Guard against a stale `defaultAgentId` (or owner id) that no longer
     * belongs to the team — e.g. a member who was removed after being set
     * as the default agent.
     */
    async isValidAssignee(teamId: string, agentUserId: string): Promise<boolean> {
        const team = await this.prisma.team.findUnique({
            where: { id: teamId },
            select: { ownerId: true },
        });
        if (team?.ownerId === agentUserId) return true;

        const member = await this.prisma.teamMember.findFirst({
            where: { teamId, userId: agentUserId, status: 'active' },
            select: { id: true },
        });
        return !!member;
    }

    /**
     * Best-effort fan-out. Each channel is isolated in its own try/catch
     * so one failing (no push token, SMTP down, socket not connected)
     * never blocks the others.
     */
    async notifyAssignee(params: HandoffNotifyParams): Promise<void> {
        const { chatRowId, agentUserId, botName, botPrimaryLanguage } = params;
        const sessionLink = `${process.env.FRONTEND_URL}/live-chat/${chatRowId}`;

        // 1. Live socket — agent panel / mobile app if currently connected
        try {
            this.eventsGateway.notifyAgent(agentUserId, {
                chatId: chatRowId,
                type: 'handoff',
                message: 'New live chat conversation assigned to you.',
            });
            this.eventsGateway.notifyHandoffRequested(agentUserId, {
                chatId: chatRowId,
                botName,
                sessionLink,
            });
        } catch (err) {
            this.logger.error(
                `[handoff] socket notify failed for agent ${agentUserId}: ${err}`,
            );
        }

        // 2. Mobile push
        try {
            await this.pushNotificationService.sendToUser(agentUserId, {
                title: 'Yeni canlı sohbet',
                body: `${botName} bir görüşmeyi size aktardı.`,
                data: { type: 'handoff_requested', chatId: chatRowId },
            });
        } catch (err) {
            this.logger.error(
                `[handoff] push notify failed for agent ${agentUserId}: ${err}`,
            );
        }

        // 3. Email — locale from bot.primaryLanguage (owner-facing), NOT
        // visitor's detectedLanguage. Owner reads the language they set
        // for their bot; a French visitor doesn't mean the Turkish owner
        // wants a French notification. MailService's registry falls back
        // to English for unlisted / omitted locales.
        try {
            const agent = await this.prisma.user.findUnique({
                where: { id: agentUserId },
                select: { email: true },
            });
            if (agent?.email) {
                await this.mailService.sendHandoffNotification(
                    agent.email,
                    botName,
                    sessionLink,
                    botPrimaryLanguage ?? 'en',
                );
            }
        } catch (err) {
            this.logger.error(
                `[handoff] email notify failed for agent ${agentUserId}: ${err}`,
            );
        }
    }
}
