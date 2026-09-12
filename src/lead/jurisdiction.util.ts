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

// Language → regime, for the signals that carry a language rather than a
// place. Only languages that are (near-)exclusive to one regime are listed:
// KVKK is the one pack bound to a language, and DE/FR/IT/ES speakers are
// overwhelmingly inside the GDPR area — where the localized gdpr:* packs
// live; the generic pack exists only in English, so falling through would
// hand them an English notice. English maps to nothing: it spans UK, US,
// IE, AU and every "English UI" browser worldwide, so it stays 'generic'.
const LANGUAGE_TO_JURISDICTION: Record<string, Jurisdiction> = {
  tr: 'kvkk',
  de: 'gdpr',
  fr: 'gdpr',
  it: 'gdpr',
  es: 'gdpr',
};

function jurisdictionForLanguage(tag?: string | null): Jurisdiction | null {
  if (!tag) return null;
  const language = tag.trim().split(/[-_]/)[0].toLowerCase();
  return LANGUAGE_TO_JURISDICTION[language] ?? null;
}

export interface ResolveJurisdictionInput {
  // ISO alpha-2 from libphonenumber-js. When present, wins — a UK visitor
  // roaming on a German SIM gets GDPR either way, but a US visitor on a
  // UK browser is CCPA per their phone identity.
  country?: string | null;
  // Bot owner's configured default (CustomerBots.settings.defaultJurisdiction).
  // Used when the country signal is unavailable (widget consent render
  // step where the phone has not been entered yet).
  botDefault?: Jurisdiction | null;
  // Language the owner declared for the bot (CustomerBots.primaryLanguage,
  // ISO 639-1). The notice names the owner's business as the data
  // controller, so the owner's market is the strongest signal available
  // before the phone is known.
  botPrimaryLanguage?: string | null;
  // Language the widget is actually rendering in (i18next `i18n.language`,
  // sent as `?locale=`). Catches v1 bots that never declared a primary
  // language. A Turkish-speaking visitor in Germany therefore gets KVKK
  // rather than GDPR wording — an accepted trade-off: the alternative was
  // the English generic pack, which they could not read at all.
  widgetLocale?: string | null;
}

// The browser's Accept-Language header is deliberately NOT a jurisdiction
// signal (removed 2026-09-12). Its region tag is a browser default, not a
// location: English-UI Chrome sends `en-US` everywhere on earth, and a
// Turkish visitor's `tr,en-US;q=0.9` still carries a US tag. Measured on
// prod over 30 days: 9 of 24 consents were served the CCPA notice and not
// one of them had a US phone number. The header still steers the LOCALE
// of the text (resolveConsentLocale below), which is what it is for.
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

  // 3. The owner's declared bot language, then the language the widget is
  //    rendering in. Both are language signals, so they can only select a
  //    language-bound regime (see LANGUAGE_TO_JURISDICTION).
  const byLanguage =
    jurisdictionForLanguage(input.botPrimaryLanguage) ??
    jurisdictionForLanguage(input.widgetLocale);
  if (byLanguage) return byLanguage;

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
  // Explicit locale from the widget (i18n.language) wins if supported.
  // Since 2026-09-12 the widget follows the language the bot replies in,
  // so this is the language the visitor is actually reading — KVKK
  // included: the pack registry now carries kvkk:en / kvkk:ru next to the
  // binding Turkish original, and getConsentPack falls back to Turkish
  // for any KVKK locale without a translation.
  if (input.explicit) {
    const short = input.explicit.split(/[-_]/)[0].toLowerCase();
    if (SUPPORTED_CONSENT_LOCALES.includes(short)) return short;
  }

  // Browser locale from Accept-Language.
  if (input.browserLocale) {
    const short = input.browserLocale.split(/[-_]/)[0].toLowerCase();
    if (SUPPORTED_CONSENT_LOCALES.includes(short)) return short;
  }

  // No language signal at all: KVKK reads in its original Turkish,
  // everything else in English.
  return input.jurisdiction === 'kvkk' ? 'tr' : 'en';
}
