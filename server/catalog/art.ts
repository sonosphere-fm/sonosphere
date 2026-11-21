import { sql, type SQL } from "drizzle-orm";
import { albums, artists, tracks } from "../db/schema";

/** For rows with `albums` joined on `tracks.albumId`. */
export const trackImage = (): SQL<string | null> => sql<string | null>`COALESCE(${albums.imageId}, ${artists.imageId})`;

/** For plays, with `albums` joined on the album the play was filed under, which may differ from the track's own. */
export const playImage = (): SQL<string | null> => sql<string | null>`COALESCE(
  ${albums.imageId},
  (SELECT own.image_id FROM ${albums} own WHERE own.id = ${tracks.albumId}),
  ${artists.imageId}
)`;
