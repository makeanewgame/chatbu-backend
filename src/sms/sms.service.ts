import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter } from 'prom-client';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

import { SmsProvider } from './providers/sms-provider.interface';
import { NetgsmSmsProvider } from './providers/netgsm.provider';

// Router strategy — read once at boot for hot-path efficiency. Flip via
// ConfigMap + Reloader restart:
//   'netgsm_only'      — every send goes to NETGSM (default, mirrors
//                        pre-2026-08-13 behaviour, prod-safe).
//   'route_by_country' — TR phones → NETGSM, everything else → the
//                        international provider. Until the international
//                        provider is registered (Slice 2 follow-up PR
//                        introducing AWS SNS), `route_by_country` still
//                        routes everything through NETGSM — the router
//                        shape is present so the flag flip doesn't
//                        require a code change once SNS lands.
// Any unknown value falls back to `netgsm_only` (fail-closed to the
// working transport). See `.claude/plans/this-is-a-example-ticklish-
// dove.md` Slice 2 for the dev-first rollout of `route_by_country`.
type SmsProviderStrategy = 'netgsm_only' | 'route_by_country';

/**
 * Convert an arbitrary user-typed phone string into an
 * `{ e164, country }` pair, or return `null` when the input is not a
 * parsable phone. Uses `libphonenumber-js` — the same library the
 * dashboard already declares (`react-international-phone` peer) and
 * that the widget will pick up in the Slice 3 KVKK i18n work.
 *
 * Why here (not on each provider): parsing MUST happen exactly once
 * per send so the router can decide provider from the country, and
 * so we never fall back into the old "every 10-digit string becomes
 * a TR number" trap that the pre-abstraction `normalizeTurkishPhone`
 * baked in. Providers assume the input is already E.164.
 *
 * The `defaultCountry='TR'` argument is intentional: existing bots
 * ingest phones like `0532 111 22 33` (no country code) and every
 * one of those is Turkish, so parse-with-TR-default gives us the
 * same behaviour the legacy normalizer had for the common case,
 * without corrupting an international `+…` input.
 */
export function parsePhoneToE164(
  raw: string,
): { e164: string; country: string } | null {
  if (!raw || typeof raw !== 'string') return null;
  const parsed = parsePhoneNumberFromString(raw, 'TR');
  if (!parsed || !parsed.isValid() || !parsed.country) return null;
  return { e164: parsed.number, country: parsed.country };
}

@Injectable()
export class SmsService {
  private readonly strategy: SmsProviderStrategy;

  constructor(
    private readonly netgsmProvider: NetgsmSmsProvider,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    // New provider-agnostic counter. Populated on every send AFTER the
    // provider's own retry envelope resolves. The provider's own more
    // detailed counters (e.g. `chatbu_netgsm_send_total{outcome:'success_
    // on_retry'}`) keep running in parallel — see metrics.providers.ts.
    @InjectMetric('chatbu_sms_send_total')
    private readonly smsSendCounter: Counter<
      'provider' | 'context' | 'country' | 'outcome'
    >,
  ) {
    const raw = (process.env.SMS_PROVIDER_STRATEGY ?? '').toLowerCase();
    this.strategy = raw === 'route_by_country' ? 'route_by_country' : 'netgsm_only';
  }

  /**
   * Decide which transport handles this send. TR → NETGSM (cheaper +
   * regulator-registered sender), else → the international provider
   * (registered separately when it lands). Until that provider ships
   * (Slice 2 follow-up), every send resolves to NETGSM regardless of
   * strategy — a non-TR phone under `route_by_country` still lands on
   * NETGSM (which will reject it at the transport layer, same as the
   * pre-router behaviour). The router shape is retained so the
   * follow-up PR only needs to inject a second provider here.
   */
  private pickProvider(_country: string): SmsProvider {
    return this.netgsmProvider;
  }

  /**
   * Generic SMS entry point. Every wrapper (`sendOtpSms`,
   * `sendBookingConfirmationSms`, `sendBookingReminderSms`) funnels
   * through here; every caller (`LeadService`, `AppointmentService`,
   * `AppointmentReminderService`, `BookingService`) is unchanged
   * because this method's public signature is preserved through the
   * refactor.
   *
   * Failure surface: throws on unparsable phone (`INVALID_PHONE_E164`
   * `BadRequestException`) OR on provider transport failure (whatever
   * the provider raised, e.g. NETGSM logical failure). Callers decide
   * what to do — for LEAD OTP, fail loud so the visitor sees a
   * sentinel; for the reminder cron, log-and-move-on.
   */
  async sendSms(
    phone: string,
    message: string,
    context: string = 'generic',
  ): Promise<void> {
    const parsed = parsePhoneToE164(phone);

    // Fail-open path for pre-abstraction callers: when the router is
    // in `netgsm_only` mode and the input is not a parseable phone,
    // hand it to NETGSM anyway with a synthetic label so today's
    // behaviour is preserved. NETGSM will reject non-TR inputs at
    // its logical layer, which is exactly what happened before. The
    // strict `INVALID_PHONE_E164` gate turns on with `route_by_country`
    // — otherwise a config flip could quietly break a working call
    // site during Slice 2's dev rollout.
    if (!parsed) {
      if (this.strategy === 'netgsm_only') {
        this.logger.warn(
          `[SmsService] unparsable phone "${phone}" — legacy passthrough to NETGSM (strategy=netgsm_only)`,
        );
        await this.netgsmProvider.sendSms({
          e164: `+${phone.replace(/\D/g, '')}`,
          country: 'TR',
          message,
          context,
        });
        this.smsSendCounter.inc({
          provider: 'netgsm',
          context,
          country: 'TR',
          outcome: 'success',
        });
        return;
      }
      this.logger.error(
        `[SmsService] phone "${phone}" is not a valid E.164 number (strategy=route_by_country)`,
      );
      throw new BadRequestException({ code: 'INVALID_PHONE_E164' });
    }

    const provider = this.pickProvider(parsed.country);
    try {
      await provider.sendSms({
        e164: parsed.e164,
        country: parsed.country,
        message,
        context,
      });
      this.smsSendCounter.inc({
        provider: provider.name,
        context,
        country: parsed.country,
        outcome: 'success',
      });
    } catch (err) {
      this.smsSendCounter.inc({
        provider: provider.name,
        context,
        country: parsed.country,
        outcome: 'failure',
      });
      throw err;
    }
  }

  /**
   * Send a 6-digit OTP over SMS. Composes the localized OTP message
   * body and delegates transport to `sendSms`. Throws on any failure —
   * callers (LeadService, BookingService) must catch and record it.
   */
  async sendOtpSms(
    phone: string,
    code: string,
    botName: string,
    lang: 'tr' | 'en' = 'tr',
  ): Promise<void> {
    const message =
      lang === 'en'
        ? `Your ${botName} verification code: ${code}. Valid for 5 minutes.`
        : `${botName} doğrulama kodunuz: ${code}. Kod 5 dakika geçerlidir.`;
    await this.sendSms(phone, message, 'otp');
  }

  /**
   * Send a booking-confirmation SMS after an appointment is created.
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
