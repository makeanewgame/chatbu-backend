-- Backlog #24: per-appointment-type duration catalog.
-- Additive nullable-defaulted column. Every existing row picks up `[]` on
-- read (Prisma defaults are applied at query time for legacy rows), so no
-- backfill is required. Bots with `_bot_has_calendar=true` that never
-- configure any types keep their current behaviour (WorkingHours.slotMinutes
-- drives every booking); nothing else on the platform reads this column.
ALTER TABLE "CustomerBots"
    ADD COLUMN "appointmentTypes" JSONB NOT NULL DEFAULT '[]';
