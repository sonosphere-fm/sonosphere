-- Running totals: plays per listener for every artist, album and track. These triggers keep user_artists,
-- user_albums and user_tracks in step with the scrobble log, so charts and listener counts never re-count it.
CREATE FUNCTION scrobble_tally_add(u integer, ar integer, al integer, tr integer) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF ar IS NOT NULL THEN INSERT INTO user_artists (user_id, artist_id, plays) VALUES (u, ar, 1) ON CONFLICT (user_id, artist_id) DO UPDATE SET plays = user_artists.plays + 1; END IF;
  IF al IS NOT NULL THEN INSERT INTO user_albums (user_id, album_id, plays) VALUES (u, al, 1) ON CONFLICT (user_id, album_id) DO UPDATE SET plays = user_albums.plays + 1; END IF;
  IF tr IS NOT NULL THEN INSERT INTO user_tracks (user_id, track_id, plays) VALUES (u, tr, 1) ON CONFLICT (user_id, track_id) DO UPDATE SET plays = user_tracks.plays + 1; END IF;
END $$;
--> statement-breakpoint
CREATE FUNCTION scrobble_tally_drop(u integer, ar integer, al integer, tr integer) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE user_artists SET plays = plays - 1 WHERE user_id = u AND artist_id = ar;
  DELETE FROM user_artists WHERE user_id = u AND artist_id = ar AND plays <= 0;
  UPDATE user_albums SET plays = plays - 1 WHERE user_id = u AND album_id = al;
  DELETE FROM user_albums WHERE user_id = u AND album_id = al AND plays <= 0;
  UPDATE user_tracks SET plays = plays - 1 WHERE user_id = u AND track_id = tr;
  DELETE FROM user_tracks WHERE user_id = u AND track_id = tr AND plays <= 0;
END $$;
--> statement-breakpoint
CREATE FUNCTION scrobble_tally() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('DELETE', 'UPDATE') THEN PERFORM scrobble_tally_drop(OLD.user_id, OLD.artist_id, OLD.album_id, OLD.track_id); END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN PERFORM scrobble_tally_add(NEW.user_id, NEW.artist_id, NEW.album_id, NEW.track_id); END IF;
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE TRIGGER scrobbles_tally_ai AFTER INSERT ON scrobbles FOR EACH ROW EXECUTE FUNCTION scrobble_tally();
--> statement-breakpoint
CREATE TRIGGER scrobbles_tally_ad AFTER DELETE ON scrobbles FOR EACH ROW EXECUTE FUNCTION scrobble_tally();
--> statement-breakpoint
CREATE TRIGGER scrobbles_tally_au AFTER UPDATE OF user_id, artist_id, album_id, track_id ON scrobbles FOR EACH ROW EXECUTE FUNCTION scrobble_tally();
