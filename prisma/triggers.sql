SET search_path TO public;

CREATE OR REPLACE FUNCTION notify_storage_update()
RETURNS trigger AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    PERFORM pg_notify('storage_updates', json_build_object('id', OLD.id, 'op', TG_OP)::text);
    RETURN OLD;
  ELSE
    PERFORM pg_notify('storage_updates', json_build_object('id', NEW.id, 'op', TG_OP)::text);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS storage_update_trigger ON "Storage";
DROP TRIGGER IF EXISTS storage_delete_trigger ON "Storage";

CREATE TRIGGER storage_update_trigger
AFTER UPDATE ON "Storage"
FOR EACH ROW
WHEN (OLD IS DISTINCT FROM NEW)
EXECUTE FUNCTION notify_storage_update();

CREATE TRIGGER storage_delete_trigger
AFTER DELETE ON "Storage"
FOR EACH ROW
EXECUTE FUNCTION notify_storage_update();

-- Content table notification trigger
CREATE OR REPLACE FUNCTION notify_content_update()
RETURNS trigger AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    PERFORM pg_notify('content_updates', json_build_object('id', OLD.id, 'op', TG_OP)::text);
    RETURN OLD;
  ELSE
    PERFORM pg_notify('content_updates', json_build_object('id', NEW.id, 'op', TG_OP)::text);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS content_update_trigger ON "Content";
DROP TRIGGER IF EXISTS content_delete_trigger ON "Content";

CREATE TRIGGER content_update_trigger
AFTER UPDATE ON "Content"
FOR EACH ROW
WHEN (OLD IS DISTINCT FROM NEW)
EXECUTE FUNCTION notify_content_update();

CREATE TRIGGER content_delete_trigger
AFTER DELETE ON "Content"
FOR EACH ROW
EXECUTE FUNCTION notify_content_update();

-- Ingestion task progress notification trigger
CREATE OR REPLACE FUNCTION notify_ingestion_task_update()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('ingestion_task_updates', json_build_object(
    'task_id', NEW.task_id,
    'customer_cuid', NEW.customer_cuid,
    'bot_cuid', NEW.bot_cuid,
    'status', NEW.status,
    'current_step', NEW.current_step,
    'total_files', NEW.total_files,
    'processed_files', NEW.processed_files,
    'total_chunks', NEW.total_chunks,
    'processed_chunks', NEW.processed_chunks,
    'progress_pct', NEW.progress_pct,
    'ingestion_type', NEW.ingestion_type,
    'error_message', NEW.error_message,
    'tokens_consumed', COALESCE(NEW.tokens_consumed, 0)
  )::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ingestion_task_update_trigger ON fastapi_ingestiontask;

CREATE TRIGGER ingestion_task_update_trigger
AFTER UPDATE ON fastapi_ingestiontask
FOR EACH ROW
WHEN (OLD IS DISTINCT FROM NEW)
EXECUTE FUNCTION notify_ingestion_task_update();