# Feature: Lead Capture — Optional Email Verification

Owner: Backend + Frontend + Platform (gateway)
Status: Draft — awaiting review
Ticket / Backlog ref: Chatbu backlog (follow-up to lead capture P1)

## Motivation

Lead capture (see `LEAD_CAPTURE.md`) currently ships without any verification: a visitor types any email or phone into the chat, the bot calls `capture_lead`, and the bot owner receives a "New Lead Received" notification. Nothing checks whether the visitor actually owns the address they provided.

Real-world consequences observed on dev:

- A visitor testing the widget provides a valid-looking email that they don't own. The bot owner receives the lead, tries to email the visitor back, and either gets a bounce (invalid) or worse, contacts a person who didn't ask for a call (deliverability + reputation cost).
- Bad actors could enumerate a competitor's bot with fake leads to drown their inbox.

Booking (see `PER_BOT_MODEL_TIER.md` and calendar tooling) already ships with verification for the same reason: `request_booking_verification` sends a 6-digit code to the visitor's email, they enter it into chat, and `create_appointment` refuses to commit unless the code checks out. This is proven infrastructure — we reuse the pattern for leads.

Not every bot owner needs verification. A boutique / spa bot that just wants "someone will call you back" leads may prefer minimal friction. A high-value B2B bot that needs deliverable emails may require it. **Per-bot toggle** — off by default, on when the owner opts in.

This document is the spec for backend + frontend + platform (gateway) changes needed to add the optional verification flow.

## Scope

### In scope

- Prisma: new boolean field on `CustomerBots` gating the flow.
- Backend: two new HTTP endpoints — `POST /api/lead/request-verification` (send OTP) and `POST /api/lead/verify` (exchange OTP → JWT). Both internal (called by gateway), mirroring the booking-verification endpoints.
- Backend: an entry in the settings-update endpoint so bot owners can toggle the field.
- Backend: SystemLog audit on toggle.
- Backend: OTP storage + expiry (5 min TTL), rate limiting per (email, bot).
- Backend: reuse `MailService` + a new template `lead_verification.html` / `_tr.html` for the OTP email.
- Frontend: a "Require email verification" toggle in the bot settings page, right below the "Lead destinations" section.
- Frontend: bot type extension (`leadVerificationRequired: boolean`).
- Gateway (`fovi-longa-chat-be`): new MCP tool `request_lead_verification(email, bot_cuid)` that mirrors the calendar `request_booking_verification` shape but hits the new lead endpoint.
- Gateway: modify `capture_lead` to accept an optional `verification_token`. When the bot's config has `leadVerificationRequired: true`, `capture_lead` refuses to fire without a valid token.
- Gateway: system-prompt block additions for the two-step flow.
- Gateway: tests for the new tool + the gated `capture_lead` behavior.

### Out of scope

- SMS OTP. Email-only for the same reason lead capture itself is email-only in P1: no new provider to introduce.
- Cross-session verified-JWT reuse. Booking has a 30-minute reuse cache in `calendar_tools.py` (`EMAIL_VERIFY_REUSE_TTL_S`) — lead capture doesn't need this in v1 because a single lead capture is one-shot; if we later see repeat leads from the same email in the same session, we add a similar cache.
- Verification for phone-only leads. If the visitor provides only a phone number, we cannot verify email; the current design keeps `capture_lead` gated on email-verified only. Phone-only leads go through unverified even when the toggle is on — same as booking, which requires an email.
- Retroactive verification of existing leads. Toggle affects only leads captured AFTER it's enabled.

## Design principles (must honor)

- **Generic platform** ([[generic-platform-no-tenant-code]]) — no vertical-specific copy in templates, no bot-name hardcodes.
- **Deterministic tool boundary** ([[deterministic-over-prompt-rules]]) — the gate is enforced in the gateway tool, not in the system prompt. Even if a model somehow calls `capture_lead` without a token when required, the tool boundary refuses.
- **Dev-first** ([[dev-environment-first]]) — every PR ships to `develop` and soaks on `chatbu-dev` before promotion to `main`.
- **Fail-safe defaults** — when a bot's config is missing or malformed, treat as "verification not required" (current behavior). We do NOT lock the flow shut on a config bug.

## Data model

### `CustomerBots` — add `leadVerificationRequired` boolean

```prisma
model CustomerBots {
  id                       String    @id @default(cuid())
  teamId                   String
  botName                  String
  botAvatar                String
  systemPrompt             String    @default("")
  settings                 Json?
  active                   Boolean   @default(false)
  modelTier                String    @default("haiku")
  leadDestinations         Json      @default("[]")
  leadVerificationRequired Boolean   @default(false)   // NEW
  createdAt                DateTime  @default(now())
  updatedAt                DateTime  @updatedAt
  isDeleted                Boolean   @default(false)
  deletedAt                DateTime?
  team                     Team      @relation(fields: [teamId], references: [id], onDelete: Cascade)
  BotLeads                 BotLeads[]
}
```

Migration: add column with `DEFAULT false`. Every existing bot ships unchanged — no behavior change until an owner explicitly enables verification.

### `LeadVerification` — new short-lived OTP table

```prisma
model LeadVerification {
  id          String   @id @default(cuid())
  botId       String
  email       String
  codeHash    String                                   // SHA-256 of the 6-digit code — never store cleartext
  attempts    Int      @default(0)                     // fail-close after 5 wrong attempts
  createdAt   DateTime @default(now())
  expiresAt   DateTime                                  // createdAt + 5 min
  usedAt      DateTime?                                 // null until an exchange succeeds

  @@index([botId, email])
  @@index([expiresAt])
}
```

Store the hash, not the code. 5-minute TTL. Fail-close on 5 wrong entries (visitor must request a new code).

We deliberately don't put OTP state in Redis for two reasons: (1) Redis is currently unstable on prod (separate incident), and (2) auditability — the row survives a delete-marker for post-hoc investigations of spam patterns.

## Backend API

### `POST /api/bot/updateLeadVerification` (NEW — bot owner)

```
Request:  { botId: string, leadVerificationRequired: boolean }
Response: { message: string, bot: CustomerBots }
Errors:
  400 - Missing or wrong-type payload
  403 - Bot not owned by requester's team
  404 - Bot not found
```

Reuse the existing team-ownership guard from `updateModelTier` / `updateLeadDestinations`. Audit via `SystemLog`:

```
category: 'BOT'
action:   'UPDATE_LEAD_VERIFICATION'
status:   'SUCCESS'
message:  `Bot lead-verification: <old> -> <new>`
```

### `POST /api/lead/request-verification` (NEW — internal, gateway → backend)

```
Request:  {
  botId: string,
  email: string
}
Response: { status: 'sent' | 'rate_limited' | 'invalid_email', expiresAt: string }
Errors:
  400 - Missing / invalid payload
  401 - Missing / invalid internal service auth
  404 - Bot not found
```

Auth: same `X-Internal-Key: $MCP_INTERNAL_API_KEY` pattern as `calendar_tools.py`.

Behavior:

1. Load the bot. If `leadVerificationRequired: false`, return `400 { code: 'NOT_REQUIRED' }` — gateway shouldn't call this on bots that don't need it, but return a specific code so the gateway can decline gracefully.
2. Validate email shape (reuse existing validator).
3. Rate-limit: reject if more than 3 requests for the same `(botId, email)` in the last 15 minutes → return `status: 'rate_limited'`.
4. Generate a 6-digit code (`crypto.randomInt(100000, 999999)`, decimal, zero-padded if the RNG returns fewer digits — never Math.random).
5. Store `LeadVerification` row with `codeHash = sha256(code)`, `expiresAt = now + 5min`, `attempts = 0`, `usedAt = null`.
6. Send OTP email via `MailService.sendLeadVerificationCode(email, code, teamLang)`. Template: `lead_verification.html` (en) and `_tr.html` (tr). Neutral copy: "You asked to be contacted through <botName>. Please enter this 6-digit code to confirm your email: ...". No vertical hints, no marketing.
7. Return `{ status: 'sent', expiresAt: <iso> }`. Do NOT return the code.

### `POST /api/lead/verify` (NEW — internal)

```
Request:  {
  botId: string,
  email: string,
  code: string
}
Response: {
  verified: true,
  verificationToken: string
} | { verified: false, reason: 'expired' | 'wrong_code' | 'too_many_attempts' | 'not_found' }
Errors:
  400 - Malformed payload
  401 - Missing / invalid internal service auth
```

Behavior:

1. Fetch the latest `LeadVerification` row where `botId + email match` AND `usedAt IS NULL`.
2. If none → `verified: false, reason: 'not_found'`.
3. If `expiresAt < now` → `verified: false, reason: 'expired'`. (Do not delete row; the audit table keeps it.)
4. If `attempts >= 5` → `verified: false, reason: 'too_many_attempts'`.
5. Increment `attempts`.
6. Compare `sha256(code) === codeHash` (constant-time compare).
   - If mismatch → `verified: false, reason: 'wrong_code'`.
   - If match → set `usedAt = now`; generate a JWT signed with `BOOKING_JWT_SECRET` (reuse the existing secret used by booking verification, so key rotation stays a single lever) with payload `{ email, botId, kind: 'lead_verification', iat, exp: now + 30min }`. Return `verified: true, verificationToken: <jwt>`.

We reuse the booking JWT secret intentionally: `kind` differentiates leads from bookings so `create_appointment` cannot accept a `lead_verification` JWT and vice versa. Two verify handlers, one signing key.

### `POST /api/lead/submit` (EXISTING — modify)

Add optional field `verificationToken: string | null` on the request. Server-side behavior:

1. Load `bot.leadVerificationRequired`.
2. If `false` → current behavior (accept the lead).
3. If `true`:
   - If `verificationToken` is missing → return `400 { code: 'VERIFICATION_REQUIRED' }`.
   - Verify the JWT (`kind === 'lead_verification'`, `email` matches `leadData.email`, `botId` matches, not expired).
   - On failure → return `400 { code: 'VERIFICATION_INVALID' }`.
   - On success → proceed with the existing capture / delivery flow.
4. Include `verified: boolean` on the persisted `BotLeads` row (add a column, see below).

### `BotLeads` — add `verified` boolean

```prisma
model BotLeads {
  // ...existing fields
  verified Boolean @default(false)     // NEW
}
```

Even a lead captured with `leadVerificationRequired: false` gets `verified: false` — the field describes whether we verified, not whether we could have. Bot owners in the leads inbox can see at a glance which leads went through OTP.

## Email delivery — new template

New method on `MailService`:

```ts
async sendLeadVerificationCode(
  to: string,
  code: string,
  botName: string,
  lang: 'en' | 'tr',
): Promise<void>
```

Templates: `src/mail/templates/lead_verification.html` and `lead_verification_tr.html`.

Copy skeleton (English):

- Subject: `Your Chatbu confirmation code`
- Body: `You asked to be contacted through the <botName> bot. Enter this 6-digit code to confirm your email address: <code>. The code expires in 5 minutes. If you didn't ask for this, you can safely ignore this email.`

No branding hooks beyond `botName`. No tenant-specific fields. English-only + Turkish variants. Same vertical-agnostic discipline as the lead-notification template.

## Frontend UI

Add a subsection under the "Lead destinations" section on the bot settings page:

```
Lead destinations
  [ Email ▾ ]  [ manager@example.com ]  [ ... ]

  Require email verification              [  ●  ]  ← toggle

  When enabled, visitors must enter a 6-digit code
  sent to their email address before their contact
  details are forwarded. This reduces spam / fake
  leads at the cost of one extra step for the
  visitor.
```

- Toggle wired to `POST /api/bot/updateLeadVerification`.
- Show an inline hint below the toggle so bot owners understand the trade-off.
- Disable the toggle if `leadDestinations` is empty (verification is meaningless with no destinations).
- i18n keys: `bot.leadVerification.title`, `bot.leadVerification.description`, `bot.leadVerification.enabled`, `bot.leadVerification.disabled`.

Bot type extension:

```ts
export interface Bot {
  // ...existing fields
  leadVerificationRequired: boolean;
}
```

Leads inbox: add a small badge on rows where `verified: true` — same visual pattern as the delivery-status pill. Owners at a glance see verified vs unverified leads.

## Gateway contract (platform team PR)

### New MCP tool `request_lead_verification(customer_cuid, bot_cuid, email)`

Mirrors `request_booking_verification` shape. In `mcp-server/lead_tools.py`:

1. Validate arguments (bot_cuid non-empty, email shape checks).
2. Query the backend `POST /api/lead/request-verification`.
3. Map responses to sentinels:
   - `status: 'sent'` → `LEAD_VERIFICATION_CODE_SENT: Verification code sent to <email>. Ask the user to check their inbox (and spam folder) and reply with the 6-digit code. Then call capture_lead again with the code as verification_token.`
   - `status: 'rate_limited'` → `LEAD_VERIFICATION_RATE_LIMITED: Too many code requests for this email. Ask the user to wait a few minutes.`
   - `status: 'invalid_email'` → `LEAD_VERIFICATION_INVALID_EMAIL: Ask the user for a valid email address.`
   - Backend 400 `NOT_REQUIRED` → `LEAD_VERIFICATION_NOT_REQUIRED: This bot doesn't require email verification. Call capture_lead directly.` (Belt + suspenders — a bot's config could be edited mid-conversation.)
   - Transport error → `LEAD_VERIFICATION_UNAVAILABLE: The verification service is unreachable. Fall back per LEAD_CAPTURE_FAILED.`

### Modify `capture_lead`

Add optional `verification_token: str = ""` parameter.

Behavior:

1. Before calling backend `/api/lead/submit`, check the tool's cached `bot.leadVerificationRequired` (fetched from a lightweight `GET /api/bot/verification-status/:botId` endpoint that returns `{ requiresVerification: boolean }`).
   - **Cache: 5-minute in-memory** (like calendar `EMAIL_VERIFY_REUSE_TTL_S`). Bot config changes rarely; a 5-min stale window is acceptable.
2. If `requiresVerification: true` and `verification_token` is empty → return `LEAD_CAPTURE_VERIFICATION_REQUIRED: Call request_lead_verification first, get the 6-digit code from the user, then call capture_lead again with that code as verification_token.`
3. If `verification_token` is present, treat it as EITHER a 6-digit OTP OR an already-issued JWT (same pattern as `create_appointment`): try JWT first via `POST /api/lead/verify` (with the raw token as `code`); on failure treat as OTP, exchange for JWT.
4. Include the resulting JWT in the `/api/lead/submit` POST body as `verificationToken`.
5. Existing behavior for non-required bots stays unchanged (no extra hop).

### System prompt block

Extend the `lead_capture_instructions` block in `chat_endpoint.py`:

```
LEAD CAPTURE VERIFICATION (only when required — the tool tells you):
- If capture_lead returns LEAD_CAPTURE_VERIFICATION_REQUIRED:
  1. Call request_lead_verification with the user's email.
  2. The tool will send a 6-digit code to the user's inbox and return LEAD_VERIFICATION_CODE_SENT.
  3. Tell the user (in their language) that the code was sent and ask them to reply with it.
  4. When the user replies with the code, call capture_lead again with the same details AND that code as verification_token.
  5. If capture_lead returns LEAD_CAPTURE_OK, the flow is complete — see the OK rule above.
- If request_lead_verification returns LEAD_VERIFICATION_RATE_LIMITED, ask the user to wait a few minutes. Do not retry yourself.
- If request_lead_verification returns LEAD_VERIFICATION_INVALID_EMAIL, ask the user for a valid email address.
```

Only shipped when the tool actually returns the sentinel — the block references sentinels the model must be able to reason about, not hidden mechanics.

## Test plan

### Backend

- Unit: `updateLeadVerification` accepts true/false, rejects other values, respects team ownership.
- Unit: `request-verification` generates 6-digit codes, stores SHA-256 hash, expires at 5min.
- Unit: rate limiting per (botId, email) — 4th request in 15min returns `rate_limited`.
- Unit: `verify` — correct code succeeds, wrong code increments attempts, 5 wrong attempts locks out, expired code returns `expired`.
- Unit: `verify` returns a JWT with `kind: 'lead_verification'`; the `create_appointment` verify path rejects that JWT.
- Integration: `/api/lead/submit` with `leadVerificationRequired: true` refuses without token, accepts with valid token, rejects with wrong-kind JWT (booking JWT).
- Integration: `BotLeads.verified` is set correctly per lead.
- Migration: existing bots after migration have `leadVerificationRequired: false`.
- Email: template renders with code + botName + language variant.

### Frontend

- Component: toggle round-trips through the endpoint.
- Component: disabled state when `leadDestinations` is empty.
- Component: verified-lead badge renders in inbox.
- E2E: owner enables verification, a mock lead with valid JWT captures successfully; a mock lead without JWT returns the "verification required" error path.

### Gateway (platform)

- Unit: `request_lead_verification` maps all backend responses to sentinels correctly.
- Unit: `capture_lead` refuses without token when bot requires verification, and calls submit correctly when a valid JWT is provided.
- Unit: 5-minute verification-status cache — a change in bot config is visible within 5 minutes.
- Integration: end-to-end simulated flow via `mcp-server/tests/test_lead_verification_flow.py`.

## Rollout plan

1. **Backend PR** — migration + endpoints + service + audit + template + tests → develop → chatbu-dev soak.
2. **Gateway PR** (separate repo) — new MCP tool + `capture_lead` gate + system-prompt block + tests → develop → chatbu-dev soak.
3. **Frontend PR** — toggle + inbox badge + i18n → develop → chatbu-dev soak.
4. Verify end-to-end on chatbu-dev: enable verification on a test bot, run through a lead capture, confirm OTP arrives and capture succeeds only with a valid code.
5. Promote all three to `main` on the same day.

Feature flag: `LEAD_VERIFICATION_ENABLED` in the gateway configmap. Ships OFF; flip ON after all three sides are on main. Default OFF at code level means an unset env leaves every bot in the current (unverified) behavior even if the toggle is somehow enabled in the DB — belt and suspenders.

## Metrics to watch

- Verification opt-in rate — how many bot owners flip the toggle on within the first week.
- Verification completion rate per attempted `request_lead_verification` — how many users actually enter the code vs abandon.
- Wrong-code rate — spam heuristic. If we see 10x wrong codes without success, someone is fuzzing.
- Deliverability — Hostinger SMTP bounce rate on OTP mail specifically. If bounces spike, we may need SES for OTP even though we use Hostinger for notifications.

## Open questions

- Do we also add SMS OTP as a P2 channel? (out of scope for now — matches the P1/P2 split of lead capture itself)
- Should the verified-lead badge include the timestamp of verification? Nice-to-have for owner audit; skippable for v1.
- Do we allow bot owners to configure the OTP TTL (5 min → longer)? Not in v1 — a shorter TTL is stricter and safer, longer TTL is only useful in edge cases we haven't seen yet.
