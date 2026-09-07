-- Slice 8 (2026-09-06): re-acceptance mechanics. All additive.
ALTER TABLE "LegalDocumentVersion" ADD COLUMN "requiresReacceptance" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LegalDocumentVersion" ADD COLUMN "effectiveAt" TIMESTAMP(3);
ALTER TABLE "LegalDocumentVersion" ADD COLUMN "changelog" TEXT;
ALTER TYPE "LegalAcceptanceContext" ADD VALUE IF NOT EXISTS 'REACCEPTANCE';
