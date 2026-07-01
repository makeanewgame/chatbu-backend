# Feature: Per-bot Model Tier

Owner: Backend + Frontend
Status: Draft — awaiting review
Ticket / Backlog ref: Chatbu backlog #5 (2026-07-01)

## Motivation

The gateway (`fovi-longa-chat-be`) currently uses a single model for every bot — Bedrock Claude Haiku 4.5 — via a cluster-wide env var. Some bot owners will pay for a stronger model (Sonnet) to lift answer quality on domain-heavy content; others will stay on Haiku for cost reasons.

We need a per-bot `modelTier` config that:

1. Defaults to Haiku when unset (zero migration cost, current behavior preserved).
2. Is chosen by the bot owner in the bot-settings UI.
3. Is only writable to a paid/premium tier for higher-cost models (plan-tier gate).
4. Is generic: values are provider-neutral names (`'haiku'`, `'sonnet'`), NOT vertical hints — Chatbu remains a vertical-agnostic platform.

This document is a spec for the backend and frontend work only. The gateway-side wiring (reading the field, calling `ModelFactory.create_llm(tier=...)`) will be delivered separately by the platform team once the backend contract is live.

## Scope

### In scope

- Prisma schema addition on `CustomerBots`.
- Backend API: expose `modelTier` in the existing bot detail / settings endpoints; accept it on the settings-update endpoint.
- Backend gate: reject non-default tiers if the team's subscription plan does not permit them.
- Frontend: add a tier selector to the bot settings screen; disable / hide options unavailable on the current plan.
- Backend migration + seed defaults for existing bots (`'haiku'` for everyone).

### Out of scope

- Gateway (`fovi-longa-chat-be`) changes — separate PR by platform team.
- New Bedrock model provisioning — Sonnet 5 is already available in eu-central-1 (`eu.anthropic.claude-sonnet-5-...`), platform team will confirm exact model id when wiring.
- Cost throttling changes — existing `TokenUsageLog` + Redis throttle keep working. If Sonnet usage causes runaway cost we tune thresholds separately.
- Auto-tier ("upgrade this bot to Sonnet automatically when X") — out of scope; explicit user choice only.

## Data model

Add a single column to `CustomerBots`:

```prisma
model CustomerBots {
  id           String    @id @default(cuid())
  teamId       String
  botName      String
  botAvatar    String
  systemPrompt String    @default("")
  settings     Json?
  active       Boolean   @default(false)
  modelTier    String    @default("haiku")   // NEW: 'haiku' | 'sonnet'
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  isDeleted    Boolean   @default(false)
  deletedAt   DateTime?
  team         Team      @relation(fields: [teamId], references: [id], onDelete: Cascade)
}
```

Prisma migration should add the column with `DEFAULT 'haiku'` so every existing row is filled without a manual backfill script.

We deliberately DO NOT stuff this into the existing `settings` JSON blob: `modelTier` needs plan-tier enforcement at the DB / service layer, and typed columns are much cleaner for filtering, indexing, and admin reports than JSON path queries.

Do NOT introduce a `ModelTier` enum type. Keep it a plain `String` — the platform team may add a third tier later without a Prisma migration, and Postgres enums are painful to evolve.

### Constants (backend side)

Introduce a single source of truth for allowed values, e.g. `src/bot/model-tier.constants.ts`:

```ts
export const MODEL_TIERS = ['haiku', 'sonnet'] as const;
export type ModelTier = typeof MODEL_TIERS[number];
export const DEFAULT_MODEL_TIER: ModelTier = 'haiku';
```

Use this in every DTO validator and service check — the string literals `'haiku'`/`'sonnet'` must not appear inline anywhere else.

## Backend API

### `POST /api/bot/list` (existing — read one bot)

Include `modelTier` on the returned object. No breaking change; frontend already tolerates unknown fields.

### `POST /api/bot/create` (existing)

Accept optional `modelTier`. If omitted, default to `'haiku'`. If provided, run the plan-tier gate (see below). Reject with `400 { message: 'Invalid model tier' }` for unknown values.

### `POST /api/bot/updateModelTier` (NEW)

```
Request:  { botId: string, modelTier: 'haiku' | 'sonnet' }
Response: { message: string, bot: CustomerBots }
Errors:
  400 - Unknown modelTier value
  402 - Payment required (plan does not include this tier)
  403 - Bot not owned by requester's team
  404 - Bot not found
```

Keep this as its own endpoint rather than piggy-backing on `saveAppearance` — plan-tier gate logic should not live inside an appearance handler, and audits become cleaner.

### Plan-tier gate

- `'haiku'` — allowed on every plan (including free tier).
- `'sonnet'` — allowed only on plans marked "premium" or higher.

Implementation: look up `Subscription` for the requesting user's team, check the plan / `PricePlan.name` (or a new `PricePlan.allowsPremiumModels: boolean` flag if that reads cleaner in your billing code). Free-tier attempts must return HTTP 402 with a machine-readable `code: 'PLAN_UPGRADE_REQUIRED'` so the frontend can render an upgrade prompt.

Gate MUST live in the backend service layer, not just the frontend — if the frontend gate is bypassed (curl, expired session, older client), backend rejects.

### Audit

Log tier changes to `SystemLog`:

```
category: 'BOT'
action: 'UPDATE_MODEL_TIER'
status: 'SUCCESS' | 'REJECTED_PLAN'
entityId: botId
message: `Bot model tier: <old> -> <new>`
```

## Frontend UI

Add a "Model" section to the existing bot settings page (same route as the appearance / system-prompt editor).

### Layout

```
Model                                                  [Learn more ⓘ]

 ( ) Standard (Haiku 4.5)   — fast, cost-efficient   [ current ]
 ( ) Advanced (Sonnet 5)    — higher quality answers  [ Premium ]
```

- Two radio buttons stacked (list will grow later, so use `<RadioGroup>`, not a hard-coded pair).
- Labels are localized (i18n keys `bot.modelTier.haiku.label`, `bot.modelTier.sonnet.label` + `.description`). Do NOT hard-code English or Turkish strings.
- If the current plan does not permit Sonnet: render the Sonnet row disabled, with a small "Premium" pill and a tooltip / link that navigates to the billing page.
- On save, call `POST /api/bot/updateModelTier`. Show a toast on success; on `402` show "This model is only available on Premium plans" (i18n key `bot.modelTier.upgradeRequired`) with a link to `/billing`.

### Where to put it

The bot settings page already has sections for appearance, system prompt, integrations. Add the "Model" section directly above "Integrations" (or in whichever order lists reads best — check with design if unclear).

### API shape on the frontend side

Extend the existing `Bot` type in `src/types/bot.ts` (or wherever your `Bot` interface lives) with:

```ts
export type ModelTier = 'haiku' | 'sonnet';

export interface Bot {
  // ...existing fields
  modelTier: ModelTier;
}
```

Consumer components can assume `modelTier` is always present — the backend guarantees a default. No optional handling required.

### What NOT to do

- Do NOT show provider names (Bedrock / Anthropic) in the UI — users think in tiers, not clouds.
- Do NOT translate `'haiku'` / `'sonnet'` in the API payload — those are stable IDs.
- Do NOT hide the section entirely on free plans — showing a disabled Premium option is a natural upsell surface.

## Test plan

### Backend

- Unit: `updateModelTier` accepts `'haiku'` / `'sonnet'`, rejects `'gpt-4'`, `'HAIKU'`, `''`.
- Unit: plan-tier gate rejects Sonnet for free-plan team; accepts for premium.
- Integration: create bot without `modelTier` → row has `'haiku'`.
- Integration: existing bots after migration all have `'haiku'`.
- Audit: SystemLog written on every attempted change (success or rejection).

### Frontend

- Component: `<ModelTierPicker>` renders both options, disables Sonnet when `plan !== premium`.
- Component: `402` response triggers upgrade toast + navigation link.
- E2E: free-plan user cannot save Sonnet (backend rejects even if UI is bypassed).

### Migration soak

- Deploy to `chatbu-dev` first ([[dev-environment-first]]).
- Verify existing bots list still renders, no `undefined` in any tier field.
- Confirm no timing issues on the settings save API round-trip.

## Rollout plan

1. Backend PR — schema migration + `updateModelTier` endpoint + gate + audit + tests → develop → dev soak.
2. Frontend PR — UI + client call → develop → dev soak.
3. Platform team PR (separate) — gateway reads `modelTier`, ModelFactory maps to Bedrock id, cost throttle validated.
4. Promote all three to main once dev soak passes.

Backend and frontend PRs are ordered but independent; the frontend can render the section with the field forced to `'haiku'` locally until backend ships.

## Open questions

- Do we want a per-team default (a Team-level fallback if a bot has no explicit tier)? Not in v1 — every bot ships with `'haiku'` and users override per-bot.
- Should Sonnet-tier bots have a higher token quota under the same plan price? Product decision; out of scope for this ticket.
- Do we introduce a middle tier (e.g. Haiku 4.5 with reasoning on) later? Yes — that's why the constants file exists and the field is a `String`, not a Postgres enum.
