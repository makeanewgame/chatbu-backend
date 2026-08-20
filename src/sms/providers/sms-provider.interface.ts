/**
 * The contract every SMS transport class implements. `SmsService` picks
 * one implementation per call based on the phone's country (see
 * `pickProvider` in sms.service.ts).
 *
 * Why an interface (2026-08-13)? The platform is going international —
 * NETGSM is a Turkish domestic gateway and can only reach `+90…` numbers,
 * so a bot with `smsVerificationRequired=true` that hits a UK/US/DE
 * visitor was silently misdelivering (or corrupting the MSISDN into a
 * fake TR one via the old `normalizeTurkishPhone` fallback). Adding
 * Twilio as a second provider requires this seam so both live behind
 * the same `SmsService.sendSms` funnel every existing caller already
 * uses. See `.claude/plans/this-is-a-example-ticklish-dove.md` for the
 * full rollout doc.
 *
 * Contract:
 *   - Inputs are already normalized. E.164 (`+…`) with a valid country
 *     is the ONLY accepted shape. Parsing + validation happens ONCE in
 *     `SmsService.sendSms` before the provider is picked, so each
 *     implementation can assume it received a wire-shaped MSISDN and
 *     avoid re-implementing the fallback normalizer that got us into
 *     the silent-corruption trap.
 *   - Implementations MUST throw on failure. `SmsService` catches +
 *     counts + logs + surfaces to callers (LeadService, BookingService,
 *     AppointmentReminderService) which decide whether to fail the outer
 *     flow (OTP: fail) or continue (reminder: log-and-move-on). Silent
 *     success on transport error is a well-worn foot-gun (see the
 *     `sendRegisterMail` original that swallowed errors).
 *   - Implementations SHOULD retry transient failures once (same shape
 *     as the existing NETGSM retry envelope) — do NOT propagate a
 *     transient hiccup as a hard failure without at least one retry.
 *     Anti-abuse rate limiting (per-bot/phone request cap) is enforced
 *     upstream in `LeadService` and does NOT need to be re-implemented
 *     per provider.
 */
export interface SmsProvider {
  /**
   * Short identifier for logs, metrics label, and per-request routing
   * decisions. MUST match the string used in `SmsService.pickProvider`.
   */
  readonly name: 'netgsm' | 'twilio' | 'mock';

  /**
   * Send one SMS message. Returns void on success, throws on failure.
   *
   * `input.e164` is guaranteed to be `+CCXXXXXXXXXX` (E.164, leading `+`,
   * country code + national number). Any provider that needs a different
   * wire shape (e.g. NETGSM wants bare `90XXXXXXXXXX`, no `+`) MUST
   * derive it from `e164` inside its own class — do not add another
   * normalizer to `SmsService`.
   *
   * `input.country` is ISO alpha-2 (`TR`, `US`, `DE`, …). Provider
   * implementations don't strictly need it (they get `e164`), but the
   * Prometheus label depends on it and passing it through avoids a
   * second `parsePhoneNumberFromString` call.
   *
   * `input.context` is a short label (`'otp'`, `'booking_confirmation'`,
   * `'booking_reminder'`, `'generic'`) for log slicing and metric
   * cardinality — same taxonomy the existing `chatbu_netgsm_send_total`
   * counter uses.
   */
  sendSms(input: {
    e164: string;
    country: string;
    message: string;
    context: string;
  }): Promise<void>;
}
