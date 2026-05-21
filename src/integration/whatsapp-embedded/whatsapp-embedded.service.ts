import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from 'src/prisma/prisma.service';

export const WHATSAPP_EMBEDDED_TYPE = 'whatsapp_embedded';
const GRAPH_BASE = 'https://graph.facebook.com/v23.0';

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
    async completeSignup(teamId: string, chatbotId: string, authorizationCode: string) {
        const appId = this.configService.get<string>('META_APP_ID');
        const appSecret = this.configService.get<string>('META_APP_SECRET');

        if (!appId || !appSecret) {
            throw new BadRequestException('META_APP_ID and META_APP_SECRET must be configured on the server');
        }

        // 1. Exchange authorization code for a short-lived user access token
        let accessToken: string;
        try {
            const tokenRes = await axios.get<{ access_token: string }>(`${GRAPH_BASE}/oauth/access_token`, {
                params: {
                    client_id: appId,
                    client_secret: appSecret,
                    code: authorizationCode,
                },
            });
            accessToken = tokenRes.data.access_token;
        } catch (err) {
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

        // 3. Fetch WhatsApp Business Accounts associated with this user
        let wabaId: string;
        let businessName: string;
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
        } catch (err) {
            if (err instanceof BadRequestException) throw err;
            this.logger.error('Failed to retrieve WABA accounts', err?.response?.data ?? err?.message);
            throw new BadRequestException('Failed to retrieve WhatsApp Business Account');
        }

        // 4. Fetch phone numbers for the WABA
        let phoneNumberId: string;
        let displayPhoneNumber: string;
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
        } catch (err) {
            if (err instanceof BadRequestException) throw err;
            this.logger.error('Failed to retrieve phone numbers', err?.response?.data ?? err?.message);
            throw new BadRequestException('Failed to retrieve WhatsApp phone number');
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
     */
    async findByPhoneNumberId(phoneNumberId: string) {
        const rows = await this.prisma.integrations.findMany({
            where: { type: WHATSAPP_EMBEDDED_TYPE },
        });
        return rows.find((r) => {
            const cfg = r.config as any;
            return cfg?.phoneNumberId === phoneNumberId && cfg?.status === 'connected';
        }) ?? null;
    }
}
