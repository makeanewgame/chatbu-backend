import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

import { OtpChannel } from './sms.service';

/**
 * The visitor's chosen transport for the next one-time code.
 *
 * ## Why this exists at all
 *
 * The OTP is not requested by the widget — it is triggered server-side,
 * inside the MCP tool boundary (`capture_lead` self-triggers the lead
 * OTP; `request_booking_verification` sends the booking one). The visitor
 * types their phone into the contact form, the form is replayed to the
 * agent as a plain message, and some turns later a code goes out. There
 * is no request the visitor's choice could ride along on.
 *
 * The obvious shortcut — append "channel: whatsapp" to the replayed form
 * message and let the agent forward it as a tool argument — is exactly
 * the prompt-compliance trap this codebase has been burned by before
 * (see `lead_tools.py`'s note on why `capture_lead` self-triggers rather
 * than asking the model to call a second tool). So the choice travels
 * out-of-band: the widget writes it here, the flow services read it. The
 * model is never in the loop and cannot get it wrong.
 *
 * ## Why keyed on chatId alone
 *
 * Every write and read is scoped to one conversation, and `chatId` is a
 * cuid — globally unique on its own. Adding a bot identifier to the key
 * would only create a way for writer and reader to disagree about WHICH
 * bot identifier (the widget knows `botSettings.id`, the booking flow
 * carries `botCuid`), and a key mismatch here fails silently as "SMS".
 * One field, no mismatch possible.
 *
 * ## Failure posture
 *
 * Every failure path returns `'sms'` — the channel every caller used
 * before this service existed. No Redis, expired key, malformed value,
 * connection error: the visitor gets an SMS, which is the behaviour the
 * platform has always had. WhatsApp is strictly additive.
 */
@Injectable()
export class OtpChannelPreferenceService implements OnModuleDestroy {
  private readonly logger = new Logger(OtpChannelPreferenceService.name);
  private readonly redis: Redis | null;

  private static readonly KEY_PREFIX = 'lead:otp-channel:';

  /**
   * Long enough to cover a slow form → agent → tool round trip and a
   * resend or two, short enough that a choice made in one conversation
   * can't haunt a later flow. The preference is re-written on every
   * form submit, so the TTL only bounds the abandoned case.
   */
  private static readonly KEY_TTL_SECONDS = 30 * 60;

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
      this.logger.warn('REDIS_URL not set — every OTP will go out over SMS');
    }
  }

  private key(chatId: string): string {
    return `${OtpChannelPreferenceService.KEY_PREFIX}${chatId}`;
  }

  /**
   * Record the visitor's choice for this conversation. Best-effort: a
   * write failure means the code goes out over SMS, so it is logged and
   * swallowed rather than failing the visitor's form submit.
   */
  async set(chatId: string, channel: OtpChannel): Promise<void> {
    if (!this.redis || !chatId) return;
    try {
      await this.redis.set(
        this.key(chatId),
        channel,
        'EX',
        OtpChannelPreferenceService.KEY_TTL_SECONDS,
      );
    } catch (err: any) {
      this.logger.warn(
        `Failed to store OTP channel preference for chat=${chatId}: ${err?.message ?? err}`,
      );
    }
  }

  /**
   * Channel the next code for this conversation should go out over.
   * Returns `'sms'` for anything but an explicit, still-live `whatsapp`
   * choice.
   */
  async get(chatId: string | null | undefined): Promise<OtpChannel> {
    if (!this.redis || !chatId) return 'sms';
    try {
      const stored = await this.redis.get(this.key(chatId));
      return stored === 'whatsapp' ? 'whatsapp' : 'sms';
    } catch (err: any) {
      this.logger.warn(
        `Failed to read OTP channel preference for chat=${chatId}: ${err?.message ?? err}`,
      );
      return 'sms';
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      await this.redis.quit().catch(() => undefined);
    }
  }
}
