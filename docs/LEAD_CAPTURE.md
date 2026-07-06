# Feature: Lead Capture (P1 — Email)

Owner: Backend + Frontend
Status: Draft — awaiting review
Ticket / Backlog ref: Chatbu backlog #2 (2026-06-22, extended 2026-07-03, split P1/P2 on 2026-07-04)

## Motivation

Across multiple bots and verticals we keep seeing the same failure pattern in production:

- User: "please have someone call me at 0506… I'm interested in X".
- Bot: "Perfect — I've passed your details to our sales team, they'll reach out shortly".
- Reality: nothing happens. No email, no ticket, no queue. The bot owner never learns a lead came in. The user waits for a call that never comes.

The MCP server only exposes booking-shaped tools today (`request_booking_verification`, `create_appointment`, `check_availability`); there is no lead-forwarding surface. The bot fabricates a comforting outcome because the system prompt tells it to be helpful, but the tool boundary can't back the promise up.

This document specifies the smallest useful fix: a `capture_lead` tool that, in v1, sends an email to a bot-owner-configured address. The choice of email as the first channel is not accidental — every bot owner already has an inbox, no third-party account setup is required, and one email path proves the whole delivery-audit-inbox loop before we add SMS / Slack / Teams / WhatsApp / webhook on top.

The result must be: when the bot says "someone will get back to you", someone actually gets an email. When delivery fails, the bot must say so honestly instead of promising a callback.

This document is a spec for the backend and frontend work only. The gateway-side wiring (the `capture_lead` MCP tool implementation and the sentinel handling in the agent loop) will be delivered separately by the platform team once the backend contract is live.

## Scope

### In scope (P1)

- Prisma schema: add `leadDestinations` (JSON) to `CustomerBots`; add `BotLeads` audit table.
- Backend: `updateLeadDestinations` endpoint for bot owners.
- Backend: `submitLead` endpoint that the gateway's `capture_lead` MCP tool will call.
- Backend: email delivery via the existing `MailService` (Hostinger SMTP — reuse; no new provider to introduce).
- Backend: leads-inbox endpoints (`listLeads`, `markLeadRead`) for the bot-owner UI.
- Frontend: bot-settings "Lead destinations" section (email address input + toggle).
- Frontend: leads-inbox page under the bot's dashboard.
- Backend migration + safe default for existing bots (`leadDestinations: []`, i.e. lead-capture off).

### Out of scope (P2 — do NOT ship in this PR pair)

- Non-email channels: SMS (Twilio/Vonage), Slack, MS Teams, WhatsApp Business, arbitrary webhook. Deferred until email has soaked and we have concrete adoption / failure numbers.
- Lead scoring, dedup across chats, CRM export.
- User-facing consent screen ("your info will be shared with…") — the existing widget ToS/privacy links already cover this; product may add an inline notice later.
- Auto-detecting lead intent without user opt-in — v1 fires only when the model calls the tool.
- Retry queue / delivery-attempt worker — v1 sends synchronously and records success/failure. If real traffic shows non-negligible transient failures we add a worker in v1.1.

## Design principles (must honor)

- **Generic platform** ([[generic-platform-no-tenant-code]]) — no vertical-specific fields, copy, or defaults. Every bot owner configures their own email; the code has no knowledge of "clinic" vs "salon" vs "security" etc.
- **Deterministic tool boundary** ([[deterministic-over-prompt-rules]]) — the bot's honesty is enforced by the tool's return contract (success sentinel vs failure sentinel), not by rules bolted onto the system prompt.
- **Dev-first** ([[dev-environment-first]]) — every PR ships to `develop` and soaks on `chatbu-dev` before promotion to `main`.
- **Audit everything** — every lead attempt, whether delivered or not, is persisted. Bot owners must be able to see failures, not just successes.

## Data model

### `CustomerBots` — add `leadDestinations` JSON field

```prisma
model CustomerBots {
  id                String    @id @default(cuid())
  teamId            String
  botName           String
  botAvatar         String
  systemPrompt      String    @default("")
  settings          Json?
  active            Boolean   @default(false)
  leadDestinations  Json      @default("[]")   // NEW: LeadDestination[]
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  isDeleted         Boolean   @default(false)
  deletedAt         DateTime?
  team              Team      @relation(fields: [teamId], references: [id], onDelete: Cascade)
  BotLeads          BotLeads[]
}
```

Migration: add column with `DEFAULT '[]'` — every existing bot lands with lead-capture off (empty destinations list ⇒ the MCP tool returns the failure sentinel, so the bot is forced to say "I can't reach anyone right now" rather than lie).

Do NOT inline destinations into the existing `settings` JSON blob. Destinations need typed validation, dedicated indexing later, and audit-log joins; a top-level typed-shape column keeps that clean.

### `LeadDestination` shape (JSON, validated in service layer)

```ts
export type LeadChannel = 'email';                              // P2 will add: 'sms' | 'slack' | 'teams' | 'whatsapp' | 'webhook'
export const LEAD_CHANNELS: readonly LeadChannel[] = ['email'] as const;

export interface LeadDestination {
  channel: LeadChannel;
  target: string;                                                // channel-specific: email address for 'email'
  label?: string;                                                // optional human-friendly name shown in the settings UI ("Sales team", "Manager")
  enabled: boolean;                                              // let bot owners pause a destination without deleting it
}
```

Constants file, single source of truth: `src/bot/lead-destination.constants.ts`. Every DTO validator, service check, and audit log reads from here. String literals `'email'`, etc. must NEVER appear inline anywhere else in the codebase.

v1 accepts multiple email destinations (a bot may want "sales" and "manager" copies). The service iterates and sends to each enabled destination in parallel.

### `BotLeads` — new audit table

```prisma
model BotLeads {
  id                  String        @id @default(cuid())
  botId               String
  chatId              String?                                    // optional — lead may come from a session that hasn't produced a persisted chat row yet
  leadData            Json                                       // { name?, email?, phone?, notes?, source_bot? } as received from the gateway
  channelsAttempted   Json          @default("[]")               // string[] of channel names attempted this submission
  channelsSucceeded   Json          @default("[]")               // string[] of channel names that returned OK
  deliveryErrors      Json?                                      // { channel: string, error: string, target?: string }[] when any leg failed
  status              LeadStatus    @default(NEW)                // NEW → READ → ARCHIVED (bot-owner UI actions)
  createdAt           DateTime      @default(now())
  updatedAt           DateTime      @updatedAt
  bot                 CustomerBots  @relation(fields: [botId], references: [id], onDelete: Cascade)

  @@index([botId, createdAt])
  @@index([botId, status])
}

enum LeadStatus {
  NEW
  READ
  ARCHIVED
}
```

We record BOTH `channelsAttempted` and `channelsSucceeded` so a partial delivery ("email OK, sms failed" in P2) is visible to the bot owner and to the gateway's sentinel logic. `deliveryErrors` captures per-channel error strings for the inbox UI to surface diagnostics.

We deliberately keep `leadData` as free-form JSON rather than typed columns — the fields the bot collects vary per vertical (a clinic wants a phone number; a B2B lead form wants a company). The gateway tool schema will validate presence of at least one contact channel (email or phone); backend accepts what it gets and stores it verbatim.

## Backend API

### `POST /api/bot/updateLeadDestinations` (NEW — bot owner)

```
Request:  {
  botId: string,
  destinations: LeadDestination[]
}
Response: { message: string, bot: CustomerBots }
Errors:
  400 - Invalid destinations payload (unknown channel, malformed target)
  403 - Bot not owned by requester's team
  404 - Bot not found
```

Validation rules per destination:

- `channel` must be a member of `LEAD_CHANNELS` (v1: `'email'` only).
- `target` must be non-empty and shape-valid per channel:
  - `email` — RFC 5322 lenient validator already used elsewhere in the codebase (reuse `email-validator` or the existing helper).
- `label`, if provided, ≤ 60 chars.
- `enabled` is a required boolean.

Reject the whole request with a validation error listing every invalid destination — do NOT silently drop invalid entries. Keeps state predictable.

Audit: `SystemLog` entry `{ category: 'BOT', action: 'UPDATE_LEAD_DESTINATIONS', entityId: botId, message: '<n> destinations, <k> enabled' }`. Do not log target values (email addresses are PII).

### `POST /api/lead/submit` (NEW — internal, called by the gateway)

```
Request:  {
  botId: string,
  chatId: string | null,
  leadData: { name?: string, email?: string, phone?: string, notes?: string, source_bot?: string }
}
Response: {
  status: 'delivered' | 'partial' | 'failed',
  leadId: string,
  channelsAttempted: string[],
  channelsSucceeded: string[]
}
Errors:
  400 - Invalid payload (missing botId, empty leadData, no contact field)
  401 - Missing / invalid internal service auth
  404 - Bot not found
```

Auth: this endpoint is called by the gateway (`fastapi-gateway-service`) using the same internal service-to-service pattern already used for MCP callbacks. Include it in the existing allow-list; do NOT expose to end users through the public router.

Delivery contract:

1. Load `bot.leadDestinations`. If empty or all disabled → return `{ status: 'failed', channelsAttempted: [], channelsSucceeded: [] }` and persist a `BotLeads` row with `deliveryErrors: [{ channel: 'none', error: 'no_destinations_configured' }]`. The gateway will emit the failure sentinel and the bot will tell the user honestly.
2. Otherwise, fan out to each enabled destination in parallel:
   - v1: only `email` — call `MailService.sendLeadNotification(target, botName, leadData, teamLang)`.
3. Wait for all fan-outs. Aggregate results:
   - All succeeded → `status: 'delivered'`.
   - Some succeeded, some failed → `status: 'partial'`.
   - All failed → `status: 'failed'`.
4. Persist `BotLeads` row with the aggregated arrays and errors regardless of outcome.
5. Return the `BotLeads.id` as `leadId` so the gateway can echo it in logs.

`status: 'partial'` is treated as success by the gateway sentinel (at least one channel delivered), but is visible in the leads-inbox UI as a warning row.

### `POST /api/lead/list` (NEW — bot owner)

```
Request:  {
  botId: string,
  status?: 'NEW' | 'READ' | 'ARCHIVED',
  cursor?: string,
  limit?: number    // default 25, max 100
}
Response: {
  leads: BotLeads[],
  nextCursor: string | null
}
Errors:
  403 - Bot not owned by requester's team
  404 - Bot not found
```

Return leads ordered by `createdAt DESC`. Cursor-based pagination (opaque token, decode server-side).

### `POST /api/lead/markStatus` (NEW — bot owner)

```
Request:  { leadId: string, status: 'READ' | 'ARCHIVED' }
Response: { message: string, lead: BotLeads }
Errors:
  400 - Invalid target status
  403 - Lead's bot not owned by requester's team
  404 - Lead not found
```

Transitions: `NEW → READ`, `NEW → ARCHIVED`, `READ → ARCHIVED`, `ARCHIVED → READ`. Every transition audited to `SystemLog`.

## Email delivery (P1 core)

Reuse the existing `MailService` (`src/mail/mail.service.ts`) — Hostinger SMTP is already configured (`SMTP_HOST`, `SMTP_PORT`, `ADMIN_EMAIL` in the base configmap) and delivering user-registration / password-reset / booking-verification emails today. No SES rollout, no new provider secret.

Add one method:

```ts
async sendLeadNotification(
  to: string,
  botName: string,
  leadData: LeadData,
  lang: 'en' | 'tr',
): Promise<void>
```

Template files under `src/mail/templates/`:

- `lead_notification.html` (English)
- `lead_notification_tr.html` (Turkish)

Both must be neutral, professional, vertical-agnostic. Suggested skeleton:

- Subject: `New lead from your Chatbu bot: {{botName}}` / `Chatbu botunuzdan yeni bir kayıt: {{botName}}`
- Body sections:
  - Header ("A visitor asked to be contacted through your {{botName}} bot.")
  - Contact info block — render only the fields present in `leadData` (name / email / phone).
  - Free-text notes block — render only if `leadData.notes` is set.
  - Timestamp (rendered server-side in the recipient team's timezone if known; else UTC).
  - Footer: link to the bot's leads-inbox page in the Chatbu app + support link + unsubscribe pointer (destinations are configurable, not a global list — the "unsubscribe" is the settings UI).

Explicitly do NOT include:

- The chat transcript. Privacy-adjacent — bot owner should open the inbox to see the conversation context, not receive it in mail.
- Any vertical-specific copy ("book an appointment", "schedule a consult" etc.).

Language: pick from the team's locale preference (existing `User.lang` on the team owner). Default to English if unknown.

Failure handling: `MailService.sendLeadNotification` throws on SMTP error → caller in `LeadService.submit` catches per-destination, records the error in `deliveryErrors`, continues with other destinations. Do NOT swallow the exception silently — the audit row must reflect what happened.

## Frontend UI

### Section 1: Bot settings — "Lead destinations"

Add a new section to the existing bot-settings page (same route as appearance / system-prompt editor), placed above "Integrations".

Layout (P1 — email only):

```
Lead destinations                                     [Learn more ⓘ]

When your bot promises to have someone contact a visitor,
we'll send an email to the address(es) below. Add one row
per person or team who should receive lead notifications.

  [ Email ▾ ]  [ manager@example.com     ]  [ Sales team    ]  [ ✓ enabled ]  [ Remove ]
  [ Email ▾ ]  [ owner@example.com       ]  [               ]  [ ✓ enabled ]  [ Remove ]

  [ + Add destination ]

  [ Save ]
```

- Channel dropdown is present but disabled with tooltip "More channels coming soon" — v1 only exposes email. The frontend must render this select from `LEAD_CHANNELS` (imported from a shared constants file mirroring the backend), not a hard-coded array — the moment backend adds `'sms'`, the UI picks it up.
- The `label` input is optional; UI hint is `"Sales team"`.
- `enabled` is a toggle; the "Remove" button deletes the row from local state (must click Save to persist).
- Validation is inline (empty email address prevents Save; malformed email shows a field error).
- If `leadDestinations` is empty, show a callout: **"No destinations configured — your bot will honestly tell visitors it can't reach anyone yet."** This is the key UX signal: bot owners who never configure this get an honest bot, not a lying one.

i18n: every label/description comes from translation keys (`bot.leadDestinations.title`, `bot.leadDestinations.description`, `bot.leadDestinations.channel.email`, `bot.leadDestinations.emptyState`, etc.). Do NOT hard-code English or Turkish strings anywhere.

### Section 2: Leads inbox page

New route under the bot's dashboard: `/bot/{botId}/leads`. Link from the bot header nav next to "Chats" / "Analytics" (existing pattern).

Layout:

```
Leads for {{botName}}                       [ All | New (3) | Read | Archived ]

  ┌─────────────────────────────────────────────────────────────────────┐
  │ ● NEW   2026-07-04 14:32     Erkan SIRIN                            │
  │         erkansirin78@hotmail.com · 0506…                             │
  │         "please have someone contact me about your services"        │
  │         Delivered: email → manager@example.com                       │
  │                                                       [Mark read ▸] │
  └─────────────────────────────────────────────────────────────────────┘
  ┌─────────────────────────────────────────────────────────────────────┐
  │ ● NEW   2026-07-04 14:12     Anonymous visitor                       │
  │         no contact info captured                                    │
  │         ⚠ Delivery failed: email → sales@… (SMTP timeout)            │
  │                                                       [Mark read ▸] │
  └─────────────────────────────────────────────────────────────────────┘

  [ Load more ]
```

- Filter chips at the top (`All | New | Read | Archived`).
- Each row: status dot, timestamp, name (or `"Anonymous visitor"` if no name), contact fields as chips, notes as a quote block, delivery outcome line (green = delivered, amber = partial, red = failed).
- Failed-delivery rows are especially important — they're the honest audit trail bot owners never had before. Highlight visibly.
- Click a row: opens a side panel with (a) full `leadData`, (b) full `deliveryErrors`, (c) a "View conversation" link jumping to the chat where the lead came from (if `chatId` is present).
- Status buttons: mark read, archive. Optimistic UI + toast on failure.

Empty state (no leads yet): "No leads yet — leads will appear here when a visitor asks you to contact them and your bot delivers a notification. Not seeing leads you expected? Check that at least one destination is enabled in Settings."

### Frontend types

Extend `src/types/bot.ts` (or wherever `Bot` lives):

```ts
export type LeadChannel = 'email';    // widened later
export interface LeadDestination {
  channel: LeadChannel;
  target: string;
  label?: string;
  enabled: boolean;
}
export interface Bot {
  // ...existing fields
  leadDestinations: LeadDestination[];
}
```

New file `src/types/lead.ts`:

```ts
export type LeadStatus = 'NEW' | 'READ' | 'ARCHIVED';
export interface Lead {
  id: string;
  botId: string;
  chatId: string | null;
  leadData: {
    name?: string;
    email?: string;
    phone?: string;
    notes?: string;
    source_bot?: string;
  };
  channelsAttempted: string[];
  channelsSucceeded: string[];
  deliveryErrors: Array<{ channel: string; error: string; target?: string }> | null;
  status: LeadStatus;
  createdAt: string;
  updatedAt: string;
}
```

### What NOT to do

- Do NOT show delivery target addresses in the leads-inbox row summary — targets are only rendered on the expanded side panel (some bot owners will screen-share this page and don't want their sales team's inbox on screen).
- Do NOT hide failed-delivery rows behind an "advanced" toggle — those are the highest-priority signal for the bot owner.
- Do NOT collapse the destinations UI when no destinations exist — the empty-state callout IS the CTA to configure.

## Gateway contract (context only — separate PR)

The gateway will implement:

- MCP tool `capture_lead(name?, email?, phone?, notes?, source_bot?) -> { status, channels_delivered, channels_failed, message }`.
- Precondition: at least one of `email` or `phone` must be present. If both are absent → return `LEAD_CAPTURE_MISSING_CONTACT` sentinel; agent instructed to ask the user for a contact channel.
- The tool calls backend `POST /api/lead/submit` and translates:
  - Backend `status: 'delivered' | 'partial'` → `LEAD_CAPTURE_OK` sentinel; agent tells the user "your details have been forwarded and someone will contact you".
  - Backend `status: 'failed'` → `LEAD_CAPTURE_FAILED` sentinel; agent tells the user "I'm sorry, I couldn't reach anyone right now — please write to <fallback email or phone from bot settings>".
  - Any transport error (backend 5xx / timeout) → `LEAD_CAPTURE_ERROR` sentinel; same honest-failure behavior.
- The prompt work is kept minimal: the system prompt only tells the agent WHEN the tool is available and WHAT each sentinel means, per [[deterministic-over-prompt-rules]]. No "always promise a callback" language.

## Test plan

### Backend

- Unit: `updateLeadDestinations` accepts a valid email destination, rejects unknown channel, rejects malformed email, rejects empty target, rejects target longer than 320 chars, rejects >20 destinations per bot (sane cap).
- Unit: destinations round-trip through the Prisma JSON column with fidelity (no field drops).
- Unit: `LeadService.submit` with (a) no destinations, (b) one enabled email destination, (c) one enabled + one disabled, (d) two enabled where MailService throws for one. Verify `channelsAttempted`, `channelsSucceeded`, `deliveryErrors`, and `status` for each shape.
- Unit: `LeadService.submit` persists a `BotLeads` row even when delivery is a total failure (audit invariant).
- Integration: gateway internal auth token is checked on `/api/lead/submit`; unauthenticated call gets 401.
- Integration: `POST /api/lead/list` returns cursor pagination in the right order; `status` filter narrows correctly.
- Integration: `POST /api/lead/markStatus` respects team ownership.
- Migration: existing bots after migration have `leadDestinations: []` (verify with a seeded fixture).
- Email: template renders with all fields present, with only some fields present, with no notes. Language switches on `lang` param.

### Frontend

- Component: `<LeadDestinationsEditor>` renders zero, one, many rows; add / remove / toggle interact with local state; Save triggers the update endpoint.
- Component: `<LeadInboxTable>` renders NEW / READ / ARCHIVED filter chips; empty state shows expected CTA; failed-delivery rows visually distinct.
- E2E: bot owner creates a destination → an incoming lead (mocked via backend) appears in the inbox with the correct destination label → marking read moves it out of the "New" filter.
- E2E: bot owner deletes all destinations → new incoming lead appears with a delivery-failed row.

### Soak

- Deploy to `chatbu-dev` first ([[dev-environment-first]]).
- Seed a dev bot with one destination (developer's own email); use the widget end-to-end to trigger the flow through the gateway; confirm the email arrives and the inbox reflects `delivered`.
- Delete the destination; re-run; confirm the inbox shows a `failed` row and the widget bot honestly refuses.
- Verify the SMTP account's send rate is unaffected (Hostinger limits — watch for bounces).

## Rollout plan

Ordered but the frontend PR can be prepared and reviewed in parallel with the backend PR; merge order is backend → frontend → platform (gateway).

1. **Backend PR** — Prisma migration + `LeadService` + `MailService.sendLeadNotification` + templates + endpoints + audit + tests → develop → chatbu-dev soak (24h). Verify migration completes without a lock.
2. **Frontend PR** — settings editor + inbox page + i18n keys + types + tests → develop → chatbu-dev soak. During the window between backend deploy and frontend deploy, the settings UI simply doesn't render (feature-gated on the field existing on `Bot`).
3. **Platform PR (separate)** — gateway `capture_lead` MCP tool + sentinel handling + minimal system-prompt block → develop → chatbu-dev soak. Only merge to main after backend + frontend are on main.
4. Promote all three to `main` in the same day, backend first.

Feature flag: `LEAD_CAPTURE_ENABLED` env var on the gateway. Ship OFF by default to prod; flip ON only after all three PRs are on main and the dev soak is clean.

## Metrics to watch after prod flip

- Leads submitted per day (per bot).
- Delivery success rate (`delivered / (delivered + partial + failed)`).
- Median deliveryErrors count on failed submissions (identifies SMTP-side issues fast).
- Distribution of `leadData` field presence — informs whether we need a required-contact schema tighten later.
- Leads-inbox opens per bot owner per week (are owners actually looking?).

Grafana dashboard: add a "Lead capture" panel to the existing Middleware Health board — LogQL panels for gateway tool-call rate + backend `/api/lead/submit` status distribution.

## Open questions

- Should we cap destinations per bot? Proposed: 20 for v1 — plenty of headroom, prevents abuse.
- Should a lead-capture email include a magic "reply here" link that opens the conversation in the Chatbu app? Nice-to-have; deferred until we see leads-inbox open-rate.
- Do we want to expose "recent leads" summary counts on the bot list page? Yes but out of scope for v1 — one item on the follow-up list.
- Do we want to auto-populate destinations from the team owner's registered email on bot creation? Tempting but no — the person who creates the bot is not always the person leads should go to (see: agencies managing bots for clients). Explicit configuration is safer.
