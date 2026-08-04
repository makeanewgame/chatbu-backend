-- CustomerBots.streamingEnabled — per-bot toggle for the widget SSE
-- streaming path (voice agent plan Faz 2b, 2026-08-04).
--
-- Default false so this migration is a no-op for every existing bot:
-- streaming stays off in prod until an operator flips it per pilot
-- tenant. The frontend widget only sends `Accept: text/event-stream`
-- when it reads streamingEnabled=true from getPublicBotSettings, so
-- setting a bot's row to true is the single gate that activates the
-- new path for that bot's widget without touching any other consumer.

ALTER TABLE "CustomerBots"
  ADD COLUMN "streamingEnabled" BOOLEAN NOT NULL DEFAULT false;
