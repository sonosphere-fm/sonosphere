import { and, count, countDistinct, desc, eq, gt, like, lt, sql } from "drizzle-orm";
import { trackImage } from "../catalog/art";
import { db } from "../db/client";
import { albumTracks, albums, apiApps, apiSessions, apiTokens, artists, follows, lovedTracks, taggings, tags, tracks, userArtists, userTracks, users } from "../db/schema";
import { digest, first, now } from "../util";

const total = async (rows: PromiseLike<{ c: number }[]>) => (await rows)[0]?.c ?? 0;

export type App = { id: number; name: string; secret: string };
export const appByKey = (apiKey: string): Promise<App | null> =>
  first(db.select({ id: apiApps.id, name: apiApps.name, secret: apiApps.secret }).from(apiApps).where(eq(apiApps.apiKey, apiKey)).limit(1));

// Keys and tokens are stored as their digest; callers pass the real ones.
const DAY = 86400;
const IDLE = 365 * DAY;

export async function sessionUser(key: string, appId: number): Promise<number | null> {
  const k = digest(key);
  const row = await first(db.select({ userId: apiSessions.userId, lastUsedAt: apiSessions.lastUsedAt }).from(apiSessions)
    .where(and(eq(apiSessions.key, k), eq(apiSessions.appId, appId), gt(apiSessions.lastUsedAt, now() - IDLE))).limit(1));
  if (!row) return null;
  // at most once a day, so scrobbling doesn't write to the session on every call
  if (row.lastUsedAt < now() - DAY) {
    await db.update(apiSessions).set({ lastUsedAt: now() }).where(eq(apiSessions.key, k));
  }
  return row.userId;
}

export async function createSession(key: string, appId: number, userId: number): Promise<void> {
  await db.insert(apiSessions).values({ key: digest(key), appId, userId, createdAt: now(), lastUsedAt: now() });
}

export async function createToken(token: string, appId: number): Promise<void> {
  await db.insert(apiTokens).values({ token: digest(token), appId, createdAt: now() });
}

// userId stays null until someone approves the token.
export const findToken = (token: string, appId: number): Promise<{ userId: number | null; createdAt: number } | null> =>
  first(db.select({ userId: apiTokens.userId, createdAt: apiTokens.createdAt }).from(apiTokens)
    .where(and(eq(apiTokens.token, digest(token)), eq(apiTokens.appId, appId))).limit(1));

export async function deleteToken(token: string): Promise<void> {
  await db.delete(apiTokens).where(eq(apiTokens.token, digest(token)));
}

type LovedRow = { title: string; duration: number; artist: string; image: string | null; at: number };
export const lovedPage = (userId: number, limit: number, offset: number): Promise<LovedRow[]> =>
  db.select({ title: tracks.title, duration: tracks.duration, artist: artists.name, image: trackImage(), at: lovedTracks.createdAt })
    .from(lovedTracks)
    .innerJoin(tracks, eq(tracks.id, lovedTracks.trackId))
    .innerJoin(artists, eq(artists.id, tracks.artistId))
    .leftJoin(albums, eq(albums.id, tracks.albumId))
    .where(eq(lovedTracks.userId, userId))
    .orderBy(desc(lovedTracks.createdAt))
    .limit(limit)
    .offset(offset);

type Friend = { username: string; realname: string; country: string; imageId: string | null; registeredAt: number };
export const friendsPage = (userId: number, limit: number, offset: number): Promise<Friend[]> =>
  db.select({ username: users.username, realname: users.realname, country: users.country, imageId: users.imageId, registeredAt: users.registeredAt })
    .from(follows)
    .innerJoin(users, eq(users.id, follows.followeeId))
    .where(eq(follows.followerId, userId))
    .orderBy(desc(follows.createdAt))
    .limit(limit)
    .offset(offset);

export function userTopTags(userId: number, limit: number): Promise<{ name: string; count: number }[]> {
  const uses = count().as("count");
  return db.select({ name: tags.name, count: uses }).from(taggings).innerJoin(tags, eq(tags.id, taggings.tagId))
    .where(eq(taggings.userId, userId)).groupBy(tags.id).orderBy(desc(uses)).limit(limit);
}

// Search patterns are used as given: % and _ in them are wildcards.
type ArtistHit = { name: string; image: string | null; listeners: number };
export function searchArtists(pattern: string, limit: number, offset: number): Promise<ArtistHit[]> {
  const listeners = sql<number>`((SELECT COUNT(*) FROM ${userArtists} WHERE ${userArtists.artistId} = ${artists.id}) + ${artists.baseListeners})`.as("listeners");
  return db.select({ name: artists.name, image: artists.imageId, listeners }).from(artists)
    .where(like(artists.nameNorm, pattern)).orderBy(desc(listeners)).limit(limit).offset(offset);
}

export const countArtists = (pattern: string): Promise<number> =>
  total(db.select({ c: count() }).from(artists).where(like(artists.nameNorm, pattern)));

type AlbumHit = { title: string; image: string | null; artist: string };
export const searchAlbums = (pattern: string, limit: number, offset: number): Promise<AlbumHit[]> =>
  db.select({ title: albums.title, image: albums.imageId, artist: artists.name }).from(albums)
    .innerJoin(artists, eq(artists.id, albums.artistId))
    .where(like(albums.titleNorm, pattern)).limit(limit).offset(offset);

export const countAlbums = (pattern: string): Promise<number> =>
  total(db.select({ c: count() }).from(albums).where(like(albums.titleNorm, pattern)));

type TrackHit = { title: string; duration: number; artist: string; image: string | null; listeners: number };
export function searchTracks(pattern: string, artistNorm: string | null, limit: number, offset: number): Promise<TrackHit[]> {
  const listeners = sql<number>`((SELECT COUNT(*) FROM ${userTracks} WHERE ${userTracks.trackId} = ${tracks.id}) + ${tracks.baseListeners})`.as("listeners");
  const byArtist = artistNorm === null ? undefined : eq(artists.nameNorm, artistNorm);
  return db.select({ title: tracks.title, duration: tracks.duration, artist: artists.name, image: trackImage(), listeners })
    .from(tracks)
    .innerJoin(artists, eq(artists.id, tracks.artistId))
    .leftJoin(albums, eq(albums.id, tracks.albumId))
    .where(and(like(tracks.titleNorm, pattern), byArtist))
    .orderBy(desc(listeners))
    .limit(limit)
    .offset(offset);
}

export const albumTrackList = (albumId: number): Promise<{ title: string; duration: number; position: number }[]> =>
  db.select({ title: tracks.title, duration: tracks.duration, position: albumTracks.position }).from(albumTracks)
    .innerJoin(tracks, eq(tracks.id, albumTracks.trackId)).where(eq(albumTracks.albumId, albumId)).orderBy(albumTracks.position);

export function tagTopArtists(tagId: number, limit: number, offset: number): Promise<{ name: string; image: string | null }[]> {
  const uses = count().as("c");
  return db.select({ name: artists.name, image: artists.imageId, c: uses }).from(taggings)
    .innerJoin(artists, eq(artists.id, taggings.itemId))
    .where(and(eq(taggings.tagId, tagId), eq(taggings.itemType, "artist")))
    .groupBy(artists.id).orderBy(desc(uses)).limit(limit).offset(offset);
}

export async function taggedArtistIds(tagId: number): Promise<number[]> {
  const rows = await db.selectDistinct({ id: taggings.itemId }).from(taggings)
    .where(and(eq(taggings.tagId, tagId), eq(taggings.itemType, "artist")));
  return rows.map(r => r.id);
}

export function chartTopTags(limit: number, offset: number): Promise<{ name: string; taggings: number; reach: number }[]> {
  const uses = count().as("taggings");
  return db.select({ name: tags.name, taggings: uses, reach: countDistinct(taggings.userId) }).from(taggings)
    .innerJoin(tags, eq(tags.id, taggings.tagId))
    .groupBy(tags.id).orderBy(desc(uses)).limit(limit).offset(offset);
}

// Desktop sign-in tokens are valid for an hour; app sessions expire after a year idle.
export async function dropStaleTokens(): Promise<void> {
  await db.delete(apiTokens).where(lt(apiTokens.createdAt, now() - 3600));
  await db.delete(apiSessions).where(lt(apiSessions.lastUsedAt, now() - IDLE));
}
