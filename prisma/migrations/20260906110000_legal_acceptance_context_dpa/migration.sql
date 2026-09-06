-- Slice 7 (2026-09-06): team-level DPA acceptance context. Additive enum
-- value; existing rows and code paths unchanged.
ALTER TYPE "LegalAcceptanceContext" ADD VALUE IF NOT EXISTS 'DPA';
