import { and, desc, eq, exists, inArray, sql } from "drizzle-orm";
import { trackImage } from "../catalog/art";
import { db } from "../db/client";
import { flag, randomOrder } from "../db/dialect";
import { albums, artists, lovedTracks, scrobbles, taggings, tracks } from "../db/schema";
import type { StationTrack } from "../../shared/stations";

const lovedBy = (viewerId: number) =>
  flag(
    exists(
      db
        .select({ one: sql`1` })
        .from(lovedTracks)
        .where(and(eq(lovedTracks.userId, viewerId), eq(lovedTracks.trackId, tracks.id)))
    )
  );

// Sampling plays rather than tracks means what they play most turns up most.
export function randomPlays(userId: number, viewerId: number, sample: number): Promise<StationTrack[]> {
  const plays = db
    .select({ trackId: scrobbles.trackId })
    .from(scrobbles)
    .where(eq(scrobbles.userId, userId))
    .orderBy(randomOrder())
    .limit(sample)
    .as("p");
  const picked = db.selectDistinct({ trackId: plays.trackId }).from(plays).as("x");
  return db
    .select({
      id: tracks.id,
      title: tracks.title,
      duration: tracks.duration,
      artist: artists.name,
      album: albums.title,
      image: trackImage(),
      loved: lovedBy(viewerId),
    })
    .from(picked)
    .innerJoin(tracks, eq(tracks.id, picked.trackId))
    .innerJoin(artists, eq(artists.id, tracks.artistId))
    .leftJoin(albums, eq(albums.id, tracks.albumId));
}

type ArtistTrack = StationTrack & { artistId: number };
type Ranked = ArtistTrack & { rn: number };

export async function popularTracks(artistIds: number[], viewerId: number, pool: number): Promise<ArtistTrack[]> {
  // raw SQL: the builder cannot select from a ROW_NUMBER() subquery with these column names
  const rows = await db.execute<Ranked>(sql`SELECT * FROM (
    SELECT ${tracks.id} id, ${tracks.title} title, ${tracks.duration} duration, ${artists.name} artist, ${albums.title} album, ${trackImage()} image,
      ${lovedBy(viewerId)} loved, ${tracks.artistId} "artistId",
      ROW_NUMBER() OVER (PARTITION BY ${tracks.artistId} ORDER BY ${tracks.baseListeners} DESC, ${tracks.basePlaycount} DESC, ${tracks.id}) rn
    FROM ${tracks} JOIN ${artists} ON ${artists.id} = ${tracks.artistId} LEFT JOIN ${albums} ON ${albums.id} = ${tracks.albumId}
    WHERE ${inArray(tracks.artistId, artistIds)}) ranked WHERE rn <= ${pool}`);
  return rows.map(({ rn, ...track }) => track);
}

export async function taggedArtists(tagId: number, limit: number): Promise<number[]> {
  const rows = await db
    .select({ id: taggings.itemId })
    .from(taggings)
    .where(and(eq(taggings.tagId, tagId), eq(taggings.itemType, "artist")))
    .groupBy(taggings.itemId)
    .orderBy(desc(sql`SUM(${taggings.weight})`))
    .limit(limit);
  return rows.map((r) => r.id);
}
