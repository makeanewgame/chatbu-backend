import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { randomInt } from 'crypto';
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
     * Tech Provider onboarding flow:
     *   1. Exchange the Embedded Signup code for a business integration system user token
     *   2. Subscribe our app to webhooks on the customer's WABA
     *   3. Register the customer's phone number for Cloud API messaging
     *   4. Persist the integration
     */
    async completeSignup(teamId: string, dto: CompleteWhatsAppSignupDto) {
        const { chatbotId, authorizationCode, wabaId, phoneNumberId } = dto;

        if (!wabaId || !phoneNumberId) {
            throw new BadRequestException(
                'wabaId and phoneNumberId are required — they are returned by the Embedded Signup message event',
            );
        }

        const appId = this.configService.get<string>('META_APP_ID');
        const appSecret = this.configService.get<string>('META_APP_SECRET');

        if (!appId || !appSecret) {
            throw new BadRequestException('META_APP_ID and META_APP_SECRET must be configured on the server');
        }

        // ── Step 1: Exchange authorization code → business integration system user token ──
        // Tech Provider docs: GET /oauth/access_token?client_id=&client_secret=&code=
        // No redirect_uri, no grant_type — this is specific to the Embedded Signup code exchange.
        let businessToken: string;
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
            businessToken = tokenRes.data.access_token;
        } catch (err: any) {
            this.logger.error('Meta code exchange failed', err?.response?.data ?? err?.message);
            throw new BadRequestException('Failed to exchange Meta authorization code');
        }

        // ── Step 2: Subscribe our app to webhooks on the customer's WABA ──
        // This enables incoming message webhooks to reach our server.
        try {
            await axios.post(
                `${GRAPH_BASE}/${wabaId}/subscribed_apps`,
                null,
                { headers: { Authorization: `Bearer ${businessToken}` } },
            );
            this.logger.log(`Subscribed to WABA webhooks | wabaId=${wabaId}`);
        } catch (err: any) {
            // Non-fatal: log and continue — webhook subscription can be retried later.
            this.logger.warn('Failed to subscribe to WABA webhooks', err?.response?.data ?? err?.message);
        }

        // ── Step 3: Register the phone number for Cloud API messaging ──
        // Generates a 6-digit two-step verification PIN for the number.
        const pin = randomInt(100000, 999999).toString();
        try {
            await axios.post(
                `${GRAPH_BASE}/${phoneNumberId}/register`,
                { messaging_product: 'whatsapp', pin },
                { headers: { Authorization: `Bearer ${businessToken}`, 'Content-Type': 'application/json' } },
            );
            this.logger.log(`Phone number registered for Cloud API | phoneNumberId=${phoneNumberId}`);
        } catch (err: any) {
            // Non-fatal: the number may already be registered with Cloud API.
            this.logger.warn('Phone registration failed (may already be registered)', err?.response?.data ?? err?.message);
        }

        // ── Step 4: Fetch display info for the UI ──
        let businessName = wabaId;
        let displayPhoneNumber = phoneNumberId;

        try {
            const wabaRes = await axios.get<{ name: string }>(
                `${GRAPH_BASE}/${wabaId}`,
                { params: { access_token: businessToken, fields: 'name' } },
            );
            businessName = wabaRes.data.name || wabaId;
        } catch {
            this.logger.warn(`Could not fetch WABA name for ${wabaId}`);
        }

        try {
            const phoneRes = await axios.get<{ display_phone_number: string }>(
                `${GRAPH_BASE}/${phoneNumberId}`,
                { params: { access_token: businessToken, fields: 'display_phone_number' } },
            );
            displayPhoneNumber = phoneRes.data.display_phone_number || phoneNumberId;
        } catch {
            this.logger.warn(`Could not fetch display phone number for ${phoneNumberId}`);
        }

        // ── Step 5: Persist the integration ──
        const config = {
            botId: chatbotId,
            connectionType: 'embedded_signup',
            wabaId,
            phoneNumberId,
            businessToken,
            pin,
            status: 'connected',
            displayPhoneNumber,
            businessName,
            connectedAt: new Date().toISOString(),
        };

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
            businessName,
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
            if (r.type === WHATSAPP_EMBEDDED_TYPE) return cfg?.status === 'connected';
            return true;
        }) ?? null;
    }
}
