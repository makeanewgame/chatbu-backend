-- AlterTable
-- Transport the visitor chose for this appointment's own notifications
-- (confirmation now, reminders hours or days later). NULL = SMS, which is
-- what every existing row got, so there is no backfill.
--
-- Why a column and not the per-chat Redis preference the OTP path reads:
-- that key is scoped to the conversation and expires with it. The reminder
-- cron fires long after the chat is gone, so the choice has to live with
-- the thing being reminded about.
ALTER TABLE "Appointment" ADD COLUMN "notifyChannel" TEXT;
