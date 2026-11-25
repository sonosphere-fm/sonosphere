CREATE OR REPLACE FUNCTION search_notify() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('search', TG_TABLE_NAME || ':' || (CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END));
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE TRIGGER artists_search AFTER INSERT OR DELETE OR UPDATE OF name ON artists FOR EACH ROW EXECUTE FUNCTION search_notify();
--> statement-breakpoint
CREATE TRIGGER albums_search AFTER INSERT OR DELETE OR UPDATE OF title, artist_id ON albums FOR EACH ROW EXECUTE FUNCTION search_notify();
--> statement-breakpoint
CREATE TRIGGER tracks_search AFTER INSERT OR DELETE OR UPDATE OF title, artist_id ON tracks FOR EACH ROW EXECUTE FUNCTION search_notify();
