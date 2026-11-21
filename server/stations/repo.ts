// Data access for stations: the pools of tracks a station draws from.
import { and, desc, eq, exists, inArray, sql } from "drizzle-orm";
import { db } from "../db/client";
import { flag, randomOrder } from "../db/dialect";
import { albums, artists, lovedTracks, scrobbles, taggings, tracks } from "../db/schema";
import type { StationTrack } from "../../shared/stations";

/** 1 when the viewer (0 for nobody) has loved the track in the row, otherwise 0. */
const lovedBy = (viewerId: number) => flag(exists(db.select({ one: sql`1` }).from(lovedTracks)
  .where(and(eq(lovedTracks.userId, viewerId), eq(lovedTracks.trackId, tracks.id)))));

/** The distinct tracks among `sample` of someone's plays picked at random, so what they play most turns up most. */
export function randomPlays(userId: number, viewerId: number, sample: number): Promise<StationTrack[]> {
  const plays = db.select({ trackId: scrobbles.trackId }).from(scrobbles).where(eq(scrobbles.userId, userId)).orderBy(randomOrder()).limit(sample).as("p");
  const picked = db.selectDistinct({ trackId: plays.trackId }).from(plays).as("x");
  return db.select({
    id: tracks.id, title: tracks.title, duration: tracks.duration, artist: artists.name, album: albums.title, image: albums.imageId, loved: lovedBy(viewerId),
  }).from(picked).innerJoin(tracks, eq(tracks.id, picked.trackId)).innerJoin(artists, eq(artists.id, tracks.artistId)).leftJoin(albums, eq(albums.id, tracks.albumId));
}

export type ArtistTrack = StationTrack & { artistId: number };
type Ranked = ArtistTrack & { rn: number };

/** The `pool` most popular tracks of each of these artists, grouped by artist with the most popular first. */
export async function popularTracks(artistIds: number[], viewerId: number, pool: number): Promise<ArtistTrack[]> {
  // a window function ranks each artist's tracks; the builder cannot select from that with these column names
  const rows = await db.execute<Ranked>(sql`SELECT * FROM (
    SELECT ${tracks.id} id, ${tracks.title} title, ${tracks.duration} duration, ${artists.name} artist, ${albums.title} album, ${albums.imageId} image,
      ${lovedBy(viewerId)} loved, ${tracks.artistId} "artistId",
      ROW_NUMBER() OVER (PARTITION BY ${tracks.artistId} ORDER BY ${tracks.baseListeners} DESC, ${tracks.basePlaycount} DESC, ${tracks.id}) rn
    FROM ${tracks} JOIN ${artists} ON ${artists.id} = ${tracks.artistId} LEFT JOIN ${albums} ON ${albums.id} = ${tracks.albumId}
    WHERE ${inArray(tracks.artistId, artistIds)}) ranked WHERE rn <= ${pool}`);
  return rows.map(({ rn, ...track }) => track);
}

/** The artists a tag applies to most strongly. */
export async function taggedArtists(tagId: number, limit: number): Promise<number[]> {
  const rows = await db.select({ id: taggings.itemId }).from(taggings).where(and(eq(taggings.tagId, tagId), eq(taggings.itemType, "artist")))
    .groupBy(taggings.itemId).orderBy(desc(sql`SUM(${taggings.weight})`)).limit(limit);
  return rows.map(r => r.id);
}
