import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

export type MetaChatPrefix = 'ig' | 'fb' | 'wa' | 'wa_test';

/**
 * Idle-based thread rotation for Meta-family channels
 * (Instagram DM, Messenger, WhatsApp Cloud, WhatsApp test).
 *
 * On the widget, each browser session starts a fresh chatId; on Meta
 * webhooks the visitor identity is the platform account and the naive
 * shape `<prefix>_<senderId>` lives forever. LangGraph's checkpointer
 * then piles state and prior assistant replies onto one thread across
 * days, and the model starts pattern-matching on its own stale output
 * (e.g. narrating "SMS gönderdim" turn after turn without ever calling
 * the tool). Widget flows never see this because their sessions expire
 * naturally.
 *
 * Rotation strategy: keep a Redis cursor per (prefix, visitorId) that
 * remembers the current suffix and the last activity timestamp. If the
 * gap since the last message exceeds META_IDLE_ROTATION_HOURS (default
 * 6h), mint a fresh suffix from the current epoch millis — that flips
 * the chatId, which the gateway sees as a brand-new LangGraph thread.
 * Same visitor, clean context.
 *
 * Kill switch: META_IDLE_ROTATION_ENABLED=false makes resolveChatId a
 * no-op that returns the legacy `<prefix>_<senderId>` shape, matching
 * pre-Slice-8 behavior for rollback without a code change.
 */
@Injectable()
export class MetaChatCursorService implements OnModuleDestroy {
    private readonly logger = new Logger(MetaChatCursorService.name);
    private readonly redis: Redis;
    private readonly enabled: boolean;
    private readonly idleWindowSecs: number;

    constructor() {
        const redisUrl = process.env.REDIS_URL || 'redis://redis-service:6379';
        this.redis = new Redis(redisUrl, {
            lazyConnect: false,
            maxRetriesPerRequest: 2,
        });
        this.redis.on('error', (err) => {
            this.logger.warn(`Redis client error: ${err.message}`);
        });

        this.enabled = (process.env.META_IDLE_ROTATION_ENABLED ?? 'true')
            .trim()
            .toLowerCase() === 'true';
        const hours = parseInt(process.env.META_IDLE_ROTATION_HOURS ?? '6', 10);
        this.idleWindowSecs = (Number.isFinite(hours) && hours > 0 ? hours : 6) * 3600;
    }

    onModuleDestroy() {
        this.redis.disconnect();
    }

    /**
     * Resolve the chatId to use for this webhook turn.
     *
     * Redis miss OR gap since last activity > idle window → mint a new
     * suffix (epoch ms), store the fresh cursor, return the new chatId.
     * Otherwise reuse the existing suffix and bump lastMessageAt.
     *
     * Redis outage falls back to the legacy `<prefix>_<visitorId>`
     * shape so a broken cache never breaks the webhook — a rotation
     * miss just means the visitor stays on the same thread longer,
     * which is exactly the pre-Slice-8 behavior.
     */
    async resolveChatId(prefix: MetaChatPrefix, visitorId: string): Promise<string> {
        const legacy = `${prefix}_${visitorId}`;
        if (!this.enabled) return legacy;

        const key = `meta:chat-cursor:${prefix}:${visitorId}`;
        const nowSecs = Math.floor(Date.now() / 1000);
        const ttlSecs = this.idleWindowSecs * 4;

        try {
            const raw = await this.redis.get(key);
            if (raw) {
                const parsed = JSON.parse(raw) as { chatId: string; lastMessageAt: number };
                const gap = nowSecs - (parsed.lastMessageAt ?? 0);
                if (parsed.chatId && gap < this.idleWindowSecs) {
                    await this.redis.setex(
                        key,
                        ttlSecs,
                        JSON.stringify({ chatId: parsed.chatId, lastMessageAt: nowSecs }),
                    );
                    return parsed.chatId;
                }
                this.logger.log(
                    `[MetaChatCursor] rotating ${prefix}/${visitorId} — idle ${gap}s ` +
                    `≥ ${this.idleWindowSecs}s (prev chatId=${parsed.chatId})`,
                );
            }

            const chatId = `${prefix}_${visitorId}_${Date.now()}`;
            await this.redis.setex(
                key,
                ttlSecs,
                JSON.stringify({ chatId, lastMessageAt: nowSecs }),
            );
            return chatId;
        } catch (err) {
            this.logger.warn(
                `[MetaChatCursor] Redis lookup failed for ${prefix}/${visitorId}, ` +
                `falling back to legacy chatId: ${(err as Error).message}`,
            );
            return legacy;
        }
    }
}
