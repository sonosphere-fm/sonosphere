// The picture a track row shows, so lists match the track page: the cover of the album the track is on, else the
// artist's photo. Both expect `artists` joined on the track's artist.
import { sql, type SQL } from "drizzle-orm";
import { albums, artists, tracks } from "../db/schema";

/** For rows with `albums` joined on `tracks.albumId`. */
export const trackImage = (): SQL<string | null> => sql<string | null>`COALESCE(${albums.imageId}, ${artists.imageId})`;

/**
 * For plays, with `albums` joined on the album the play was filed under. A play can be filed under another album
 * than the track's own (a different edition, say), so the track's own cover comes before the artist's photo.
 */
export const playImage = (): SQL<string | null> =>
  sql<string | null>`COALESCE(${albums.imageId}, (SELECT own.image_id FROM ${albums} own WHERE own.id = ${tracks.albumId}), ${artists.imageId})`;
