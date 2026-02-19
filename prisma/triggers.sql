SET search_path TO public;

CREATE OR REPLACE FUNCTION notify_storage_update()
RETURNS trigger AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    PERFORM pg_notify('storage_updates', row_to_json(OLD)::text);
    RETURN OLD;
  ELSE
    PERFORM pg_notify('storage_updates', row_to_json(NEW)::text);
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
    PERFORM pg_notify('content_updates', row_to_json(OLD)::text);
    RETURN OLD;
  ELSE
    PERFORM pg_notify('content_updates', row_to_json(NEW)::text);
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