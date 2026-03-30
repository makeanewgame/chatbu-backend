-- Fix pg_notify payload size: send only {id, op} instead of full row_to_json
-- to avoid exceeding the 8KB pg_notify payload limit.

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
