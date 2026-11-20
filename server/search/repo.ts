// Data access for search: names containing what was typed, exact matches first where there can be one, then the most listened to.
import { and, count, desc, eq, exists, or, sql } from "drizzle-orm";
import { db } from "../db/client";
import { flag, matches } from "../db/dialect";
import { albums, artists, lovedTracks, taggings, tags, tracks, userAlbums, userArtists, userTracks, users } from "../db/schema";
import { publicCols } from "../users/repo";
import { like } from "../util";
import type { FoundAlbum, FoundArtist, FoundTrack, FoundUser } from "../../shared/search";
import type { TagCount } from "../../shared/tags";

/** Which slice of the results to return. `term` is the search text in its normalised form. */
export type Query = { term: string; limit: number; offset: number };

export function searchArtists({ term, limit, offset }: Query): Promise<FoundArtist[]> {
  const listeners = sql<number>`((${db.select({ c: count() }).from(userArtists).where(eq(userArtists.artistId, artists.id))}) + ${artists.baseListeners})`.as("listeners");
  return db.select({ id: artists.id, name: artists.name, image: artists.imageId, listeners }).from(artists)
    .where(matches(artists.nameNorm, like(term))).orderBy(desc(eq(artists.nameNorm, term)), desc(listeners)).limit(limit).offset(offset);
}

export function searchAlbums({ term, limit, offset }: Query): Promise<FoundAlbum[]> {
  const listeners = sql<number>`((${db.select({ c: count() }).from(userAlbums).where(eq(userAlbums.albumId, albums.id))}) + ${albums.baseListeners})`.as("listeners");
  return db.select({ id: albums.id, title: albums.title, image: albums.imageId, artist: artists.name, listeners }).from(albums)
    .innerJoin(artists, eq(artists.id, albums.artistId))
    .where(matches(albums.titleNorm, like(term))).orderBy(desc(eq(albums.titleNorm, term)), desc(listeners)).limit(limit).offset(offset);
}

/** `loved` on each track says whether the viewer (0 for nobody) has loved it. */
export function searchTracks({ term, limit, offset }: Query, viewerId: number): Promise<FoundTrack[]> {
  const heard = db.select({ c: count() }).from(userTracks).where(eq(userTracks.trackId, tracks.id));
  const plays = db.select({ c: sql<number>`COALESCE(SUM(${userTracks.plays}), 0)` }).from(userTracks).where(eq(userTracks.trackId, tracks.id));
  const listeners = sql<number>`((${heard}) + ${tracks.baseListeners})`.as("listeners");
  return db.select({
    id: tracks.id, title: tracks.title, duration: tracks.duration, artist: artists.name, album: albums.title, image: albums.imageId,
    listeners, playcount: sql<number>`((${plays}) + ${tracks.basePlaycount})`.as("playcount"),
    loved: flag(exists(db.select({ one: sql`1` }).from(lovedTracks).where(and(eq(lovedTracks.userId, viewerId), eq(lovedTracks.trackId, tracks.id))))),
  }).from(tracks).innerJoin(artists, eq(artists.id, tracks.artistId)).leftJoin(albums, eq(albums.id, tracks.albumId))
    .where(matches(tracks.titleNorm, like(term))).orderBy(desc(eq(tracks.titleNorm, term)), desc(listeners)).limit(limit).offset(offset);
}

export function searchTags({ term, limit, offset }: Query): Promise<TagCount[]> {
  const uses = sql<number>`(${db.select({ c: count() }).from(taggings).where(eq(taggings.tagId, tags.id))})`.as("count");
  return db.select({ name: tags.name, count: uses }).from(tags).where(matches(tags.nameNorm, like(term))).orderBy(desc(uses)).limit(limit).offset(offset);
}

/** People whose username or real name contains the term, the heaviest listeners first. */
export function searchUsers({ term, limit, offset }: Query): Promise<FoundUser[]> {
  const playcount = sql<number>`(${db.select({ c: sql<number>`COALESCE(SUM(${userArtists.plays}), 0)` }).from(userArtists).where(eq(userArtists.userId, users.id))})`.as("playcount");
  return db.select({ ...publicCols, playcount }).from(users)
    .where(or(matches(users.usernameNorm, like(term)), matches(sql`lower(${users.realname})`, like(term)))).orderBy(desc(playcount)).limit(limit).offset(offset);
}
