SET search_path TO public;

CREATE OR REPLACE FUNCTION notify_storage_update()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('storage_updates', row_to_json(NEW)::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS storage_update_trigger ON "Storage";

CREATE TRIGGER storage_update_trigger
AFTER UPDATE ON "Storage"
FOR EACH ROW
WHEN (OLD IS DISTINCT FROM NEW)
EXECUTE FUNCTION notify_storage_update();

-- Content table notification trigger
CREATE OR REPLACE FUNCTION notify_content_update()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('content_updates', row_to_json(NEW)::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS content_update_trigger ON "Content";

CREATE TRIGGER content_update_trigger
AFTER UPDATE ON "Content"
FOR EACH ROW
WHEN (OLD IS DISTINCT FROM NEW)
EXECUTE FUNCTION notify_content_update();