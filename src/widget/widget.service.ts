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

@Injectable()
export class WidgetService {
    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService,
        private configService: ConfigService,
        private botService: BotService,
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
}
