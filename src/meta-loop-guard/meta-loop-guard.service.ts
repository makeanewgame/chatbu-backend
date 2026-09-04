import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter } from 'prom-client';
import Redis from 'ioredis';

export type LoopGuardChannel = 'messenger' | 'instagram' | 'whatsapp';

/**
 * Deterministic bot-to-bot loop breaker for the Meta family of
 * channels (Instagram DM, Messenger, WhatsApp).
 *
 * Why it exists — 2026-09-04 incident: two Chatbu-botted Instagram
 * accounts DM'd each other (Fovimarlo bot ↔ Sincan Tercüme bot). Each
 * bot's reply arrived at the other as a fresh inbound message —
 * `is_echo` only covers a bot's OWN messages — and the pair ping-ponged
 * "Görüşmek üzere! 👋" for 24 minutes / ~790 messages / ~400 LLM calls
 * until the integration was manually disabled. Overnight it would have
 * burned tokens for hours.
 *
 * Two independent layers, both channel-agnostic and language-agnostic
 * (pure counters + byte equality — no keyword lists, no LLM judgment):
 *
 *  1. RATE BREAKER (pre-LLM): more than MAX_REPLIES_PER_WINDOW bot
 *     replies to the same (botId, contactId) pair within WINDOW_SECONDS
 *     → stop invoking the LLM entirely. Saves the token spend, starves
 *     the loop. No human conversation sustains 20+ bot replies in 10
 *     minutes.
 *  2. DUPLICATE SUPPRESSOR (post-LLM): outbound reply byte-identical to
 *     one of the last DUPLICATE_LOOKBACK bot replies in the same
 *     conversation → don't send it. Kills a ping-pong by its ~3rd
 *     repetition, long before the rate window fills. Side benefit: the
 *     HANDOFF_PENDING acknowledgment no longer spams on every turn of a
 *     HUMAN_ACTIVE conversation.
 *
 * Kill switch semantics are INVERTED relative to feature flags: this is
 * a protective control, so a missing META_LOOP_GUARD_ENABLED env means
 * ON. Set the key to "false" (configMapKeyRef in k8s/deployment.yaml)
 * to disable.
 *
 * No Redis → both checks return false (guard inert) — same graceful
 * shape as MetaSentRegistryService / MetaChatCursorService.
 */
@Injectable()
export class MetaLoopGuardService implements OnModuleDestroy {
  private readonly logger = new Logger(MetaLoopGuardService.name);
  private readonly redis: Redis | null;
  private readonly enabled: boolean;

  private static readonly WINDOW_SECONDS = 600;
  private static readonly MAX_REPLIES_PER_WINDOW = 20;
  private static readonly DUPLICATE_LOOKBACK = 2;
  private static readonly LAST_REPLIES_TTL_SECONDS = 900;

  private static readonly RATE_PREFIX = 'meta:loopguard:rate:';
  private static readonly LAST_PREFIX = 'meta:loopguard:last:';

  constructor(
    @Optional()
    @InjectMetric('chatbu_meta_loop_guard_total')
    private readonly guardCounter?: Counter<string>,
  ) {
    this.enabled = (process.env.META_LOOP_GUARD_ENABLED ?? 'true').trim().toLowerCase() === 'true';
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
          ? 'REDIS_URL not set — meta loop guard inert'
          : 'META_LOOP_GUARD_ENABLED=false — meta loop guard disabled',
      );
    }
  }

  private key(prefix: string, botId: string, contactId: string): string {
    return `${prefix}${botId}:${contactId}`;
  }

  /**
   * Pre-LLM check: true when this (bot, contact) pair has already
   * received MAX_REPLIES_PER_WINDOW bot replies inside the rolling
   * window — the caller should skip the LLM call and drop the inbound
   * message. Never throws.
   */
  async shouldRateLimit(botId: string, contactId: string, channel: LoopGuardChannel): Promise<boolean> {
    if (!this.redis) return false;
    try {
      const count = await this.redis.get(this.key(MetaLoopGuardService.RATE_PREFIX, botId, contactId));
      const limited =
        count !== null && parseInt(count, 10) >= MetaLoopGuardService.MAX_REPLIES_PER_WINDOW;
      if (limited) {
        this.guardCounter?.labels(channel, 'rate_limited').inc();
        this.logger.warn(
          `[loop-guard] rate breaker tripped bot=${botId} contact=${contactId} channel=${channel} — dropping inbound without LLM call`,
        );
      }
      return limited;
    } catch (err) {
      this.logger.warn(`shouldRateLimit failed: ${err?.message}`);
      return false;
    }
  }

  /**
   * Post-LLM check: true when the reply text is byte-identical to one
   * of the last DUPLICATE_LOOKBACK replies we sent this contact — the
   * caller should suppress the send. Never throws.
   */
  async isDuplicateReply(
    botId: string,
    contactId: string,
    text: string,
    channel: LoopGuardChannel,
  ): Promise<boolean> {
    if (!this.redis || !text) return false;
    try {
      const recent = await this.redis.lrange(
        this.key(MetaLoopGuardService.LAST_PREFIX, botId, contactId),
        0,
        MetaLoopGuardService.DUPLICATE_LOOKBACK - 1,
      );
      const duplicate = recent.includes(text);
      if (duplicate) {
        this.guardCounter?.labels(channel, 'duplicate_suppressed').inc();
        this.logger.warn(
          `[loop-guard] duplicate reply suppressed bot=${botId} contact=${contactId} channel=${channel}`,
        );
      }
      return duplicate;
    } catch (err) {
      this.logger.warn(`isDuplicateReply failed: ${err?.message}`);
      return false;
    }
  }

  /**
   * Record a successfully-sent reply: bumps the rate counter and
   * pushes onto the last-replies list. Call AFTER the Graph send
   * succeeds so failed sends don't consume budget. Never throws.
   */
  async recordReply(botId: string, contactId: string, text: string): Promise<void> {
    if (!this.redis) return;
    try {
      const rateKey = this.key(MetaLoopGuardService.RATE_PREFIX, botId, contactId);
      const lastKey = this.key(MetaLoopGuardService.LAST_PREFIX, botId, contactId);
      const multi = this.redis.multi();
      multi.incr(rateKey);
      // NX: the window is fixed from the FIRST reply — a steady trickle
      // can't keep resetting its own budget.
      multi.expire(rateKey, MetaLoopGuardService.WINDOW_SECONDS, 'NX');
      multi.lpush(lastKey, text);
      multi.ltrim(lastKey, 0, MetaLoopGuardService.DUPLICATE_LOOKBACK - 1);
      multi.expire(lastKey, MetaLoopGuardService.LAST_REPLIES_TTL_SECONDS);
      await multi.exec();
    } catch (err) {
      this.logger.warn(`recordReply failed: ${err?.message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis?.quit().catch(() => undefined);
  }
}
