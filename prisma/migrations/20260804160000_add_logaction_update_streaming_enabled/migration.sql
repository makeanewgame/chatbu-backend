-- Add UPDATE_STREAMING_ENABLED to the LogAction enum for the widget SSE
-- streaming toggle audit trail (voice plan Faz 2b dashboard toggle,
-- follow-up to `20260804140000_add_bot_streaming_enabled`).
--
-- `ADD VALUE` on a PostgreSQL enum is non-transactional in older Postgres
-- and must run outside a BEGIN block; Prisma 5+ handles this correctly
-- by splitting enum-add migrations out of the main transaction. `IF NOT
-- EXISTS` makes the migration idempotent if a hotfix or manual run
-- already added the value.

ALTER TYPE "LogAction" ADD VALUE IF NOT EXISTS 'UPDATE_STREAMING_ENABLED';
