-- Allow LeadPrivacyConsent to be recorded before a chatId exists, so the
-- widget can call POST /widget/lead/kvkk-consent BEFORE the first chat POST
-- has been made (chicken-and-egg fix, 2026-08-01). Backend then binds this
-- to a real chatId on the next chat POST via `provisionalConsentId` in the
-- chat body.
ALTER TABLE "LeadPrivacyConsent" ALTER COLUMN "chatId" DROP NOT NULL;
