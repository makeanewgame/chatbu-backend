/**
 * Transport contract for WhatsApp business-initiated messages.
 *
 * Deliberately NOT an extension of `SmsProvider` (2026-09-07). That
 * interface takes `message: string`, and for WhatsApp that would be a
 * lie: a business-initiated message sent outside the 24-hour customer
 * service window cannot carry free text. WhatsApp only delivers a
 * pre-approved template, identified by a Content SID, with the dynamic
 * parts passed as numbered variables — the body itself is fixed by Meta
 * and localized by them per template language. Forcing that through a
 * `message` parameter would leave a string that every caller composes
 * and no transport ever sends, which is exactly the kind of silent
 * mismatch the SMS provider seam was introduced to kill.
 *
 * Why WhatsApp at all: SMS has a structural blind spot for travellers
 * and diaspora. The trigger was a Dutch visitor who keeps their NL SIM
 * switched off while in Turkey to avoid roaming charges and lives on
 * WiFi — no SMS from any provider reaches them, while WhatsApp does.
 *
 * Contract mirrors `SmsProvider`:
 *   - `e164` is already parsed and validated by the caller; the
 *     implementation adds the `whatsapp:` prefix, nothing else.
 *   - Implementations MUST throw on failure. The caller counts, logs,
 *     and decides whether the outer flow fails (OTP: yes).
 *   - Implementations SHOULD retry a transient failure once.
 */
export interface WhatsAppTemplateInput {
  /** Destination in E.164, WITHOUT the `whatsapp:` prefix. */
  e164: string;
  /** ISO alpha-2, for logs and the metrics label. */
  country: string;
  /** Approved template to send, e.g. `HX361535…`. */
  contentSid: string;
  /**
   * Template variables keyed by position as strings — an authentication
   * template's body is `{{1}}`, so an OTP send is `{ '1': '123456' }`.
   */
  variables: Record<string, string>;
  /** `otp` | `booking_confirmation` | … — logs + metrics label. */
  context: string;
}

export interface WhatsAppProvider {
  /** Short identifier for logs and the metrics `provider` label. */
  readonly name: string;
  sendTemplate(input: WhatsAppTemplateInput): Promise<void>;
}
