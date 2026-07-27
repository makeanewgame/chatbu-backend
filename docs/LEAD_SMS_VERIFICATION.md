# Feature: Lead Capture — SMS (NETGSM) Verification + KVKK Consent

Owner: Backend + Frontend + Platform (gateway)
Status: Implemented (backend) — awaiting gateway + frontend PRs
Ticket / Backlog ref: follow-up to `LEAD_VERIFICATION.md` (email), which explicitly listed SMS OTP as out of scope for v1

## Motivation

`LEAD_VERIFICATION.md` shipped optional **email** OTP verification for captured leads and explicitly deferred SMS: "no new provider to introduce." This document is that follow-up, scoped to Turkey via **NETGSM**.

Two things make this different from the email flow, not just a channel swap:

1. **A phone number is itself personal data under KVKK** (Turkey's Kişisel Verilerin Korunması Kanunu, the domestic analogue of GDPR). Sending an SMS to collect and process it requires the visitor's explicit, informed consent *before* the number is even collected — not just before the lead is submitted. The email flow never needed this because typing an email address into a chat box is the visitor's own voluntary disclosure; texting a one-time code to a phone number is the bot initiating contact with a real-world identifier, which is exactly what KVKK's Aydınlatma Metni (disclosure notice) + explicit consent requirement is for.
2. **NETGSM** (not Twilio/Vonage) is the provider, since target customers are Turkish bot owners and NETGSM is the dominant domestic SMS gateway with local invoicing and deliverability.

Not every bot owner needs this. A bot that only ever asks for email can leave `smsVerificationRequired` off forever — it's a sibling toggle to `leadVerificationRequired`, independently settable.

## Scope

### In scope

- Prisma: `CustomerBots.smsVerificationRequired` boolean (sibling to `leadVerificationRequired`).
- Prisma: `LeadSmsVerification` — OTP storage, mirrors `LeadVerification`.
- Prisma: `LeadPrivacyConsent` — a permanent KVKK consent audit log (not just an ephemeral gate), recording `phone`, `ipAddress`, `userAgent`, `privacyVersion`, `privacyAcceptedAt`, `otpVerified`/`otpVerifiedAt`, and eventually `leadId` once the lead is submitted.
- Backend: `POST /api/lead/request-sms-verification`, `POST /api/lead/verify-sms` (internal, gateway-called, mirror the email endpoints).
- Backend: `POST /widget/lead/kvkk-consent` (public, widget-called directly — NOT gated behind the LLM/gateway, so consent is recorded the instant the visitor clicks through, independent of anything the model does or doesn't do).
- Backend: `POST /api/bot/updateSmsVerification` (owner toggle) + `SystemLog` audit (`UPDATE_SMS_VERIFICATION`).
- Backend: `GET /api/bot/verification-status/:botId` extended with `requiresSmsVerification`.
- Backend: `SmsService` (NETGSM REST v2 integration), mirrors `MailService`'s structure — throws on failure, never swallows.
- Backend: `submit()` extended to accept `smsVerificationToken`, gated on `smsVerificationRequired` + a phone present in `leadData`.
- Frontend: "SMS ile doğrulama iste" toggle in bot settings, directly below "Eposta Doğrulama İste".
- Frontend: a `KVKK_CONSENT` chat action (checkbox + Aydınlatma Metni / Kullanım Şartları links + "Devam Et"), rendered as a chat bubble, reusing the existing hosted chatbu.io legal pages (`legalLinks.ts`) rather than new per-bot legal text.
- Gateway (`fovi-longa-chat-be`): `prompt_kvkk_consent` signal tool, `request_lead_sms_verification` tool, `capture_lead` extended with `sms_verification_token`, new prompt blocks.

### Out of scope

- Non-Turkish phone numbers / international SMS providers. NETGSM is Turkey-only; a bot owner outside Turkey has no path to enable this toggle meaningfully yet.
- Retroactive consent/verification of leads captured before this shipped.
- A configurable per-bot KVKK text. Every bot uses the same chatbu.io-hosted Aydınlatma Metni / Kullanım Şartları (per product decision — the legal text is a platform-level document, not a per-tenant one).
- Requiring SMS verification when the lead has no phone number. If a visitor only gives an email, the SMS gate never triggers — same "verification requires the matching contact channel" rule the email flow already has.

## Design principles (must honor)

- **Generic platform** — no vertical-specific copy; every bot uses the same consent copy and flow.
- **Deterministic tool boundary** — the actual enforcement of "was consent given" and "was the code verified" lives in the backend (`LeadPrivacyConsent` row lookup, JWT `kind` check), never inferred from LLM-generated chat text. The gateway's `prompt_kvkk_consent` tool is a pure UI trigger, not a source of truth.
- **Consent precedes data collection** — a `LeadPrivacyConsent` row must exist for `(botId, chatId)` before an OTP is ever sent to a phone number, not just before the final lead submit.
- **Fail-safe defaults** — `smsVerificationRequired` defaults to `false`; existing bots are entirely unaffected until an owner opts in.
- **Audit everything** — `LeadPrivacyConsent` is a permanent record (IP, user agent, consent timestamp, legal-text version, OTP verification timestamp), not pruned like the short-lived OTP tables.

## Data model

### `CustomerBots.smsVerificationRequired`

```prisma
smsVerificationRequired Boolean @default(false)
```

Independent from `leadVerificationRequired` — a bot owner can require email verification, SMS verification, both, or neither.

### `LeadSmsVerification` (OTP storage, mirrors `LeadVerification`)

```prisma
model LeadSmsVerification {
  id        String    @id @default(cuid())
  botId     String
  phone     String
  codeHash  String
  attempts  Int       @default(0)
  createdAt DateTime  @default(now())
  expiresAt DateTime
  usedAt    DateTime?

  @@index([botId, phone])
  @@index([expiresAt])
}
```

Same 6-digit / SHA-256 hash / 5-minute TTL / 5-attempt fail-close / 3-per-15-minutes rate limit as the email flow.

### `LeadPrivacyConsent` (new — the KVKK audit log)

```prisma
model LeadPrivacyConsent {
  id                String    @id @default(cuid())
  botId             String
  teamId            String
  chatId            String
  phone             String?
  source            String    @default("chatbot")
  privacyVersion    String
  privacyAcceptedAt DateTime
  ipAddress         String?
  userAgent         String?
  otpVerified       Boolean   @default(false)
  otpVerifiedAt     DateTime?
  leadId            String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@index([botId, chatId])
  @@index([leadId])
}
```

One row's lifecycle: created at consent-click time (`phone` null, `otpVerified` false) → `phone` filled in when `requestSmsVerification` is called → `otpVerified`/`otpVerifiedAt` set on successful code verification → `leadId` back-filled once `submit()` persists the lead. This row is never deleted — it's the compliance record for "who consented, to what version of the legal text, from what IP/device, and did we actually verify their number."

`requestSmsVerification` requires a `LeadPrivacyConsent` row created within the last 60 minutes for `(botId, chatId)` — otherwise it refuses with `KVKK_CONSENT_REQUIRED` and sends no SMS. This is the deterministic gate: NETGSM never sends a code unless a real, timestamped, IP-stamped consent row exists first.

### `BotLeads` — add `smsVerified`, `privacyConsentId`

```prisma
smsVerified      Boolean @default(false)   // inbox-badge convenience, mirrors `verified` (email)
privacyConsentId String?                    // FK to the full audit record in LeadPrivacyConsent
```

## Backend API

### `POST /widget/lead/kvkk-consent` (NEW — public, widget-called directly)

```
Request:  { botId: string, chatId: string }
Response: { accepted: true, consentId: string, privacyVersion: string }
```

Called the instant the visitor checks the consent box and clicks "Devam Et" — **before** any tool call, before the phone number is even asked for. `ipAddress`/`userAgent` are read server-side from the request (`X-Forwarded-For` / `user-agent` header), never accepted as client-supplied fields, so the audit trail can't be spoofed by the browser payload.

### `POST /api/lead/request-sms-verification` (NEW — internal, gateway → backend)

```
Request:  { botId: string, chatId: string, phone: string }
Response: { status: 'sent' | 'rate_limited', expiresAt?: string }
Errors:
  400 { code: 'NOT_REQUIRED' }        - bot doesn't require SMS verification
  400 { code: 'KVKK_CONSENT_REQUIRED' } - no fresh consent row for this chat
```

Behavior: load bot → require `smsVerificationRequired` → require a `LeadPrivacyConsent` row younger than 60 minutes for `(botId, chatId)` → rate-limit 3 per 15 minutes per `(botId, phone)` → generate 6-digit code → hash + store → send via `SmsService.sendOtpSms` → write `phone` onto the matched consent row.

### `POST /api/lead/verify-sms` (NEW — internal)

```
Request:  { botId: string, phone: string, code: string }
Response: { verified: true, verificationToken: string } | { verified: false, reason: ... }
```

Same lookup/expiry/attempts/constant-time-compare logic as `/api/lead/verify` (email). On success, marks the matched `LeadPrivacyConsent` row `otpVerified: true` and signs a JWT `{ phone, botId, kind: 'lead_sms_verification', exp: +30min }` with the same `BOOKING_VERIFICATION_SECRET || JWT_SECRET` used everywhere else — `kind` keeps this JWT from being accepted by the email or booking verify paths.

### `POST /api/bot/updateSmsVerification` (NEW — bot owner)

```
Request:  { botId: string, smsVerificationRequired: boolean }
Response: { message: string, bot: CustomerBots }
```

Byte-for-byte mirror of `updateLeadVerification`. Audit: `SystemLog { category: 'BOT', action: 'UPDATE_SMS_VERIFICATION' }`.

### `GET /api/bot/verification-status/:botId` (EXTENDED)

```
Response: { requiresVerification: boolean, requiresSmsVerification: boolean }
```

### `POST /api/lead/submit` (EXISTING — extended)

Add optional `smsVerificationToken: string | null`. When `bot.smsVerificationRequired` and `leadData.phone` is present: require + verify the token (`kind === 'lead_sms_verification'`, phone/botId match) exactly like the email gate; on success, set `BotLeads.smsVerified = true` and `BotLeads.privacyConsentId` to the matched consent row's id (and back-fill that row's `leadId`).

## SMS delivery — NETGSM

New `SmsModule`/`SmsService` (`src/sms/`), structurally mirroring `MailModule`/`MailService`:

```ts
async sendOtpSms(phone: string, code: string, botName: string, lang: 'tr' | 'en'): Promise<void>
```

- Provider: NETGSM REST v2 send endpoint (`https://api.netgsm.com.tr/sms/rest/v2/send`), Basic Auth (`NETGSM_USERNAME`/`NETGSM_PASSWORD`), sender header `NETGSM_MSGHEADER`.
- **NETGSM returns HTTP 200 even on a logical failure** — the real outcome is in the JSON body's `code` field (`"00"`/`"01"` = accepted; anything else = provider/account error). `SmsService` treats any other code as a thrown error.
- **Throws on failure, never swallows** — matches the fix already applied to every `MailService` method added after the original `sendRegisterMail` anti-pattern.
- Phone numbers are normalized to NETGSM's expected `90XXXXXXXXXX` shape. **Confirm exact formatting and auth details against NETGSM's live docs / a real test send before the `chatbu-dev` soak** — this was implemented from the well-known v2 REST contract, not verified against the account's actual live credentials yet.

Env vars (added to `backend-secrets` k8s Secret in both `k8s/` and `k8s-dev/`, same mechanism as `SMTP_*` — no new Secret object, `envFrom: secretRef` auto-injects any key added): `NETGSM_USERNAME`, `NETGSM_PASSWORD`, `NETGSM_MSGHEADER`. Also `KVKK_TEXT_VERSION` (non-secret, bump whenever the chatbu.io legal pages materially change).

## Frontend UI

### Bot settings

Directly below the existing "Eposta Doğrulama İste" switch (`ChatbotEdit.tsx`, Ayarlar tab): a new "SMS ile doğrulama iste" switch, wired to `updateSmsVerification`, independent of the lead-destinations-empty disabled state (SMS verification is about the visitor's own number, not where notifications are delivered).

### Widget consent flow

A new `KVKK_CONSENT` chat action — rendered as a card with intro copy, two links ("Aydınlatma Metni", "Kullanım Şartları" — resolved via the existing `legalLinks.ts` helpers, the same chatbu.io pages used at signup), a checkbox, and a "Devam Et" button disabled until checked. On click: `POST /widget/lead/kvkk-consent`, then continue the conversation normally so the bot asks for the phone number, sends the OTP, and the visitor types the code back — fully conversational from that point on, matching the existing email-OTP UX.

## Gateway contract (platform team PR)

- New signal-only tool `prompt_kvkk_consent(reason)` — zero HTTP calls, mirrors `request_feedback`/`request_human_handoff`. Returns `KVKK_CONSENT_REQUIRED: ...`.
- New tool `request_lead_sms_verification(customer_cuid, bot_cuid, chat_id, phone)` — calls `/api/lead/request-sms-verification`; on backend `400 KVKK_CONSENT_REQUIRED`, tells the model to call `prompt_kvkk_consent` first.
- `capture_lead` extended with optional `sms_verification_token`, gated the same way the email token is, using the extended `verification-status` cache.
- `chat_endpoint.py`: detect a `prompt_kvkk_consent` `ToolMessage` whose content starts with `KVKK_CONSENT_REQUIRED` and append `{"type": "KVKK_CONSENT", "actionId": ..., "data": {"botName": ...}}` to `response_data["actions"]` — the same mechanism already used for `QUICK_REPLY`/`human_handover`.
- Feature flag `LEAD_SMS_VERIFICATION_ENABLED`, checked in lock-step with tool registration, ships OFF.

## Test plan

### Backend

- Unit: `updateSmsVerification` accepts true/false, respects team ownership.
- Unit: `recordPrivacyConsent` creates a row with correct `teamId`, `privacyVersion`, `ipAddress`, `userAgent`.
- Unit: `requestSmsVerification` refuses with `KVKK_CONSENT_REQUIRED` when no fresh consent row exists; refuses with `NOT_REQUIRED` when the bot doesn't need SMS verification; rate-limits at 4 requests in 15 minutes.
- Unit: `verifySmsCode` — correct code succeeds and marks the consent row `otpVerified`; wrong code increments attempts; 5 wrong attempts locks out; expired code returns `expired`.
- Unit: JWT `kind` isolation — a `lead_sms_verification` token is rejected by the email/booking verify paths and vice versa.
- Integration: `/api/lead/submit` with `smsVerificationRequired: true` and a phone present refuses without a token, accepts with a valid one, and correctly links `BotLeads.privacyConsentId`.
- Migration: existing bots default to `smsVerificationRequired: false`.

### Frontend

- Component: settings toggle round-trips through the endpoint.
- Component: `KvkkConsentCard` — "Devam Et" stays disabled until the checkbox is checked; clicking it posts consent and continues the chat.
- E2E: full flow on a test bot with a real phone number through NETGSM.

## Rollout plan

1. **Backend PR** — migration + `SmsModule` + `LeadService`/`LeadController` extensions + `WidgetController` consent endpoint + `updateSmsVerification` + audit → `develop` → `chatbu-dev` soak.
2. **Gateway PR** (`fovi-longa-chat-be`) — new tools + `capture_lead` gate + `chat_endpoint.py` action emission + prompt blocks → `develop` → `chatbu-dev` soak.
3. **Frontend PR** — settings toggle + `KVKK_CONSENT` action/card + widget wiring + i18n → `develop` → `chatbu-dev` soak.
4. End-to-end verify on `chatbu-dev`: enable on a test bot, run the widget, confirm the KVKK card renders, accept, receive a real NETGSM SMS, verify the code, confirm the lead lands with `smsVerified: true` and a fully-populated `LeadPrivacyConsent` row.
5. Promote all three to `main` the same day. Feature flag `LEAD_SMS_VERIFICATION_ENABLED` ships OFF; flip ON only after all three are confirmed on `main`.

## Metrics to watch

- SMS OTP delivery success rate via NETGSM (distinct from email deliverability — different failure modes: msgheader approval, IYS filter rejects, insufficient credit).
- KVKK consent → OTP-request → OTP-verified funnel drop-off (identifies friction in the "Devam Et" → phone → code sequence).
- Wrong-code rate (spam/fuzzing heuristic, same as the email flow).

## Open questions

- Should bot owners be able to see the raw `LeadPrivacyConsent` audit rows (IP, user agent, version) in the dashboard, e.g. for responding to a KVKK data-subject access request? Not in v1 — the data is captured and retained, but no UI is built to surface it yet.
- Do we need a data-retention/deletion policy for `LeadPrivacyConsent` (KVKK also grants a right to erasure)? Deferred — flag for legal/compliance review before this ships to `main`.
- Should `smsVerificationRequired` and `leadVerificationRequired` be mutually exclusive, or can both be on for the same bot (requiring both a verified email AND a verified phone before a lead is accepted)? Current implementation treats them as independent, additive gates - each only applies when the corresponding contact field is present in `leadData`.
