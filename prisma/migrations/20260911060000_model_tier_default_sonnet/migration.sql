-- New bots default to Sonnet (2026-09-11). Only the column DEFAULT changes;
-- existing rows keep whatever tier they have.
ALTER TABLE "CustomerBots" ALTER COLUMN "modelTier" SET DEFAULT 'sonnet';
