# Feature: Chatbot Wizard v2 — Structured Owner Intent Capture

Owner: Frontend + Backend + Platform (gateway meta-prompt)
Status: Draft — awaiting review
Ticket / Backlog ref: Chatbu backlog #22 (2026-08-24)

## Motivation

The current wizard (Hazalcan v1, `chatbu-frontend/src/pages/ChatbotWizard/`) collects four free-text/free-choice inputs from the owner (businessName, companySize, industry, purpose) and hands the rest to an LLM meta-prompt (`app-ml-services/routers/generate_system_prompt.py`) that synthesizes a "production-grade" system prompt of several hundred words. Owners — most of whom are salespeople with zero prompt-engineering background — see the synthesized textarea, accept it, and never revisit it.

This has produced a class of recurring production bugs:

- **Fovi Bot prod (2026-08-24)**: owner-facing system prompt contains "*müşterinin telefon numarasını ve ne zaman aranmak istediğini al*" — a line **written by our own meta-prompt LLM** during synthesis, not by the owner. When the platform's `LEAD CAPTURE` block appends `FORM FIRST — PRIORITY RULE`, the two collide. Sonnet 4.5 (upgraded from Haiku for this exact bot) still followed the owner-directive path (inline questions) over the platform rule.
- **Veri Bilimi Okulu prod (2026-08-24)**: 8,397-char synthesized prompt contains "*doğal bir şekilde adını ve iletişim bilgisini toplamayı öner*" and "*İletişim detaylarını konuşma doğal olarak sonlanırken paylaş*" — again LLM-authored, again overriding platform FORM FIRST.
- **Beautyisland prod**: 568-char short generic prompt with NO contact-collection directives → platform FORM FIRST works correctly.

Root cause: **the meta-prompt (`generate_system_prompt.py:47-140`) freeform-injects business-logic directives into the synthesized prompt** ("if purpose implies sales/bookings/quotes, include capturing the visitor's contact details as a goal"). These directives compete with platform-level rules the gateway appends at chat time.

**Third defect class — off-topic answering (2026-08-24 real prod repro)**: prod bot "bobot" received the message "harry potter" and answered in English with the 4 Hogwarts houses (Gryffindor / Slytherin / Hufflepuff / Ravenclaw). The bot is clearly not a Harry Potter bot — this is Claude's training-data general knowledge leaking through. The current meta-prompt says "Never invent information" but the LLM interprets general knowledge as NOT invented (it's factually true), so the guard fails. The bot also answered in English despite the visitor writing in Turkish (grounding middleware + language enforcement both bypassed on this off-topic path).

This is a **default-behavior gap**: bots should refuse off-topic questions by default. Owner must opt IN to general-knowledge fallback if that's actually desired (rare — few businesses want their support bot answering trivia).

Fixing this reactively (deterministic middleware to force `tool_choice`) is captured as backlog #21 — that's a bandage. This spec is the preventive fix: **make it structurally impossible for an owner-facing prompt to contain business-logic directives that platform capabilities already handle deterministically**.

Related memory:
- [[project_backlog]] #21 — reactive middleware (still valid as a safety net)
- [[project_backlog]] #18 — Skill Presets (natural downstream once wizard v2 lands)
- [[feedback_deterministic_over_prompt_rules]] — capability flags > freeform prose
- [[feedback_prompt_priority_bullets]] — platform PRIORITY bullets lose dominance when surrounded by prose
- [[feedback_generic_platform_no_tenant_code]] — capability list must remain vertical-agnostic

## Scope

### In scope (this spec)

- Prisma schema additions on `CustomerBots` (capabilities, persona, negatives, primary language).
- `bot.service.ts`: accept the new fields on create + update; validate; expose in bot detail endpoint.
- Frontend wizard v2: 7 structured steps + playground (see § Frontend).
- Backend meta-prompt v2 (`generate-system-prompt`): drop all freeform business-logic injection; render structured sections from the capability flags. Platform-handled capabilities produce a MINIMAL prompt fragment ("platform handles X — do NOT restate rules"), not a full "how to do X" section.
- Migration path for existing bots: no forced re-synthesis; opt-in "Re-run wizard v2" from bot settings.
- Feature flag: `WIZARD_V2_ENABLED` env (dev on, prod off) — both wizards live side-by-side until soak passes.

### Out of scope (separate work)

- Gateway `chat_endpoint.py` prompt-composition changes — the appended LEAD CAPTURE / booking blocks stay as-is; wizard v2 just ensures nothing owner-side competes with them.
- Backlog #21 (deterministic middleware) — orthogonal safety net; ships independently.
- Backlog #18 (Skill Presets) — vertical templates on top of wizard v2's structured intents; separate iteration once v2 soaks.
- Automatic re-synthesis of existing bots — owner-triggered only.
- Multi-language content for wizard UI beyond current TR/EN (mirrors chatbu locale support).
- Owner playground load testing / rate limiting — wizard v2 playground reuses the existing `/chat` endpoint; standard rate limits apply.

## Data model

### `CustomerBots` — additive columns

```prisma
model CustomerBots {
  // ... existing fields (id, teamId, botName, botAvatar, systemPrompt, settings, active, modelTier, createdAt, updatedAt, isDeleted, deletedAt, team) ...

  // NEW — wizard v2 structured intent inputs
  capabilities      Json?     // { leadCapture, booking, productCatalog, humanEscalation, generalKnowledgeFallback } — nullable to preserve v1 bots
  persona           Json?     // { name?: string, role?: string, tone?: 'warm'|'formal'|'casual'|'expert' }
  negatives         String[]  @default([]) // "don't discuss competitors", "don't give medical advice", …
  primaryLanguage   String?   // ISO 639-1 code; null = auto-detect only
  wizardVersion     Int       @default(1)  // 1 = Hazalcan v1 (unstructured), 2 = wizard v2 (structured intents)
}
```

Rationale:
- All new fields **nullable / defaulted** — zero migration cost, existing bots keep working with `wizardVersion=1` (which means the gateway meta-prompt append logic still uses the raw `systemPrompt` verbatim — see § Meta-prompt v2 for why v2 bots synthesize differently).
- `capabilities` as `Json` (not enum table) — additive; adding a new capability flag next quarter is a schema no-op on the frontend and a single migration on the Prisma side.
- `persona` as `Json` — same reasoning; tone will grow beyond 4 options.
- `negatives` as `String[]` — Postgres native array; simple UI mapping (chip list); indexable if needed later.
- `primaryLanguage` nullable — v2 wizard forces a choice; v1 bots keep `null` and fall through to the current i18n-derived logic.
- `wizardVersion` explicit column — the gateway needs to know which append behavior to use for this bot without introspecting the JSON.

### Prisma migration

```sql
ALTER TABLE "CustomerBots"
  ADD COLUMN "capabilities" JSONB,
  ADD COLUMN "persona" JSONB,
  ADD COLUMN "negatives" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN "primaryLanguage" TEXT,
  ADD COLUMN "wizardVersion" INTEGER NOT NULL DEFAULT 1;
```

Additive, no backfill, no data movement — same shape as the `modelTier` addition ([[PER_BOT_MODEL_TIER.md]]).

## Backend API

### Endpoint changes

**`POST /bot/create`** — extend `CreateBotRequest` DTO:

```typescript
export class CreateBotRequest {
  // ... existing (user, botName, botAvatar, settings, systemPrompt, purpose) ...

  @IsOptional() capabilities?: {
    leadCapture: boolean;
    booking: boolean;
    productCatalog: boolean;
    humanEscalation: boolean;
    generalKnowledgeFallback: boolean; // rare; default false → scope guard active
  };

  @IsOptional() persona?: {
    name?: string;
    role?: string;
    tone?: 'warm' | 'formal' | 'casual' | 'expert';
  };

  @IsOptional() @IsArray() negatives?: string[];
  @IsOptional() @IsString() primaryLanguage?: string;
  @IsOptional() @IsInt() wizardVersion?: number; // defaults to 1 if absent
}
```

**`POST /bot/generateSystemPrompt`** — extend `GenerateSystemPromptRequest`:

```typescript
export class GenerateSystemPromptRequest {
  // ... existing (teamId, businessName, companySize, industry, website, purpose, language, pageSummaries) ...

  @IsOptional() capabilities?: { leadCapture; booking; productCatalog; humanEscalation; generalKnowledgeFallback };
  @IsOptional() persona?: { name?; role?; tone? };
  @IsOptional() @IsArray() negatives?: string[];
  @IsOptional() @IsInt() wizardVersion?: number;
}
```

Backend forwards these to the ML endpoint `POST /generate-system-prompt` (same passthrough shape as today).

**`PATCH /bot/updateSettings`** — accept the same four new fields, apply through Prisma update.

**No new endpoints.** Wizard playground uses the existing `/chat` endpoint against a **draft bot** (see § Playground below).

### Meta-prompt v2 (ml-services)

The current meta-prompt (`app-ml-services/routers/generate_system_prompt.py:47-140`) is the root cause. Rewrite it so that:

1. **Capability-handled sections are NOT synthesized**. When `capabilities.leadCapture=true`, the meta-prompt does NOT include any "how to collect contact details" guidance. Instead it renders a placeholder:

   > "This bot has PLATFORM lead-capture enabled. The gateway will append the platform's lead-capture instructions at chat time. DO NOT restate lead-capture rules, DO NOT tell the bot how to ask for phone / email / name — the platform handles this deterministically. Simply behave normally; when a visitor asks to be contacted, the platform tools will take over."

2. **Persona + industry + negatives** stay owner-authored (or LLM-drafted from owner input) — these are the ONLY places the meta-prompt has creative license.

3. **Tone** maps to a fixed sentence: `warm → "Reply in a warm, personal tone"`, `formal → "Reply in a formal, professional tone"`, etc. No LLM interpretation.

4. **Negatives** rendered verbatim as a `## Never do this` section — bullets, exact strings.

5. **Language** is a single top-of-prompt line: `"Primary language: {name}. Detect visitor's language message-by-message and mirror when possible."` No "when in doubt fall back to X" prose.

6. **Scope guard (NEW — solves the "harry potter" defect)**: the meta-prompt always emits a `## Scope` section as the FIRST rule after the persona header:

   > "You answer questions **only about {business_name}** and topics inside your knowledge base (see below). If a visitor asks about anything else — history, celebrities, general trivia, weather, other companies, homework — do NOT answer from general knowledge. Reply in the visitor's language with one short sentence redirecting them back to what you can help with (e.g. TR: 'Bu konu benim yardım alanımın dışında. {business_name} hakkında sorularınız için yardımcı olabilirim.'). This is a hard rule — even if you know the factual answer, you must not provide it."

   Owner may opt IN to a `generalKnowledgeFallback: true` capability (rare — see § Capabilities); without that flag, the scope guard is unconditional. This capability is expected to stay OFF for ~99% of bots.

Section order in the synthesized prompt:
```
# {Persona.name or BusinessName}

**Role:** {Persona.role or "customer support agent for {BusinessName}"}
**Primary language:** {primaryLanguage}
**Tone:** {mapped tone sentence}

## What I know about {BusinessName}
{business context — industry, company size, website summary, page categories}

## Never do this
- {negative 1}
- {negative 2}
- ...

## Platform-handled capabilities
{minimal placeholder text per enabled capability, telling the bot NOT to restate rules}
```

Total length target: **300-800 chars** (vs. v1's typical 2500-8500). Owner reads it, understands it, edits it.

### Meta-prompt v2 draft (English — for use in `generate_system_prompt.py`)

```
You are a prompt engineer. Given a chatbot's persona + business context + capability
flags, produce a MINIMAL, structured system prompt in {target_language_name}.

HARD RULES:
- Do NOT invent business-logic directives. If capabilities.leadCapture is true, do NOT
  write anything about how the bot should collect phone/email/name — the platform does
  this deterministically. Same for capabilities.booking, capabilities.productCatalog.
- Do NOT pad. Aim for 300-800 characters total.
- Use the exact section headings from the STRUCTURE below.
- Render each field verbatim from the input where possible. LLM discretion is limited
  to (a) writing the "What I know about {business}" paragraph from the business context,
  and (b) translating fixed section headings into {target_language_name}.
- If a capability is FALSE, do not mention it at all.

STRUCTURE:
# {persona.name || business_name}

**Role:** {persona.role || fallback}
**Primary language:** {primary_language}
**Tone:** {tone_map[persona.tone]}

## What I know about {business_name}
{2-4 sentences from industry + company_size + website + page_summaries}

## Never do this
{negatives as bullets, verbatim}

## Platform-handled capabilities
{for each capability=true, render its placeholder line — see PLACEHOLDERS below}

PLACEHOLDERS (do not modify these strings):
- leadCapture: "The platform handles lead capture (contact form + KVKK consent + SMS verification). When a visitor asks to be contacted, follow the platform tools — do NOT ask for phone/email/name inline in text."
- booking: "The platform handles appointment booking (availability + calendar). When a visitor wants to book, follow the platform tools."
- productCatalog: "The platform grounds product/price answers on your ingested content."
- humanEscalation: "For complex or sensitive requests, hand off to the business's official contact channel from the KB."

SCOPE GUARD (always emitted UNLESS capabilities.generalKnowledgeFallback === true):
Render this as a `## Scope` section immediately after the persona header:

"You answer questions **only about {business_name}** and topics inside your knowledge base.
If a visitor asks about anything else — history, celebrities, general trivia, weather,
other companies, homework — do NOT answer from general knowledge. Reply in the visitor's
language with one short sentence redirecting them back to what you can help with. This
is a hard rule — even if you know the factual answer, you must not provide it."
```

### Fallback prompt (when synth fails)

Current `_fallback_prompt` (`generate_system_prompt.py:227-256`) stays but shrinks to match the new minimal shape — one persona line + one KB line + capability placeholders. No prose.

## Frontend — 7-step wizard

`chatbu-frontend/src/pages/ChatbotWizard/` — new files:
- `steps/StepPersona.tsx` (NEW)
- `steps/StepCapabilities.tsx` (NEW)
- `steps/StepNegatives.tsx` (NEW)
- `steps/StepLanguage.tsx` (NEW)
- `steps/StepPlayground.tsx` (NEW)
- `steps/StepReviewPrompt.tsx` (MODIFIED — add lint highlighting)
- `steps/StepIndustry.tsx` (MODIFIED — dropdown instead of free text)

### Step-by-step

| # | Step ID | Component | Inputs | Purpose |
|---|---|---|---|---|
| 1 | businessIdentity | StepBusinessName + StepCompanySize + StepIndustry (bundled, could split) | businessName, companySize, industry (dropdown) | Business identity — same as v1 but industry becomes searchable dropdown (20-30 curated + "Other → free text"). |
| 2 | persona | StepPersona (NEW) | persona.name (optional, defaults to businessName), persona.role (single-line), persona.tone (4-option select) | Bot's voice + identity — the ONE place owner authors character. |
| 3 | website | StepWebsite → StepWebsitePages → StepBrandTheme | website URL, page selection, primaryColor, logoUrl | Unchanged from v1. Opt-in. |
| 4 | capabilities | StepCapabilities (NEW) | capabilities.{leadCapture, booking, productCatalog, humanEscalation} | Structured intent — checkbox per platform capability. |
| 5 | negatives | StepNegatives (NEW) | negatives: string[] | "Ne YAPMASIN" free-form chip list. Owner adds items; each is a `<Chip>` with delete. Up to 10 items, each 100 chars max. |
| 6 | language | StepLanguage (NEW) | primaryLanguage (dropdown: en, tr, de, es, fr, it — mirror of supportedLngs) | Bot's default language; visitor language mirror always on. |
| 7 | playground | StepPlayground (NEW) | (read-only test) | Draft bot created backend-side, 3 auto-generated test questions rendered as clickable prompts, response shown live. Owner can iterate persona/negatives/capabilities → click "Re-generate prompt" → back to playground. |
| 8 | review | StepReviewPrompt (MODIFIED) | (synth'd prompt, read + lint) | Final prompt shown in editable textarea with LINT PASS overlay — any line matching `/telefon|phone|email|contact|ilet.şim/i` inside the synthesized prompt (unlikely in v2 since capabilities handle these) gets a yellow underline + tooltip "This is already handled by platform — safe to delete". |

### `StepCapabilities.tsx` — component sketch

```tsx
interface Capabilities {
  leadCapture: boolean;
  booking: boolean;
  productCatalog: boolean;
  humanEscalation: boolean;
}

const CAPABILITIES: Array<{key: keyof Capabilities; icon: string; requiresIntegration?: 'google-calendar'; defaultOn?: boolean}> = [
  { key: 'leadCapture',              icon: '📞' },
  { key: 'booking',                  icon: '📅', requiresIntegration: 'google-calendar' },
  { key: 'productCatalog',           icon: '🛍️' },
  { key: 'humanEscalation',          icon: '👤' },
  { key: 'generalKnowledgeFallback', icon: '🎓' }, // stays OFF for ~99% of bots; scope guard active when OFF
];

export default function StepCapabilities({ value, onChange, botIntegrations }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3">
      <h1>{t('chatbotWizard.capabilities.title')}</h1>
      <p>{t('chatbotWizard.capabilities.subtitle')}</p>
      {CAPABILITIES.map(cap => {
        const requiresMissing = cap.requiresIntegration && !botIntegrations.includes(cap.requiresIntegration);
        return (
          <label key={cap.key} className={/* ... */}>
            <Checkbox
              checked={value[cap.key]}
              disabled={requiresMissing}
              onChange={e => onChange({ ...value, [cap.key]: e.target.checked })}
            />
            <span>{cap.icon} {t(`chatbotWizard.capabilities.${cap.key}.label`)}</span>
            <p className="text-xs text-gray-500">{t(`chatbotWizard.capabilities.${cap.key}.description`)}</p>
            {requiresMissing && (
              <p className="text-xs text-orange-500">
                {t('chatbotWizard.capabilities.requiresIntegration', { integration: cap.requiresIntegration })}
              </p>
            )}
          </label>
        );
      })}
    </div>
  );
}
```

i18n leaves:
- `chatbotWizard.capabilities.leadCapture.label = "Lead capture (visitor contact info)"`
- `chatbotWizard.capabilities.leadCapture.description = "Collects name + phone + email via a widget form when a visitor asks to be contacted. KVKK consent + SMS verification handled automatically."`
- Similar for `booking`, `productCatalog`, `humanEscalation`.

### `StepPlayground.tsx` — flow

1. On mount: `POST /bot/create` with wizard state (bot created as **draft**, hidden from bot list until wizard finishes — new `isDraft: boolean` on `CustomerBots` OR just create with `active=false` and skip the URL ingest step).
2. Render 3 auto-generated test prompts as clickable buttons:
   - Generic: `t('chatbotWizard.playground.testGeneric')` → "What do you offer?" / "Neler yapıyorsunuz?"
   - Off-topic: `t('chatbotWizard.playground.testOffTopic')` → "What's the weather?" / "Hava nasıl?"
   - Intent-specific (based on capabilities):
     - `leadCapture=true` → "Beni arayın" / "Call me"
     - `booking=true` → "Yarın için randevu alabilir miyim?" / "Book me for tomorrow"
     - Neither → skip 3rd prompt
3. Click prompt → `POST /chat` against draft bot → response streams into playground pane. Owner sees actual behavior.
4. "Iterate" button → back to StepCapabilities/StepPersona/StepNegatives to adjust → returns to playground → "Re-generate prompt" button re-runs `POST /bot/generateSystemPrompt` → new prompt takes effect on next test chat.
5. "Looks good, save" → StepReviewPrompt.

**Draft-bot cleanup**: any draft bot older than 24h auto-deleted by a nightly cron. Same pattern chatbu already uses for stale content.

### `StepReviewPrompt.tsx` — lint pass

Regex list applied to synthesized prompt (case-insensitive, multiline):
- `/\b(telefon|phone number|email|iletişim bilgi)/i` — likely lead-capture contamination
- `/\b(randevu|appointment|book)/i` — likely booking contamination
- `/\b(fiyat|price|catalog)/i` — likely product-catalog contamination

Each match → underline + tooltip "This capability is already handled by the platform. Consider removing this line."

This is a **safety net**, not the primary defense. With v2 meta-prompt fixed, lint hits should be rare.

## Rollout

**Phase 1 — Backend + Prisma** (chatbu-backend, develop):
- Prisma migration (additive columns)
- DTO widen + service accept new fields
- Meta-prompt v2 stub at `generate_system_prompt.py` gated on `WIZARD_V2_ENABLED` env — old meta-prompt still fires when flag off (which is the default).
- Unit tests.
- Merge develop, backend picks up. Behaviour change: zero (flag off + no v2 wizard callers yet).

**Phase 2 — Frontend wizard v2** (chatbu-frontend, develop):
- New steps + Playground + Lint pass.
- Feature-flagged: `NEXT_PUBLIC_WIZARD_V2_ENABLED=false` default; when true, `/chatbots/new` routes to v2, `/chatbots/new-legacy` stays available.
- Wizard v2 calls `POST /bot/generateSystemPrompt` with `wizardVersion=2` — backend flips to v2 meta-prompt for those calls only.
- Merge develop → dev wizard v2 available at `?v=2` query flag while `WIZARD_V2_ENABLED=false` for gradual dogfood.

**Phase 3 — Dogfood + dev canary**:
- Create 3-5 test bots via wizard v2 on dev with different capability combinations.
- Verify: synthesized prompts are 300-800 chars; no contact-collection prose when leadCapture=true; playground answers correctly per capability.
- Load Fovi-like + VBO-like scenarios: "beni arayın" → form widget renders (FORM FIRST wins deterministically because no owner-side directive competes).

**Phase 4 — Prod flip**:
- `WIZARD_V2_ENABLED=true` in prod configmap + `NEXT_PUBLIC_WIZARD_V2_ENABLED=true` in prod FE build.
- Legacy wizard stays available at `/chatbots/new-legacy` for owner support (30-day deprecation window).
- Migration: existing bots (`wizardVersion=1`) untouched. Bot settings UI gains "Re-run with wizard v2" opt-in button — owner clicks → wizard v2 pre-fills from existing bot settings → owner reviews → confirms → new synthesized prompt overwrites `systemPrompt`.

**Rollback**: `WIZARD_V2_ENABLED=false` → wizard v2 users get a "temporarily unavailable" message + fallback link to legacy. No data loss (draft bots created via v2 keep working with their existing synthesized prompts).

## Verification

**Backend unit** (`bot.service.spec.ts` + `generate_system_prompt_test.py`):
- `createBot` accepts + persists new fields.
- `generateSystemPrompt` with `wizardVersion=2, capabilities.leadCapture=true` returns a prompt that does NOT contain the strings `phone`, `email`, `telefon`, `iletişim bilgi` in any language (assertion list).
- `generateSystemPrompt` with `wizardVersion=2, capabilities={all false}` returns a minimal prompt with only persona + KB sections.
- Fallback prompt path when LLM synth fails also returns v2-shape output.

**Frontend integration** (`ChatbotWizard.test.tsx`):
- Full wizard v2 flow renders every step in order.
- StepCapabilities disables `booking` when bot has no google-calendar integration (integration probe).
- StepPlayground creates draft bot + shows 3 clickable prompts + streams responses.
- StepReviewPrompt lint pass highlights contaminated lines (test with a hand-crafted prompt containing "telefon numarası").

**Dev end-to-end**:
1. Wizard v2 → create bot with `leadCapture=true`, `booking=false`, persona.tone='warm', negatives=['rakip firmayı kötüleme'].
2. Playground → "beni arayın" → widget form renders (KVKK card → form → OTP → success in 4 turns).
3. Playground → "hava nasıl" → bot politely deflects, offers to help with business-related questions.
4. Save → bot appears in bot list → real chat via widget confirms same behavior.
5. Fovi-like scenario: create wizard v2 bot with 8000-char industry text → synth output should still be 300-800 chars total, no contact directives.

**Regression** (existing bots unaffected):
- All existing bots have `wizardVersion=1` post-migration → gateway meta-prompt append behavior unchanged.
- Legacy wizard `/chatbots/new-legacy` still creates `wizardVersion=1` bots that behave identically to today.

## Open questions

1. **Draft bot storage**: use `isDraft: boolean` new column, OR reuse `active=false` state? Recommend NEW `isDraft` column — `active` already has UI semantics (owner can toggle bot on/off) and mixing "wizard-in-progress" with "manually deactivated" is confusing. Effort: 15 min extra migration.

2. **Playground rate limits**: each playground test = 1 real chat turn = LLM cost. Cap at 20 turns per wizard session? Recommend YES — cheap safety.

3. **Persona name vs bot avatar identity**: currently `botName` is the identity string; `persona.name` in wizard v2 becomes the in-prompt name. Should `botName` auto-sync from `persona.name`? Recommend: yes on first create, decoupled on later edits. Owner may rename persona without renaming the bot record.

4. **Multi-language wizard UI**: v2 wizard chrome (labels/tooltips) should localize to the 6 supported locales (en/tr/de/es/fr/it). Effort: standard i18n keys pass. Not a blocker for first ship.

5. **Skill Presets ([[project_backlog]] #18) integration**: presets could pre-fill wizard v2's capability + persona + negatives fields. That is exactly the natural downstream. Presets ship AFTER v2 soaks — v2's schema is the interface presets bind to.

## Effort estimate

| Task | Owner | Effort |
|---|---|---|
| Prisma migration + `bot.service` DTO widen + tests | Backend | 0.5 day |
| Meta-prompt v2 rewrite in `generate_system_prompt.py` + tests | Backend/Platform | 1 day |
| FE StepPersona + StepCapabilities + StepNegatives + StepLanguage | Frontend | 1.5 days |
| FE StepPlayground (draft bot + chat integration + iterate loop) | Frontend | 1.5 days |
| FE StepReviewPrompt lint pass + wire up wizard controller | Frontend | 0.5 day |
| Draft-bot lifecycle + nightly cleanup cron | Backend | 0.5 day |
| E2E dogfood + iteration | Full team | 1 day |
| **Total** |  | **~6-7 days** |

## Related memory + backlog

- [[project_backlog]] #22 — this spec is the plan for that item
- [[project_backlog]] #21 — reactive middleware (safety net; ships independently)
- [[project_backlog]] #18 — Skill Presets (downstream of this)
- [[PER_BOT_MODEL_TIER.md]] — same additive-column pattern
- [[LEAD_CAPTURE.md]] — platform capability being restated in owner prompts (the exact contamination this spec eliminates)
- [[LEAD_SMS_VERIFICATION.md]] — platform SMS flow, same pattern
- [[feedback_deterministic_over_prompt_rules]] — capabilities as data > directives as prose
- [[feedback_generic_platform_no_tenant_code]] — capability list stays vertical-agnostic
- [[feedback_prompt_priority_bullets]] — dominance loss when platform PRIORITY sits alongside owner prose
- [[project_kb_stuffing_2026-08-13]] — orthogonal (KB stuffing is gateway-side, wizard is owner-side)
