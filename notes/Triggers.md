-- Triggers for storage table
CREATE OR REPLACE FUNCTION notify_storage_update()
RETURNS trigger AS $$
BEGIN
PERFORM pg_notify('storage_updates', row_to_json(NEW)::text);
RETURN NEW;
END;

$$
LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS storage_update_trigger ON "Storage";
CREATE TRIGGER storage_update_trigger
AFTER UPDATE ON "Storage"
FOR EACH ROW
WHEN (OLD IS DISTINCT FROM NEW)
EXECUTE FUNCTION notify_storage_update();
$$
