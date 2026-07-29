import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

const NETGSM_SEND_URL = 'https://api.netgsm.com.tr/sms/rest/v2/send';

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
  ) { }

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

    try {
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
            timeout: 10000,
          },
        ),
      );

      const code_ = response.data?.code;
      if (!NETGSM_SUCCESS_CODES.has(code_)) {
        throw new Error(`NETGSM rejected the message (code=${code_})`);
      }

      this.logger.info(`[NETGSM] ${context} sent to ${to} (jobid=${response.data?.jobid ?? 'n/a'})`);
    } catch (error) {
      this.logger.error(`[NETGSM] error sending ${context} to ${to}:`, error);
      throw error;
    }
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
