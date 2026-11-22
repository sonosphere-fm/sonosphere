-- Aggregate deleted plays once per statement instead of updating three tallies per row.
CREATE FUNCTION scrobble_tally_bulk_drop() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE user_artists AS tally SET plays = tally.plays - gone.plays
  FROM (SELECT user_id, artist_id, count(*) AS plays FROM deleted_scrobbles GROUP BY user_id, artist_id) AS gone
  WHERE tally.user_id = gone.user_id AND tally.artist_id = gone.artist_id;
  DELETE FROM user_artists AS tally WHERE tally.plays <= 0
    AND EXISTS (SELECT 1 FROM deleted_scrobbles AS gone WHERE gone.user_id = tally.user_id AND gone.artist_id = tally.artist_id);

  UPDATE user_albums AS tally SET plays = tally.plays - gone.plays
  FROM (SELECT user_id, album_id, count(*) AS plays FROM deleted_scrobbles WHERE album_id IS NOT NULL GROUP BY user_id, album_id) AS gone
  WHERE tally.user_id = gone.user_id AND tally.album_id = gone.album_id;
  DELETE FROM user_albums AS tally WHERE tally.plays <= 0
    AND EXISTS (SELECT 1 FROM deleted_scrobbles AS gone WHERE gone.user_id = tally.user_id AND gone.album_id = tally.album_id);

  UPDATE user_tracks AS tally SET plays = tally.plays - gone.plays
  FROM (SELECT user_id, track_id, count(*) AS plays FROM deleted_scrobbles GROUP BY user_id, track_id) AS gone
  WHERE tally.user_id = gone.user_id AND tally.track_id = gone.track_id;
  DELETE FROM user_tracks AS tally WHERE tally.plays <= 0
    AND EXISTS (SELECT 1 FROM deleted_scrobbles AS gone WHERE gone.user_id = tally.user_id AND gone.track_id = tally.track_id);
  RETURN NULL;
END $$;
--> statement-breakpoint
DROP TRIGGER scrobbles_tally_ad ON scrobbles;
--> statement-breakpoint
CREATE TRIGGER scrobbles_tally_ad AFTER DELETE ON scrobbles
REFERENCING OLD TABLE AS deleted_scrobbles
FOR EACH STATEMENT EXECUTE FUNCTION scrobble_tally_bulk_drop();
