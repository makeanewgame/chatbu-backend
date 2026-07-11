import {
    ForbiddenException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { BotService } from '../bot/bot.service';
import { MinioClientService } from '../minio-client/minio-client.service';
import { MailService } from '../mail/mail.service';
import { LeadDestination } from '../bot/lead-destination.constants';
import { EventsGateway } from '../events/events.gateway';

const FEEDBACK_ANSWER_TO_RATING: Record<'yes' | 'partial' | 'no', number> = {
    yes: 5,
    partial: 3,
    no: 1,
};

@Injectable()
export class WidgetService {
    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService,
        private configService: ConfigService,
        private botService: BotService,
        private minioClientService: MinioClientService,
        private mailService: MailService,
        private eventsGateway: EventsGateway,
    ) { }

    // ---------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------

    private sha256(value: string): string {
        return createHash('sha256').update(value).digest('hex');
    }

    private extractHostname(origin?: string, referer?: string): string {
        const raw = origin || referer || '';
        if (!raw) return 'unknown';
        try {
            return new URL(raw).hostname.toLowerCase();
        } catch {
            return raw.split('/')[0].toLowerCase() || 'unknown';
        }
    }

    private isSameUtcDay(a: Date, b: Date): boolean {
        return (
            a.getUTCFullYear() === b.getUTCFullYear() &&
            a.getUTCMonth() === b.getUTCMonth() &&
            a.getUTCDate() === b.getUTCDate()
        );
    }

    // ---------------------------------------------------------------------------
    // POST /widget/session
    // ---------------------------------------------------------------------------

    async createSession(
        token: string,
        ip: string,
        userAgent: string,
        acceptLanguage: string,
        origin?: string,
        referer?: string,
    ) {
        // 1. Verify embed JWT
        let payload: any;
        try {
            payload = await this.jwtService.verifyAsync(token, {
                secret: this.configService.get('JWT_SECRET'),
            });
        } catch {
            throw new UnauthorizedException('Invalid or expired embed token');
        }
        if (payload.type !== 'embed') {
            throw new UnauthorizedException('Invalid token type');
        }
        const botId: string = payload.botId;

        // 2. Bot must exist and be active
        const bot = await this.prisma.customerBots.findUnique({
            where: { id: botId, isDeleted: false },
            select: { id: true, teamId: true, active: true, settings: true },
        });
        if (!bot) throw new ForbiddenException('Bot not found');
        if (!bot.active) throw new ForbiddenException('Bot is not active');

        // 3. Domain whitelist check (skip if allowedDomains is empty → open access)
        const hostname = this.extractHostname(origin, referer);
        const settings: any = bot.settings || {};
        const allowedDomains: string[] = settings.allowedDomains || [];
        if (allowedDomains.length > 0) {
            const isAllowed = allowedDomains.some((d: string) => {
                const nd = d.toLowerCase();
                return hostname === nd || hostname.endsWith(`.${nd}`);
            });
            if (!isAllowed) throw new ForbiddenException('Domain not allowed');
        }

        // 4. Build server-side fingerprint — this is the authoritative visitor identity.
        //    Clients cannot spoof it by clearing localStorage because it is computed
        //    entirely from HTTP headers on the server.
        const normalizedIp = ip === '::1' ? '127.0.0.1' : ip;
        const fingerprintRaw = `${normalizedIp}|${userAgent}|${acceptLanguage}|${botId}`;
        const fingerprintHash = this.sha256(fingerprintRaw);
        const ipHash = this.sha256(normalizedIp);
        const userAgentHash = this.sha256(userAgent);

        // 5. Lookup or create the WidgetVisitor record
        let visitor = await this.prisma.widgetVisitor.findFirst({
            where: { fingerprintHash, chatbotId: botId },
        });

        if (!visitor) {
            visitor = await this.prisma.widgetVisitor.create({
                data: {
                    visitorId: randomUUID(),
                    chatbotId: botId,
                    domain: hostname,
                    fingerprintHash,
                    ipHash,
                    userAgentHash,
                },
            });
        } else {
            // Refresh mutable fields (IP or UA may change legitimately, e.g. VPN rotation)
            await this.prisma.widgetVisitor.update({
                where: { id: visitor.id },
                data: { ipHash, userAgentHash, domain: hostname },
            });
        }

        // 6. Block check after create/update
        if (visitor.isBlocked) {
            throw new ForbiddenException('Access denied');
        }

        // 7. Issue a short-lived session token (2 h).  The client stores the
        //    visitorId in localStorage and re-calls this endpoint to get a fresh
        //    sessionToken — it cannot forge a different visitorId because the
        //    fingerprint on the server always resolves the canonical record.
        const sessionToken = await this.jwtService.signAsync(
            {
                visitorId: visitor.visitorId,
                botId,
                teamId: bot.teamId,
                type: 'widget-session',
            },
            {
                secret: this.configService.get('JWT_SECRET'),
                expiresIn: '2h',
            },
        );

        return { visitorId: visitor.visitorId, sessionToken };
    }

    // ---------------------------------------------------------------------------
    // POST /widget/chat
    // ---------------------------------------------------------------------------

    async chat(
        sessionToken: string,
        message: string,
        chatId: string | undefined,
        ip: string,
        attachments?: any[],
    ) {
        // 1. Verify session token
        let payload: any;
        try {
            payload = await this.jwtService.verifyAsync(sessionToken, {
                secret: this.configService.get('JWT_SECRET'),
            });
        } catch {
            throw new UnauthorizedException('Session expired');
        }
        if (payload.type !== 'widget-session') {
            throw new UnauthorizedException('Invalid session token type');
        }

        const { visitorId, botId, teamId } = payload;

        // 2. Load visitor record
        const visitor = await this.prisma.widgetVisitor.findUnique({
            where: { visitorId },
        });
        if (!visitor) throw new UnauthorizedException('Visitor not found');
        if (visitor.isBlocked) throw new ForbiddenException('Access denied');

        // 3. Inline daily counter reset if the calendar day has rolled over
        const now = new Date();
        const needsReset = !this.isSameUtcDay(visitor.dailyResetAt, now);
        const messageCountToday = needsReset ? 0 : visitor.messageCountToday;
        const tokenUsageToday = needsReset ? 0 : visitor.tokenUsageToday;
        const currentRiskScore = needsReset ? 0 : visitor.riskScore;

        // 4. Per-bot daily limits (configured in bot settings JSON)
        const bot = await this.prisma.customerBots.findUnique({
            where: { id: botId, isDeleted: false },
            select: { active: true, settings: true },
        });
        if (!bot || !bot.active) throw new ForbiddenException('Bot is not active');

        const botSettings: any = bot.settings || {};
        const maxMessagesPerDay: number = botSettings.maxMessagesPerDay ?? 50;
        const maxTokensPerDay: number = botSettings.maxTokensPerDay ?? 10000;

        if (messageCountToday >= maxMessagesPerDay) {
            throw new ForbiddenException('Daily message limit reached');
        }
        if (tokenUsageToday >= maxTokensPerDay) {
            throw new ForbiddenException('Daily token limit reached');
        }

        // 5. Delegate to the existing chat pipeline
        const normalizedIp = ip === '::1' ? '127.0.0.1' : ip;
        const result = await this.botService.publicChatInternal(
            botId,
            teamId,
            message,
            chatId,
            normalizedIp,
            attachments,
        );

        // 6. Update visitor counters and risk score
        const tokensUsed: number = result?.tokens?.total_tokens ?? 0;
        const newMessageCount = messageCountToday + 1;
        const newTokenCount = tokenUsageToday + tokensUsed;

        // Risk scoring: accumulate points for suspicious patterns
        let riskDelta = 0;
        if (message.length > 1500) riskDelta += 5;                              // Very long message
        if (newMessageCount > maxMessagesPerDay * 0.8) riskDelta += 10;        // Approaching daily limit
        if (newMessageCount > maxMessagesPerDay * 0.9) riskDelta += 20;        // Near limit

        const newRiskScore = Math.min(100, currentRiskScore + riskDelta);
        const shouldBlock = newRiskScore >= 80;

        await this.prisma.widgetVisitor.update({
            where: { id: visitor.id },
            data: {
                messageCountToday: newMessageCount,
                tokenUsageToday: newTokenCount,
                riskScore: newRiskScore,
                ...(needsReset ? { dailyResetAt: now } : {}),
                ...(shouldBlock
                    ? { isBlocked: true, blockedReason: 'Auto-blocked: risk threshold exceeded' }
                    : {}),
            },
        });

        return result;
    }

    // ---------------------------------------------------------------------------
    // Auto-close inactive bot chats — runs every minute
    // Closes BOT_ACTIVE chats that have had no activity for 10+ minutes.
    // Agent-assigned chats (HUMAN_ASSIGNED, HUMAN_ACTIVE) are excluded and
    // must be closed manually by the agent.
    // ---------------------------------------------------------------------------

    @Cron('* * * * *')
    async autoCloseInactiveBotChats() {
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        const chatsToClose = await this.prisma.customerChats.findMany({
            where: {
                chatStatus: 'BOT_ACTIVE',
                isDeleted: false,
                updatedAt: { lt: tenMinutesAgo },
            },
            select: { id: true, chatId: true },
        });

        if (chatsToClose.length === 0) {
            return;
        }

        await this.prisma.customerChats.updateMany({
            where: { id: { in: chatsToClose.map((c) => c.id) } },
            data: {
                chatStatus: 'CLOSED',
            },
        });

        for (const chat of chatsToClose) {
            this.eventsGateway.notifyChatEnded(chat.id, { chatId: chat.id, reason: 'auto_closed_inactivity' });
            this.eventsGateway.notifyChatEnded(chat.chatId, { chatId: chat.chatId, reason: 'auto_closed_inactivity' });
        }
    }

    // ---------------------------------------------------------------------------
    // POST /widget/feedback
    // Two shapes are accepted on the same endpoint so older embedded widgets
    // keep working during a rolling deploy:
    //   - legacy: { rating: 1-5 }
    //   - current: { answer: 'yes' | 'partial' | 'no', comment? }
    // `answer` submissions are audited in ChatFeedback and, when the visitor
    // was not fully satisfied (partial/no), forwarded to the bot's configured
    // lead-destination email(s) — the same "notification destinations" used
    // by lead capture.
    // ---------------------------------------------------------------------------

    async submitFeedback(
        sessionToken: string,
        chatId: string,
        rating?: number,
        answer?: 'yes' | 'partial' | 'no',
        comment?: string,
    ) {
        // 1. Verify session token
        let payload: any;
        try {
            payload = await this.jwtService.verifyAsync(sessionToken, {
                secret: this.configService.get('JWT_SECRET'),
            });
        } catch {
            throw new UnauthorizedException('Session expired');
        }
        if (payload.type !== 'widget-session') {
            throw new UnauthorizedException('Invalid session token type');
        }

        const { botId, teamId } = payload;
        return this.recordFeedback(botId, teamId, chatId, rating, answer, comment);
    }

    // ---------------------------------------------------------------------------
    // Same feedback flow as submitFeedback above, for the dashboard's own
    // internal "test your chatbot" panel (ChatForm.tsx, /bot/chat — an
    // authenticated dashboard user, not a widget visitor with a sessionToken).
    // Trusts botId/teamId straight from the authenticated request the same
    // way BotController#chat already does.
    // ---------------------------------------------------------------------------
    async submitFeedbackAuthenticated(
        botId: string,
        teamId: string,
        chatId: string,
        answer: 'yes' | 'partial' | 'no',
        comment?: string,
    ) {
        return this.recordFeedback(botId, teamId, chatId, undefined, answer, comment);
    }

    private async recordFeedback(
        botId: string,
        teamId: string,
        chatId: string,
        rating?: number,
        answer?: 'yes' | 'partial' | 'no',
        comment?: string,
    ) {
        // 2. Resolve the 1-5 rating from either shape
        let resolvedRating: number;
        if (answer !== undefined) {
            if (!(answer in FEEDBACK_ANSWER_TO_RATING)) {
                throw new UnauthorizedException('Invalid feedback answer');
            }
            resolvedRating = FEEDBACK_ANSWER_TO_RATING[answer];
        } else if (rating !== undefined) {
            resolvedRating = Math.round(rating);
            if (resolvedRating < 1 || resolvedRating > 5) {
                throw new UnauthorizedException('Rating must be between 1 and 5');
            }
        } else {
            throw new UnauthorizedException('rating or answer is required');
        }

        // 3. Update the chat record — only if it belongs to the verified bot/team.
        // Any conversation that received feedback is considered concluded,
        // regardless of which trigger opened the feedback panel — mark it CLOSED.
        await this.prisma.customerChats.updateMany({
            where: { chatId, teamId, isDeleted: false },
            data: { feedbackRating: resolvedRating, chatStatus: 'CLOSED' },
        });

        if (answer === undefined) {
            return { ok: true };
        }

        const dbAnswer = answer.toUpperCase() as 'YES' | 'PARTIAL' | 'NO';
        const trimmedComment = comment?.trim() || undefined;

        if (dbAnswer === 'YES') {
            await this.prisma.chatFeedback.create({
                data: { botId, chatId, answer: dbAnswer, comment: trimmedComment },
            });
            return { ok: true };
        }

        // 4. Not fully satisfied — notify the bot's enabled email destinations
        const bot = await this.prisma.customerBots.findUnique({
            where: { id: botId, isDeleted: false },
            select: { botName: true, leadDestinations: true },
        });

        const destinations = bot
            ? ((bot.leadDestinations as unknown as LeadDestination[]) || []).filter((d) => d.enabled)
            : [];

        const channelsAttempted: string[] = [];
        const channelsSucceeded: string[] = [];
        const deliveryErrors: { channel: string; error: string; target?: string }[] = [];

        await Promise.all(
            destinations.map(async (destination) => {
                channelsAttempted.push(destination.channel);
                try {
                    if (destination.channel === 'email') {
                        await this.mailService.sendNegativeFeedbackNotification(
                            destination.target,
                            bot.botName,
                            { answer: dbAnswer, comment: trimmedComment },
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

        await this.prisma.chatFeedback.create({
            data: {
                botId,
                chatId,
                answer: dbAnswer,
                comment: trimmedComment,
                channelsAttempted,
                channelsSucceeded,
                deliveryErrors: deliveryErrors.length > 0 ? deliveryErrors : null,
            },
        });

        return { ok: true };
    }

    // ---------------------------------------------------------------------------
    // Scheduled reset — runs at 00:00 UTC every day
    // The inline per-request reset handles cases where the cron was missed.
    // ---------------------------------------------------------------------------

    @Cron('0 0 * * *')
    async resetDailyVisitorStats() {
        await this.prisma.widgetVisitor.updateMany({
            data: {
                messageCountToday: 0,
                tokenUsageToday: 0,
                riskScore: 0,
                dailyResetAt: new Date(),
            },
        });
    }

    // ---------------------------------------------------------------------------
    // POST /widget/uploadAttachment
    // ---------------------------------------------------------------------------

    async uploadAttachment(
        sessionToken: string,
        file: Express.Multer.File,
    ) {
        // 1. Verify session token
        let payload: any;
        try {
            payload = await this.jwtService.verifyAsync(sessionToken, {
                secret: this.configService.get('JWT_SECRET'),
            });
        } catch {
            throw new UnauthorizedException('Session expired');
        }
        if (payload.type !== 'widget-session') {
            throw new UnauthorizedException('Invalid session token type');
        }

        const { botId, teamId } = payload;

        // 2. Verify visitor exists and is not blocked
        const visitor = await this.prisma.widgetVisitor.findUnique({
            where: { visitorId: payload.visitorId },
        });
        if (!visitor) throw new UnauthorizedException('Visitor not found');
        if (visitor.isBlocked) throw new ForbiddenException('Access denied');

        // 3. Quota check against team's file quota
        const existingQuota = await this.prisma.team.findFirst({
            where: {
                id: teamId,
                Quota: { some: { quotaType: 'FILE' } },
            },
            include: {
                Quota: { where: { quotaType: 'FILE' } },
            },
        });

        if (!existingQuota || !existingQuota.Quota[0]) {
            throw new ForbiddenException('Storage quota not configured');
        }

        const fileKb = Math.ceil(file.size / 1024);
        if (existingQuota.Quota[0].used + fileKb > existingQuota.Quota[0].limit) {
            const limitMb = (existingQuota.Quota[0].limit / 1024).toFixed(1);
            const usedMb = (existingQuota.Quota[0].used / 1024).toFixed(1);
            return {
                message: `Storage quota exceeded. ${usedMb} MB / ${limitMb} MB used.`,
                quotaExceeded: true,
            };
        }

        // 4. Upload to MinIO under users_upload/
        const bucket = this.configService.get('S3_BUCKET_NAME');
        const { objectPath, presignedUrl } = await this.minioClientService.uploadChatAttachment(file, bucket, botId);

        const { createHash: nodeCreateHash } = await import('crypto');
        const fileHash = nodeCreateHash('sha256').update(file.buffer).digest('hex');

        // 5. Save to Storage with source='chat_upload'
        const storage = await this.prisma.storage.create({
            data: {
                teamId,
                botId,
                fileUrl: objectPath,
                type: file.mimetype,
                size: file.size.toString(),
                status: 'UPLOADED',
                ingestionInfo: {},
                taskId: '',
                fileName: file.originalname,
                fileHash,
                source: 'chat_upload',
            },
        });

        // 6. Deduct quota
        await this.prisma.quota.update({
            where: { teamId_quotaType: { teamId, quotaType: 'FILE' } },
            data: { used: { increment: fileKb } },
        });

        return {
            storageId: storage.id,
            objectPath,
            presignedUrl,
            fileName: file.originalname,
            fileType: file.mimetype,
            size: file.size,
        };
    }
}
