-- Per-bot appointment availability window for the inline calendar picker.
-- Nullable column, but every row (existing + future) gets an explicit
-- default written so NULL should not occur in steady state:
--   - this migration backfills every pre-existing bot below
--   - BotService.createBot (src/bot/bot.service.ts) writes it on create
-- Default: Turkey time, weekdays 09:00-18:00, weekends closed — matches
-- appointment.constants.ts DEFAULT_WORKING_HOURS, keep both in sync if
-- this default ever changes.
ALTER TABLE "CustomerBots" ADD COLUMN "appointmentWorkingHours" JSONB;

UPDATE "CustomerBots"
SET "appointmentWorkingHours" = '{
  "timezone": "Europe/Istanbul",
  "slotMinutes": 30,
  "days": {
    "mon": { "enabled": true,  "start": "09:00", "end": "18:00" },
    "tue": { "enabled": true,  "start": "09:00", "end": "18:00" },
    "wed": { "enabled": true,  "start": "09:00", "end": "18:00" },
    "thu": { "enabled": true,  "start": "09:00", "end": "18:00" },
    "fri": { "enabled": true,  "start": "09:00", "end": "18:00" },
    "sat": { "enabled": false, "start": "09:00", "end": "18:00" },
    "sun": { "enabled": false, "start": "09:00", "end": "18:00" }
  }
}'::jsonb
WHERE "appointmentWorkingHours" IS NULL;
