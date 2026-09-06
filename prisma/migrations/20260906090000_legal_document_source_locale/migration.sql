-- Slice 6 (2026-09-06): per-document source locale. Additive with a
-- default matching the previous hardcoded behaviour (Turkish source),
-- so existing rows and code paths are unchanged until a document opts
-- into a different source locale.
ALTER TABLE "LegalDocument" ADD COLUMN "sourceLocale" TEXT NOT NULL DEFAULT 'tr';
