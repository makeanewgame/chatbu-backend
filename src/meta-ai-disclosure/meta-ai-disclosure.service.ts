import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

import { PrismaService } from 'src/prisma/prisma.service';
import { consentLegalUrls } from 'src/lead/consent-text.constants';

/**
 * AI-transparency disclosure for the Meta family of channels (Legal
 * Slice 4 — EU AI Act Art. 50, in force since 2 Aug 2026).
 *
 * The widget has a persistent "You're chatting with an AI assistant"
 * line in its header; IG DM / Messenger / WhatsApp have no pre-chat
 * surface at all, so the disclosure is prepended deterministically to
 * the FIRST bot reply of each conversation session — exactly once, no
 * prompt rule, no model judgement. It also covers the voice-note and
 * lead-capture flows on those channels, which ride the same replies.
 *
 * "Once per conversation" is a Redis SETNX on the chatId. Chat sessions
 * for Meta threads already rotate on 6h idle (MetaChatCursorService),
 * so a returning visitor after a long gap gets a fresh chatId — and a
 * fresh disclosure, which is the behaviour Art. 50 wants. The key TTL
 * only garbage-collects; it is deliberately longer than any realistic
 * session.
 *
 * The line is brand-free ("AI assistant", not "Chatbu") — correct for
 * whitelabel tenants and for the generic-platform rule alike.
 *
 * Kill switch semantics are INVERTED like MetaLoopGuardService: this is
 * a compliance control, so a missing META_AI_DISCLOSURE_ENABLED env
 * means ON. Set it to "false" (configMapKeyRef in k8s/deployment.yaml)
 * to disable.
 *
 * No Redis → replies pass through undecorated (same graceful shape as
 * the other meta services). Redis is core prod infra; degrading to
 * "no disclosure" beats spamming the line on every message.
 */
@Injectable()
export class MetaAiDisclosureService implements OnModuleDestroy {
  private readonly logger = new Logger(MetaAiDisclosureService.name);
  private readonly redis: Redis | null;
  private readonly enabled: boolean;

  private static readonly KEY_PREFIX = 'meta:ai-disclosure:';
  private static readonly KEY_TTL_SECONDS = 7 * 24 * 3600;

  /**
   * Localized by the bot's primaryLanguage (wizard v2) — the only
   * language signal available before the visitor's own turns, and
   * language-agnostic w.r.t. message content (no detection heuristics).
   */
  private static readonly LINES: Record<string, string> = {
    en: "🤖 You're chatting with an AI assistant. Privacy:",
    tr: '🤖 Bir yapay zekâ asistanıyla yazışıyorsunuz. Gizlilik:',
    de: '🤖 Sie chatten mit einem KI-Assistenten. Datenschutz:',
    fr: '🤖 Vous discutez avec un assistant IA. Confidentialité :',
    it: '🤖 Stai chattando con un assistente IA. Privacy:',
    es: '🤖 Está chateando con un asistente de IA. Privacidad:',
  };

  constructor(private readonly prisma: PrismaService) {
    this.enabled =
      (process.env.META_AI_DISCLOSURE_ENABLED ?? 'true').trim().toLowerCase() === 'true';
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl && this.enabled) {
      this.redis = new Redis(redisUrl, {
        lazyConnect: false,
        maxRetriesPerRequest: 2,
      });
      this.redis.on('error', (err) => {
        this.logger.warn(`Redis client error: ${err.message}`);
      });
    } else {
      this.redis = null;
      this.logger.log(
        this.enabled
          ? 'REDIS_URL not set — AI disclosure inert'
          : 'META_AI_DISCLOSURE_ENABLED=false — AI disclosure disabled',
      );
    }
  }

  /**
   * Returns the reply with the disclosure line prepended iff this is the
   * first bot reply of the chat session. Never throws — any failure
   * returns the reply untouched.
   *
   * Call AFTER the loop-guard duplicate check and record the ORIGINAL
   * reply text in the guard: the guard's byte-equality must keep
   * comparing model output with model output.
   */
  async withDisclosure(botId: string, chatId: string | null | undefined, replyText: string): Promise<string> {
    if (!this.enabled || !this.redis || !chatId || !replyText) return replyText;
    try {
      const first = await this.redis.set(
        `${MetaAiDisclosureService.KEY_PREFIX}${chatId}`,
        '1',
        'EX',
        MetaAiDisclosureService.KEY_TTL_SECONDS,
        'NX',
      );
      if (first !== 'OK') return replyText;

      let lang = 'en';
      try {
        const bot = await this.prisma.customerBots.findUnique({
          where: { id: botId },
          select: { primaryLanguage: true },
        });
        if (bot?.primaryLanguage && MetaAiDisclosureService.LINES[bot.primaryLanguage]) {
          lang = bot.primaryLanguage;
        }
      } catch {
        /* language lookup is cosmetic — English fallback */
      }

      // The app's own CMS-served privacy page, in the disclosure's
      // language (legal Slice 6) — the same link the widget consent card
      // uses. Never the marketing site: its copy drifts (2026-09-12: a
      // static "4 Ağustos" header over a CMS body dated "6 Eylül"). The
      // env override stays for operators hosting the policy elsewhere.
      const privacyUrl =
        process.env.FRONTEND_PRIVACY_POLICY_URL || consentLegalUrls(lang).privacyPolicyUrl;
      this.logger.log(`AI disclosure prepended for chat ${chatId} (lang=${lang})`);
      return `${MetaAiDisclosureService.LINES[lang]} ${privacyUrl}\n\n${replyText}`;
    } catch (err) {
      this.logger.warn(
        `disclosure check failed for chat ${chatId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return replyText;
    }
  }

  onModuleDestroy() {
    this.redis?.disconnect();
  }
}
