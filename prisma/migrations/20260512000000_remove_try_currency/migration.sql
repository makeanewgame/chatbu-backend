-- Remove TRY currency fields from PricePlan (USD-only pricing migration)
ALTER TABLE "PricePlan" DROP COLUMN IF EXISTS "amountTry";
ALTER TABLE "PricePlan" DROP COLUMN IF EXISTS "exchangeRate";

-- Remove lastKnownUsdTryRate from SystemSettings (no longer needed)
DELETE FROM "SystemSettings" WHERE "key" = 'lastKnownUsdTryRate';
