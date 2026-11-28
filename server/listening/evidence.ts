import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { albums, artists, scrobbles, tracks } from "../db/schema";
import type { ListeningPair } from "../../shared/listening-evidence";

export async function listeningPairs(
  userId: number,
  from: number,
  to: number,
  ids?: number[]
): Promise<ListeningPair[]> {
  return db.execute<ListeningPair>(sql`
    WITH plays AS (
      SELECT ${scrobbles.id} AS id, ${scrobbles.playedAt} AS at,
        ${scrobbles.trackId} AS track, ${scrobbles.source} AS source, ${tracks.duration} AS duration,
        json_build_object(
          'id', ${scrobbles.id}, 'track', ${scrobbles.trackId}, 'album', ${scrobbles.albumId},
          'artist', ${scrobbles.artistId}, 'title', COALESCE(${scrobbles.sentTrack}, ${tracks.title}),
          'artistName', COALESCE(${scrobbles.sentArtist}, ${artists.name}),
          'albumTitle', COALESCE(${scrobbles.sentAlbum}, ${albums.title}),
          'at', ${scrobbles.playedAt}, 'source', ${scrobbles.source}, 'duration', ${tracks.duration}
        ) AS play
      FROM ${scrobbles}
      JOIN ${tracks} ON ${tracks.id} = ${scrobbles.trackId}
      JOIN ${artists} ON ${artists.id} = ${scrobbles.artistId}
      LEFT JOIN ${albums} ON ${albums.id} = ${scrobbles.albumId}
      WHERE ${scrobbles.userId} = ${userId} AND ${scrobbles.source} <> 'import'
        AND ${scrobbles.playedAt} BETWEEN ${from - 300} AND ${to + 300}
    ), neighbours AS (
      SELECT *, LAG(id) OVER w AS prev_id, LAG(at) OVER w AS prev_at,
        LAG(track) OVER w AS prev_track, LAG(source) OVER w AS prev_source,
        LAG(duration) OVER w AS prev_duration, LAG(play) OVER w AS prev_play
      FROM plays WINDOW w AS (ORDER BY at, id)
    )
    SELECT play AS "current", prev_play AS previous, at - prev_at AS gap,
      (CASE WHEN prev_duration > 0 THEN LEAST(prev_duration / 2, 240) ELSE 30 END) - 5 AS minimum
    FROM neighbours
    WHERE prev_id IS NOT NULL
      AND ${ids ? sql`(id IN ${ids} OR prev_id IN ${ids})` : sql`at BETWEEN ${from} AND ${to}`}
      AND at - prev_at < (CASE WHEN prev_duration > 0 THEN LEAST(prev_duration / 2, 240) ELSE 30 END) - 5
      AND NOT (track = prev_track AND source <> prev_source AND at - prev_at < 60)
    ORDER BY at, id ${ids ? sql`` : sql`LIMIT 101`}
  `);
}
