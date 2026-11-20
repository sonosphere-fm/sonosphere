-- Running totals: plays per listener for every artist, album and track. These triggers keep user_artists,
-- user_albums and user_tracks in step with the scrobble log, so charts and listener counts never re-count it.
CREATE TRIGGER IF NOT EXISTS scrobbles_tally_ai AFTER INSERT ON scrobbles BEGIN
  INSERT INTO user_artists (user_id, artist_id, plays) SELECT NEW.user_id, NEW.artist_id, 1 WHERE NEW.artist_id IS NOT NULL ON CONFLICT (user_id, artist_id) DO UPDATE SET plays = plays + 1;
  INSERT INTO user_albums (user_id, album_id, plays) SELECT NEW.user_id, NEW.album_id, 1 WHERE NEW.album_id IS NOT NULL ON CONFLICT (user_id, album_id) DO UPDATE SET plays = plays + 1;
  INSERT INTO user_tracks (user_id, track_id, plays) SELECT NEW.user_id, NEW.track_id, 1 WHERE NEW.track_id IS NOT NULL ON CONFLICT (user_id, track_id) DO UPDATE SET plays = plays + 1;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS scrobbles_tally_ad AFTER DELETE ON scrobbles BEGIN
  UPDATE user_artists SET plays = plays - 1 WHERE user_id = OLD.user_id AND artist_id = OLD.artist_id;
  DELETE FROM user_artists WHERE user_id = OLD.user_id AND artist_id = OLD.artist_id AND plays <= 0;
  UPDATE user_albums SET plays = plays - 1 WHERE user_id = OLD.user_id AND album_id = OLD.album_id;
  DELETE FROM user_albums WHERE user_id = OLD.user_id AND album_id = OLD.album_id AND plays <= 0;
  UPDATE user_tracks SET plays = plays - 1 WHERE user_id = OLD.user_id AND track_id = OLD.track_id;
  DELETE FROM user_tracks WHERE user_id = OLD.user_id AND track_id = OLD.track_id AND plays <= 0;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS scrobbles_tally_au AFTER UPDATE OF user_id, artist_id, album_id, track_id ON scrobbles BEGIN
  UPDATE user_artists SET plays = plays - 1 WHERE user_id = OLD.user_id AND artist_id = OLD.artist_id;
  DELETE FROM user_artists WHERE user_id = OLD.user_id AND artist_id = OLD.artist_id AND plays <= 0;
  UPDATE user_albums SET plays = plays - 1 WHERE user_id = OLD.user_id AND album_id = OLD.album_id;
  DELETE FROM user_albums WHERE user_id = OLD.user_id AND album_id = OLD.album_id AND plays <= 0;
  UPDATE user_tracks SET plays = plays - 1 WHERE user_id = OLD.user_id AND track_id = OLD.track_id;
  DELETE FROM user_tracks WHERE user_id = OLD.user_id AND track_id = OLD.track_id AND plays <= 0;
  INSERT INTO user_artists (user_id, artist_id, plays) SELECT NEW.user_id, NEW.artist_id, 1 WHERE NEW.artist_id IS NOT NULL ON CONFLICT (user_id, artist_id) DO UPDATE SET plays = plays + 1;
  INSERT INTO user_albums (user_id, album_id, plays) SELECT NEW.user_id, NEW.album_id, 1 WHERE NEW.album_id IS NOT NULL ON CONFLICT (user_id, album_id) DO UPDATE SET plays = plays + 1;
  INSERT INTO user_tracks (user_id, track_id, plays) SELECT NEW.user_id, NEW.track_id, 1 WHERE NEW.track_id IS NOT NULL ON CONFLICT (user_id, track_id) DO UPDATE SET plays = plays + 1;
END;
