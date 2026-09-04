import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { BotService } from 'src/bot/bot.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { MetaChatCursorService } from 'src/meta-chat-cursor/meta-chat-cursor.service';
import { AudioTranscriptionService } from 'src/audio-transcription/audio-transcription.service';
import { MetaAudioService } from 'src/audio-transcription/meta-audio.service';
import { MetaLoopGuardService } from 'src/meta-loop-guard/meta-loop-guard.service';
import { resolveMetaReplyText } from 'src/meta/meta-reply.util';

@Injectable()
export class WhatsAppService {
    private readonly logger = new Logger(WhatsAppService.name);

    constructor(
        private prisma: PrismaService,
        private botService: BotService,
        private metaChatCursor: MetaChatCursorService,
        private audioTranscription: AudioTranscriptionService,
        private metaAudio: MetaAudioService,
        private loopGuard: MetaLoopGuardService,
    ) { }

    /**
     * Mirror of MetaWhatsappService.extractWhatsAppText for the legacy
     * manually-configured WA integration — same Cloud API payload shape,
     * same silent-drop semantics, kept separate only because the two
     * services have different config resolution. Without this the same
     * visitor gets voice replies on IG but silence on legacy WA.
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
                this.logger.log(`[whatsapp-legacy] voice note transcribed empty for botId=${tenant.botId} — dropping`);
                return null;
            }
            return result.transcript;
        } catch (err) {
            this.logger.warn(
                `[whatsapp-legacy] voice note transcription failed for botId=${tenant.botId}: ${err?.message}`,
            );
            return null;
        }
    }

    async verifyWebhook(mode: string, verifyToken: string, challenge: string): Promise<string> {
        if (mode !== 'subscribe') {
            throw new ForbiddenException('Invalid hub.mode');
        }

        const integrations = await this.prisma.integrations.findMany({
            where: { type: { in: ['whatsapp', 'whatsapp_manual'] } },
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
                    where: { type: { in: ['whatsapp', 'whatsapp_manual'] } },
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
                    const senderId = message.from;
                    // Text passes straight through; audio (voice note) is
                    // transcribed. Everything else stays silent-drop.
                    const text = await this.extractWhatsAppText(message, accessToken, {
                        botId,
                        teamId: integration.teamId,
                    });
                    if (!text) continue;
                    // Loop guard, layer 1 — see meta.service.ts Messenger loop.
                    if (await this.loopGuard.shouldRateLimit(botId, senderId, 'whatsapp')) continue;
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
                                sourceChannel: 'whatsapp',
                            } as any,
                            '0.0.0.0',
                        );

                        const replyText = resolveMetaReplyText(response);
                        if (replyText) {
                            // Loop guard, layer 2 — see meta.service.ts.
                            if (await this.loopGuard.isDuplicateReply(botId, senderId, replyText, 'whatsapp')) continue;
                            await this.sendWhatsAppMessage(senderId, replyText, phoneNumberId, accessToken);
                            await this.loopGuard.recordReply(botId, senderId, replyText);
                        } else {
                            this.logger.warn(
                                `[whatsapp-legacy] empty chat response for botId=${botId} chatId=${chatId} — no reply sent`,
                            );
                        }
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
