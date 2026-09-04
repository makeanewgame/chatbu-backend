import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { BotService } from 'src/bot/bot.service';
import { WhatsAppEmbeddedService } from 'src/integration/whatsapp-embedded/whatsapp-embedded.service';
import { MetaChatCursorService } from 'src/meta-chat-cursor/meta-chat-cursor.service';
import { AudioTranscriptionService } from 'src/audio-transcription/audio-transcription.service';
import { MetaAudioService } from 'src/audio-transcription/meta-audio.service';
import { resolveMetaReplyText } from 'src/meta/meta-reply.util';
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
        // Voice notes / audio clips: the webhook carries only a media id;
        // the bytes are resolved via GET /<media_id> with the same token.
        audio?: { id: string; mime_type?: string; voice?: boolean };
        type: string;
    }>;
    statuses?: Array<{
        id: string;
        status: string;
        timestamp: string;
        recipient_id: string;
    }>;
    // Coexistence: messages the business sent from the WhatsApp Business app
    // (or a linked companion device) — delivered on the `smb_message_echoes` field.
    message_echoes?: Array<{
        from: string;
        to: string;
        id: string;
        timestamp: string;
        text?: { body: string };
        type: string;
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
        private readonly metaChatCursor: MetaChatCursorService,
        private readonly audioTranscription: AudioTranscriptionService,
        private readonly metaAudio: MetaAudioService,
    ) { }

    /**
     * Text of an inbound WA Cloud message, transcribing a voice note when
     * the message is audio. Returns null for anything unusable (silent
     * drop — same as the pre-voice behaviour for stickers/locations/etc.).
     * Voice branch stays dark while VOICE_TRANSCRIBE_ENABLED != true, so
     * the media resolve round trips are never attempted with the kill
     * switch closed.
     */
    private async extractWhatsAppText(
        message: { type: string; text?: { body: string }; audio?: { id: string }; from: string },
        accessToken: string,
        tenant: { botId: string; teamId: string },
    ): Promise<string | null> {
        if (message.type === 'text' && message.text?.body) return message.text.body;

        if (message.type !== 'audio' || !message.audio?.id) return null;
        if (!this.audioTranscription.isEnabled()) return null;

        const fetched = await this.metaAudio.downloadWhatsAppAudio(message.audio.id, accessToken);
        if (!fetched) return null;

        try {
            const result = await this.audioTranscription.transcribe({
                audio: fetched.audio,
                mimeType: fetched.mimeType,
                channel: 'whatsapp',
                tenantContext: { ...tenant, chatId: message.from },
            });
            if (!result.transcript) {
                this.logger.log(`[whatsapp] voice note transcribed empty for botId=${tenant.botId} — dropping`);
                return null;
            }
            return result.transcript;
        } catch (err) {
            this.logger.warn(
                `[whatsapp] voice note transcription failed for botId=${tenant.botId}: ${err?.message}`,
            );
            return null;
        }
    }

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
                if (change.field === 'smb_message_echoes') {
                    await this.handleMessageEchoes(change.value);
                    continue;
                }

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

                    this.logger.warn(`No active WhatsApp integration for phoneNumberId=${phoneNumberId}`);

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
                // Embedded Signup / Coexistence integrations store the system-user
                // token as `businessToken`; only the legacy manual form used `accessToken`.
                const accessToken: string = cfg?.businessToken ?? cfg?.accessToken;

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

                    const senderId = message.from;
                    // Text passes straight through; audio (voice note) is
                    // transcribed. Everything else stays silent-drop.
                    const text = await this.extractWhatsAppText(message, accessToken, {
                        botId,
                        teamId: integration.teamId,
                    });
                    if (!text) continue;
                    const chatId = await this.metaChatCursor.resolveChatId('wa', senderId);

                    try {
                        const response = await this.botService.chat(
                            {
                                botId,
                                teamId: integration.teamId,
                                message: text,
                                chatId,
                                sender: senderId,
                                date: new Date().toISOString(),
                                sourceChannel: 'whatsapp_embed',
                            } as any,
                            '0.0.0.0',
                        );

                        if ((response as any)?.agent_active) {
                            // Chat is with a human — the business replied from the
                            // WhatsApp Business app (coexistence) or a dashboard
                            // handover. Stay fully silent: the business sees the
                            // customer's message in their own WhatsApp app.
                            this.logger.log(
                                `[whatsapp-embedded] chat ${chatId} is HUMAN_ACTIVE — bot staying silent`,
                            );
                        } else {
                            const replyText = resolveMetaReplyText(response);
                            if (replyText) {
                                await this.sendWhatsAppMessage(senderId, replyText, phoneNumberId, accessToken);
                            } else {
                                this.logger.warn(
                                    `[whatsapp-embedded] empty chat response for chatId=${chatId} — no reply sent`,
                                );
                            }
                        }
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

    /**
     * `smb_message_echoes` — under Coexistence the business keeps replying to
     * customers from the WhatsApp Business app on their phone. Each such reply
     * is echoed here. When it lands, hand the conversation to the human:
     * flip it to HUMAN_ACTIVE (the bot's chat pipeline then short-circuits and
     * stops auto-replying) and mirror the message into the transcript so the
     * dashboard shows the full thread.
     */
    private async handleMessageEchoes(value: WhatsAppWebhookValue): Promise<void> {
        const phoneNumberId = value?.metadata?.phone_number_id;
        const echoes = value?.message_echoes || [];

        if (!phoneNumberId || !echoes.length) return;

        const integration = await this.whatsAppEmbeddedService.findByPhoneNumberId(phoneNumberId);

        if (!integration) {
            this.logger.warn(`smb_message_echoes: no WhatsApp integration for phoneNumberId=${phoneNumberId}`);
            return;
        }

        const cfg = integration.config as any;
        const botId: string = cfg?.botId;

        if (!botId) return;

        for (const echo of echoes) {
            const customerId = echo.to; // the WhatsApp user the business replied to

            if (!customerId) continue;

            // Resolve the chat by the stable contact id — NOT metaChatCursor,
            // whose resolveChatId() bumps the idle-rotation cursor and can mint a
            // fresh chatId, which would miss the row the bot already owns.
            const chat = await this.prisma.customerChats.findFirst({
                where: {
                    botId,
                    teamId: integration.teamId,
                    externalContactId: customerId,
                    isDeleted: false,
                    chatStatus: { not: 'CLOSED' },
                },
                orderBy: { updatedAt: 'desc' },
            });

            if (!chat) {
                this.logger.log(`smb_message_echoes: no active chat for customer=${customerId} — nothing to hand over`);
                continue;
            }

            const text = echo.text?.body ?? `[${echo.type || 'media'}]`;

            // The details table has no external-message-id column, so de-dupe
            // redelivered echoes by matching the most recent identical agent line.
            const last = await this.prisma.customerChatDetails.findFirst({
                where: { chatId: chat.id, sender: 'agent', message: text },
                orderBy: { createdAt: 'desc' },
            });

            if (last && Date.now() - last.createdAt.getTime() < 120_000) continue;

            await this.prisma.customerChatDetails.create({
                data: { chatId: chat.id, sender: 'agent', message: text, createdAt: new Date() },
            });

            await this.prisma.customerChats.update({
                where: { id: chat.id },
                data: { chatStatus: 'HUMAN_ACTIVE', updatedAt: new Date() },
            });

            if (chat.chatStatus !== 'HUMAN_ACTIVE') {
                this.logger.log(
                    `smb_message_echoes: chat ${chat.id} → HUMAN_ACTIVE` +
                    ` (business replied from the WhatsApp Business app)`,
                );
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

                const chatId = await this.metaChatCursor.resolveChatId('wa_test', senderId);
                const response = await this.botService.chat(
                    {
                        botId: testBotId,
                        teamId: bot.teamId,
                        message: text,
                        chatId,
                        sender: senderId,
                        date: new Date().toISOString(),
                        sourceChannel: 'wa_test',
                    } as any,
                    '0.0.0.0',
                );

                const replyText =
                    resolveMetaReplyText(response) ?? 'Üzgünüm, şu an yanıt veremiyorum.';

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


