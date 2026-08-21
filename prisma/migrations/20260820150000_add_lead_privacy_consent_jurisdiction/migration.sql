-- Slice 3 (SMS jurisdiction-aware consent): additive, nullable, zero-backfill.
--
-- Two new columns on LeadPrivacyConsent:
--   jurisdiction — 'gdpr' | 'kvkk' | 'ccpa' | 'pdpl' | 'generic'. Populated
--     at consent write time via resolveJurisdiction(bot default, browser
--     locale, phone country when available). Legacy rows keep NULL; a NULL
--     value implicitly means "kvkk" for pre-Slice-3 rows since locale='tr'
--     was the only shape the old code wrote.
--   country — ISO alpha-2, populated by bindProvisionalConsent when the
--     phone country becomes known (join to LeadSmsVerification.country).
--     Nullable because the consent card is rendered BEFORE the phone is
--     entered, so at write time the country is often unknown. Filled in
--     later during OTP verify.
--
-- No index — filter cardinality is dominated by (botId, chatId) which
-- already has @@index. Add a composite (botId, jurisdiction) later if
-- analytics grow.
ALTER TABLE "LeadPrivacyConsent" ADD COLUMN "jurisdiction" TEXT;
ALTER TABLE "LeadPrivacyConsent" ADD COLUMN "country" TEXT;
