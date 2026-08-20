// Slice 3 (2026-08-20): jurisdiction dispatch for the consent card.
//
// The widget renders the "Privacy Notice and Terms of Use" card BEFORE the
// visitor's phone number is known — so we cannot key on phone country at
// render time. Instead the resolver picks a jurisdiction shorthand from
// three signals in priority order, and the returned value drives both the
// consent text (fetched via GET /api/lead/privacy-consent-text) and the
// audit row (persisted on LeadPrivacyConsent.jurisdiction).
//
// Chatbu is UK-based global SaaS — the fallback is 'generic' (not 'kvkk')
// so a browser with no locale hint on a bot with no configured default
// gets neutral, English, GDPR-compatible copy rather than Turkish KVKK
// wording ([[feedback_chatbu_uk_global_not_tr]]).

export type Jurisdiction = 'gdpr' | 'kvkk' | 'ccpa' | 'pdpl' | 'generic';

export const JURISDICTIONS: readonly Jurisdiction[] = [
  'gdpr',
  'kvkk',
  'ccpa',
  'pdpl',
  'generic',
] as const;

// ISO alpha-2 country → jurisdiction. Only countries that actually have a
// distinct data-protection regime that changes the consent wording are
// listed; everything else falls through to 'generic'. GDPR covers UK
// (post-Brexit UK GDPR is functionally equivalent) + EU/EEA member states.
// PDPL groups the Gulf states with materially similar laws (each has its
// own act; the wording differences are minor enough to share copy). TR
// (KVKK) and US (CCPA/state privacy patchwork) are treated as their own
// pack because the required notice language is materially different.
const COUNTRY_TO_JURISDICTION: Record<string, Jurisdiction> = {
  // EU member states + EEA (Norway, Iceland, Liechtenstein) + UK (UK GDPR)
  // + Switzerland (FADP — treated as gdpr for our purposes; wording is
  // close enough that a legal-team refresh is a future refinement, not a
  // separate pack).
  GB: 'gdpr',
  DE: 'gdpr',
  FR: 'gdpr',
  IT: 'gdpr',
  ES: 'gdpr',
  NL: 'gdpr',
  BE: 'gdpr',
  AT: 'gdpr',
  CH: 'gdpr',
  SE: 'gdpr',
  DK: 'gdpr',
  NO: 'gdpr',
  FI: 'gdpr',
  IE: 'gdpr',
  PL: 'gdpr',
  PT: 'gdpr',
  GR: 'gdpr',
  CZ: 'gdpr',
  HU: 'gdpr',
  RO: 'gdpr',
  BG: 'gdpr',
  SK: 'gdpr',
  SI: 'gdpr',
  HR: 'gdpr',
  LT: 'gdpr',
  LV: 'gdpr',
  EE: 'gdpr',
  CY: 'gdpr',
  MT: 'gdpr',
  LU: 'gdpr',
  IS: 'gdpr',
  LI: 'gdpr',

  // Turkey: KVKK (Kişisel Verilerin Korunması Kanunu, Law No. 6698)
  TR: 'kvkk',

  // US: CCPA (California) is the dominant regime; other US state laws
  // (VCDPA/CDPA/CTDPA/…) are close enough that the CCPA pack is a safe
  // superset. Federal law is still absent.
  US: 'ccpa',

  // Gulf PDPL — UAE PDPL 2021, SA PDPL 2023, Bahrain PDPL 2018,
  // Qatar/Kuwait/Oman all have similar recent laws.
  AE: 'pdpl',
  SA: 'pdpl',
  QA: 'pdpl',
  BH: 'pdpl',
  KW: 'pdpl',
  OM: 'pdpl',
};

export interface ResolveJurisdictionInput {
  // ISO alpha-2 from libphonenumber-js. When present, wins — a UK visitor
  // roaming on a German SIM gets GDPR either way, but a US visitor on a
  // UK browser is CCPA per their phone identity.
  country?: string | null;
  // Bot owner's configured default (CustomerBots.settings.defaultJurisdiction).
  // Used when the country signal is unavailable (widget consent render
  // step where the phone has not been entered yet).
  botDefault?: Jurisdiction | null;
  // Browser locale from Accept-Language, e.g. "de-DE", "en-GB", "tr-TR".
  // Only the region tag is inspected ("de-DE" → "DE"); the language tag
  // is not enough on its own (a German-speaking visitor in Switzerland
  // is still GDPR, but a Turkish-speaking visitor in Germany is GDPR
  // too, not KVKK). Falls through to 'generic' if the header has no
  // parseable region tag.
  browserLocale?: string | null;
}

export function resolveJurisdiction(input: ResolveJurisdictionInput): Jurisdiction {
  // 1. Explicit country (from phone parse) wins — most accurate signal
  //    when available. Uppercased for map lookup because ISO alpha-2 is
  //    conventionally upper, but callers occasionally pass lower.
  if (input.country) {
    const upper = input.country.toUpperCase();
    if (COUNTRY_TO_JURISDICTION[upper]) return COUNTRY_TO_JURISDICTION[upper];
  }

  // 2. Bot owner default — set via CustomerBots.settings.defaultJurisdiction.
  //    Validated in the calling controller so we can trust it here.
  if (input.botDefault && JURISDICTIONS.includes(input.botDefault)) {
    return input.botDefault;
  }

  // 3. Browser locale — parse "de-DE" style tags and look up the region.
  //    "en" alone has no region, falls through.
  if (input.browserLocale) {
    const match = input.browserLocale.match(/[-_]([A-Za-z]{2})\b/);
    if (match) {
      const upper = match[1].toUpperCase();
      if (COUNTRY_TO_JURISDICTION[upper]) return COUNTRY_TO_JURISDICTION[upper];
    }
  }

  // 4. No signal → generic (Chatbu-branded, English, GDPR-compatible).
  return 'generic';
}

// Locale resolver — separate from jurisdiction because a GDPR jurisdiction
// might be rendered in EN, DE, FR, etc. Preferred locale is the browser
// language tag ('de-DE' → 'de'); we snap to the supported set and fall
// through to 'en'. Never returns 'tr' unless the jurisdiction is KVKK
// — Turkish copy is only shipped for the KVKK pack.
//
// Matches the backend's `SUPPORTED_LOCALES` in legal-document.dto and the
// frontend widget bundle's supportedLngs. Adding a new locale here is
// only useful when a matching consent pack exists in
// consent-text.constants — otherwise getConsentPack will fall through to
// generic-en for that locale.
const SUPPORTED_CONSENT_LOCALES: readonly string[] = [
  'en',
  'tr',
  'de',
  'fr',
  'it',
  'es',
  'ru',
  'ar',
] as const;

export function resolveConsentLocale(input: {
  jurisdiction: Jurisdiction;
  browserLocale?: string | null;
  explicit?: string | null;
}): string {
  // KVKK is a Turkish-language regime — the legal wording only exists in
  // TR and rendering it in EN would be legally questionable. Bail early
  // so nothing overrides it downstream.
  if (input.jurisdiction === 'kvkk') return 'tr';

  // Explicit locale from the widget (i18n.language) wins if supported.
  if (input.explicit) {
    const short = input.explicit.split(/[-_]/)[0].toLowerCase();
    if (SUPPORTED_CONSENT_LOCALES.includes(short)) return short;
  }

  // Browser locale from Accept-Language.
  if (input.browserLocale) {
    const short = input.browserLocale.split(/[-_]/)[0].toLowerCase();
    if (SUPPORTED_CONSENT_LOCALES.includes(short)) return short;
  }

  return 'en';
}
