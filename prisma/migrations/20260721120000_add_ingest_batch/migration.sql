-- Phase B-2: per-web-ingest-request batch record.
-- Immutable snapshot of the URL list a user requested to ingest,
-- keyed on the ML worker's task_id. Per-URL outcomes remain in
-- Content.ingestionInfo; this table is only for reconstructing
-- the request-side intent (retry-failed-only, batch history).

-- CreateTable
CREATE TABLE "IngestBatch" (
    "id"          TEXT NOT NULL,
    "teamId"      TEXT NOT NULL,
    "botId"       TEXT NOT NULL,
    "taskId"      TEXT NOT NULL,
    "pageList"    JSONB NOT NULL,
    "triggeredBy" TEXT NOT NULL DEFAULT 'initial',
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngestBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IngestBatch_taskId_key" ON "IngestBatch"("taskId");

-- CreateIndex
CREATE INDEX "IngestBatch_botId_idx" ON "IngestBatch"("botId");

-- CreateIndex
CREATE INDEX "IngestBatch_teamId_createdAt_idx" ON "IngestBatch"("teamId", "createdAt");

-- AddForeignKey
ALTER TABLE "IngestBatch"
    ADD CONSTRAINT "IngestBatch_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "Team"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
