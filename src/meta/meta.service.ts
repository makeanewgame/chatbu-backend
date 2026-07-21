import { ForbiddenException, Injectable, Logger, BadRequestException } from '@nestjs/common';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { BotService } from 'src/bot/bot.service';
import { MetaEmbeddedService } from 'src/integration/meta-embedded/meta-embedded.service';

@Injectable()
export class MetaService {
    private readonly logger = new Logger(MetaService.name);

    constructor(
        private prisma: PrismaService,
        private botService: BotService,
        private configService: ConfigService,
        private metaEmbeddedService: MetaEmbeddedService,
    ) { }

    async verifyWebhook(mode: string, verifyToken: string, challenge: string): Promise<string> {
        if (mode !== 'subscribe') {
            throw new ForbiddenException('Invalid hub.mode');
        }

        // Centralized token: used by the Meta Embedded (Messenger/Instagram) connect flow,
        // configured once in the App Dashboard's webhook settings.
        const globalVerifyToken = this.configService.get<string>('META_WEBHOOK_VERIFY_TOKEN');
        if (globalVerifyToken && verifyToken === globalVerifyToken) {
            return challenge;
        }

        // Legacy fallback: per-integration verify token for manually configured integrations.
        const integrations = await this.prisma.integrations.findMany({
            where: { type: { in: ['metabusiness', 'instagram'] } },
        });

        const match = integrations.find(i => {
            const config = i.config as any;
            return config?.verifyToken === verifyToken;
        });

        if (!match) {
            throw new ForbiddenException('Verify token mismatch');
        }

        return challenge;
    }

    async handleWebhook(body: any): Promise<void> {
        if (body.object === 'page') {
            await this.handlePageWebhook(body);
        } else if (body.object === 'instagram') {
            await this.handleInstagramWebhook(body);
        }
    }

    private async handlePageWebhook(body: any): Promise<void> {
        for (const entry of body.entry || []) {
            const pageId = entry.id;

            const integration = await this.metaEmbeddedService.findByPageId(pageId);

            if (!integration) {
                this.logger.warn(`No Messenger integration found for pageId: ${pageId}`);
                continue;
            }

            const config = integration.config as any;
            const botId = config?.botId;
            const pageAccessToken = config?.pageAccessToken;

            if (!botId || !pageAccessToken) {
                this.logger.warn(`Missing botId or pageAccessToken for pageId: ${pageId}`);
                continue;
            }

            for (const messagingEvent of entry.messaging || []) {
                if (!messagingEvent.message || !messagingEvent.message.text) continue;
                // Echoes are our own bot's outbound messages reflected back by Meta —
                // replying to them would create an infinite loop.
                if (messagingEvent.message.is_echo) continue;

                const senderId = messagingEvent.sender.id;
                const text = messagingEvent.message.text;

                try {
                    const response = await this.botService.chat(
                        {
                            botId,
                            teamId: integration.teamId,
                            message: text,
                            chatId: `fb_${senderId}`,
                            sender: senderId,
                            date: new Date().toISOString(),
                        } as any,
                        '0.0.0.0',
                    );

                    const replyText = response?.content ?? 'Üzgünüm, şu an yanıt veremiyorum.';
                    await this.sendMetaMessage(senderId, replyText, pageAccessToken);
                } catch (err) {
                    this.logger.error(`Error processing Messenger message from ${senderId}: ${err?.toString()}`);
                }
            }
        }
    }

    private async handleInstagramWebhook(body: any): Promise<void> {
        for (const entry of body.entry || []) {
            const instagramAccountId = entry.id;

            const integration = await this.metaEmbeddedService.findByInstagramAccountId(instagramAccountId);

            if (!integration) {
                // instagramAccountId here has been observed to diverge from the ID captured
                // during the OAuth connect flow (/me/accounts field instagram_business_account.id) —
                // logging recipient/sender IDs from the raw entry lets us compare ID schemes
                // without needing to reproduce the issue again.
                this.logger.warn(
                    `No Instagram integration found for instagramAccountId: ${instagramAccountId} | raw entry: ${JSON.stringify(entry)}`,
                );
                continue;
            }

            const config = integration.config as any;
            const botId = config?.botId;
            const pageAccessToken = config?.pageAccessToken;

            if (!botId || !pageAccessToken) {
                this.logger.warn(`Missing botId or pageAccessToken for instagramAccountId: ${instagramAccountId}`);
                continue;
            }

            for (const messagingEvent of entry.messaging || []) {
                if (!messagingEvent.message || !messagingEvent.message.text) continue;
                // Echoes are our own bot's outbound messages reflected back by Meta —
                // replying to them would create an infinite loop.
                if (messagingEvent.message.is_echo) continue;

                const senderId = messagingEvent.sender.id;
                const text = messagingEvent.message.text;
                const contactName = await this.fetchInstagramContactName(senderId, pageAccessToken);

                try {
                    const response = await this.botService.chat(
                        {
                            botId,
                            teamId: integration.teamId,
                            message: text,
                            chatId: `ig_${senderId}`,
                            sender: senderId,
                            externalContactName: contactName,
                            date: new Date().toISOString(),
                        } as any,
                        '0.0.0.0',
                    );

                    const replyText = response?.content ?? 'Üzgünüm, şu an yanıt veremiyorum.';
                    await this.sendMetaMessage(senderId, replyText, pageAccessToken);
                } catch (err) {
                    this.logger.error(`Error processing Instagram message from ${senderId}: ${err?.toString()}`);
                }
            }
        }
    }

    /**
     * Sends a text reply via the unified Meta Send API. Works for both Messenger (PSID)
     * and Page-linked Instagram (IGSID) recipients when given that Page's access token.
     */
    private async sendMetaMessage(recipientId: string, text: string, pageAccessToken: string): Promise<void> {
        await axios.post(
            'https://graph.facebook.com/v23.0/me/messages',
            {
                recipient: { id: recipientId },
                message: { text },
            },
            { params: { access_token: pageAccessToken } },
        );
    }

    /**
     * Best-effort lookup of the customer's display name via the Instagram user profile API.
     * Messenger has no equivalent here: Meta restricts the Messenger User Profile API's
     * first_name/last_name/name fields to apps with extended access, which this app doesn't
     * have yet (Standard Access only — see App Review status), so PSID lookups fail outright.
     * Never throws — the chat is created with a missing name rather than failing entirely.
     */
    private async fetchInstagramContactName(igsid: string, pageAccessToken: string): Promise<string | undefined> {
        try {
            const { data } = await axios.get(`https://graph.facebook.com/v23.0/${igsid}`, {
                params: { fields: 'name,username', access_token: pageAccessToken },
            });
            return data?.name || data?.username || undefined;
        } catch (err) {
            this.logger.warn(`Failed to fetch Instagram contact name for ${igsid}: ${err?.toString()}`);
            return undefined;
        }
    }

    // ─── WhatsApp Test Methods (Temporary – Meta App Review) ──────────────────

    private getTestCredentials() {
        const phoneNumberId = this.configService.get<string>('META_TEST_PHONE_NUMBER_ID');
        const accessToken = this.configService.get<string>('META_TEST_ACCESS_TOKEN');

        if (!phoneNumberId || !accessToken) {
            throw new BadRequestException('META_TEST_PHONE_NUMBER_ID or META_TEST_ACCESS_TOKEN is not configured');
        }

        return { phoneNumberId, accessToken };
    }

    private async sendWhatsAppMessage(to: string, message: string, phoneNumberId: string, accessToken: string) {
        const normalizedTo = to.replace(/^\+/, '');

        const response = await axios.post(
            `https://graph.facebook.com/v23.0/${phoneNumberId}/messages`,
            {
                messaging_product: 'whatsapp',
                to: normalizedTo,
                type: 'text',
                text: { body: message },
            },
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            },
        );

        return response.data;
    }

    async testSendWhatsApp(to: string, message: string): Promise<any> {
        const { phoneNumberId, accessToken } = this.getTestCredentials();

        this.logger.log(`WA test-send to=${to}`);

        const data = await this.sendWhatsAppMessage(to, message, phoneNumberId, accessToken);

        return {
            success: true,
            messageId: data?.messages?.[0]?.id ?? null,
        };
    }

    async testChatWhatsApp(botId: string, to: string, message: string): Promise<any> {
        const { phoneNumberId, accessToken } = this.getTestCredentials();

        // 1. Resolve bot and its teamId
        const bot = await this.prisma.customerBots.findUnique({
            where: { id: botId, isDeleted: false },
        });

        if (!bot) {
            throw new BadRequestException('Bot not found');
        }

        // 2. Process message through chat service
        const chatResponse = await this.botService.chat(
            {
                botId,
                teamId: bot.teamId,
                message,
                chatId: `wa_test_${to.replace(/\D/g, '')}`,
                sender: to,
                date: new Date().toISOString(),
            } as any,
            '0.0.0.0',
        );

        const replyText = chatResponse?.content ?? 'Üzgünüm, şu an yanıt veremiyorum.';

        // 3. Send bot reply via WhatsApp
        const data = await this.sendWhatsAppMessage(to, replyText, phoneNumberId, accessToken);

        return {
            success: true,
            botReply: replyText,
            messageId: data?.messages?.[0]?.id ?? null,
        };
    }
}
