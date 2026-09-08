import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter } from 'prom-client';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

import { SmsProvider } from './providers/sms-provider.interface';
import { NetgsmSmsProvider } from './providers/netgsm.provider';
import { TwilioSmsProvider } from './providers/twilio.provider';
import { TwilioWhatsAppProvider } from './providers/twilio-whatsapp.provider';
import {
  OtpDeliveryFallbackService,
  OtpFallbackContext,
} from './otp-delivery-fallback.service';

// Router strategy — read once at boot for hot-path efficiency. Flip via
// ConfigMap + Reloader restart:
//   'netgsm_only'      — every send goes to NETGSM (default, mirrors
//                        pre-2026-08-13 behaviour, prod-safe).
//   'route_by_country' — TR phones → NETGSM, everything else → Twilio.
// Any unknown value falls back to `netgsm_only` (fail-closed to the
// working transport). See `.claude/plans/this-is-a-example-ticklish-
// dove.md` Slice 2 for the dev-first rollout of `route_by_country`.
type SmsProviderStrategy = 'netgsm_only' | 'route_by_country';

/**
 * Transport a one-time code goes out over.
 *
 * `sms` stays the default for every caller and every bot — WhatsApp is an
 * opt-in second channel the VISITOR picks, not a platform-wide flip. The
 * trigger was one traveller whose SIM is switched off abroad, and one
 * report is not evidence that SMS is failing for everyone.
 */
/**
 * When-phrase for a reminder, e.g. "tomorrow at 15:30" / "yarın 15:30".
 *
 * Exists because the WhatsApp reminder is ONE approved template whose
 * body is fixed by Meta — the three offset shapes the SMS sentence
 * branches on have to collapse into a single variable. The wording
 * mirrors the SMS copy so a visitor reads the same thing on either
 * channel.
 */
export function reminderWhenPhrase(
  offsetMinutes: number,
  lang: 'tr' | 'en',
  timeOnly: string,
  dateAndTime: string,
): string {
  if (offsetMinutes === 1440) {
    return lang === 'en' ? `tomorrow at ${timeOnly}` : `yarın ${timeOnly}`;
  }
  if (offsetMinutes === 60) {
    return lang === 'en' ? `in 1 hour at ${timeOnly}` : `1 saat sonra ${timeOnly}`;
  }
  const hours = offsetMinutes / 60;
  const humanOffset =
    Number.isInteger(hours) && hours > 0
      ? lang === 'en'
        ? `in ${hours} hours`
        : `${hours} saat sonra`
      : lang === 'en'
        ? 'soon'
        : 'yaklaşıyor';
  return lang === 'en'
    ? `${humanOffset} at ${dateAndTime}`
    : `${humanOffset}, ${dateAndTime}`;
}

export type OtpChannel = 'sms' | 'whatsapp';

/**
 * Business-initiated WhatsApp messages must each be a separately approved
 * template, so every distinct message this platform sends needs its own
 * kind here plus its own pair of Content SIDs.
 */
export type WhatsAppTemplateKind = 'otp' | 'booking_confirmation' | 'booking_reminder';

/**
 * Which env var holds the approved Content SID for each (kind, language).
 * Data, not branching: a new template kind is one entry plus one
 * configmap pair, with no new code path.
 */
const WHATSAPP_TEMPLATE_ENV: Record<WhatsAppTemplateKind, { en: string; tr: string }> = {
  otp: {
    en: 'TWILIO_WHATSAPP_OTP_TEMPLATE_EN',
    tr: 'TWILIO_WHATSAPP_OTP_TEMPLATE_TR',
  },
  booking_confirmation: {
    en: 'TWILIO_WHATSAPP_BOOKING_CONFIRMATION_TEMPLATE_EN',
    tr: 'TWILIO_WHATSAPP_BOOKING_CONFIRMATION_TEMPLATE_TR',
  },
  booking_reminder: {
    en: 'TWILIO_WHATSAPP_BOOKING_REMINDER_TEMPLATE_EN',
    tr: 'TWILIO_WHATSAPP_BOOKING_REMINDER_TEMPLATE_TR',
  },
};

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

/**
 * OTP/booking SMS template language. Priority:
 *   1. Conversation-language hint from the agent (the visitor's actual
 *      chat language — a +49 diaspora visitor chatting in Turkish gets
 *      a Turkish SMS, which the phone country alone would get wrong).
 *   2. Phone-country fallback: TR → Turkish, else English.
 * Templates exist only in tr/en today — a non-tr hint (de/fr/…) lands
 * on English until more locales ship (backlog: SMS template languages).
 */
export function resolveOtpLang(
  langHint: string | null | undefined,
  country: string | null | undefined,
): 'tr' | 'en' {
  const hint = (langHint ?? '').trim().toLowerCase().slice(0, 2);
  if (hint === 'tr') return 'tr';
  if (hint) return 'en';
  return country === 'TR' ? 'tr' : 'en';
}

@Injectable()
export class SmsService {
  private readonly strategy: SmsProviderStrategy;

  constructor(
    private readonly netgsmProvider: NetgsmSmsProvider,
    private readonly twilioProvider: TwilioSmsProvider,
    private readonly whatsappProvider: TwilioWhatsAppProvider,
    private readonly otpDeliveryFallback: OtpDeliveryFallbackService,
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
   * regulator-registered sender), else → Twilio (international coverage).
   * When the strategy flag is `netgsm_only` (default, prod baseline)
   * every send goes to NETGSM regardless of country — the router is
   * present but inert until Slice 2 flips the flag.
   */
  private pickProvider(country: string): SmsProvider {
    if (this.strategy === 'netgsm_only') return this.netgsmProvider;
    return country === 'TR' ? this.netgsmProvider : this.twilioProvider;
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
   * the provider raised, e.g. NETGSM logical failure, Twilio API
   * error). Callers decide what to do — for LEAD OTP, fail loud so
   * the visitor sees a sentinel; for the reminder cron, log-and-move-on.
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
    channel: OtpChannel = 'sms',
    fallback?: OtpFallbackContext,
  ): Promise<void> {
    if (channel === 'whatsapp') {
      await this.sendWhatsAppTemplate({
        kind: 'otp',
        phone,
        lang,
        variables: { '1': code },
        context: 'otp',
        fallback,
      });
      return;
    }
    const message =
      lang === 'en'
        ? `Your ${botName} verification code: ${code}. Valid for 5 minutes.`
        : `${botName} doğrulama kodunuz: ${code}. Kod 5 dakika geçerlidir.`;
    await this.sendSms(phone, message, 'otp');
  }

  /**
   * True when the WhatsApp OTP channel may be offered at all: the flag is
   * on, a sender is configured, and at least one approved template SID
   * exists. Callers use this to decide whether to show the visitor a
   * channel choice — offering WhatsApp and then failing to deliver is
   * worse than never offering it.
   */
  whatsappOtpAvailable(): boolean {
    return this.whatsappAvailable('otp');
  }

  /**
   * True when a given message kind can actually be delivered over
   * WhatsApp right now: the flag is on, a sender is configured, and at
   * least one approved template exists for that kind.
   *
   * Per-kind rather than global because the kinds clear Meta approval
   * independently — the OTP templates were approved days before the
   * booking ones were even written. A caller must never route to a
   * channel whose template is still pending; the send would fail
   * outright, which is strictly worse than the SMS that works today.
   */
  whatsappAvailable(kind: WhatsAppTemplateKind): boolean {
    if (process.env.WHATSAPP_OTP_ENABLED?.toLowerCase() !== 'true') return false;
    if (!process.env.TWILIO_WHATSAPP_FROM) return false;
    return Boolean(
      this.whatsappTemplateSid(kind, 'en') || this.whatsappTemplateSid(kind, 'tr'),
    );
  }

  /**
   * Approved template for a (kind, language) pair.
   *
   * WhatsApp templates are per-language resources — Meta owns the body
   * copy and localizes it per template, so there is one Content SID per
   * language rather than one template with a language parameter. A
   * missing language falls back to English; if English is missing too the
   * caller gets null and must not route to WhatsApp.
   */
  private whatsappTemplateSid(
    kind: WhatsAppTemplateKind,
    lang: 'tr' | 'en',
  ): string | null {
    const env = WHATSAPP_TEMPLATE_ENV[kind];
    return process.env[lang === 'tr' ? env.tr : env.en] || process.env[env.en] || null;
  }

  /**
   * Send one approved WhatsApp template.
   *
   * Unlike the SMS path there is no message to compose: Meta owns the
   * body and localizes it per template, and we supply only the numbered
   * variables. Everything else — E.164 parsing, the metrics counter,
   * throw-on-failure — matches `sendSms` so callers can treat both
   * channels identically.
   *
   * Every variable is coerced to a non-empty string. Meta rejects a send
   * whose variable is empty, and the values here come from optional
   * fields (a booking `summary` can legitimately be blank), so an empty
   * one would turn a cosmetic gap into a failed delivery.
   */
  private async sendWhatsAppTemplate(args: {
    kind: WhatsAppTemplateKind;
    phone: string;
    lang: 'tr' | 'en';
    variables: Record<string, string>;
    context: string;
    /**
     * When present, the message id is registered against this context so
     * Twilio's delivery callback can re-send the code over SMS if
     * WhatsApp never lands it. Only the OTP path passes one — a
     * confirmation that fails to deliver is a nuisance, an unusable
     * verification code is a dead end.
     */
    fallback?: OtpFallbackContext;
  }): Promise<void> {
    const { kind, phone, lang, variables, context, fallback } = args;

    if (process.env.WHATSAPP_OTP_ENABLED?.toLowerCase() !== 'true') {
      this.logger.error(
        `[SmsService] WhatsApp ${context} requested while WHATSAPP_OTP_ENABLED is off`,
      );
      throw new BadRequestException({ code: 'WHATSAPP_OTP_DISABLED' });
    }

    const parsed = parsePhoneToE164(phone);
    if (!parsed) {
      this.logger.error(`[SmsService] phone "${phone}" is not a valid E.164 number (whatsapp)`);
      throw new BadRequestException({ code: 'INVALID_PHONE_E164' });
    }

    const contentSid = this.whatsappTemplateSid(kind, lang);
    if (!contentSid) {
      const env = WHATSAPP_TEMPLATE_ENV[kind];
      this.logger.error(
        `[SmsService] no WhatsApp ${kind} template configured for lang=${lang} ` +
          `(${env.en}/${env.tr})`,
      );
      throw new InternalServerErrorException(`WhatsApp ${kind} template is not configured`);
    }

    const safeVariables: Record<string, string> = {};
    for (const [key, value] of Object.entries(variables)) {
      const trimmed = (value ?? '').trim();
      safeVariables[key] = trimmed.length > 0 ? trimmed : '-';
    }

    try {
      const messageSid = await this.whatsappProvider.sendTemplate({
        e164: parsed.e164,
        country: parsed.country,
        contentSid,
        variables: safeVariables,
        context,
      });
      if (fallback) {
        await this.otpDeliveryFallback.register(messageSid, fallback);
      }
      this.smsSendCounter.inc({
        provider: this.whatsappProvider.name,
        context,
        country: parsed.country,
        outcome: 'success',
      });
    } catch (err) {
      this.smsSendCounter.inc({
        provider: this.whatsappProvider.name,
        context,
        country: parsed.country,
        outcome: 'failure',
      });
      throw err;
    }
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
    channel: OtpChannel = 'sms',
  ): Promise<void> {
    const when = formatDateAndTime(appointmentStart, timezone);

    // The WhatsApp template carries the same three pieces the SMS
    // sentence does — business, when, details — so the visitor reads the
    // same message either way. Meta owns the wording around them.
    //
    // Falls back to SMS when this template kind isn't deliverable yet,
    // rather than refusing the way the OTP path does. The two cases are
    // genuinely different: the widget only offers WhatsApp for the OTP
    // once `whatsappOtpAvailable()` is true, so an unavailable OTP
    // template means something is misconfigured and silence is the
    // honest answer. Here the channel is INHERITED from that OTP choice
    // while these templates clear Meta approval on their own schedule —
    // so "not approved yet" is the expected state, and dropping the
    // confirmation entirely would be a regression against the SMS that
    // works today.
    if (channel === 'whatsapp' && this.whatsappAvailable('booking_confirmation')) {
      await this.sendWhatsAppTemplate({
        kind: 'booking_confirmation',
        phone,
        lang,
        variables: { '1': botName, '2': when, '3': summary },
        context: 'booking_confirmation',
      });
      return;
    }

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
    channel: OtpChannel = 'sms',
  ): Promise<void> {
    const timeOnly = formatTimeOnly(appointmentStart, timezone);
    const dateAndTime = formatDateAndTime(appointmentStart, timezone);

    // One WhatsApp template covers all three offset shapes: the phrase
    // that varies ("tomorrow at 15:30" / "in 1 hour at 15:30" / "in 3
    // hours at 8 September 15:30") is composed here and passed as a
    // variable, rather than approving three near-identical templates per
    // language with Meta.
    //
    // Same fall-back-to-SMS rule as the confirmation above: an
    // unapproved template must not cost the visitor their reminder.
    if (channel === 'whatsapp' && this.whatsappAvailable('booking_reminder')) {
      await this.sendWhatsAppTemplate({
        kind: 'booking_reminder',
        phone,
        lang,
        variables: {
          '1': botName,
          '2': reminderWhenPhrase(offsetMinutes, lang, timeOnly, dateAndTime),
          '3': summary,
        },
        context: 'booking_reminder',
      });
      return;
    }

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
