-- Remove existing duplicate rows for ingestion-style operations before adding
-- the unique constraint. Keep the EARLIEST row per (taskId, operationType).
-- Note: this does NOT correct already-double-counted Subscription.tokensUsedThisMonth.
DELETE FROM "TokenUsageLog" t1
USING "TokenUsageLog" t2
WHERE t1."taskId" IS NOT NULL
  AND t1."taskId" = t2."taskId"
  AND t1."operationType" = t2."operationType"
  AND (
    t1."createdAt" > t2."createdAt"
    OR (t1."createdAt" = t2."createdAt" AND t1."id" > t2."id")
  );

-- CreateIndex
-- Partial behavior is implicit: Postgres treats NULL values as distinct in
-- unique indexes, so chat rows (taskId IS NULL) remain unconstrained.
CREATE UNIQUE INDEX "TokenUsageLog_taskId_operationType_key"
ON "TokenUsageLog"("taskId", "operationType");
