import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from 'src/prisma/prisma.service';
import { CompleteWhatsAppSignupDto } from './dto/complete-whatsapp-signup.dto';

export const WHATSAPP_EMBEDDED_TYPE = 'whatsapp_embedded';
const GRAPH_BASE = 'https://graph.facebook.com/v25.0';

@Injectable()
export class WhatsAppEmbeddedService {
    private readonly logger = new Logger(WhatsAppEmbeddedService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService,
    ) { }

    /**
     * Exchange the Meta authorization code for tokens, retrieve WABA and phone number
     * details, then upsert the integration record for the given chatbot.
     */
    async completeSignup(teamId: string, dto: CompleteWhatsAppSignupDto) {
        const { chatbotId, authorizationCode, wabaId: wabaIdHint, phoneNumberId: phoneNumberIdHint } = dto;

        const appId = this.configService.get<string>('META_APP_ID');
        const appSecret = this.configService.get<string>('META_APP_SECRET');
        const redirectUri = this.configService.get<string>('META_OAUTH_REDIRECT_URI'); // optional

        if (!appId || !appSecret) {
            throw new BadRequestException('META_APP_ID and META_APP_SECRET must be configured on the server');
        }

        // 1. Exchange authorization code for a short-lived user access token
        let accessToken: string;
        try {
            const params: Record<string, string> = {
                client_id: appId,
                client_secret: appSecret,
                grant_type: 'authorization_code',
                code: authorizationCode,
            };
            // redirect_uri is not required for JS SDK Embedded Signup flows
            if (redirectUri) {
                params.redirect_uri = redirectUri;
            }

            const tokenRes = await axios.get<{ access_token: string }>(
                `${GRAPH_BASE}/oauth/access_token`,
                { params },
            );
            accessToken = tokenRes.data.access_token;
        } catch (err: any) {
            this.logger.error('Meta code exchange failed', err?.response?.data ?? err?.message);
            throw new BadRequestException('Failed to exchange Meta authorization code');
        }

        // 2. Upgrade to a long-lived user access token (60 days)
        try {
            const llRes = await axios.get<{ access_token: string }>(`${GRAPH_BASE}/oauth/access_token`, {
                params: {
                    grant_type: 'fb_exchange_token',
                    client_id: appId,
                    client_secret: appSecret,
                    fb_exchange_token: accessToken,
                },
            });
            accessToken = llRes.data.access_token;
        } catch {
            this.logger.warn('Could not upgrade to long-lived token — using short-lived token');
        }

        // 3. Resolve WABA ID and business name
        // Prefer the ID returned by the Embedded Signup message event (wabaIdHint)
        let wabaId: string;
        let businessName: string;

        if (wabaIdHint) {
            wabaId = wabaIdHint;
            try {
                const wabaRes = await axios.get<{ name: string }>(
                    `${GRAPH_BASE}/${wabaId}`,
                    { params: { access_token: accessToken, fields: 'name' } },
                );
                businessName = wabaRes.data.name || wabaId;
            } catch {
                this.logger.warn(`Could not fetch WABA name for ${wabaId} — using WABA ID as fallback`);
                businessName = wabaId;
            }
        } else {
            try {
                const wabaRes = await axios.get<{ data: Array<{ id: string; name: string }> }>(
                    `${GRAPH_BASE}/me/whatsapp_business_accounts`,
                    {
                        params: {
                            access_token: accessToken,
                            fields: 'id,name,currency,timezone_id',
                        },
                    },
                );
                const wabaList = wabaRes.data.data ?? [];
                if (!wabaList.length) {
                    throw new BadRequestException('No WhatsApp Business Account found for this user');
                }
                wabaId = wabaList[0].id;
                businessName = wabaList[0].name;
            } catch (err: any) {
                if (err instanceof BadRequestException) throw err;
                this.logger.error('Failed to retrieve WABA accounts', err?.response?.data ?? err?.message);
                throw new BadRequestException('Failed to retrieve WhatsApp Business Account');
            }
        }

        // 4. Resolve phone number ID and display number
        // Prefer the ID returned by the Embedded Signup message event (phoneNumberIdHint)
        let phoneNumberId: string;
        let displayPhoneNumber: string;

        if (phoneNumberIdHint) {
            phoneNumberId = phoneNumberIdHint;
            try {
                const phoneRes = await axios.get<{ display_phone_number: string }>(
                    `${GRAPH_BASE}/${phoneNumberId}`,
                    { params: { access_token: accessToken, fields: 'display_phone_number' } },
                );
                displayPhoneNumber = phoneRes.data.display_phone_number || phoneNumberId;
            } catch {
                this.logger.warn(`Could not fetch display phone number for ${phoneNumberId}`);
                displayPhoneNumber = phoneNumberId;
            }
        } else {
            try {
                const phoneRes = await axios.get<{
                    data: Array<{ id: string; display_phone_number: string; verified_name: string }>;
                }>(`${GRAPH_BASE}/${wabaId}/phone_numbers`, {
                    params: {
                        access_token: accessToken,
                        fields: 'id,display_phone_number,verified_name,quality_rating',
                    },
                });
                const phoneList = phoneRes.data.data ?? [];
                if (!phoneList.length) {
                    throw new BadRequestException('No phone number found for this WhatsApp Business Account');
                }
                phoneNumberId = phoneList[0].id;
                displayPhoneNumber = phoneList[0].display_phone_number;
            } catch (err: any) {
                if (err instanceof BadRequestException) throw err;
                this.logger.error('Failed to retrieve phone numbers', err?.response?.data ?? err?.message);
                throw new BadRequestException('Failed to retrieve WhatsApp phone number');
            }
        }

        // 5. Optionally retrieve the Business Portfolio (Meta Business) ID
        let businessAccountId: string = wabaId;
        try {
            const bizRes = await axios.get<{ data: Array<{ id: string; name: string }> }>(
                `${GRAPH_BASE}/me/businesses`,
                {
                    params: { access_token: accessToken, fields: 'id,name' },
                },
            );
            if (bizRes.data.data?.length) {
                businessAccountId = bizRes.data.data[0].id;
            }
        } catch {
            this.logger.warn('Could not retrieve Business Portfolio ID — using WABA ID as fallback');
        }

        const config = {
            botId: chatbotId,
            connectionType: 'embedded_signup',
            wabaId,
            phoneNumberId,
            businessAccountId,
            accessToken,
            tokenType: 'user',
            expiresAt: null,
            status: 'connected',
            displayPhoneNumber,
            businessName: businessName || displayPhoneNumber,
            connectedAt: new Date().toISOString(),
        };

        // Upsert: find existing integration for this team + chatbot
        const existing = await this.prisma.integrations.findFirst({
            where: {
                teamId,
                type: WHATSAPP_EMBEDDED_TYPE,
                config: { path: ['botId'], equals: chatbotId },
            },
        });

        if (existing) {
            await this.prisma.integrations.update({
                where: { id: existing.id },
                data: { config },
            });
        } else {
            await this.prisma.integrations.create({
                data: { teamId, type: WHATSAPP_EMBEDDED_TYPE, config },
            });
        }

        this.logger.log(
            `WhatsApp Embedded Signup complete | teamId=${teamId} | chatbotId=${chatbotId}` +
            ` | phoneNumberId=${phoneNumberId} | wabaId=${wabaId}`,
        );

        return {
            success: true,
            displayPhoneNumber,
            businessName: config.businessName,
            wabaId,
            phoneNumberId,
        };
    }

    /**
     * Return the WhatsApp integration status for a specific chatbot.
     */
    async getStatus(teamId: string, chatbotId: string) {
        const row = await this.prisma.integrations.findFirst({
            where: {
                teamId,
                type: WHATSAPP_EMBEDDED_TYPE,
                config: { path: ['botId'], equals: chatbotId },
            },
        });

        if (!row) {
            return { connected: false };
        }

        const cfg = row.config as any;
        return {
            connected: cfg.status === 'connected',
            displayPhoneNumber: cfg.displayPhoneNumber,
            businessName: cfg.businessName,
            wabaId: cfg.wabaId,
            connectedAt: cfg.connectedAt,
        };
    }

    /**
     * Delete the WhatsApp integration for a specific chatbot.
     */
    async disconnect(teamId: string, chatbotId: string) {
        const row = await this.prisma.integrations.findFirst({
            where: {
                teamId,
                type: WHATSAPP_EMBEDDED_TYPE,
                config: { path: ['botId'], equals: chatbotId },
            },
        });

        if (!row) {
            throw new NotFoundException('No WhatsApp integration found for this chatbot');
        }

        await this.prisma.integrations.delete({ where: { id: row.id } });
        this.logger.log(`WhatsApp integration disconnected | teamId=${teamId} | chatbotId=${chatbotId}`);
        return { success: true };
    }

    /**
     * Internal: look up integration by phoneNumberId for webhook routing.
     * Covers both embedded-signup (whatsapp_embedded) and manual-key (whatsapp_manual) integrations.
     */
    async findByPhoneNumberId(phoneNumberId: string) {
        const rows = await this.prisma.integrations.findMany({
            where: { type: { in: [WHATSAPP_EMBEDDED_TYPE, 'whatsapp_manual'] } },
        });
        return rows.find((r) => {
            const cfg = r.config as any;
            if (cfg?.phoneNumberId !== phoneNumberId) return false;
            // whatsapp_embedded requires status=connected; whatsapp_manual has no status field
            if (r.type === WHATSAPP_EMBEDDED_TYPE) return cfg?.status === 'connected';
            return true; // whatsapp_manual — presence of phoneNumberId is sufficient
        }) ?? null;
    }
}
