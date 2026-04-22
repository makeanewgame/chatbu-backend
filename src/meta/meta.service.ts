import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from 'src/prisma/prisma.service';
import { BotService } from 'src/bot/bot.service';

@Injectable()
export class MetaService {
    private readonly logger = new Logger(MetaService.name);

    constructor(
        private prisma: PrismaService,
        private botService: BotService,
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
}
