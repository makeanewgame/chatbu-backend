import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from 'src/prisma/prisma.service';
import { CompleteMetaConnectionDto } from './dto/complete-meta-connection.dto';

export const META_MESSENGER_EMBEDDED_TYPE = 'metabusiness_embedded';
export const META_INSTAGRAM_EMBEDDED_TYPE = 'instagram_embedded';
const GRAPH_BASE = 'https://graph.facebook.com/v23.0';

type MetaPage = {
    pageId: string;
    pageName: string;
    pageAccessToken: string;
    instagramAccountId?: string;
    instagramUsername?: string;
};

@Injectable()
export class MetaEmbeddedService {
    private readonly logger = new Logger(MetaEmbeddedService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService,
    ) { }

    /**
     * Exchange the Facebook Login for Business authorization code for the list of
     * Pages (and their linked Instagram professional accounts) the user granted access to.
     * Nothing is persisted here — the frontend lets the user pick which channels to enable.
     */
    async exchangeCode(chatbotId: string, authorizationCode: string): Promise<{ pages: MetaPage[]; fbUserId?: string }> {
        const appId = this.configService.get<string>('META_APP_ID');
        const appSecret = this.configService.get<string>('META_APP_SECRET');

        if (!appId || !appSecret) {
            throw new BadRequestException('META_APP_ID and META_APP_SECRET must be configured on the server');
        }

        // ── Step 1: Exchange authorization code → user access token ──
        // Facebook Login for Business docs: GET /oauth/access_token?client_id=&client_secret=&code=
        // No redirect_uri — the JS SDK popup flow encodes it internally.
        let userToken: string;
        try {
            const tokenRes = await axios.get<{ access_token: string }>(
                `${GRAPH_BASE}/oauth/access_token`,
                {
                    params: {
                        client_id: appId,
                        client_secret: appSecret,
                        code: authorizationCode,
                    },
                },
            );
            userToken = tokenRes.data.access_token;
        } catch (err: any) {
            this.logger.error('Meta code exchange failed', err?.response?.data ?? err?.message);
            throw new BadRequestException('Failed to exchange Meta authorization code');
        }

        // ── Step 2: Exchange for a long-lived user token so derived Page tokens don't expire ──
        // Non-fatal: some Business Login configurations already return a long-lived token.
        try {
            const longLivedRes = await axios.get<{ access_token: string }>(
                `${GRAPH_BASE}/oauth/access_token`,
                {
                    params: {
                        grant_type: 'fb_exchange_token',
                        client_id: appId,
                        client_secret: appSecret,
                        fb_exchange_token: userToken,
                    },
                },
            );
            userToken = longLivedRes.data.access_token || userToken;
        } catch (err: any) {
            this.logger.warn('Long-lived token exchange failed, continuing with original token', err?.response?.data ?? err?.message);
        }

        // ── Step 3: List the Pages granted during login, with linked Instagram accounts ──
        let pages: MetaPage[] = [];
        try {
            const accountsRes = await axios.get<{
                data: Array<{
                    id: string;
                    name: string;
                    access_token: string;
                    instagram_business_account?: { id: string; username?: string };
                }>;
            }>(`${GRAPH_BASE}/me/accounts`, {
                params: {
                    fields: 'id,name,access_token,instagram_business_account{id,username}',
                    access_token: userToken,
                },
            });

            pages = (accountsRes.data.data || []).map((page) => ({
                pageId: page.id,
                pageName: page.name,
                pageAccessToken: page.access_token,
                instagramAccountId: page.instagram_business_account?.id,
                instagramUsername: page.instagram_business_account?.username,
            }));
        } catch (err: any) {
            this.logger.error('Failed to list Facebook Pages', err?.response?.data ?? err?.message);
            throw new BadRequestException('Failed to list Facebook Pages for this account');
        }

        // Resolve the connecting Facebook user's ID so that a later Meta deauthorize/data-deletion
        // callback (keyed by that same user_id) can find and remove the integrations it created.
        let fbUserId: string | undefined;
        try {
            const meRes = await axios.get<{ id: string }>(`${GRAPH_BASE}/me`, {
                params: { access_token: userToken, fields: 'id' },
            });
            fbUserId = meRes.data.id;
        } catch (err: any) {
            this.logger.warn('Could not resolve Facebook user id for this connection', err?.response?.data ?? err?.message);
        }

        this.logger.log(`Meta code exchange complete | chatbotId=${chatbotId} | pages=${pages.length}`);

        return { pages, fbUserId };
    }

    /**
     * Subscribe the app to the selected Page's webhooks and persist the requested channels.
     */
    async completeConnection(teamId: string, dto: CompleteMetaConnectionDto) {
        const { chatbotId, pageId, pageName, pageAccessToken, enableMessenger, enableInstagram, instagramAccountId, instagramUsername, fbUserId } = dto;

        if (!enableMessenger && !enableInstagram) {
            throw new BadRequestException('At least one of enableMessenger or enableInstagram must be true');
        }
        if (enableInstagram && !instagramAccountId) {
            throw new BadRequestException('instagramAccountId is required when enableInstagram is true');
        }

        // Subscribe our app to this Page's webhooks (covers both Messenger and, when linked, Instagram).
        try {
            await axios.post(
                `${GRAPH_BASE}/${pageId}/subscribed_apps`,
                null,
                {
                    params: {
                        subscribed_fields: 'messages,messaging_postbacks,messaging_optins,message_deliveries,messaging_referrals,message_reactions',
                    },
                    headers: { Authorization: `Bearer ${pageAccessToken}` },
                },
            );
            this.logger.log(`Subscribed to Page webhooks | pageId=${pageId}`);
        } catch (err: any) {
            // Non-fatal: subscription can be retried later.
            this.logger.warn('Failed to subscribe to Page webhooks', err?.response?.data ?? err?.message);
        }

        const connectedAt = new Date().toISOString();
        const result: { success: boolean; messenger?: any; instagram?: any } = { success: true };

        if (enableMessenger) {
            const config = {
                botId: chatbotId,
                connectionType: 'embedded',
                pageId,
                pageName,
                pageAccessToken,
                fbUserId,
                status: 'connected',
                connectedAt,
            };
            await this.upsertIntegration(teamId, META_MESSENGER_EMBEDDED_TYPE, chatbotId, pageId, config);
            result.messenger = { pageId, pageName, connectedAt };
        }

        if (enableInstagram) {
            const config = {
                botId: chatbotId,
                connectionType: 'embedded',
                pageId,
                instagramAccountId,
                instagramUsername,
                pageAccessToken,
                fbUserId,
                status: 'connected',
                connectedAt,
            };
            await this.upsertIntegration(teamId, META_INSTAGRAM_EMBEDDED_TYPE, chatbotId, pageId, config);
            result.instagram = { pageId, instagramAccountId, instagramUsername, connectedAt };
        }

        this.logger.log(
            `Meta Embedded connection complete | teamId=${teamId} | chatbotId=${chatbotId}` +
            ` | pageId=${pageId} | messenger=${enableMessenger} | instagram=${enableInstagram}`,
        );

        return result;
    }

    private async upsertIntegration(teamId: string, type: string, chatbotId: string, pageId: string, config: Record<string, any>) {
        const existing = await this.prisma.integrations.findFirst({
            where: {
                teamId,
                type,
                config: { path: ['botId'], equals: chatbotId },
            },
        });

        if (existing) {
            await this.prisma.integrations.update({
                where: { id: existing.id },
                data: { botId: chatbotId, config },
            });
        } else {
            await this.prisma.integrations.create({
                data: { teamId, botId: chatbotId, type, config },
            });
        }
    }

    /**
     * Return the current Messenger + Instagram embedded connection status for a chatbot.
     */
    async getStatus(teamId: string, chatbotId: string) {
        const [messengerRow, instagramRow] = await Promise.all([
            this.prisma.integrations.findFirst({
                where: { teamId, type: META_MESSENGER_EMBEDDED_TYPE, config: { path: ['botId'], equals: chatbotId } },
            }),
            this.prisma.integrations.findFirst({
                where: { teamId, type: META_INSTAGRAM_EMBEDDED_TYPE, config: { path: ['botId'], equals: chatbotId } },
            }),
        ]);

        const messengerCfg = messengerRow?.config as any;
        const instagramCfg = instagramRow?.config as any;

        return {
            messenger: messengerCfg?.status === 'connected'
                ? { connected: true, pageName: messengerCfg.pageName, pageId: messengerCfg.pageId, connectedAt: messengerCfg.connectedAt }
                : null,
            instagram: instagramCfg?.status === 'connected'
                ? {
                    connected: true,
                    instagramUsername: instagramCfg.instagramUsername,
                    instagramAccountId: instagramCfg.instagramAccountId,
                    pageId: instagramCfg.pageId,
                    connectedAt: instagramCfg.connectedAt,
                }
                : null,
        };
    }

    /**
     * Disconnect a single channel (messenger or instagram) for a chatbot.
     */
    async disconnectChannel(teamId: string, chatbotId: string, channel: 'messenger' | 'instagram') {
        const type = channel === 'messenger' ? META_MESSENGER_EMBEDDED_TYPE : META_INSTAGRAM_EMBEDDED_TYPE;

        const row = await this.prisma.integrations.findFirst({
            where: { teamId, type, config: { path: ['botId'], equals: chatbotId } },
        });

        if (!row) {
            throw new NotFoundException(`No ${channel} integration found for this chatbot`);
        }

        const cfg = row.config as any;
        try {
            await axios.delete(`${GRAPH_BASE}/${cfg.pageId}/subscribed_apps`, {
                headers: { Authorization: `Bearer ${cfg.pageAccessToken}` },
            });
        } catch (err: any) {
            // Non-fatal: the Page may already be unsubscribed, or shared with the other channel.
            this.logger.warn(`Failed to unsubscribe Page webhooks for ${channel}`, err?.response?.data ?? err?.message);
        }

        await this.prisma.integrations.delete({ where: { id: row.id } });
        this.logger.log(`Meta ${channel} integration disconnected | teamId=${teamId} | chatbotId=${chatbotId}`);
        return { success: true };
    }

    /**
     * Removes all Messenger/Instagram embedded integrations created by a given Facebook user.
     * Called from the Meta deauthorize and data-deletion callbacks — `fbUserId` is the
     * `user_id` Meta reports in the signed_request for whoever connected the integration.
     * Best-effort unsubscribes each Page from our app's webhooks before deleting the row.
     */
    async deleteByFbUserId(fbUserId: string): Promise<number> {
        const rows = await this.prisma.integrations.findMany({
            where: {
                type: { in: [META_MESSENGER_EMBEDDED_TYPE, META_INSTAGRAM_EMBEDDED_TYPE] },
                config: { path: ['fbUserId'], equals: fbUserId },
            },
        });

        for (const row of rows) {
            const cfg = row.config as any;
            try {
                await axios.delete(`${GRAPH_BASE}/${cfg.pageId}/subscribed_apps`, {
                    headers: { Authorization: `Bearer ${cfg.pageAccessToken}` },
                });
            } catch (err: any) {
                this.logger.warn(`Failed to unsubscribe Page webhooks while deleting for fbUserId=${fbUserId}`, err?.response?.data ?? err?.message);
            }
        }

        if (rows.length > 0) {
            await this.prisma.integrations.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
        }

        this.logger.log(`Deleted ${rows.length} Meta embedded integration(s) for fbUserId=${fbUserId}`);
        return rows.length;
    }

    /**
     * Internal: look up a connected Messenger integration by Page ID for webhook routing.
     * Falls back to the legacy manual 'metabusiness' integration for backward compatibility.
     */
    async findByPageId(pageId: string) {
        const rows = await this.prisma.integrations.findMany({
            where: { type: { in: [META_MESSENGER_EMBEDDED_TYPE, 'metabusiness'] } },
        });
        return rows.find((r) => {
            const cfg = r.config as any;
            if (cfg?.pageId !== pageId) return false;
            if (r.type === META_MESSENGER_EMBEDDED_TYPE) return cfg?.status === 'connected';
            return true;
        }) ?? null;
    }

    /**
     * Internal: look up a connected Instagram integration by Instagram account ID for webhook routing.
     * Falls back to the legacy manual 'instagram' integration for backward compatibility.
     */
    async findByInstagramAccountId(instagramAccountId: string) {
        const rows = await this.prisma.integrations.findMany({
            where: { type: { in: [META_INSTAGRAM_EMBEDDED_TYPE, 'instagram'] } },
        });
        return rows.find((r) => {
            const cfg = r.config as any;
            if (cfg?.instagramAccountId !== instagramAccountId) return false;
            if (r.type === META_INSTAGRAM_EMBEDDED_TYPE) return cfg?.status === 'connected';
            return true;
        }) ?? null;
    }
}
