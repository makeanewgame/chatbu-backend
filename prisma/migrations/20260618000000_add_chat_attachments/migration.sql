-- Add source field to Storage table (distinguishes chat uploads from knowledge base files)
ALTER TABLE "Storage" ADD COLUMN IF NOT EXISTS "source" TEXT DEFAULT 'knowledge_base';

-- Add attachments field to CustomerChatDetails table
ALTER TABLE "CustomerChatDetails" ADD COLUMN IF NOT EXISTS "attachments" JSONB;

-- Re-create storage triggers to exclude chat_upload records from pg_notify
-- This prevents chat attachments from being accidentally ingested by the FastAPI service
DROP TRIGGER IF EXISTS storage_update_trigger ON "Storage";
DROP TRIGGER IF EXISTS storage_delete_trigger ON "Storage";

CREATE TRIGGER storage_update_trigger
AFTER UPDATE ON "Storage"
FOR EACH ROW
WHEN (
  OLD IS DISTINCT FROM NEW
  AND COALESCE(NEW.source, 'knowledge_base') = 'knowledge_base'
)
EXECUTE FUNCTION notify_storage_update();

CREATE TRIGGER storage_delete_trigger
AFTER DELETE ON "Storage"
FOR EACH ROW
WHEN (COALESCE(OLD.source, 'knowledge_base') = 'knowledge_base')
EXECUTE FUNCTION notify_storage_update();
