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
 * ## Why the OTP choice is single-use
 *
 * A number with no WhatsApp account fails ASYNCHRONOUSLY at Twilio: our
 * send returns success, the code never arrives, and nothing throws. With
 * a sticky preference the resend would go to WhatsApp too and the
 * visitor would be stuck in a loop — a silently lost lead, and only for
 * people who mis-picked.
 *
 * So `consumeForOtp` marks the choice used on the first code. A resend
 * falls back to SMS. This costs the traveller the feature exists for
 * almost nothing: their first send reaches them precisely because they
 * do have WhatsApp, so they never reach a resend. Someone who does
 * reach one is, by that fact, someone WhatsApp didn't reach. Re-picking
 * WhatsApp on the form writes a fresh choice, so the escape hatch stays
 * open in both directions.
 *
 * The mark is a value change rather than a delete because a second
 * reader still needs the answer: `AppointmentService` stamps the
 * visitor's channel onto the appointment AFTER the booking OTP has
 * already consumed it, and that appointment's confirmation and
 * reminders must still follow the channel the visitor chose. `peek` is
 * for those readers; `consumeForOtp` is only for the code senders.
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
   * Channel the NEXT ONE-TIME CODE for this conversation goes out over,
   * marking the choice used so a resend falls back to SMS. Only the code
   * senders call this — see the single-use rationale in the class
   * docstring.
   *
   * The mark is best-effort: if it fails we still return the channel the
   * visitor picked, because failing to record "used" is far better than
   * withholding a code they are waiting for. Worst case a resend also
   * goes over WhatsApp, which is exactly today's behaviour.
   */
  async consumeForOtp(chatId: string | null | undefined): Promise<OtpChannel> {
    if (!this.redis || !chatId) return 'sms';
    try {
      const stored = await this.redis.get(this.key(chatId));

      if (stored === 'whatsapp_used') {
        // A WhatsApp code already went out and the visitor is asking
        // again — WhatsApp evidently did not reach them. Fall back to
        // SMS and clear the choice entirely, so the callers' cooldown
        // bypass fires exactly once and the appointment stamp records
        // the channel that actually worked.
        try {
          await this.redis.del(this.key(chatId));
        } catch (delErr: any) {
          this.logger.warn(
            `Failed to clear spent OTP channel preference for chat=${chatId}: ${delErr?.message ?? delErr}`,
          );
        }
        return 'sms';
      }

      if (stored !== 'whatsapp') return 'sms';

      try {
        await this.redis.set(
          this.key(chatId),
          'whatsapp_used',
          'EX',
          OtpChannelPreferenceService.KEY_TTL_SECONDS,
        );
      } catch (markErr: any) {
        this.logger.warn(
          `Failed to mark OTP channel preference used for chat=${chatId}: ${markErr?.message ?? markErr}`,
        );
      }
      return 'whatsapp';
    } catch (err: any) {
      this.logger.warn(
        `Failed to read OTP channel preference for chat=${chatId}: ${err?.message ?? err}`,
      );
      return 'sms';
    }
  }

  /**
   * True when a WhatsApp code already went out for this chat, so the
   * next one will go over SMS instead.
   *
   * Callers use this to skip their resend cooldown. That cooldown exists
   * to stop a caller hammering ONE transport; when the next code goes
   * over a DIFFERENT one it protects nothing and actively strands the
   * visitor. Observed on chatbu-dev 2026-09-08: the WhatsApp code was
   * sent at 14:42:25, the visitor said it never arrived at 14:42:40, and
   * the 60-second cooldown answered "wait a few minutes" instead of
   * sending the SMS. Nobody whose code did not arrive waits a minute
   * before saying so — the fallback is immediate or it may as well not
   * exist.
   *
   * Non-mutating, and one-shot by construction: `consumeForOtp` clears
   * the key on that same fallback, so the very next request is back
   * under the normal cooldown.
   */
  async hasSpentWhatsAppChoice(chatId: string | null | undefined): Promise<boolean> {
    if (!this.redis || !chatId) return false;
    try {
      return (await this.redis.get(this.key(chatId))) === 'whatsapp_used';
    } catch (err: any) {
      this.logger.warn(
        `Failed to read OTP channel preference for chat=${chatId}: ${err?.message ?? err}`,
      );
      return false;
    }
  }

  /**
   * The channel the visitor chose, without consuming it. For readers
   * that are not sending a code — today `AppointmentService`, stamping
   * the choice onto the appointment so its confirmation and reminders
   * follow it long after the OTP consumed the mark.
   */
  async peek(chatId: string | null | undefined): Promise<OtpChannel> {
    if (!this.redis || !chatId) return 'sms';
    try {
      const stored = await this.redis.get(this.key(chatId));
      return stored === 'whatsapp' || stored === 'whatsapp_used' ? 'whatsapp' : 'sms';
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
