import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { BotService } from 'src/bot/bot.service';
import { WhatsAppEmbeddedService } from 'src/integration/whatsapp-embedded/whatsapp-embedded.service';

export interface WhatsAppWebhookEntry {
    id: string;
    changes: WhatsAppWebhookChange[];
}

export interface WhatsAppWebhookChange {
    field: string;
    value: WhatsAppWebhookValue;
}

export interface WhatsAppWebhookValue {
    messaging_product: string;
    metadata: {
        display_phone_number: string;
        phone_number_id: string;
    };
    contacts?: Array<{
        profile: { name: string };
        wa_id: string;
    }>;
    messages?: Array<{
        from: string;
        id: string;
        timestamp: string;
        text?: { body: string };
        type: string;
    }>;
    statuses?: Array<{
        id: string;
        status: string;
        timestamp: string;
        recipient_id: string;
    }>;
}

export interface WhatsAppWebhookBody {
    object: string;
    entry: WhatsAppWebhookEntry[];
}

@Injectable()
export class MetaWhatsappService {
    private readonly logger = new Logger(MetaWhatsappService.name);

    constructor(
        private readonly configService: ConfigService,
        private readonly whatsAppEmbeddedService: WhatsAppEmbeddedService,
        private readonly botService: BotService,
    ) { }

    verifyWebhook(mode: string, verifyToken: string, challenge: string): string {
        const expectedToken = this.configService.get<string>('META_WEBHOOK_VERIFY_TOKEN');

        if (mode !== 'subscribe') {
            this.logger.warn('Webhook verification failed: invalid hub.mode');
            throw new ForbiddenException('Invalid hub.mode');
        }

        if (verifyToken !== expectedToken) {
            this.logger.warn('Webhook verification failed: token mismatch');
            throw new ForbiddenException('Verify token mismatch');
        }

        this.logger.log('WhatsApp webhook verified successfully');
        return challenge;
    }

    async handleWebhook(body: WhatsAppWebhookBody): Promise<void> {
        if (body.object !== 'whatsapp_business_account') {
            this.logger.warn(`Unexpected webhook object type: ${body.object}`);
            return;
        }

        for (const entry of body.entry || []) {
            for (const change of entry.changes || []) {
                if (change.field !== 'messages') continue;

                const value = change.value;
                const phoneNumberId = value?.metadata?.phone_number_id;

                if (!phoneNumberId) continue;

                // Resolve the chatbot integration for this phone number
                const integration = await this.whatsAppEmbeddedService.findByPhoneNumberId(phoneNumberId);

                if (!integration) {
                    this.logger.warn(`No active whatsapp_embedded integration for phoneNumberId=${phoneNumberId}`);

                    // Log incoming messages for diagnostics even when unrouted
                    for (const message of value?.messages || []) {
                        this.logger.log(
                            `Unrouted message | phone_number_id=${phoneNumberId}` +
                            ` | wa_id=${message.from} | type=${message.type}`,
                        );
                    }
                    continue;
                }

                const cfg = integration.config as any;
                const botId: string = cfg?.botId;
                const accessToken: string = cfg?.accessToken;

                if (!botId || !accessToken) {
                    this.logger.warn(`Integration config incomplete for phoneNumberId=${phoneNumberId}`);
                    continue;
                }

                // Process incoming messages
                for (const message of value?.messages || []) {
                    this.logger.log(
                        `Incoming message | phone_number_id=${phoneNumberId}` +
                        ` | wa_id=${message.from} | type=${message.type}` +
                        ` | text=${message.text?.body ?? '(non-text)'}`,
                    );

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
                        this.logger.error(
                            `Error processing WhatsApp message from ${senderId}: ${err?.toString()}`,
                        );
                    }
                }

                // Log status updates
                for (const status of value?.statuses || []) {
                    this.logger.log(
                        `Message status update | phone_number_id=${phoneNumberId}` +
                        ` | message_id=${status.id} | status=${status.status}` +
                        ` | recipient_id=${status.recipient_id}`,
                    );
                }
            }
        }
    }

    private async sendWhatsAppMessage(
        to: string,
        text: string,
        phoneNumberId: string,
        accessToken: string,
    ): Promise<void> {
        await axios.post(
            `https://graph.facebook.com/v23.0/${phoneNumberId}/messages`,
            {
                messaging_product: 'whatsapp',
                to,
                type: 'text',
                text: { body: text },
            },
            { headers: { Authorization: `Bearer ${accessToken}` } },
        );
    }
}

