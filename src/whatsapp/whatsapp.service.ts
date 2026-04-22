import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { BotService } from 'src/bot/bot.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class WhatsAppService {
    private readonly logger = new Logger(WhatsAppService.name);

    constructor(
        private prisma: PrismaService,
        private botService: BotService,
    ) {}

    async verifyWebhook(mode: string, verifyToken: string, challenge: string): Promise<string> {
        if (mode !== 'subscribe') {
            throw new ForbiddenException('Invalid hub.mode');
        }

        const integrations = await this.prisma.integrations.findMany({
            where: { type: 'whatsapp' },
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
        if (body.object !== 'whatsapp_business_account') return;

        for (const entry of body.entry || []) {
            for (const change of entry.changes || []) {
                if (change.field !== 'messages') continue;

                const value = change.value;
                const phoneNumberId = value?.metadata?.phone_number_id;
                const messages = value?.messages || [];

                if (!messages.length || !phoneNumberId) continue;

                const integrations = await this.prisma.integrations.findMany({
                    where: { type: 'whatsapp' },
                });

                const integration = integrations.find(i => {
                    const config = i.config as any;
                    return config?.phoneNumberId === phoneNumberId;
                });

                if (!integration) {
                    this.logger.warn(`No whatsapp integration found for phoneNumberId: ${phoneNumberId}`);
                    continue;
                }

                const config = integration.config as any;
                const botId = config?.botId;
                const accessToken = config?.accessToken;

                if (!botId || !accessToken) {
                    this.logger.warn(`Missing botId or accessToken for phoneNumberId: ${phoneNumberId}`);
                    continue;
                }

                for (const message of messages) {
                    if (message.type !== 'text' || !message.text?.body) continue;

                    const senderId = message.from;
                    const text = message.text.body;

                    try {
                        const response = await this.botService.chat(
                            {
                                botId,
                                teamId: integration.teamId,
                                message: text,
                                chatId: `wa_${senderId}`,
                                sender: senderId,
                                date: new Date().toISOString(),
                            } as any,
                            '0.0.0.0',
                        );

                        const replyText = response?.content ?? 'Üzgünüm, şu an yanıt veremiyorum.';
                        await this.sendWhatsAppMessage(senderId, replyText, phoneNumberId, accessToken);
                    } catch (err) {
                        this.logger.error(`Error processing WhatsApp message from ${senderId}: ${err?.toString()}`);
                    }
                }
            }
        }
    }

    private async sendWhatsAppMessage(to: string, text: string, phoneNumberId: string, accessToken: string): Promise<void> {
        await axios.post(
            `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
            {
                messaging_product: 'whatsapp',
                to,
                type: 'text',
                text: { body: text },
            },
            {
                headers: { Authorization: `Bearer ${accessToken}` },
            },
        );
    }
}
