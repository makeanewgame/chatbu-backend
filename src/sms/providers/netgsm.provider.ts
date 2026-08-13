import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter } from 'prom-client';
import { AxiosResponse } from 'axios';

import { SmsProvider } from './sms-provider.interface';

const NETGSM_SEND_URL = 'https://api.netgsm.com.tr/sms/rest/v2/send';

// Retry envelope (P2 follow-up 2026-08-03). NETGSM is intermittently
// slow / 5xx / logically-rejecting; the earlier single-attempt design
// surfaced every one of those as a hard LEAD_SMS_VERIFICATION_UNAVAILABLE
// sentinel to the visitor. Sizing rationale:
//   PER_ATTEMPT_TIMEOUT_MS = 12000 → two attempts + backoff fit comfortably
//     inside the MCP caller's 30s ceiling (12+3+12 = 27s) so MCP never
//     cancels backend mid-retry. Down from hotfix #133's 25000ms because
//     retry is more valuable than a longer single attempt.
//   RETRY_BACKOFF_MS      = 3000  → short enough to keep total worst-case
//     under 30s; long enough that a briefly-degraded NETGSM has time to
//     recover between the two hits.
const PER_ATTEMPT_TIMEOUT_MS = 12000;
const RETRY_BACKOFF_MS = 3000;

// NETGSM v2/send returns HTTP 200 even on a logical failure - the real
// outcome lives in the JSON body's `code` field. "00" and "01" are the only
// success codes (message accepted / queued); anything else is a provider or
// account error (bad credentials, unapproved msgheader, IYS filter reject,
// insufficient credit, etc). Never treat HTTP 200 alone as success.
const NETGSM_SUCCESS_CODES = new Set(['00', '01']);

/**
 * Convert E.164 (`+905321112233`) into NETGSM's expected wire format
 * (`905321112233` — no `+`, no spaces, no dashes). NETGSM only accepts
 * Turkish MSISDNs at all, so `SmsService.pickProvider` will not route
 * a non-TR phone here — this helper does not need to handle other
 * country codes.
 *
 * Historical note: the pre-provider-abstraction `SmsService` had a
 * `normalizeTurkishPhone` helper that ACCEPTED any digit shape (local
 * `0532…`, bare 10-digit `532…`, or `+90…`) and forced them all into
 * `90XXXXXXXXXX`. That was safe when NETGSM was the only sink and
 * every phone was Turkish, but became a silent-corruption trap when
 * international phones started landing on it (any 10+-digit string
 * got a `90` prefix and misdelivered). E.164 parsing now happens ONCE
 * in `SmsService.sendSms`; this helper is the last-mile wire shape
 * for the one provider that needs the plus stripped.
 */
function stripPlusForNetgsm(e164: string): string {
  return e164.replace(/^\+/, '');
}

@Injectable()
export class NetgsmSmsProvider implements SmsProvider {
  readonly name = 'netgsm' as const;

  constructor(
    private readonly httpService: HttpService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    // Legacy counter kept in parallel with the new `chatbu_sms_send_total`
    // (added in metrics.providers.ts alongside the provider abstraction).
    // Grafana dashboards + alerts built against the old name keep working
    // while we migrate; a follow-up cleanup PR will delete this once the
    // dashboards move over.
    @InjectMetric('chatbu_netgsm_send_total')
    private readonly netgsmSendCounter: Counter<'context' | 'outcome'>,
  ) {}

  /**
   * Classify a NETGSM send failure as retryable (transient — worth a
   * second attempt) or not (permanent — a retry would fail identically).
   *
   * Retryable:
   *   - HTTP 5xx (NETGSM server error)
   *   - axios timeout (ECONNABORTED, ETIMEDOUT — NETGSM hanging)
   *   - network reset / DNS fail (ECONNRESET, ENOTFOUND — transport blip)
   *   - `.netgsmLogical = true` (we tagged a non-success code from the
   *     JSON body — NETGSM's own transient-vs-permanent distinction is
   *     not documented reliably, so retry once and see)
   *
   * NOT retryable:
   *   - HTTP 4xx (bad auth, malformed request — same result next time)
   *   - anything else (unknown failure mode; err on the side of caller
   *     seeing the real error rather than swallowing it silently)
   */
  private isTransientFailure(err: any): boolean {
    if (err?.netgsmLogical === true) return true;
    const code = err?.code;
    if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') return true;
    if (code === 'ECONNRESET' || code === 'ENOTFOUND') return true;
    const status = err?.response?.status;
    if (typeof status === 'number' && status >= 500) return true;
    return false;
  }

  async sendSms(input: {
    e164: string;
    country: string;
    message: string;
    context: string;
  }): Promise<void> {
    const to = stripPlusForNetgsm(input.e164);
    const { message, context } = input;

    // Dev/local escape hatch: skip the real NETGSM call and just log,
    // so end-to-end flows can be exercised without spending real SMS
    // credits or needing a live NETGSM account on every dev machine.
    // Never enable in prod.
    if (process.env.NETGSM_MOCK?.toLowerCase() === 'true') {
      this.logger.info(`[NETGSM_MOCK] Would send ${context} to ${to}: "${message}"`);
      return;
    }

    const username = process.env.NETGSM_USERNAME;
    const password = process.env.NETGSM_PASSWORD;
    const msgheader = process.env.NETGSM_MSGHEADER;

    if (!username || !password || !msgheader) {
      this.logger.error(
        'NETGSM credentials are not configured (NETGSM_USERNAME/NETGSM_PASSWORD/NETGSM_MSGHEADER)',
      );
      throw new InternalServerErrorException('SMS provider is not configured');
    }

    const basicAuth = Buffer.from(`${username}:${password}`).toString('base64');

    // Single-attempt send. Encapsulated so the retry envelope below can
    // invoke it twice without duplicating the axios call site. Tags any
    // non-success `code` in the JSON body with `.netgsmLogical = true`
    // so isTransientFailure treats it as retryable.
    const attempt = async (): Promise<AxiosResponse> => {
      const response = await firstValueFrom(
        this.httpService.post(
          NETGSM_SEND_URL,
          {
            msgheader,
            encoding: 'TR',
            iysfilter: '0',
            partnercode: '',
            messages: [{ msg: message, no: to }],
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Basic ${basicAuth}`,
            },
            timeout: PER_ATTEMPT_TIMEOUT_MS,
          },
        ),
      );
      const code_ = response.data?.code;
      if (!NETGSM_SUCCESS_CODES.has(code_)) {
        const err: any = new Error(`NETGSM rejected the message (code=${code_})`);
        err.netgsmLogical = true;
        err.netgsmCode = code_;
        throw err;
      }
      return response;
    };

    // Retry envelope (2026-08-03 follow-up to hotfix #133). One retry
    // on transient failures with a fixed 3s backoff. Permanent failures
    // (bad credentials, malformed request, 4xx) skip the retry and
    // surface the original error so a config bug isn't masked. See
    // isTransientFailure() for the classification.
    let response: AxiosResponse;
    try {
      response = await attempt();
      this.netgsmSendCounter.inc({ context, outcome: 'success_on_first' });
    } catch (firstErr: any) {
      if (!this.isTransientFailure(firstErr)) {
        this.netgsmSendCounter.inc({ context, outcome: 'permanent_fail' });
        this.logger.error(
          `[NETGSM] permanent fail sending ${context} to ${to} (no retry): ${firstErr?.message ?? firstErr}`,
        );
        throw firstErr;
      }
      this.logger.warn(
        `[NETGSM] transient fail sending ${context} to ${to}, retrying in ${RETRY_BACKOFF_MS}ms: ${firstErr?.message ?? firstErr}`,
      );
      await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS));
      try {
        response = await attempt();
        this.netgsmSendCounter.inc({ context, outcome: 'success_on_retry' });
        this.logger.info(`[NETGSM] recovered on retry sending ${context} to ${to}`);
      } catch (secondErr: any) {
        this.netgsmSendCounter.inc({ context, outcome: 'exhausted' });
        this.logger.error(
          `[NETGSM] exhausted after 2 attempts sending ${context} to ${to}: ${secondErr?.message ?? secondErr}`,
        );
        throw secondErr;
      }
    }

    this.logger.info(`[NETGSM] ${context} sent to ${to} (jobid=${response.data?.jobid ?? 'n/a'})`);
  }
}
