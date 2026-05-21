import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { BotService } from 'src/bot/bot.service';
import { WhatsAppEmbeddedService } from 'src/integration/whatsapp-embedded/whatsapp-embedded.service';
import { PrismaService } from 'src/prisma/prisma.service';

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

export interface TestMessage {
    role: 'user' | 'bot';
    from: string;
    text: string;
    timestamp: string;
    messageId?: string;
}

@Injectable()
export class MetaWhatsappService {
    private readonly logger = new Logger(MetaWhatsappService.name);

    private static readonly KEY_TEST_BOT_ID = 'wa_test_bot_id';
    private static readonly KEY_TEST_MESSAGES = 'wa_test_messages';

    constructor(
        private readonly configService: ConfigService,
        private readonly whatsAppEmbeddedService: WhatsAppEmbeddedService,
        private readonly botService: BotService,
        private readonly prisma: PrismaService,
    ) { }

    // ── Test mode management (DB-backed so all replicas share state) ─────────

    async setTestBot(botId: string | null): Promise<void> {
        if (botId) {
            await this.prisma.systemSettings.upsert({
                where: { key: MetaWhatsappService.KEY_TEST_BOT_ID },
                update: { value: botId },
                create: { key: MetaWhatsappService.KEY_TEST_BOT_ID, value: botId, description: 'WA App Review test bot ID (temporary)' },
            });
            // Clear messages when activating
            await this.prisma.systemSettings.upsert({
                where: { key: MetaWhatsappService.KEY_TEST_MESSAGES },
                update: { value: '[]' },
                create: { key: MetaWhatsappService.KEY_TEST_MESSAGES, value: '[]', description: 'WA App Review test conversation log (temporary)' },
            });
        } else {
            await this.prisma.systemSettings.deleteMany({
                where: { key: { in: [MetaWhatsappService.KEY_TEST_BOT_ID, MetaWhatsappService.KEY_TEST_MESSAGES] } },
            });
        }
        this.logger.log(`WA test mode: ${botId ? `activated with botId=${botId}` : 'deactivated'}`);
    }

    async getTestState(): Promise<{ active: boolean; botId: string | null; messages: TestMessage[] }> {
        const [botSetting, msgSetting] = await Promise.all([
            this.prisma.systemSettings.findUnique({ where: { key: MetaWhatsappService.KEY_TEST_BOT_ID } }),
            this.prisma.systemSettings.findUnique({ where: { key: MetaWhatsappService.KEY_TEST_MESSAGES } }),
        ]);
        const botId = botSetting?.value ?? null;
        const messages: TestMessage[] = msgSetting ? JSON.parse(msgSetting.value) : [];
        return { active: !!botId, botId, messages };
    }

    async clearTestMessages(): Promise<void> {
        await this.prisma.systemSettings.upsert({
            where: { key: MetaWhatsappService.KEY_TEST_MESSAGES },
            update: { value: '[]' },
            create: { key: MetaWhatsappService.KEY_TEST_MESSAGES, value: '[]', description: 'WA App Review test conversation log (temporary)' },
        });
    }

    private async getTestBotId(): Promise<string | null> {
        const setting = await this.prisma.systemSettings.findUnique({
            where: { key: MetaWhatsappService.KEY_TEST_BOT_ID },
        });
        return setting?.value ?? null;
    }

    private async appendTestMessages(newMessages: TestMessage[]): Promise<void> {
        const setting = await this.prisma.systemSettings.findUnique({
            where: { key: MetaWhatsappService.KEY_TEST_MESSAGES },
        });
        const existing: TestMessage[] = setting ? JSON.parse(setting.value) : [];
        const updated = [...existing, ...newMessages];
        await this.prisma.systemSettings.upsert({
            where: { key: MetaWhatsappService.KEY_TEST_MESSAGES },
            update: { value: JSON.stringify(updated) },
            create: { key: MetaWhatsappService.KEY_TEST_MESSAGES, value: JSON.stringify(updated), description: 'WA App Review test conversation log (temporary)' },
        });
    }

    // ────────────────────────────────────────────────────────────────────────

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
                    // ── Test mode fallback ────────────────────────────────
                    const testPhoneNumberId = this.configService.get<string>('META_TEST_PHONE_NUMBER_ID');

                    if (phoneNumberId === testPhoneNumberId) {
                        const testBotId = await this.getTestBotId();
                        if (testBotId) {
                            this.logger.log(`Test mode: routing messages for phoneNumberId=${phoneNumberId} to botId=${testBotId}`);
                            await this.handleTestModeMessages(value, phoneNumberId, testBotId);
                            continue;
                        }
                    }
                    // ─────────────────────────────────────────────────────

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

    private async handleTestModeMessages(value: WhatsAppWebhookValue, phoneNumberId: string, testBotId: string): Promise<void> {
        const testAccessToken = this.configService.get<string>('META_TEST_ACCESS_TOKEN');

        if (!testAccessToken) {
            this.logger.error('META_TEST_ACCESS_TOKEN not configured — cannot reply in test mode');
            return;
        }

        for (const message of value?.messages || []) {
            if (message.type !== 'text' || !message.text?.body) continue;

            const senderId = message.from;
            const text = message.text.body;

            this.logger.log(`Test mode incoming | from=${senderId} | text=${text}`);

            const incomingMsg: TestMessage = {
                role: 'user',
                from: senderId,
                text,
                timestamp: new Date().toISOString(),
            };

            try {
                // Look up bot teamId
                const bot = await this.botService.botDetail(testBotId);

                const response = await this.botService.chat(
                    {
                        botId: testBotId,
                        teamId: bot.teamId,
                        message: text,
                        chatId: `wa_test_${senderId}`,
                        sender: senderId,
                        date: new Date().toISOString(),
                    } as any,
                    '0.0.0.0',
                );

                const replyText = response?.content ?? 'Üzgünüm, şu an yanıt veremiyorum.';

                // Send reply via WhatsApp using test credentials
                const waRes = await axios.post(
                    `https://graph.facebook.com/v23.0/${phoneNumberId}/messages`,
                    {
                        messaging_product: 'whatsapp',
                        to: senderId,
                        type: 'text',
                        text: { body: replyText },
                    },
                    { headers: { Authorization: `Bearer ${testAccessToken}` } },
                );

                const messageId = waRes.data?.messages?.[0]?.id ?? undefined;

                this.logger.log(`Test mode reply sent | to=${senderId} | messageId=${messageId}`);

                const botMsg: TestMessage = {
                    role: 'bot',
                    from: 'chatbu',
                    text: replyText,
                    timestamp: new Date().toISOString(),
                    messageId,
                };

                // Persist both messages to DB (shared across all pods)
                await this.appendTestMessages([incomingMsg, botMsg]);
            } catch (err) {
                this.logger.error(`Test mode error for ${senderId}: ${err?.toString()}`);
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


