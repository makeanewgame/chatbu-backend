/**
 * Account / billing mails (payment reminder, payment failed, token-limit,
 * feedback notification) only ship `en` + `_tr` template variants. Any
 * other language — including `es` / `fr` / `de` — resolves to English.
 */
export function enOrTr(lang?: string | null): 'en' | 'tr' {
  return lang === 'tr' ? 'tr' : 'en';
}

/**
 * Owner-facing billing mails pick their language from the billing address
 * country (2-letter ISO code, as stored on `BillingInfo.country`). Only
 * Turkey maps to Turkish; everything else — and a missing address —
 * falls back to English.
 */
export function mailLocaleFromBillingCountry(
  country?: string | null,
): 'en' | 'tr' {
  return country?.toUpperCase() === 'TR' ? 'tr' : 'en';
}
