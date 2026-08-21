import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

import { SmsProvider } from './sms-provider.interface';

// Same shape as the NETGSM retry envelope (netgsm.provider.ts): one
// retry on transient failure, fixed 3s backoff, per-attempt timeout that
// keeps two attempts + backoff under the MCP caller's 30s ceiling
// (13+3+13 = 29s). Twilio's own SDK enforces its internal HTTP timeout
// through `edge`/`region` config; the outer per-attempt fence is here
// so a slow Twilio call can't stall the whole MCP round trip.
const PER_ATTEMPT_TIMEOUT_MS = 13000;
const RETRY_BACKOFF_MS = 3000;

// Twilio REST error codes fall into two big buckets we care about:
// - 60xxx: Verify / Lookup / phone-related classification (permanent
//          for us — bad number, unverified sender, etc.)
// - 30xxx: message delivery status (some transient, some permanent —
//          see the numeric ranges below)
// - HTTP status: 5xx → transient, 4xx → permanent (mirror of NETGSM
//   classifier; Twilio uses 429 for rate limit which we treat as
//   transient by including it in the retry set)
// Twilio SDK errors surface as `err.status` (HTTP) + `err.code` (Twilio-
// specific numeric). Only pull the classifier we actually need — this
// list is bounded so any unrecognized error defaults to non-retryable
// (fail-loud rather than mask a config bug on a silent retry loop).
const TWILIO_TRANSIENT_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

/**
 * Twilio Programmable SMS transport. Sends via Messaging Service SID
 * (`TWILIO_MESSAGING_SERVICE_SID`) rather than a fixed `from` number, so
 * Twilio picks the best sender for the destination country automatically
 * (US long code, UK alphanumeric, DE Twilio number, etc.) — this is why
 * we route international traffic here instead of piling per-country
 * sender rules into config.
 *
 * Instantiated lazily (`ensureClient`) so a pod that never routes an
 * international SMS never pays the SDK-init cost, and dev pods without
 * Twilio secrets don't crash at boot — only when someone actually
 * tries to send via this provider. When routing is off
 * (`SMS_PROVIDER_STRATEGY=netgsm_only`), this class is registered but
 * never invoked.
 *
 * See `.claude/plans/this-is-a-example-ticklish-dove.md` (Slice 1) for
 * why this ships behind the flag before Slice 2 turns routing on in dev.
 */
@Injectable()
export class TwilioSmsProvider implements SmsProvider {
  readonly name = 'twilio' as const;

  // Lazy singleton — `require`d on first send so the `twilio` package
  // is loaded off the hot path and a pod without Twilio credentials
  // stays healthy until the first call actually needs it.
  private client: any | null = null;
  private clientInitFailed = false;

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  private ensureClient(): any {
    if (this.clientInitFailed) {
      throw new InternalServerErrorException('Twilio provider is not configured');
    }
    if (this.client) return this.client;

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      this.clientInitFailed = true;
      this.logger.error(
        'Twilio credentials are not configured (TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN)',
      );
      throw new InternalServerErrorException('Twilio provider is not configured');
    }

    // Require rather than top-level import so a pod that never routes
    // internationally doesn't force-load the SDK. Also keeps the
    // `twilio` dep out of the boot path for teams running only the
    // legacy NETGSM route.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const twilio = require('twilio');
    this.client = twilio(accountSid, authToken);
    return this.client;
  }

  private isTransientFailure(err: any): boolean {
    const status = err?.status;
    if (typeof status === 'number' && TWILIO_TRANSIENT_STATUS_CODES.has(status)) {
      return true;
    }
    // Twilio SDK sometimes wraps network errors with axios-style codes
    // (same shape the NETGSM classifier handles).
    const code = err?.code;
    if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') return true;
    if (code === 'ECONNRESET' || code === 'ENOTFOUND') return true;
    return false;
  }

  async sendSms(input: {
    e164: string;
    country: string;
    message: string;
    context: string;
  }): Promise<void> {
    const { e164, country, message, context } = input;

    // Dev/local escape hatch mirrors NETGSM_MOCK — set TWILIO_MOCK=true
    // on any dev pod to exercise the routing end-to-end without spending
    // real Twilio credits. Prod NEVER sets this.
    if (process.env.TWILIO_MOCK?.toLowerCase() === 'true') {
      this.logger.info(
        `[TWILIO_MOCK] Would send ${context} to ${e164} (${country}): "${message}"`,
      );
      return;
    }

    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;

    if (!messagingServiceSid && !fromNumber) {
      this.logger.error(
        'Twilio sender not configured (need TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER)',
      );
      throw new InternalServerErrorException('Twilio sender is not configured');
    }

    const client = this.ensureClient();

    const attempt = async (): Promise<string> => {
      // Prefer messagingServiceSid — Twilio picks the best sender for
      // the destination country. `from` is the fallback for early
      // provisioning before a Messaging Service is set up.
      const params: Record<string, unknown> = {
        to: e164,
        body: message,
      };
      if (messagingServiceSid) {
        params.messagingServiceSid = messagingServiceSid;
      } else {
        params.from = fromNumber;
      }
      // Twilio SDK has its own timeout defaulting to the HTTP agent's,
      // usually 30s. Wrap in Promise.race to enforce the per-attempt
      // fence — otherwise a Twilio hang could exceed the MCP 30s ceiling.
      const timeoutMs = PER_ATTEMPT_TIMEOUT_MS;
      const send = client.messages.create(params);
      const timeout = new Promise<never>((_, reject) => {
        const t = setTimeout(() => {
          const err: any = new Error(`Twilio send timed out after ${timeoutMs}ms`);
          err.code = 'ECONNABORTED';
          reject(err);
        }, timeoutMs);
        // Prevent the timer from keeping the event loop alive if the
        // send resolves first — Node auto-clears via unref-on-settle
        // on the actual resolver, but Promise.race doesn't so we help
        // it along here.
        send.finally(() => clearTimeout(t));
      });
      const result: any = await Promise.race([send, timeout]);
      return result?.sid ?? 'n/a';
    };

    let sid: string;
    try {
      sid = await attempt();
    } catch (firstErr: any) {
      if (!this.isTransientFailure(firstErr)) {
        this.logger.error(
          `[TWILIO] permanent fail sending ${context} to ${e164} (no retry): ${firstErr?.message ?? firstErr}`,
        );
        throw firstErr;
      }
      this.logger.warn(
        `[TWILIO] transient fail sending ${context} to ${e164}, retrying in ${RETRY_BACKOFF_MS}ms: ${firstErr?.message ?? firstErr}`,
      );
      await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS));
      try {
        sid = await attempt();
        this.logger.info(`[TWILIO] recovered on retry sending ${context} to ${e164}`);
      } catch (secondErr: any) {
        this.logger.error(
          `[TWILIO] exhausted after 2 attempts sending ${context} to ${e164}: ${secondErr?.message ?? secondErr}`,
        );
        throw secondErr;
      }
    }

    this.logger.info(
      `[TWILIO] ${context} sent to ${e164} country=${country} sid=${sid}`,
    );
  }
}
