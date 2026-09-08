import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Everything needed to re-send a one-time code over SMS after its
 * WhatsApp delivery failed. Deliberately the flow's own entry-point
 * arguments rather than a new send path — the webhook re-invokes
 * `requestSmsVerification`, which already resolves the channel, the
 * language and the rate limits.
 */
export interface OtpFallbackContext {
  flow: 'lead' | 'booking';
  botId: string;
  chatId: string;
  phone: string;
  lang?: string;
}

/**
 * Ties a WhatsApp message id to the visitor waiting on it, so Twilio's
 * asynchronous delivery callback can be turned into an SMS.
 *
 * ## Why this exists
 *
 * A WhatsApp send to a number with no WhatsApp account is ACCEPTED by
 * Twilio and fails minutes later, asynchronously, with nothing thrown.
 * Our send looks successful, the code never arrives, and the visitor is
 * left staring at an OTP prompt.
 *
 * Everything else we tried needs someone to notice and act: the visitor
 * saying "it didn't arrive" only helps if the agent then calls the
 * resend tool (on chatbu-dev 2026-09-08 it did not — it wrote advice
 * instead), and a widget button does not exist on Instagram, Messenger
 * or WhatsApp at all, where there is no card to put it on. The delivery
 * callback is the one signal that needs no visitor action, no agent
 * cooperation, and behaves identically on every channel.
 *
 * ## Single-use by design
 *
 * `take` is a GETDEL. Twilio retries status callbacks and can deliver
 * the same status more than once; consuming the entry means a duplicate
 * callback cannot produce a second SMS.
 *
 * ## Failure posture
 *
 * No Redis, a write failure, an unknown id: the fallback simply does not
 * fire and the platform behaves exactly as it did before this existed.
 * Nothing here may ever break a send that is otherwise working.
 */
@Injectable()
export class OtpDeliveryFallbackService implements OnModuleDestroy {
  private readonly logger = new Logger(OtpDeliveryFallbackService.name);
  private readonly redis: Redis | null;

  private static readonly KEY_PREFIX = 'otp:wa-sid:';

  /**
   * Long enough for Twilio to give up on a WhatsApp delivery and tell
   * us, short enough that a stale entry can't resurrect an abandoned
   * conversation. Twilio's own default message validity is 4 hours, but
   * an undeliverable destination reports back in seconds to minutes.
   */
  private static readonly KEY_TTL_SECONDS = 30 * 60;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      this.redis = new Redis(redisUrl, { lazyConnect: false, maxRetriesPerRequest: 2 });
      this.redis.on('error', (err) => {
        this.logger.warn(`Redis client error: ${err.message}`);
      });
    } else {
      this.redis = null;
      this.logger.warn('REDIS_URL not set — undelivered WhatsApp codes will not fall back to SMS');
    }
  }

  private key(messageSid: string): string {
    return `${OtpDeliveryFallbackService.KEY_PREFIX}${messageSid}`;
  }

  /** Best-effort: a failed write costs the fallback, never the send. */
  async register(messageSid: string, context: OtpFallbackContext): Promise<void> {
    if (!this.redis || !messageSid || !context.chatId) return;
    try {
      await this.redis.set(
        this.key(messageSid),
        JSON.stringify(context),
        'EX',
        OtpDeliveryFallbackService.KEY_TTL_SECONDS,
      );
    } catch (err: any) {
      this.logger.warn(
        `Failed to register OTP fallback for sid=${messageSid}: ${err?.message ?? err}`,
      );
    }
  }

  /**
   * Claim the context for a message id, exactly once. Returns null when
   * the id is unknown, already claimed, or unreadable.
   */
  async take(messageSid: string): Promise<OtpFallbackContext | null> {
    if (!this.redis || !messageSid) return null;
    try {
      const key = this.key(messageSid);
      const raw = await this.redis.get(key);
      if (!raw) return null;
      await this.redis.del(key).catch(() => undefined);
      return JSON.parse(raw) as OtpFallbackContext;
    } catch (err: any) {
      this.logger.warn(
        `Failed to claim OTP fallback for sid=${messageSid}: ${err?.message ?? err}`,
      );
      return null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      await this.redis.quit().catch(() => undefined);
    }
  }
}
