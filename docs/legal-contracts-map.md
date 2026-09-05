# Chatbu Legal Contracts Map

**Status**: internal working document (2026-09-05). Not legal advice; this is the
engineering-side requirements map that (a) answers "which agreement do we need,
where, when", (b) records what already exists in the product, and (c) scopes the
questions we take to counsel. Product implementation slices live in the plan
file referenced at the bottom.

**Contracting entity (fixed decision)**: every agreement, in every market, is
made with **DATALONGA SOLUTIONS LTD** (Company No. 16372088, registered office:
338a Regents Park Road, Office 3 and 4, London, N3 2LN, United Kingdom).
**Chatbu is this company's brand/product, not a legal entity.** Canonical
identity pattern in all documents: *"DATALONGA SOLUTIONS LTD, trading as
Chatbu"*. There is no "Chatbu Ltd" and no "Chatbu LLC" — any occurrence of
those strings in code, config or documents is a bug (see Slice 1).

Contact addresses: `hello@chatbu.io` (general), `support@chatbu.io` (support).
The mail domain is **chatbu.io** — `@chatbu.com` addresses do not exist.

Depth of coverage: **Turkey + UK/EU** (KVKK + UK GDPR + EU GDPR) in full;
CCPA (US) and PDPL (Gulf) as framework slots only — the jurisdiction resolver
already emits `ccpa`/`pdpl` and the generic pack covers them until those
markets justify counsel spend.

---

## 1. Core architecture decision: one common set, not per-country contracts

**Decision: a single common contract set governed by the law of England and
Wales, plus jurisdiction-specific annexes.** This is the standard SaaS pattern
(Stripe/Intercom shape). We do NOT maintain a separate contract per country.

Rationale:

- One entity → one governing law. Enforcement is consistent and counsel cost
  scales linearly with annexes, not combinatorially with countries.
- KVKK and GDPR apply to the *data processing* by force of law, independent of
  the contract's governing law. They are satisfied with annexes (KVKK
  aydınlatma metni, DPA + UK IDTA + EU SCCs), not by rewriting the whole
  agreement per country.
- The in-product legal CMS versions documents per slug; annex-as-separate-slug
  fits the existing machinery with zero schema change.
- **Question #1 for TR counsel**: Turkish Law No. 6502 (distance sales) cannot
  be contracted away for B2C. Chatbu tenants are businesses buying a chatbot
  tool (B2B) → likely exempt, but confirm, and confirm whether the
  pre-contractual information duty (ön bilgilendirme) still applies to sole
  traders signing up self-serve.

## 2. Document inventory

Audience legend: **Tenant** = the business that signs up and owns bots;
**End-visitor** = a person chatting with a tenant's bot (Chatbu is processor,
tenant is controller); **Everyone** = both plus marketing-site visitors.

| # | Document | Audience | Lifecycle trigger | Jurisdiction treatment | Current state |
|---|----------|----------|-------------------|------------------------|---------------|
| 1 | Terms of Service / MSA | Tenant | Signup; re-accept on republish | Common (England & Wales) + KVKK/TR annex | Hardcoded JSX page; governing law said Republic of Turkey until Slice 1 interim fix; acceptance recorded as a bare boolean |
| 2 | Sales / Subscription Terms | Tenant | Checkout | Common + TR B2C carve-out question | In CMS (`sales-agreement` slug); PURCHASE acceptance works — the only CMS consumer today |
| 3 | Privacy Policy (platform) | Tenant users | Signup, footer | Common + KVKK aydınlatma annex | Hardcoded JSX + a diverging external page on chatbu.io |
| 4 | Visitor privacy notice **template** | End-visitor | Widget open / lead capture | Per-jurisdiction packs (resolver: `src/lead/jurisdiction.util.ts`) | Hardcoded `consent-text.constants.ts` packs (9); header notes "legal review required" |
| 5 | DPA + annexes: sub-processor list, TOMs, UK IDTA + EU SCCs | Tenant (team-level) | Signup or first bot publish | One DPA covering UK+EU; KVKK transfer annex | **Entirely missing** — yet the consent text already asserts the processor relationship |
| 6 | Cookie Policy + consent UI | Everyone | First page load | Common (PECR/ePrivacy + KVKK board guidance) | Policy prose exists; **no banner — Mixpanel (cross-subdomain `.chatbu.io` cookie) and FB SDK load unconditionally** |
| 7 | Acceptable Use Policy | Tenant | Signup (bundled into ToS) | Common | Missing |
| 8 | AI transparency disclosure (EU AI Act Art. 50 — **in force since 2 Aug 2026**) | End-visitor | Every bot conversation, incl. IG/WA/Messenger and voice notes | Common line, localized | Missing; `whitelabelEnabled` currently hides the only branding hint too |
| 9 | SLA | Enterprise tenant | Contract | Common | Missing — **deferred** (slot only) |
| 10 | Marketing consent (+İYS for TR) | Users + leads | Opt-in | TR-specific (Law 6563) | Missing; NETGSM sends `iysfilter:'0'` and is OTP-only today → İYS integration deferred, consent field slot ships now |
| 11 | CCPA / PDPL packs | End-visitor | — | Framework slots | Resolver already emits `ccpa`/`pdpl`; generic pack covers until prioritized |

Out of scope: employment/contractor documents.

### Notes on the three parallel content systems (to be collapsed — Slice 6)

Today legal copy lives in three places that can and do diverge:

1. **Legal-doc CMS** (`LegalDocument`/`Version`/`Content`/`Acceptance` tables,
   `prisma/schema.prisma` — versioning, translation approval flow, append-only
   audit). Mature but only consumed by checkout (`sales-agreement`).
2. **Hardcoded JSX pages** (`chatbu-frontend/src/pages/TermsOfService.tsx`,
   `PrivacyPolicy.tsx`) — ~600 lines each, edited only via frontend deploys.
3. **External chatbu.io pages** (marketing site) — linked from consent packs
   (`legalLinks.ts`), content drifts independently.

Target end-state: one system (the CMS), same frontend routes serving
CMS-published content, hardcoded packs seeded as v1, counsel edits happening in
the admin UI rather than in JSX.

## 3. Registration / filing questions

- **UK ICO registration (data protection fee)** — near-certain obligation for
  DATALONGA SOLUTIONS LTD. Internal task; no counsel needed.
- **KVKK VERBİS** — does a UK entity processing TR data subjects' data need
  VERBİS registration via a Turkish representative (yurt dışı veri sorumlusu
  regime)? → TR counsel question.
- **İYS (TR commercial electronic message registry)** — only required once we
  send *marketing* SMS/email to TR recipients; OTP/transactional is exempt.
  Decision: İYS integration deferred; capture the marketing-consent field now
  (inventory #10).
- **EU AI Act Art. 50** — in force. The product fix is the AI-disclosure slice;
  the disclosure line itself is an internal template (no counsel gate to ship).

## 4. Counsel shopping list

**UK counsel:**
- ToS/MSA rewrite + governing law/venue clauses
- DPA with UK IDTA + EU SCC annexes
- AUP
- Subscription/auto-renew/refund terms review
- Whitelabel question: may a tenant hide "provided by Chatbu" while the AI
  disclosure stays visible? (Our position: branding may hide, "this is AI"
  may not.)

**TR counsel:**
- KVKK aydınlatma + açık rıza texts (visitor packs + platform)
- VERBİS registration question (above)
- Distance-sales B2B/B2C carve-out (Law 6502) + pre-contractual info duty
- İYS scoping confirmation
- TR annex review of the UK master set

**Internal templates (start without counsel):**
- Sub-processor list: AWS (hosting, eu-central-1), AWS Bedrock / Anthropic
  (LLM), Meta (IG/Messenger/WhatsApp channels), Stripe (payments), NETGSM
  (TR SMS), Twilio (international SMS), Mixpanel (analytics), Hostinger
  (marketing site). Keep as a CMS slug + public page so updates don't need
  contract re-signing.
- Cookie policy regenerated from the *actual* tracker inventory
- AI disclosure line (localized)
- Retention schedule (single source; fix the support article's "30 days" claim;
  `RETENTION_DAYS` stays env-driven and the policy page should render the value)
- Visitor-notice template skeleton
- This map itself

## 5. Existing product machinery (do not rebuild)

- **Legal CMS with versioning + acceptance audit** — extend, don't replace.
  `LegalDocumentAcceptance` is append-only with context enum (PURCHASE today;
  SIGNUP/DPA to be added).
- **Jurisdiction resolver** — `src/lead/jurisdiction.util.ts` maps country →
  `gdpr|kvkk|ccpa|pdpl|generic`; data-driven, no per-country code branches.
- **Consent packs** — `src/lead/consent-text.constants.ts` (9 packs across
  gdpr/kvkk/ccpa/pdpl/generic × en/de/tr/fr/it/es), versioned per pack;
  the version string is persisted on each consent row.
- **`PrivacyConsentCard` machine + provisional-consent bind flow** — reused by
  the lead-capture consent gate work.
- **`TermsAccept.tsx`** — retro-acceptance interstitial, reused for
  re-acceptance mechanics.
- **Identity config** — single source is the `chatbu-config` ConfigMap
  (`COMPANY_NAME`, `COMPANY_TRADING_NAME`, `COMPANY_NUMBER`,
  `COMPANY_ADDRESS`); the backend pulls these via surgical `configMapKeyRef`
  entries (the backend does not consume chatbu-config wholesale).

## 6. Implementation status

Product work is sliced in the plan file (fovi-longa-chat-be repo,
`.claude/plans/this-is-a-example-ticklish-dove.md`, top section). MVP cut =
Slices 1–5 + this document; contract *texts* (DPA body, KVKK annex, ToS
rewrite) are counsel-blocked — the product ships slots and plumbing now.

| Slice | Scope | Status |
|-------|-------|--------|
| 1 | Entity identity single-source (configmap + consent packs + ToS interim governing-law/contact fix) | **In progress 2026-09-05** |
| 2 | Lead-capture consent gate decoupled from `smsVerificationRequired` | Pending |
| 3 | Cookie consent banner + gated trackers | Pending |
| 4 | AI disclosure (widget + off-platform channels) | Pending |
| 5 | Acceptance auditability (SIGNUP context) + endpoint hardening | Pending |
| 6 | Content consolidation into CMS | Next wave |
| 7 | DPA surface (slug + team-level acceptance + sub-processor page) | Next wave |
| 8 | Versioning / re-acceptance mechanics | Next wave |
| 9–11 | Team legal identity, retention alignment, cleanup slots | Later |
