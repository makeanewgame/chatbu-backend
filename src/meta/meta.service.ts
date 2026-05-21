import { ForbiddenException, Injectable, Logger, BadRequestException } from '@nestjs/common';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { BotService } from 'src/bot/bot.service';

@Injectable()
export class MetaService {
    private readonly logger = new Logger(MetaService.name);

    constructor(
        private prisma: PrismaService,
        private botService: BotService,
        private configService: ConfigService,
    ) { }

    async verifyWebhook(mode: string, verifyToken: string, challenge: string): Promise<string> {
        if (mode !== 'subscribe') {
            throw new ForbiddenException('Invalid hub.mode');
        }

        const integrations = await this.prisma.integrations.findMany({
            where: { type: 'metabusiness' },
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
        if (body.object !== 'page') return;

        for (const entry of body.entry || []) {
            const pageId = entry.id;

            const integrations = await this.prisma.integrations.findMany({
                where: { type: 'metabusiness' },
            });

            const integration = integrations.find(i => {
                const config = i.config as any;
                return config?.pageId === pageId;
            });

            if (!integration) {
                this.logger.warn(`No metabusiness integration found for pageId: ${pageId}`);
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
                    await this.sendFacebookMessage(senderId, replyText, pageAccessToken);
                } catch (err) {
                    this.logger.error(`Error processing message from ${senderId}: ${err?.toString()}`);
                }
            }
        }
    }

    private async sendFacebookMessage(recipientId: string, text: string, pageAccessToken: string): Promise<void> {
        await axios.post(
            'https://graph.facebook.com/v19.0/me/messages',
            {
                recipient: { id: recipientId },
                message: { text },
            },
            { params: { access_token: pageAccessToken } },
        );
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
