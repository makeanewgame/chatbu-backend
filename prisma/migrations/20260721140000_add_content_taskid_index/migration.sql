-- Phase B-3: the batch-summary endpoint fetches every Content row for
-- a given task_id to compute per-URL status. Without this index,
-- that's a full table scan on the Content table.

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Content_taskId_idx" ON "Content"("taskId");
