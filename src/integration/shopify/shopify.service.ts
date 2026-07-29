import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import { BotService } from 'src/bot/bot.service';

const CODE_TTL_MINUTES = 5;
const ACCESS_TOKEN_TTL = '90d';

@Injectable()
export class ShopifyService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwt: JwtService,
        private readonly config: ConfigService,
        private readonly botService: BotService,
    ) { }

    private hashCode(code: string) {
        return createHash('sha256').update(code).digest('hex');
    }

    /**
     * Called by the dashboard consent screen (chatbu-frontend, AccessTokenGuard-authenticated)
     * once the merchant approves. Mints a one-time code the Shopify app exchanges server-to-server.
     */
    async createAuthorizationCode(teamId: string, userId: string, redirectUri: string) {
        // SHOPIFY_APP_CALLBACK_URL only needs to be the bare app domain (whatever
        // `shopify app dev` prints each run) — only the origin is trusted here,
        // the callback path is always fixed at /chatbu-callback regardless of
        // whether a path happens to be included in the env value too.
        const allowedOrigin = this.config.get<string>('SHOPIFY_APP_CALLBACK_URL');
        let parsedRedirect: URL;
        let parsedAllowed: URL;
        try {
            parsedRedirect = new URL(redirectUri);
            parsedAllowed = new URL(allowedOrigin || '');
        } catch {
            throw new UnauthorizedException('Unknown redirect_uri');
        }
        if (
            parsedRedirect.origin !== parsedAllowed.origin ||
            parsedRedirect.pathname !== '/chatbu-callback'
        ) {
            throw new UnauthorizedException('Unknown redirect_uri');
        }

        const code = randomBytes(32).toString('hex');
        await this.prisma.shopifyAuthCode.create({
            data: {
                codeHash: this.hashCode(code),
                teamId,
                userId,
                redirectUri,
                expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000),
            },
        });

        return { code };
    }

    /**
     * Called server-to-server by the Shopify app backend (ShopifyClientSecretGuard) to
     * redeem a one-time code for a long-lived, narrowly-scoped 'shopify' access token.
     */
    async exchangeCodeForToken(code: string) {
        const record = await this.prisma.shopifyAuthCode.findFirst({
            where: {
                codeHash: this.hashCode(code),
                usedAt: null,
                expiresAt: { gt: new Date() },
            },
            orderBy: { createdAt: 'desc' },
        });

        if (!record) {
            throw new UnauthorizedException('Invalid or expired code');
        }

        await this.prisma.shopifyAuthCode.update({
            where: { id: record.id },
            data: { usedAt: new Date() },
        });

        const accessToken = await this.jwt.signAsync(
            { teamId: record.teamId, type: 'shopify' },
            { expiresIn: ACCESS_TOKEN_TTL, secret: this.config.get('JWT_SECRET') },
        );

        return { accessToken, teamId: record.teamId };
    }

    /** GET /integration/shopify/bots — reuses BotService, no duplicated query logic. */
    listBots(teamId: string) {
        return this.botService.listBots(teamId);
    }

    /** POST /integration/shopify/complete — records which bot+shop the team connected. */
    async completeConnection(teamId: string, botId: string, shop: string) {
        const existing = await this.prisma.integrations.findFirst({
            where: { teamId, type: 'shopify' },
        });

        if (existing) {
            return this.prisma.integrations.update({
                where: { id: existing.id },
                data: { botId, config: { shop } },
            });
        }

        return this.prisma.integrations.create({
            data: { teamId, botId, type: 'shopify', config: { shop } },
        });
    }

    /** GET /integration/shopify/status — for the chatbu-frontend Integrations page card. */
    async getStatus(teamId: string) {
        const integration = await this.prisma.integrations.findFirst({
            where: { teamId, type: 'shopify' },
        });

        if (!integration) {
            return { connected: false as const };
        }

        return {
            connected: true as const,
            botId: integration.botId,
            shop: (integration.config as { shop?: string } | null)?.shop ?? null,
        };
    }

    /** Shared cleanup for both dashboard-initiated disconnect and the uninstall webhook. */
    async disconnect(teamId: string) {
        await this.prisma.integrations.deleteMany({
            where: { teamId, type: 'shopify' },
        });
        return { disconnected: true };
    }
}
