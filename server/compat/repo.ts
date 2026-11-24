import { and, count, countDistinct, desc, eq, gt, inArray, lt, sql } from "drizzle-orm";
import { trackImage } from "../catalog/art";
import { db } from "../db/client";
import { matches } from "../db/dialect";
import {
  albumTracks,
  albums,
  apiApps,
  apiSessions,
  apiTokens,
  artists,
  follows,
  lovedTracks,
  taggings,
  tags,
  tracks,
  userArtists,
  userTracks,
  users,
} from "../db/schema";
import { digest, first, now } from "../util";
import { countryName } from "../../shared/countries";

const total = async (rows: PromiseLike<{ c: number }[]>) => (await rows)[0]?.c ?? 0;

export type App = { id: number; name: string; secret: string };
export const appByKey = (apiKey: string): Promise<App | null> =>
  first(
    db
      .select({ id: apiApps.id, name: apiApps.name, secret: apiApps.secret })
      .from(apiApps)
      .where(eq(apiApps.apiKey, apiKey))
      .limit(1)
  );

// Keys and tokens are stored as their digest; callers pass the real ones.
const DAY = 86400;
const IDLE = 365 * DAY;

export async function sessionUser(key: string, appId: number): Promise<number | null> {
  const k = digest(key);
  const row = await first(
    db
      .select({ userId: apiSessions.userId, lastUsedAt: apiSessions.lastUsedAt })
      .from(apiSessions)
      .where(and(eq(apiSessions.key, k), eq(apiSessions.appId, appId), gt(apiSessions.lastUsedAt, now() - IDLE)))
      .limit(1)
  );
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
  first(
    db
      .select({ userId: apiTokens.userId, createdAt: apiTokens.createdAt })
      .from(apiTokens)
      .where(and(eq(apiTokens.token, digest(token)), eq(apiTokens.appId, appId)))
      .limit(1)
  );

// Only one caller can take a token, so it can't become two sessions.
export async function takeToken(token: string): Promise<boolean> {
  const rows = await db
    .delete(apiTokens)
    .where(eq(apiTokens.token, digest(token)))
    .returning({ token: apiTokens.token });
  return rows.length > 0;
}

type LovedRow = { title: string; duration: number; artist: string; image: string | null; at: number };
export const lovedPage = (userId: number, limit: number, offset: number): Promise<LovedRow[]> =>
  db
    .select({
      title: tracks.title,
      duration: tracks.duration,
      artist: artists.name,
      image: trackImage(),
      at: lovedTracks.createdAt,
    })
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
  db
    .select({
      username: users.username,
      realname: users.realname,
      country: users.country,
      imageId: users.imageId,
      registeredAt: users.registeredAt,
    })
    .from(follows)
    .innerJoin(users, eq(users.id, follows.followeeId))
    .where(eq(follows.followerId, userId))
    .orderBy(desc(follows.createdAt))
    .limit(limit)
    .offset(offset);

export function userTopTags(userId: number, limit: number): Promise<{ name: string; count: number }[]> {
  const uses = count().as("count");
  return db
    .select({ name: tags.name, count: uses })
    .from(taggings)
    .innerJoin(tags, eq(tags.id, taggings.tagId))
    .where(eq(taggings.userId, userId))
    .groupBy(tags.id)
    .orderBy(desc(uses))
    .limit(limit);
}

// Patterns come from like() in server/util.ts.
type ArtistHit = { name: string; image: string | null; listeners: number };
export function searchArtists(pattern: string, limit: number, offset: number): Promise<ArtistHit[]> {
  const listeners =
    sql<number>`((SELECT COUNT(*) FROM ${userArtists} WHERE ${userArtists.artistId} = ${artists.id}) + ${artists.baseListeners})`.as(
      "listeners"
    );
  return db
    .select({ name: artists.name, image: artists.imageId, listeners })
    .from(artists)
    .where(matches(artists.nameNorm, pattern))
    .orderBy(desc(listeners))
    .limit(limit)
    .offset(offset);
}

export const countArtists = (pattern: string): Promise<number> =>
  total(db.select({ c: count() }).from(artists).where(matches(artists.nameNorm, pattern)));

type AlbumHit = { title: string; image: string | null; artist: string };
export const searchAlbums = (pattern: string, limit: number, offset: number): Promise<AlbumHit[]> =>
  db
    .select({ title: albums.title, image: albums.imageId, artist: artists.name })
    .from(albums)
    .innerJoin(artists, eq(artists.id, albums.artistId))
    .where(matches(albums.titleNorm, pattern))
    .limit(limit)
    .offset(offset);

export const countAlbums = (pattern: string): Promise<number> =>
  total(db.select({ c: count() }).from(albums).where(matches(albums.titleNorm, pattern)));

type TrackHit = { title: string; duration: number; artist: string; image: string | null; listeners: number };
export function searchTracks(
  pattern: string,
  artistNorm: string | null,
  limit: number,
  offset: number
): Promise<TrackHit[]> {
  const listeners =
    sql<number>`((SELECT COUNT(*) FROM ${userTracks} WHERE ${userTracks.trackId} = ${tracks.id}) + ${tracks.baseListeners})`.as(
      "listeners"
    );
  const byArtist = artistNorm === null ? undefined : eq(artists.nameNorm, artistNorm);
  return db
    .select({ title: tracks.title, duration: tracks.duration, artist: artists.name, image: trackImage(), listeners })
    .from(tracks)
    .innerJoin(artists, eq(artists.id, tracks.artistId))
    .leftJoin(albums, eq(albums.id, tracks.albumId))
    .where(and(matches(tracks.titleNorm, pattern), byArtist))
    .orderBy(desc(listeners))
    .limit(limit)
    .offset(offset);
}

export const albumTrackList = (albumId: number): Promise<{ title: string; duration: number; position: number }[]> =>
  db
    .select({ title: tracks.title, duration: tracks.duration, position: albumTracks.position })
    .from(albumTracks)
    .innerJoin(tracks, eq(tracks.id, albumTracks.trackId))
    .where(eq(albumTracks.albumId, albumId))
    .orderBy(albumTracks.position);

export function tagTopArtists(
  tagId: number,
  limit: number,
  offset: number
): Promise<{ name: string; image: string | null }[]> {
  const uses = count().as("c");
  return db
    .select({ name: artists.name, image: artists.imageId, c: uses })
    .from(taggings)
    .innerJoin(artists, eq(artists.id, taggings.itemId))
    .where(and(eq(taggings.tagId, tagId), eq(taggings.itemType, "artist")))
    .groupBy(artists.id)
    .orderBy(desc(uses))
    .limit(limit)
    .offset(offset);
}

export async function taggedArtistIds(tagId: number): Promise<number[]> {
  const rows = await db
    .selectDistinct({ id: taggings.itemId })
    .from(taggings)
    .where(and(eq(taggings.tagId, tagId), eq(taggings.itemType, "artist")));
  return rows.map((r) => r.id);
}

export function chartTopTags(
  limit: number,
  offset: number
): Promise<{ name: string; taggings: number; reach: number }[]> {
  const uses = count().as("taggings");
  return db
    .select({ name: tags.name, taggings: uses, reach: countDistinct(taggings.userId) })
    .from(taggings)
    .innerJoin(tags, eq(tags.id, taggings.tagId))
    .groupBy(tags.id)
    .orderBy(desc(uses))
    .limit(limit)
    .offset(offset);
}

export const tagCount = (): Promise<number> => total(db.select({ c: count() }).from(tags));

export function userArtistTagCounts(userId: number, artistIds: number[]): Promise<Map<number, number>> {
  if (!artistIds.length) return Promise.resolve(new Map());
  return db
    .select({ id: taggings.itemId, c: count() })
    .from(taggings)
    .where(and(eq(taggings.userId, userId), eq(taggings.itemType, "artist"), inArray(taggings.itemId, artistIds)))
    .groupBy(taggings.itemId)
    .then((rows) => new Map(rows.map((r) => [r.id, r.c])));
}

export type PersonalArtist = { name: string; image: string | null };
export type PersonalAlbum = { title: string; image: string | null; artist: string };
export type PersonalTrack = { title: string; image: string | null; artist: string };

const taggedBy = (userId: number, tagId: number, type: string) =>
  and(eq(taggings.userId, userId), eq(taggings.tagId, tagId), eq(taggings.itemType, type));

export const personalTagCount = (userId: number, tagId: number, type: string): Promise<number> =>
  total(
    db
      .select({ c: count() })
      .from(taggings)
      .where(taggedBy(userId, tagId, type))
  );

export function personalTagArtists(
  userId: number,
  tagId: number,
  limit: number,
  offset: number
): Promise<PersonalArtist[]> {
  return db
    .select({ name: artists.name, image: artists.imageId })
    .from(taggings)
    .innerJoin(artists, eq(artists.id, taggings.itemId))
    .where(taggedBy(userId, tagId, "artist"))
    .orderBy(desc(taggings.createdAt), artists.name)
    .limit(limit)
    .offset(offset);
}

export function personalTagAlbums(
  userId: number,
  tagId: number,
  limit: number,
  offset: number
): Promise<PersonalAlbum[]> {
  return db
    .select({ title: albums.title, image: albums.imageId, artist: artists.name })
    .from(taggings)
    .innerJoin(albums, eq(albums.id, taggings.itemId))
    .innerJoin(artists, eq(artists.id, albums.artistId))
    .where(taggedBy(userId, tagId, "album"))
    .orderBy(desc(taggings.createdAt), albums.title)
    .limit(limit)
    .offset(offset);
}

export function personalTagTracks(
  userId: number,
  tagId: number,
  limit: number,
  offset: number
): Promise<PersonalTrack[]> {
  return db
    .select({ title: tracks.title, image: trackImage(), artist: artists.name })
    .from(taggings)
    .innerJoin(tracks, eq(tracks.id, taggings.itemId))
    .innerJoin(artists, eq(artists.id, tracks.artistId))
    .leftJoin(albums, eq(albums.id, tracks.albumId))
    .where(taggedBy(userId, tagId, "track"))
    .orderBy(desc(taggings.createdAt), tracks.title)
    .limit(limit)
    .offset(offset);
}

export type GeoArtist = {
  id: number;
  name: string;
  image: string | null;
  playcount: number;
  listeners: number;
};
export type GeoTrack = {
  id: number;
  title: string;
  duration: number;
  artist: string;
  image: string | null;
  playcount: number;
  listeners: number;
};

const GEO_DEPTH = 1000;

async function listenersIn(country: string) {
  const saved = await db.selectDistinct({ c: users.country }).from(users);
  const spellings = saved.map((r) => r.c).filter((c) => c === country || countryName(c) === country);
  return and(
    inArray(users.country, spellings.length ? spellings : [country]),
    eq(users.privateListening, false),
    eq(users.banned, false)
  );
}

export async function geoTopArtists(country: string): Promise<{ items: GeoArtist[]; total: number }> {
  const listeners = countDistinct(userArtists.userId).as("listeners");
  const playcount = sql<number>`SUM(${userArtists.plays})`.as("playcount");
  const w = await listenersIn(country);
  const items = await db
    .select({ id: artists.id, name: artists.name, image: artists.imageId, listeners, playcount })
    .from(userArtists)
    .innerJoin(artists, eq(artists.id, userArtists.artistId))
    .innerJoin(users, eq(users.id, userArtists.userId))
    .where(w)
    .groupBy(artists.id)
    .orderBy(desc(listeners), desc(playcount), artists.name)
    .limit(GEO_DEPTH);
  const all = await total(
    db
      .select({ c: countDistinct(userArtists.artistId) })
      .from(userArtists)
      .innerJoin(users, eq(users.id, userArtists.userId))
      .where(w)
  );
  return { items, total: Math.min(all, GEO_DEPTH) };
}

export async function geoTopTracks(country: string): Promise<{ items: GeoTrack[]; total: number }> {
  const listeners = countDistinct(userTracks.userId).as("listeners");
  const playcount = sql<number>`SUM(${userTracks.plays})`.as("playcount");
  const w = await listenersIn(country);
  const items = await db
    .select({
      id: tracks.id,
      title: tracks.title,
      duration: tracks.duration,
      artist: artists.name,
      image: trackImage(),
      listeners,
      playcount,
    })
    .from(userTracks)
    .innerJoin(tracks, eq(tracks.id, userTracks.trackId))
    .innerJoin(artists, eq(artists.id, tracks.artistId))
    .leftJoin(albums, eq(albums.id, tracks.albumId))
    .innerJoin(users, eq(users.id, userTracks.userId))
    .where(w)
    .groupBy(tracks.id, artists.id, albums.id)
    .orderBy(desc(listeners), desc(playcount), tracks.title)
    .limit(GEO_DEPTH);
  const all = await total(
    db
      .select({ c: countDistinct(userTracks.trackId) })
      .from(userTracks)
      .innerJoin(users, eq(users.id, userTracks.userId))
      .where(w)
  );
  return { items, total: Math.min(all, GEO_DEPTH) };
}

// Desktop sign-in tokens are valid for an hour; app sessions expire after a year idle.
export async function dropStaleTokens(): Promise<void> {
  await db.delete(apiTokens).where(lt(apiTokens.createdAt, now() - 3600));
  await db.delete(apiSessions).where(lt(apiSessions.lastUsedAt, now() - IDLE));
}
