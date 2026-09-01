-- Per-bot toggle for the in-widget KVKK consent card (Aydınlatma Metni +
-- Kullanım Şartları) shown before a visitor hands over a phone / email in
-- the lead + contact-form flows.
--
-- Additive, NOT NULL with DEFAULT true so every existing bot keeps today's
-- mandatory-consent behaviour with zero backfill. Owners who collect KVKK
-- consent out-of-band flip this off; SMS / email OTP verification is
-- governed by its own flags and is unaffected.

-- AlterEnum
ALTER TYPE "LogAction" ADD VALUE IF NOT EXISTS 'UPDATE_KVKK_CONSENT';

-- AlterTable
ALTER TABLE "CustomerBots" ADD COLUMN "kvkkConsentRequired" BOOLEAN NOT NULL DEFAULT true;
