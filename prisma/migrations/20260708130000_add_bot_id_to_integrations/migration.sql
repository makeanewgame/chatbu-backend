-- AlterTable
ALTER TABLE "Integrations" ADD COLUMN     "botId" TEXT;

-- Backfill pass 1: integration types that already embed a botId inside their
-- JSON config (google-calendar, whatsapp_embedded) keep their original bot.
UPDATE "Integrations"
SET "botId" = "config"->>'botId'
WHERE "botId" IS NULL
  AND "config" ? 'botId'
  AND "config"->>'botId' IS NOT NULL;

-- Backfill pass 2: any remaining rows (generic account-level integrations
-- created before bots were scoped) are assigned to the earliest-created,
-- non-deleted bot of their team. Teams with zero bots are left NULL.
UPDATE "Integrations" i
SET "botId" = sub.bot_id
FROM (
    SELECT DISTINCT ON ("teamId") "teamId", "id" AS bot_id
    FROM "CustomerBots"
    WHERE "isDeleted" = false
    ORDER BY "teamId", "createdAt" ASC
) sub
WHERE i."teamId" = sub."teamId"
  AND i."botId" IS NULL;

-- CreateIndex
CREATE INDEX "Integrations_teamId_botId_idx" ON "Integrations"("teamId", "botId");

-- AddForeignKey
ALTER TABLE "Integrations" ADD CONSTRAINT "Integrations_botId_fkey" FOREIGN KEY ("botId") REFERENCES "CustomerBots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
