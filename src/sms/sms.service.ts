import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter } from 'prom-client';
import { AxiosResponse } from 'axios';

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

// Turkish mobile numbers only, matching NETGSM's expected `90XXXXXXXXXX`
// (country code, no leading zero, no '+'). Confirm exact formatting
// requirements against NETGSM's own docs / a real test send before go-live.
function normalizeTurkishPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('90') && digits.length === 12) {
    return digits;
  }
  if (digits.startsWith('0') && digits.length === 11) {
    return `90${digits.slice(1)}`;
  }
  if (digits.length === 10) {
    return `90${digits}`;
  }
  return digits;
}

// Format a Date in the target timezone as "DD/MM HH:MM" (24-hour). Intl
// gives us TZ-correct components without pulling in a date library.
function formatDateAndTime(when: Date, timezone: string = 'Europe/Istanbul'): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(when);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${g('day')}/${g('month')} ${g('hour')}:${g('minute')}`;
}

function formatTimeOnly(when: Date, timezone: string = 'Europe/Istanbul'): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(when);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${g('hour')}:${g('minute')}`;
}

@Injectable()
export class SmsService {
  constructor(
    private readonly httpService: HttpService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    @InjectMetric('chatbu_netgsm_send_total')
    private readonly netgsmSendCounter: Counter<'context' | 'outcome'>,
  ) { }

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

  /**
   * Generic NETGSM send. Every SMS the platform emits eventually funnels
   * through here — OTP, booking confirmation, appointment reminder — so
   * transport concerns (auth, provider response code parsing, mock hatch,
   * credential guard, timeout) live in exactly one place. Callers compose
   * the message body and pass a raw phone; this method handles TR
   * normalization + delivery. Throws on any failure — callers must catch
   * and decide whether to fail the outer flow (e.g. OTP: fail) or continue
   * (e.g. reminder: log-and-move-on, next cron tick will retry).
   *
   * `context` is a short log label ("otp", "booking_confirmation",
   * "booking_reminder") so Loki queries can slice `[NETGSM]` traffic by
   * purpose without parsing message bodies.
   */
  async sendSms(phone: string, message: string, context: string = 'generic'): Promise<void> {
    const to = normalizeTurkishPhone(phone);

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
      this.logger.error('NETGSM credentials are not configured (NETGSM_USERNAME/NETGSM_PASSWORD/NETGSM_MSGHEADER)');
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

  /**
   * Send a 6-digit OTP over SMS. Composes the localized OTP message body
   * and delegates transport to `sendSms`. Throws on any failure — callers
   * (LeadService, BookingService) must catch and record it, mirroring the
   * same fix already applied to every MailService method added after the
   * original sendRegisterMail (which swallowed errors silently).
   */
  async sendOtpSms(phone: string, code: string, botName: string, lang: 'tr' | 'en' = 'tr'): Promise<void> {
    const message =
      lang === 'en'
        ? `Your ${botName} verification code: ${code}. Valid for 5 minutes.`
        : `${botName} doğrulama kodunuz: ${code}. Kod 5 dakika geçerlidir.`;
    await this.sendSms(phone, message, 'otp');
  }

  /**
   * Send a booking-confirmation SMS after an appointment is created. Called
   * from the MCP post-booking hop (via AppointmentService.createFromMcp).
   * `appointmentStart` is the appointment's UTC Date; `timezone` is the
   * IANA zone name the event was booked under (defaults to Europe/Istanbul
   * — the vast majority of Chatbu tenants). Fail policy is up to the
   * caller: for a completed booking we do NOT want to fail the whole
   * flow just because SMS was unreachable, so the appointment service
   * catches and logs.
   */
  async sendBookingConfirmationSms(
    phone: string,
    botName: string,
    appointmentStart: Date,
    summary: string,
    lang: 'tr' | 'en' = 'tr',
    timezone: string = 'Europe/Istanbul',
  ): Promise<void> {
    const when = formatDateAndTime(appointmentStart, timezone);
    const message =
      lang === 'en'
        ? `Your ${botName} appointment is confirmed for ${when}. Details: ${summary}.`
        : `${botName} randevunuz ${when} için onaylandı. Detay: ${summary}.`;
    await this.sendSms(phone, message, 'booking_confirmation');
  }

  /**
   * Send a reminder SMS at a configured offset before the appointment.
   * Two wording variants baked in — 24h ("tomorrow at HH:MM") and 60m
   * ("in 1 hour at HH:MM") — because those are the two offsets the FE
   * exposes (Faz E per-bot config). Other offsets fall back to the
   * generic wording. The reminder cron catches per-send exceptions and
   * marks the offset `failed` in `reminderStates`; the next tick won't
   * retry the same failed slot (bounded, not infinite retry).
   */
  async sendBookingReminderSms(
    phone: string,
    botName: string,
    appointmentStart: Date,
    summary: string,
    offsetMinutes: number,
    lang: 'tr' | 'en' = 'tr',
    timezone: string = 'Europe/Istanbul',
  ): Promise<void> {
    const timeOnly = formatTimeOnly(appointmentStart, timezone);
    const dateAndTime = formatDateAndTime(appointmentStart, timezone);
    let message: string;

    if (offsetMinutes === 1440) {
      message =
        lang === 'en'
          ? `Reminder: your ${botName} appointment is tomorrow at ${timeOnly}. Details: ${summary}.`
          : `${botName} randevunuzu hatırlatırız: yarın ${timeOnly}. Detay: ${summary}.`;
    } else if (offsetMinutes === 60) {
      message =
        lang === 'en'
          ? `Reminder: your ${botName} appointment is in 1 hour at ${timeOnly}.`
          : `${botName} randevunuz yaklaşıyor: 1 saat sonra ${timeOnly}.`;
    } else {
      // Fallback: mention the offset in hours if it divides cleanly,
      // otherwise fall back to the concrete date/time so the visitor
      // still gets an unambiguous timestamp even on unusual offsets.
      const hours = offsetMinutes / 60;
      const humanOffset =
        Number.isInteger(hours) && hours > 0
          ? lang === 'en'
            ? `in ${hours} hours`
            : `${hours} saat sonra`
          : lang === 'en'
            ? 'soon'
            : 'yaklaşıyor';
      message =
        lang === 'en'
          ? `Reminder: your ${botName} appointment ${humanOffset} at ${dateAndTime}. Details: ${summary}.`
          : `${botName} randevunuz ${humanOffset}: ${dateAndTime}. Detay: ${summary}.`;
    }

    await this.sendSms(phone, message, 'booking_reminder');
  }
}
