import { ForbiddenException, Injectable, Logger, BadRequestException } from '@nestjs/common';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { BotService } from 'src/bot/bot.service';
import { MetaEmbeddedService } from 'src/integration/meta-embedded/meta-embedded.service';
import { MetaChatCursorService } from 'src/meta-chat-cursor/meta-chat-cursor.service';
import { AudioTranscriptionService, VoiceChannel } from 'src/audio-transcription/audio-transcription.service';
import { MetaAudioService } from 'src/audio-transcription/meta-audio.service';
import { resolveMetaReplyText } from './meta-reply.util';

@Injectable()
export class MetaService {
    private readonly logger = new Logger(MetaService.name);

    constructor(
        private prisma: PrismaService,
        private botService: BotService,
        private configService: ConfigService,
        private metaEmbeddedService: MetaEmbeddedService,
        private metaChatCursor: MetaChatCursorService,
        private audioTranscription: AudioTranscriptionService,
        private metaAudio: MetaAudioService,
    ) { }

    /**
     * Text of a Messenger/IG messaging event, transcribing a voice-note
     * attachment when there is no text. Returns null when the event has
     * no usable content (the caller's silent-drop path — identical to
     * the pre-voice behaviour for stickers, images, reactions, etc.).
     *
     * Voice branch is dark unless VOICE_TRANSCRIBE_ENABLED=true, so the
     * CDN download isn't even attempted with the kill switch closed.
     */
    private async extractTextOrTranscribe(
        message: any,
        channel: VoiceChannel,
        tenant: { botId: string; teamId: string; chatId: string },
    ): Promise<string | null> {
        if (message.text) return message.text;

        if (!this.audioTranscription.isEnabled()) return null;

        const audioAttachment = (message.attachments || []).find(
            (a: any) => a?.type === 'audio' && a?.payload?.url,
        );
        if (!audioAttachment) return null;

        const fetched = await this.metaAudio.downloadMessengerAudio(audioAttachment.payload.url);
        if (!fetched) return null;

        try {
            const result = await this.audioTranscription.transcribe({
                audio: fetched.audio,
                mimeType: fetched.mimeType,
                channel,
                tenantContext: tenant,
            });
            if (!result.transcript) {
                this.logger.log(
                    `[${channel}] voice note transcribed empty for botId=${tenant.botId} — dropping`,
                );
                return null;
            }
            return result.transcript;
        } catch (err) {
            // transcribe() already counted the error metric; a broken voice
            // note must not take the webhook batch down with it.
            this.logger.warn(
                `[${channel}] voice note transcription failed for botId=${tenant.botId}: ${err?.message}`,
            );
            return null;
        }
    }

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
                if (!messagingEvent.message) continue;
                // Echoes are our own bot's outbound messages reflected back by Meta —
                // replying to them would create an infinite loop.
                if (messagingEvent.message.is_echo) continue;

                const senderId = messagingEvent.sender.id;
                // Voice notes arrive as audio attachments with no text — the
                // helper transcribes them; sender id doubles as chat context
                // because the chat cursor is only resolved for usable content.
                const text = await this.extractTextOrTranscribe(
                    messagingEvent.message,
                    'messenger',
                    { botId, teamId: integration.teamId, chatId: senderId },
                );
                if (!text) continue;
                const chatId = await this.metaChatCursor.resolveChatId('fb', senderId);

                try {
                    const response = await this.botService.chat(
                        {
                            botId,
                            teamId: integration.teamId,
                            message: text,
                            chatId,
                            sender: senderId,
                            date: new Date().toISOString(),
                            sourceChannel: 'messenger',
                        } as any,
                        '0.0.0.0',
                    );

                    const replyText = resolveMetaReplyText(response);
                    if (replyText) {
                        await this.sendMetaMessage(senderId, replyText, pageAccessToken);
                    } else {
                        this.logger.warn(
                            `[messenger] empty chat response for botId=${botId} chatId=${chatId} — no reply sent`,
                        );
                    }
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
                if (!messagingEvent.message) continue;
                // Echoes are our own bot's outbound messages reflected back by Meta —
                // replying to them would create an infinite loop.
                if (messagingEvent.message.is_echo) continue;

                const senderId = messagingEvent.sender.id;
                // Same voice-note handling as Messenger above.
                const text = await this.extractTextOrTranscribe(
                    messagingEvent.message,
                    'instagram',
                    { botId, teamId: integration.teamId, chatId: senderId },
                );
                if (!text) continue;
                const contactName = await this.fetchInstagramContactName(senderId, pageAccessToken);
                const chatId = await this.metaChatCursor.resolveChatId('ig', senderId);

                try {
                    const response = await this.botService.chat(
                        {
                            botId,
                            teamId: integration.teamId,
                            message: text,
                            chatId,
                            sender: senderId,
                            externalContactName: contactName,
                            date: new Date().toISOString(),
                            sourceChannel: 'instagram',
                        } as any,
                        '0.0.0.0',
                    );

                    const replyText = resolveMetaReplyText(response);
                    if (replyText) {
                        await this.sendMetaMessage(senderId, replyText, pageAccessToken);
                    } else {
                        this.logger.warn(
                            `[instagram] empty chat response for botId=${botId} chatId=${chatId} — no reply sent`,
                        );
                    }
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
        const wa_test_visitor = to.replace(/\D/g, '');
        const chatId = await this.metaChatCursor.resolveChatId('wa_test', wa_test_visitor);
        const chatResponse = await this.botService.chat(
            {
                botId,
                teamId: bot.teamId,
                message,
                chatId,
                sender: to,
                date: new Date().toISOString(),
                sourceChannel: 'wa_test',
            } as any,
            '0.0.0.0',
        );

        const replyText =
            resolveMetaReplyText(chatResponse) ?? 'Üzgünüm, şu an yanıt veremiyorum.';

        // 3. Send bot reply via WhatsApp
        const data = await this.sendWhatsAppMessage(to, replyText, phoneNumberId, accessToken);

        return {
            success: true,
            botReply: replyText,
            messageId: data?.messages?.[0]?.id ?? null,
        };
    }
}
