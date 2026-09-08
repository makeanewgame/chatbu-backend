import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

import { WhatsAppProvider, WhatsAppTemplateInput } from './whatsapp-provider.interface';

// Same retry envelope as the SMS providers (netgsm.provider.ts /
// twilio.provider.ts): one retry on a transient failure, fixed backoff,
// per-attempt timeout so a Twilio hang can't outlive the caller's own
// deadline. Kept local rather than shared because each transport has
// owned its envelope since the provider seam was introduced, and
// refactoring the working SMS path was not worth the risk of adding a
// second channel.
const RETRY_BACKOFF_MS = 3000;
const PER_ATTEMPT_TIMEOUT_MS = 10000;
const TWILIO_TRANSIENT_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

/**
 * WhatsApp template transport over Twilio.
 *
 * Sends a pre-approved Content template (`contentSid` + `contentVariables`)
 * from the platform's own WhatsApp sender. Two things differ from the SMS
 * providers and both are structural, not stylistic:
 *
 *  1. No free text. A business-initiated WhatsApp message outside the
 *     24-hour service window must be an approved template; Meta owns the
 *     body and localizes it per template language. We supply only the
 *     variables.
 *  2. A fixed `from`, not a Messaging Service. WhatsApp senders are bound
 *     to a specific number and a specific WhatsApp Business Account —
 *     there is no "pick the best sender for the country" equivalent, so
 *     `TWILIO_WHATSAPP_FROM` is required rather than optional.
 *
 * The sender is deliberately CENTRAL (Chatbu's own number), not per
 * tenant: a tenant's own WhatsApp number would need its own template
 * approved inside its own WABA, which no bot owner is going to do.
 *
 * Credentials and sender are read lazily on first send, so a pod with no
 * WhatsApp configuration boots healthy and only fails when something
 * actually tries to use the channel — the same posture as
 * `TwilioSmsProvider`.
 */
@Injectable()
export class TwilioWhatsAppProvider implements WhatsAppProvider {
  readonly name = 'twilio_whatsapp' as const;

  private client: any | null = null;
  private clientInitFailed = false;

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  private ensureClient(): any {
    if (this.clientInitFailed) {
      throw new InternalServerErrorException('Twilio WhatsApp provider is not configured');
    }
    if (this.client) return this.client;

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      this.clientInitFailed = true;
      this.logger.error(
        'Twilio credentials are not configured (TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN)',
      );
      throw new InternalServerErrorException('Twilio WhatsApp provider is not configured');
    }

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
    const code = err?.code;
    if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') return true;
    if (code === 'ECONNRESET' || code === 'ENOTFOUND') return true;
    return false;
  }

  async sendTemplate(input: WhatsAppTemplateInput): Promise<string> {
    const { e164, country, contentSid, variables, context } = input;

    // Dev escape hatch, mirroring NETGSM_MOCK / TWILIO_MOCK. Lets the
    // whole channel-selection flow be exercised end-to-end before the
    // templates clear Meta approval. Prod NEVER sets this.
    if (process.env.TWILIO_WHATSAPP_MOCK?.toLowerCase() === 'true') {
      this.logger.info(
        `[WHATSAPP_MOCK] Would send ${context} to ${e164} (${country}) ` +
          `template=${contentSid} vars=${JSON.stringify(variables)}`,
      );
      return 'mock';
    }

    const from = process.env.TWILIO_WHATSAPP_FROM;
    if (!from) {
      this.logger.error('WhatsApp sender not configured (TWILIO_WHATSAPP_FROM)');
      throw new InternalServerErrorException('WhatsApp sender is not configured');
    }

    const client = this.ensureClient();

    const attempt = async (): Promise<string> => {
      const params: Record<string, unknown> = {
        from: `whatsapp:${from}`,
        to: `whatsapp:${e164}`,
        contentSid,
        // Twilio expects a JSON STRING here, not an object.
        contentVariables: JSON.stringify(variables),
      };

      // Delivery status callback. A WhatsApp send to a number with no
      // WhatsApp account is ACCEPTED here and fails minutes later —
      // asynchronously, with nothing thrown — so this is the only signal
      // that the code never landed. Optional: with no URL configured the
      // send behaves exactly as before, we just lose the fallback.
      const statusCallback = process.env.TWILIO_STATUS_CALLBACK_URL;
      if (statusCallback) params.statusCallback = statusCallback;
      const send = client.messages.create(params);
      const timeout = new Promise<never>((_, reject) => {
        const t = setTimeout(() => {
          const err: any = new Error(
            `Twilio WhatsApp send timed out after ${PER_ATTEMPT_TIMEOUT_MS}ms`,
          );
          err.code = 'ECONNABORTED';
          reject(err);
        }, PER_ATTEMPT_TIMEOUT_MS);
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
          `[WHATSAPP] permanent fail sending ${context} to ${e164} (no retry): ` +
            `${firstErr?.message ?? firstErr}`,
        );
        throw firstErr;
      }
      this.logger.warn(
        `[WHATSAPP] transient fail sending ${context} to ${e164}, ` +
          `retrying in ${RETRY_BACKOFF_MS}ms: ${firstErr?.message ?? firstErr}`,
      );
      await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS));
      try {
        sid = await attempt();
        this.logger.info(`[WHATSAPP] recovered on retry sending ${context} to ${e164}`);
      } catch (secondErr: any) {
        this.logger.error(
          `[WHATSAPP] exhausted after 2 attempts sending ${context} to ${e164}: ` +
            `${secondErr?.message ?? secondErr}`,
        );
        throw secondErr;
      }
    }

    this.logger.info(
      `[WHATSAPP] ${context} sent to ${e164} country=${country} ` +
        `template=${contentSid} sid=${sid}`,
    );
    return sid;
  }
}
