import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Redis-backed registry of Graph API message ids WE sent to Meta
 * channels (bot replies from meta.service, dashboard agent replies
 * from report.service's deliverToExternalChannel).
 *
 * Why it exists: Messenger/Instagram echo webhooks (`message.is_echo`)
 * fire for EVERY page-sent message — both our API sends and messages
 * the owner types manually in the IG/Messenger inbox app. The
 * owner-echo takeover flow (meta.service.handleOwnerEcho) must treat
 * only the latter as "a human took over". Recording every mid we send
 * lets the echo handler answer "is this ours?" deterministically.
 *
 * Shape: one `SET meta:sent-mid:<mid> 1 EX <ttl>` per send. Echoes
 * arrive within seconds; 15 minutes of TTL is generous headroom for
 * webhook retries without letting the keyspace grow.
 *
 * No Redis (local dev without the cluster) → record() is a no-op and
 * isOurs() returns false. That fails HOT (an echo would look like an
 * owner takeover), which is why the caller keeps a transcript-based
 * dedupe as a second guard and the whole takeover path sits behind
 * META_ECHO_TAKEOVER_ENABLED (default off).
 */
@Injectable()
export class MetaSentRegistryService implements OnModuleDestroy {
  private readonly logger = new Logger(MetaSentRegistryService.name);
  private readonly redis: Redis | null;

  private static readonly KEY_PREFIX = 'meta:sent-mid:';
  private static readonly TTL_SECONDS = 15 * 60;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      this.redis = new Redis(redisUrl, {
        lazyConnect: false,
        maxRetriesPerRequest: 2,
      });
      this.redis.on('error', (err) => {
        this.logger.warn(`Redis client error: ${err.message}`);
      });
    } else {
      this.redis = null;
      this.logger.log('REDIS_URL not set — sent-mid registry disabled (echo takeover falls back to transcript dedupe only)');
    }
  }

  /** Record a Graph message id we just sent. Never throws. */
  async record(mid: string | undefined | null): Promise<void> {
    if (!mid || !this.redis) return;
    try {
      await this.redis.set(
        MetaSentRegistryService.KEY_PREFIX + mid,
        '1',
        'EX',
        MetaSentRegistryService.TTL_SECONDS,
      );
    } catch (err) {
      this.logger.warn(`record(${mid}) failed: ${err?.message}`);
    }
  }

  /** True when the mid is one we sent within the TTL window. Never throws. */
  async isOurs(mid: string | undefined | null): Promise<boolean> {
    if (!mid || !this.redis) return false;
    try {
      const hit = await this.redis.get(MetaSentRegistryService.KEY_PREFIX + mid);
      return hit !== null;
    } catch (err) {
      this.logger.warn(`isOurs(${mid}) failed: ${err?.message}`);
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis?.quit().catch(() => undefined);
  }
}
