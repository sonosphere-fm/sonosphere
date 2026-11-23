import { wantBare, wantCovers } from "../metadata/wanted";
import {
  and,
  asc,
  count,
  countDistinct,
  desc,
  eq,
  exists,
  gt,
  gte,
  inArray,
  isNotNull,
  lt,
  max,
  min,
  ne,
  notExists,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { playImage, trackImage } from "../catalog/art";
import { alias } from "drizzle-orm/pg-core";
import { db, transact, transactRetry, type Conn } from "../db/client";
import { flag, timeBucket, type Bucket } from "../db/dialect";
import { getJson, setJson } from "../kv";
import {
  albums,
  artists,
  lovedTracks,
  nowPlaying as playing,
  scrobbles,
  taggings,
  tags,
  tracks,
  userAlbums,
  userArtists,
  userTracks,
  users,
} from "../db/schema";
import {
  getOrCreateAlbumTx,
  getOrCreateArtistTx,
  getOrCreateTrackTx,
  resolveTrackTx,
  type TrackNames,
  type TrackRef,
} from "../catalog/repo";
import { first, norm, now } from "../util";
import { FOREVER } from "./period";
import { listeningChanged } from "../realtime";
import type {
  Counts,
  EditScope,
  ExportRow,
  NowPlaying,
  RecentTrack,
  ScopeCounts,
  SeriesPoint,
  TopAlbum,
  TopArtist,
  TopList,
  TopTrack,
} from "../../shared/listening";

/**
 * Which plays a statistic covers. `viewerId` only decides the `loved` flag on tracks, and `global` ranks by
 * listeners first (site charts) instead of plays first (one person's charts).
 */
export type Scope = {
  userId?: number;
  artistId?: number;
  albumId?: number;
  trackId?: number;
  artistIds?: number[];
  from?: number;
  to?: number;
  viewerId?: number;
  global?: boolean;
};
type Kind = "artists" | "albums" | "tracks";

const allTime = (s: Scope) => !s.from && !(s.to && s.to < FOREVER);

function within(s: Scope, ...more: SQL[]): SQL | undefined {
  const c: SQL[] = [];
  if (s.userId) c.push(eq(scrobbles.userId, s.userId));
  if (s.artistId) c.push(eq(scrobbles.artistId, s.artistId));
  if (s.albumId) c.push(eq(scrobbles.albumId, s.albumId));
  if (s.trackId) c.push(eq(scrobbles.trackId, s.trackId));
  if (s.artistIds) c.push(inArray(scrobbles.artistId, s.artistIds));
  if (s.from) c.push(gte(scrobbles.playedAt, s.from));
  if (s.to && s.to < FOREVER) c.push(lt(scrobbles.playedAt, s.to));
  return and(...c, ...more);
}
const total = async (rows: PromiseLike<{ c: number }[]>) => (await rows)[0]?.c ?? 0;

const artistCols = { id: artists.id, name: artists.name, image: artists.imageId };
const albumCols = { id: albums.id, title: albums.title, image: albums.imageId, artist: artists.name };
const trackCols = {
  id: tracks.id,
  title: tracks.title,
  duration: tracks.duration,
  artist: artists.name,
  album: albums.title,
  image: trackImage(),
};

const lovedBy = (viewerId: number | undefined) => {
  const loved = db
    .select({ one: sql`1` })
    .from(lovedTracks)
    .where(and(eq(lovedTracks.userId, viewerId || 0), eq(lovedTracks.trackId, tracks.id)));
  return flag(exists(loved));
};

// counted from the scrobble log: used whenever a time span or a single album or track is involved
const played = count().as("playcount");
const heardBy = countDistinct(scrobbles.userId).as("listeners");
const ranked = (s: Scope) => (s.global ? [desc(heardBy), desc(played)] : [desc(played), desc(heardBy)]);

// site-wide all-time rankings start from the catalogue so imported base totals count alongside local scrobbles
const wholeSite = (s: Scope) => !!s.global && !s.userId && !s.albumId && !s.trackId && allTime(s);
// one listener's all-time ranking comes straight from the running totals
const oneListener = (s: Scope) => !!s.userId && !s.albumId && !s.trackId && !s.artistIds && allTime(s);

/** Plays (pc) and listeners (ls) per item from the running totals, limited to the artists asked for, if any. */
function tallies(kind: Kind, s: Scope) {
  const ids = s.artistId ? [s.artistId] : s.artistIds;
  if (kind === "artists") {
    return db
      .select({
        k: sql<number>`${userArtists.artistId}`.as("k"),
        ls: count().as("ls"),
        pc: sql<number>`SUM(${userArtists.plays})`.as("pc"),
      })
      .from(userArtists)
      .where(ids && inArray(userArtists.artistId, ids))
      .groupBy(userArtists.artistId)
      .as("x");
  }
  if (kind === "albums") {
    const ofArtists = ids && db.select({ id: albums.id }).from(albums).where(inArray(albums.artistId, ids));
    return db
      .select({
        k: sql<number>`${userAlbums.albumId}`.as("k"),
        ls: count().as("ls"),
        pc: sql<number>`SUM(${userAlbums.plays})`.as("pc"),
      })
      .from(userAlbums)
      .where(ofArtists && inArray(userAlbums.albumId, ofArtists))
      .groupBy(userAlbums.albumId)
      .as("x");
  }
  const ofArtists = ids && db.select({ id: tracks.id }).from(tracks).where(inArray(tracks.artistId, ids));
  return db
    .select({
      k: sql<number>`${userTracks.trackId}`.as("k"),
      ls: count().as("ls"),
      pc: sql<number>`SUM(${userTracks.plays})`.as("pc"),
    })
    .from(userTracks)
    .where(ofArtists && inArray(userTracks.trackId, ofArtists))
    .groupBy(userTracks.trackId)
    .as("x");
}
type Tallies = ReturnType<typeof tallies>;
type Base = {
  baseListeners: typeof artists.baseListeners | typeof albums.baseListeners | typeof tracks.baseListeners;
  basePlaycount: typeof artists.basePlaycount | typeof albums.basePlaycount | typeof tracks.basePlaycount;
};

function catalogued(
  base: Base,
  artistId: typeof artists.id | typeof albums.artistId | typeof tracks.artistId,
  x: Tallies,
  s: Scope
) {
  const hasAny = or(isNotNull(x.pc), gt(base.baseListeners, 0), gt(base.basePlaycount, 0));
  return {
    playcount: sql<number>`${base.basePlaycount} + COALESCE(${x.pc}, 0)`.as("playcount"),
    listeners: sql<number>`${base.baseListeners} + COALESCE(${x.ls}, 0)`.as("listeners"),
    where: and(
      hasAny,
      s.artistId ? eq(artistId, s.artistId) : undefined,
      s.artistIds ? inArray(artistId, s.artistIds) : undefined
    ),
  };
}

async function topArtistsRows(s: Scope, limit = 50, offset = 0): Promise<TopList<TopArtist>> {
  if (wholeSite(s)) {
    const x = tallies("artists", s);
    const c = catalogued(artists, artists.id, x, s);
    const items = await db
      .select({ ...artistCols, playcount: c.playcount, listeners: c.listeners })
      .from(artists)
      .leftJoin(x, eq(x.k, artists.id))
      .where(c.where)
      .orderBy(desc(c.listeners), desc(c.playcount), artists.name)
      .limit(limit)
      .offset(offset);
    const count_ = db.select({ c: count() }).from(artists).leftJoin(x, eq(x.k, artists.id)).where(c.where);
    return { items, total: await total(count_) };
  }
  if (oneListener(s)) {
    const w = and(eq(userArtists.userId, s.userId ?? 0), s.artistId ? eq(userArtists.artistId, s.artistId) : undefined);
    const items = await db
      .select({ ...artistCols, playcount: userArtists.plays, listeners: sql<number>`1` })
      .from(userArtists)
      .innerJoin(artists, eq(artists.id, userArtists.artistId))
      .where(w)
      .orderBy(desc(userArtists.plays), userArtists.artistId)
      .limit(limit)
      .offset(offset);
    return { items, total: await total(db.select({ c: count() }).from(userArtists).where(w)) };
  }
  const w = within(s);
  const items = await db
    .select({ ...artistCols, playcount: played, listeners: heardBy })
    .from(scrobbles)
    .innerJoin(artists, eq(artists.id, scrobbles.artistId))
    .where(w)
    .groupBy(artists.id)
    .orderBy(...ranked(s), artists.name)
    .limit(limit)
    .offset(offset);
  return {
    items,
    total: await total(
      db
        .select({ c: countDistinct(scrobbles.artistId) })
        .from(scrobbles)
        .where(w)
    ),
  };
}

async function topAlbumsRows(s: Scope, limit = 50, offset = 0): Promise<TopList<TopAlbum>> {
  if (wholeSite(s)) {
    const x = tallies("albums", s);
    const c = catalogued(albums, albums.artistId, x, s);
    const items = await db
      .select({ ...albumCols, playcount: c.playcount, listeners: c.listeners })
      .from(albums)
      .innerJoin(artists, eq(artists.id, albums.artistId))
      .leftJoin(x, eq(x.k, albums.id))
      .where(c.where)
      .orderBy(desc(c.listeners), desc(c.playcount), albums.title)
      .limit(limit)
      .offset(offset);
    const count_ = db
      .select({ c: count() })
      .from(albums)
      .innerJoin(artists, eq(artists.id, albums.artistId))
      .leftJoin(x, eq(x.k, albums.id))
      .where(c.where);
    return { items, total: await total(count_) };
  }
  if (oneListener(s)) {
    const userId = s.userId ?? 0;
    const w = and(eq(userAlbums.userId, userId), s.artistId ? eq(albums.artistId, s.artistId) : undefined);
    const items = await db
      .select({ ...albumCols, playcount: userAlbums.plays, listeners: sql<number>`1` })
      .from(userAlbums)
      .innerJoin(albums, eq(albums.id, userAlbums.albumId))
      .innerJoin(artists, eq(artists.id, albums.artistId))
      .where(w)
      .orderBy(desc(userAlbums.plays), userAlbums.albumId)
      .limit(limit)
      .offset(offset);
    const count_ = s.artistId
      ? db
          .select({ c: count() })
          .from(userAlbums)
          .innerJoin(albums, eq(albums.id, userAlbums.albumId))
          .innerJoin(artists, eq(artists.id, albums.artistId))
          .where(w)
      : db.select({ c: count() }).from(userAlbums).where(eq(userAlbums.userId, userId));
    return { items, total: await total(count_) };
  }
  const w = within(s, isNotNull(scrobbles.albumId));
  const items = await db
    .select({ ...albumCols, playcount: played, listeners: heardBy })
    .from(scrobbles)
    .innerJoin(albums, eq(albums.id, scrobbles.albumId))
    .innerJoin(artists, eq(artists.id, albums.artistId))
    .where(w)
    .groupBy(albums.id, artists.id)
    .orderBy(...ranked(s), albums.title)
    .limit(limit)
    .offset(offset);
  return {
    items,
    total: await total(
      db
        .select({ c: countDistinct(scrobbles.albumId) })
        .from(scrobbles)
        .where(w)
    ),
  };
}

async function topTracksRows(s: Scope, limit = 50, offset = 0): Promise<TopList<TopTrack>> {
  const loved = lovedBy(s.viewerId);
  if (wholeSite(s)) {
    const x = tallies("tracks", s);
    const c = catalogued(tracks, tracks.artistId, x, s);
    const items = await db
      .select({ ...trackCols, loved, playcount: c.playcount, listeners: c.listeners })
      .from(tracks)
      .innerJoin(artists, eq(artists.id, tracks.artistId))
      .leftJoin(albums, eq(albums.id, tracks.albumId))
      .leftJoin(x, eq(x.k, tracks.id))
      .where(c.where)
      .orderBy(desc(c.listeners), desc(c.playcount), tracks.title)
      .limit(limit)
      .offset(offset);
    const count_ = db
      .select({ c: count() })
      .from(tracks)
      .innerJoin(artists, eq(artists.id, tracks.artistId))
      .leftJoin(albums, eq(albums.id, tracks.albumId))
      .leftJoin(x, eq(x.k, tracks.id))
      .where(c.where);
    return { items, total: await total(count_) };
  }
  if (oneListener(s)) {
    const userId = s.userId ?? 0;
    const w = and(eq(userTracks.userId, userId), s.artistId ? eq(tracks.artistId, s.artistId) : undefined);
    const items = await db
      .select({ ...trackCols, loved, playcount: userTracks.plays, listeners: sql<number>`1` })
      .from(userTracks)
      .innerJoin(tracks, eq(tracks.id, userTracks.trackId))
      .innerJoin(artists, eq(artists.id, tracks.artistId))
      .leftJoin(albums, eq(albums.id, tracks.albumId))
      .where(w)
      .orderBy(desc(userTracks.plays), userTracks.trackId)
      .limit(limit)
      .offset(offset);
    const count_ = s.artistId
      ? db
          .select({ c: count() })
          .from(userTracks)
          .innerJoin(tracks, eq(tracks.id, userTracks.trackId))
          .innerJoin(artists, eq(artists.id, tracks.artistId))
          .leftJoin(albums, eq(albums.id, tracks.albumId))
          .where(w)
      : db.select({ c: count() }).from(userTracks).where(eq(userTracks.userId, userId));
    return { items, total: await total(count_) };
  }
  const w = within(s);
  const items = await db
    .select({ ...trackCols, playcount: played, listeners: heardBy, loved })
    .from(scrobbles)
    .innerJoin(tracks, eq(tracks.id, scrobbles.trackId))
    .innerJoin(artists, eq(artists.id, tracks.artistId))
    .leftJoin(albums, eq(albums.id, tracks.albumId))
    .where(w)
    .groupBy(tracks.id, artists.id, albums.id)
    .orderBy(...ranked(s), tracks.title)
    .limit(limit)
    .offset(offset);
  return {
    items,
    total: await total(
      db
        .select({ c: countDistinct(scrobbles.trackId) })
        .from(scrobbles)
        .where(w)
    ),
  };
}

export function top(kind: "artists", s: Scope, limit?: number, offset?: number): Promise<TopList<TopArtist>>;
export function top(kind: "albums", s: Scope, limit?: number, offset?: number): Promise<TopList<TopAlbum>>;
export function top(kind: "tracks", s: Scope, limit?: number, offset?: number): Promise<TopList<TopTrack>>;
export function top(
  kind: Kind,
  s: Scope,
  limit?: number,
  offset?: number
): Promise<TopList<TopArtist | TopAlbum | TopTrack>>;
export function top(kind: Kind, s: Scope, limit = 50, offset = 0): Promise<TopList<TopArtist | TopAlbum | TopTrack>> {
  if (kind === "artists") return topArtists(s, limit, offset);
  if (kind === "albums") return topAlbums(s, limit, offset);
  return topTracks(s, limit, offset);
}

// Site charts scan every play and every visitor asks for the same ones, so each is computed at most once a minute
// (shared between processes through Valkey) and a stale copy is served while a fresh one is computed. Only the
// `loved` flag depends on the viewer; it is filled in afterwards.
type SiteList = TopList<TopArtist | TopAlbum | TopTrack>;
type SiteEntry = { at: number; v: Promise<SiteList>; next?: Promise<unknown> };
const siteCache = new Map<string, SiteEntry>();
const SITE_TTL = 60_000;

export function siteTop(kind: "artists", s: Scope, limit?: number, offset?: number): Promise<TopList<TopArtist>>;
export function siteTop(kind: "albums", s: Scope, limit?: number, offset?: number): Promise<TopList<TopAlbum>>;
export function siteTop(kind: "tracks", s: Scope, limit?: number, offset?: number): Promise<TopList<TopTrack>>;
export function siteTop(
  kind: Kind,
  s: Scope,
  limit?: number,
  offset?: number
): Promise<TopList<TopArtist | TopAlbum | TopTrack>>;
export async function siteTop(
  kind: Kind,
  s: Scope,
  limit = 50,
  offset = 0
): Promise<TopList<TopArtist | TopAlbum | TopTrack>> {
  // windows like "the last 7 days" move every second; snap them to the minute so they share one entry
  const from = s.from ? s.from - (s.from % 60) : undefined;
  const to = s.to && s.to < FOREVER ? s.to : undefined;
  const key = `${kind}:${from ?? ""}:${to ?? ""}:${limit}:${offset}`;

  const load = async (): Promise<{ at: number; list: SiteList }> => {
    const shared = await getJson<{ at: number; list: SiteList }>(`site:${key}`);
    if (shared && Date.now() - shared.at < SITE_TTL) return shared;
    const fresh = { at: Date.now(), list: await top(kind, { from, to, global: true }, limit, offset) };
    await setJson(`site:${key}`, fresh, 10 * SITE_TTL);
    return fresh;
  };

  let hit = siteCache.get(key);
  if (!hit || Date.now() - hit.at > 10 * SITE_TTL) {
    // nothing, or too old to show: fetch it now
    if (siteCache.size > 500) siteCache.clear();
    const loading = load();
    const entry: SiteEntry = { at: Date.now(), v: loading.then((r) => r.list) };
    loading.then(
      (r) => {
        entry.at = r.at;
      },
      () => {
        if (siteCache.get(key) === entry) siteCache.delete(key);
      }
    );
    hit = entry;
    siteCache.set(key, entry);
  } else if (Date.now() - hit.at > SITE_TTL && !hit.next) {
    // stale: show it, refresh behind it
    const old = hit;
    old.next = load().then(
      (r) => {
        siteCache.set(key, { at: r.at, v: Promise.resolve(r.list) });
      },
      () => {
        old.next = undefined;
      }
    );
  }

  const list = await hit.v;
  if (kind !== "tracks" || !s.viewerId || !list.items.length) return list;
  const ids = list.items.map((i) => i.id);
  const lovedRows = await db
    .select({ id: lovedTracks.trackId })
    .from(lovedTracks)
    .where(and(eq(lovedTracks.userId, s.viewerId), inArray(lovedTracks.trackId, ids)));
  const mine = new Set(lovedRows.map((r) => r.id));
  return { ...list, items: list.items.map((i) => ({ ...i, loved: mine.has(i.id) ? 1 : 0 })) };
}

type BaseTotals = { l: number; p: number } | null;
const baseOf = {
  artist: (id: number): Promise<BaseTotals> =>
    first(
      db.select({ l: artists.baseListeners, p: artists.basePlaycount }).from(artists).where(eq(artists.id, id)).limit(1)
    ),
  album: (id: number): Promise<BaseTotals> =>
    first(
      db.select({ l: albums.baseListeners, p: albums.basePlaycount }).from(albums).where(eq(albums.id, id)).limit(1)
    ),
  track: (id: number): Promise<BaseTotals> =>
    first(
      db.select({ l: tracks.baseListeners, p: tracks.basePlaycount }).from(tracks).where(eq(tracks.id, id)).limit(1)
    ),
};
const EMPTY = { playcount: 0, listeners: 0, artists: 0 };

/** All-time totals for a listener, an artist, or a listener's plays of one artist, from the running totals. */
async function tallied(s: Scope): Promise<Counts> {
  const mine = s.userId ? eq(userArtists.userId, s.userId) : undefined;
  const r = await first(
    db
      .select({
        playcount: sql<number>`COALESCE(SUM(${userArtists.plays}), 0)`,
        listeners: countDistinct(userArtists.userId),
        artists: countDistinct(userArtists.artistId),
      })
      .from(userArtists)
      .where(and(mine, s.artistId ? eq(userArtists.artistId, s.artistId) : undefined))
  );
  const albumCount = !s.artistId
    ? db
        .select({ c: count() })
        .from(userAlbums)
        .where(eq(userAlbums.userId, s.userId ?? 0))
    : db
        .select({ c: countDistinct(userAlbums.albumId) })
        .from(albums)
        .innerJoin(userAlbums, eq(userAlbums.albumId, albums.id))
        .where(and(eq(albums.artistId, s.artistId), s.userId ? eq(userAlbums.userId, s.userId) : undefined));
  const trackCount = !s.artistId
    ? db
        .select({ c: count() })
        .from(userTracks)
        .where(eq(userTracks.userId, s.userId ?? 0))
    : db
        .select({ c: countDistinct(userTracks.trackId) })
        .from(tracks)
        .innerJoin(userTracks, eq(userTracks.trackId, tracks.id))
        .where(and(eq(tracks.artistId, s.artistId), s.userId ? eq(userTracks.userId, s.userId) : undefined));
  return { ...(r ?? EMPTY), albums: await total(albumCount), tracks: await total(trackCount) };
}

function baseFor(s: Scope): Promise<BaseTotals> {
  if (s.trackId) return baseOf.track(s.trackId);
  if (s.albumId) return baseOf.album(s.albumId);
  if (s.artistId) return baseOf.artist(s.artistId);
  return Promise.resolve(null);
}

export async function counts(s: Scope): Promise<Counts> {
  if ((s.userId || s.artistId) && !s.albumId && !s.trackId && !s.artistIds && allTime(s)) {
    const r = await tallied(s);
    const b = !s.userId && s.artistId ? await baseOf.artist(s.artistId) : null;
    if (b) {
      r.listeners += b.l;
      r.playcount += b.p;
    }
    return r;
  }
  const row = await first(
    db
      .select({
        playcount: count(),
        listeners: countDistinct(scrobbles.userId),
        artists: countDistinct(scrobbles.artistId),
        albums: countDistinct(scrobbles.albumId),
        tracks: countDistinct(scrobbles.trackId),
      })
      .from(scrobbles)
      .where(within(s))
  );
  const r: Counts = row ?? { ...EMPTY, albums: 0, tracks: 0 };
  // all-time totals for a single artist, album or track include any imported base totals
  if (!s.userId && !s.artistIds && allTime(s)) {
    const b = await baseFor(s);
    if (b) {
      r.listeners += b.l;
      r.playcount += b.p;
    }
  }
  return r;
}

async function recentRows(s: Scope, limit = 50, offset = 0): Promise<TopList<RecentTrack>> {
  const w = within(s);
  const items = await db
    .select({
      id: scrobbles.id,
      playedAt: scrobbles.playedAt,
      trackId: tracks.id,
      title: tracks.title,
      duration: tracks.duration,
      artist: artists.name,
      album: albums.title,
      image: playImage(),
      user: users.username,
      userImage: users.imageId,
      loved: lovedBy(s.viewerId),
    })
    .from(scrobbles)
    .innerJoin(tracks, eq(tracks.id, scrobbles.trackId))
    .innerJoin(artists, eq(artists.id, scrobbles.artistId))
    .leftJoin(albums, eq(albums.id, sql`COALESCE(${scrobbles.albumId}, ${tracks.albumId})`))
    .innerJoin(users, eq(users.id, scrobbles.userId))
    .where(w)
    .orderBy(desc(scrobbles.playedAt), desc(scrobbles.id))
    .limit(limit)
    .offset(offset);
  const mine = s.userId && !s.artistId && !s.albumId && !s.trackId && !s.artistIds && allTime(s);
  const count_ = mine
    ? db
        .select({ c: sql<number>`COALESCE(SUM(${userArtists.plays}), 0)` })
        .from(userArtists)
        .where(eq(userArtists.userId, s.userId ?? 0))
    : db.select({ c: count() }).from(scrobbles).where(w);
  return { items, total: await total(count_) };
}

export function nowPlaying(userId: number, viewerId = 0): Promise<NowPlaying | null> {
  return first(
    db
      .select({
        trackId: tracks.id,
        title: tracks.title,
        duration: tracks.duration,
        artist: artists.name,
        album: albums.title,
        image: playImage(),
        startedAt: playing.startedAt,
        loved: lovedBy(viewerId),
      })
      .from(playing)
      .innerJoin(tracks, eq(tracks.id, playing.trackId))
      .innerJoin(artists, eq(artists.id, tracks.artistId))
      .leftJoin(albums, eq(albums.id, sql`COALESCE(${playing.albumId}, ${tracks.albumId})`))
      .where(and(eq(playing.userId, userId), gt(playing.expiresAt, now())))
      .limit(1)
  );
}

/** Plays for `seconds` plus a short grace period. */
export async function saveNowPlaying(userId: number, ref: TrackRef, seconds: number): Promise<void> {
  const row = { trackId: ref.trackId, albumId: ref.albumId, startedAt: now(), expiresAt: now() + seconds + 30 };
  await db
    .insert(playing)
    .values({ userId, ...row })
    .onConflictDoUpdate({ target: playing.userId, set: row });
}

/** With `trackId`, only while that track is still the one playing. */
export async function clearNowPlaying(userId: number, trackId?: number): Promise<void> {
  const which =
    trackId === undefined ? eq(playing.userId, userId) : and(eq(playing.userId, userId), eq(playing.trackId, trackId));
  const removed = await db.delete(playing).where(which).returning({ id: playing.userId });
  if (removed.length) listeningChanged(userId, "nowplaying");
}

type NewScrobble = TrackNames & { playedAt: number };
type Scrobbled = TrackRef & { id: number };

/** One entry per play, in order: where it was filed, or null when that play was already recorded. */
export async function recordScrobbles(
  userId: number,
  plays: NewScrobble[],
  source: string
): Promise<(Scrobbled | null)[]> {
  return transactRetry(async (tx) => {
    const out: (Scrobbled | null)[] = [];
    for (const play of plays) {
      const ref = await resolveTrackTx(tx, play);
      const [row] = await tx
        .insert(scrobbles)
        .values({
          userId,
          ...ref,
          playedAt: play.playedAt,
          source,
          sentArtist: play.artist,
          sentTrack: play.track,
          sentAlbum: play.album || null,
        })
        .onConflictDoNothing()
        .returning({ id: scrobbles.id });
      if (!row) {
        out.push(null);
        continue;
      }
      // a finished play ends the matching "now playing"
      await tx.delete(playing).where(and(eq(playing.userId, userId), eq(playing.trackId, ref.trackId)));
      out.push({ id: row.id, ...ref });
    }
    return out;
  });
}

/** Oldest first. `tzMin` is the reader's offset from UTC in minutes. */
export async function series(s: Scope, bucket: Bucket, tzMin = 0): Promise<SeriesPoint[]> {
  const k = timeBucket(scrobbles.playedAt, bucket, Math.round(tzMin) * 60).as("k");
  return db.select({ k, c: count() }).from(scrobbles).where(within(s)).groupBy(sql`1`).orderBy(sql`1`);
}

export async function firstScrobble(userId: number): Promise<number | null> {
  const row = await first(
    db
      .select({ t: min(scrobbles.playedAt) })
      .from(scrobbles)
      .where(eq(scrobbles.userId, userId))
  );
  return row?.t ?? null;
}

/** Most played first. "after" keeps tracks first played since `since`, "before" ones not played since. */
export async function tracksOnlyPlayed(
  userId: number,
  side: "after" | "before",
  since: number,
  limit: number
): Promise<number[]> {
  const edge =
    side === "after" ? gte(min(scrobbles.playedAt), since) : and(lt(max(scrobbles.playedAt), since), gte(count(), 3));
  const rows = await db
    .select({ id: scrobbles.trackId })
    .from(scrobbles)
    .where(eq(scrobbles.userId, userId))
    .groupBy(scrobbles.trackId)
    .having(edge)
    .orderBy(desc(count()))
    .limit(limit);
  return rows.map((r) => r.id);
}

const span = (userId: number, from: number, to: number) =>
  and(eq(scrobbles.userId, userId), gte(scrobbles.playedAt, from), lt(scrobbles.playedAt, to));

/** Tracks of unknown length count as three and a half minutes. */
export const listeningSeconds = (userId: number, from: number, to: number): Promise<number> =>
  total(
    db
      .select({
        c: sql<number>`COALESCE(SUM(CASE WHEN ${tracks.duration} > 0 THEN ${tracks.duration} ELSE 210 END), 0)`,
      })
      .from(scrobbles)
      .innerJoin(tracks, eq(tracks.id, scrobbles.trackId))
      .where(span(userId, from, to))
  );

/** Artists played in a span and never before it, most played first. */
export async function newArtists(
  userId: number,
  from: number,
  to: number
): Promise<{ name: string; image: string | null; playcount: number }[]> {
  const earlier = alias(scrobbles, "o");
  const playcount = count().as("playcount");
  const playedBefore = db
    .select({ one: sql`1` })
    .from(earlier)
    .where(
      and(eq(earlier.userId, scrobbles.userId), eq(earlier.artistId, scrobbles.artistId), lt(earlier.playedAt, from))
    );
  return db
    .select({ name: artists.name, image: artists.imageId, playcount })
    .from(scrobbles)
    .innerJoin(artists, eq(artists.id, scrobbles.artistId))
    .where(and(span(userId, from, to), notExists(playedBefore)))
    .groupBy(artists.id)
    .orderBy(desc(playcount));
}

/** The tags of the artists played in a span, weighted by plays. */
export async function playedTags(
  userId: number,
  from: number,
  to: number,
  limit = 8
): Promise<{ name: string; weight: number }[]> {
  const weight = count().as("weight");
  return db
    .select({ name: tags.name, weight })
    .from(scrobbles)
    .innerJoin(taggings, and(eq(taggings.itemType, "artist"), eq(taggings.itemId, scrobbles.artistId)))
    .innerJoin(tags, eq(tags.id, taggings.tagId))
    .where(span(userId, from, to))
    .groupBy(tags.id)
    .orderBy(desc(weight))
    .limit(limit);
}

// triggers normally keep the running totals in step with the scrobble log
async function rebuildTallies(): Promise<void> {
  await transact(async (tx) => {
    await tx.delete(userArtists);
    await tx.insert(userArtists).select(
      tx
        .select({ userId: scrobbles.userId, artistId: scrobbles.artistId, plays: count().as("plays") })
        .from(scrobbles)
        .groupBy(scrobbles.userId, scrobbles.artistId)
    );
    await tx.delete(userAlbums);
    await tx.insert(userAlbums).select(
      tx
        .select({
          userId: scrobbles.userId,
          albumId: sql<number>`${scrobbles.albumId}`.as("album_id"),
          plays: count().as("plays"),
        })
        .from(scrobbles)
        .where(isNotNull(scrobbles.albumId))
        .groupBy(scrobbles.userId, scrobbles.albumId)
    );
    await tx.delete(userTracks);
    await tx.insert(userTracks).select(
      tx
        .select({ userId: scrobbles.userId, trackId: scrobbles.trackId, plays: count().as("plays") })
        .from(scrobbles)
        .groupBy(scrobbles.userId, scrobbles.trackId)
    );
  });
}

export async function ensureTallies(): Promise<void> {
  const logged = await total(db.select({ c: count() }).from(scrobbles));
  const sum = (plays: typeof userArtists.plays | typeof userTracks.plays) => sql<number>`COALESCE(SUM(${plays}), 0)`;
  const artistPlays = await total(db.select({ c: sum(userArtists.plays) }).from(userArtists));
  if (artistPlays !== logged) return rebuildTallies();
  const trackPlays = await total(db.select({ c: sum(userTracks.plays) }).from(userTracks));
  if (trackPlays !== logged) return rebuildTallies();
}

export type Scrobble = typeof scrobbles.$inferSelect;
const own = (userId: number, id: number) => and(eq(scrobbles.id, id), eq(scrobbles.userId, userId));

export const findScrobble = (userId: number, id: number): Promise<Scrobble | null> =>
  first(db.select().from(scrobbles).where(own(userId, id)).limit(1));

export async function deleteScrobble(userId: number, id: number): Promise<boolean> {
  const gone = await db.delete(scrobbles).where(own(userId, id)).returning({ id: scrobbles.id });
  return gone.length > 0;
}

export async function deleteScrobbles(userId: number, ids: number[]): Promise<number> {
  const gone = await db
    .delete(scrobbles)
    .where(and(eq(scrobbles.userId, userId), inArray(scrobbles.id, ids)))
    .returning({ id: scrobbles.id });
  return gone.length;
}

export async function deleteAllScrobbles(
  userId: number,
  onDeleted?: (tx: Conn, deleted: number) => Promise<void>
): Promise<number> {
  return transact(async (tx) => {
    const n = await total(tx.select({ c: count() }).from(scrobbles).where(eq(scrobbles.userId, userId)));
    await tx.delete(scrobbles).where(eq(scrobbles.userId, userId));
    await onDeleted?.(tx, n);
    return n;
  });
}

/** How many of the listener's plays share this play's track, album and artist. */
export async function scopeCounts(s: Scrobble): Promise<ScopeCounts> {
  const n = (same: SQL) =>
    total(
      db
        .select({ c: count() })
        .from(scrobbles)
        .where(and(eq(scrobbles.userId, s.userId), same))
    );
  return {
    track: await n(eq(scrobbles.trackId, s.trackId)),
    album: s.albumId ? await n(eq(scrobbles.albumId, s.albumId)) : 0,
    artist: await n(eq(scrobbles.artistId, s.artistId)),
  };
}

/** False when the listener already has that track at the same second. */
export async function refileScrobble(id: number, ref: TrackRef): Promise<boolean> {
  try {
    await db
      .update(scrobbles)
      .set({ trackId: ref.trackId, artistId: ref.artistId, albumId: ref.albumId })
      .where(eq(scrobbles.id, id));
    return true;
  } catch {
    return false;
  }
}

/** An empty album means none. */
type BulkEdit = { scope: EditScope; artist: string; track: string; album: string };

/**
 * Applies the same correction to every play of the listener's that shares `src`'s track, album or artist.
 * Returns how many plays were changed. The caller checks that `src` has an album when the scope is "album".
 */
export async function refileScrobbles(src: Scrobble, edit: BulkEdit): Promise<number> {
  let shared: SQL;
  if (edit.scope === "track") shared = eq(scrobbles.trackId, src.trackId);
  else if (edit.scope === "album") shared = eq(scrobbles.albumId, src.albumId ?? 0);
  else shared = eq(scrobbles.artistId, src.artistId);

  return transact(async (tx) => {
    const artistId = await getOrCreateArtistTx(tx, edit.artist);
    const rows = await tx
      .select({
        id: scrobbles.id,
        trackId: scrobbles.trackId,
        albumId: scrobbles.albumId,
        playedAt: scrobbles.playedAt,
      })
      .from(scrobbles)
      .where(and(eq(scrobbles.userId, src.userId), shared));
    let srcAlbum = "";
    if (src.albumId) {
      const [a] = await tx.select({ title: albums.title }).from(albums).where(eq(albums.id, src.albumId));
      srcAlbum = a?.title || "";
    }
    const albumEdited = norm(edit.album) !== norm(srcAlbum);
    const movedAlbums = new Map<number, number>();
    const newTracks = new Map<string, number>();
    const gone = new Set<number>();

    const albumFor = async (old: number | null): Promise<number | null> => {
      if (edit.scope === "album" || (edit.scope === "track" && albumEdited)) {
        return edit.album ? await getOrCreateAlbumTx(tx, artistId, edit.album) : null;
      }
      if (!old) return null;
      let to = movedAlbums.get(old);
      if (to === undefined) {
        // an album filed under the old artist moves with the rename; anything else (a compilation, say) stays put
        const [a] = await tx
          .select({ artistId: albums.artistId, title: albums.title })
          .from(albums)
          .where(eq(albums.id, old));
        const moves = a && a.artistId === src.artistId && artistId !== src.artistId;
        to = moves ? await getOrCreateAlbumTx(tx, artistId, a.title) : old;
        movedAlbums.set(old, to);
      }
      return to;
    };

    let changed = 0;
    for (const r of rows) {
      const albumId = await albumFor(r.albumId);
      const key = `${r.trackId}:${albumId}`;
      let trackId = newTracks.get(key);
      if (trackId === undefined) {
        const [t] = await tx
          .select({ title: tracks.title, duration: tracks.duration })
          .from(tracks)
          .where(eq(tracks.id, r.trackId));
        const title = edit.scope === "track" ? edit.track : (t?.title ?? "");
        trackId = await getOrCreateTrackTx(tx, artistId, title, t?.duration ?? 0, albumId);
        newTracks.set(key, trackId);
      }
      if (gone.has(r.id)) continue;
      // two plays that become the same track at the same second are one play: the duplicate goes
      const dupes = await tx
        .delete(scrobbles)
        .where(
          and(
            eq(scrobbles.userId, src.userId),
            eq(scrobbles.trackId, trackId),
            eq(scrobbles.playedAt, r.playedAt),
            ne(scrobbles.id, r.id)
          )
        )
        .returning({ id: scrobbles.id });
      for (const d of dupes) gone.add(d.id);
      await tx.update(scrobbles).set({ trackId, artistId, albumId }).where(eq(scrobbles.id, r.id));
      changed++;
    }
    return changed;
  });
}

export async function setLoved(userId: number, trackId: number, loved: boolean): Promise<void> {
  if (loved) await db.insert(lovedTracks).values({ userId, trackId, createdAt: now() }).onConflictDoNothing();
  else await db.delete(lovedTracks).where(and(eq(lovedTracks.userId, userId), eq(lovedTracks.trackId, trackId)));
}

/** Returns how many were not loved already. */
export async function loveTracks(
  userId: number,
  list: { artist: string; track: string; lovedAt: number }[]
): Promise<number> {
  return transact(async (tx) => {
    let added = 0;
    for (const t of list) {
      const artistId = await getOrCreateArtistTx(tx, t.artist);
      const trackId = await getOrCreateTrackTx(tx, artistId, t.track);
      const [row] = await tx
        .insert(lovedTracks)
        .values({ userId, trackId, createdAt: t.lovedAt })
        .onConflictDoNothing()
        .returning({ trackId: lovedTracks.trackId });
      if (row) added++;
    }
    return added;
  });
}

export const exportScrobbles = (userId: number): Promise<ExportRow[]> =>
  db
    .select({ artist: artists.name, album: albums.title, track: tracks.title, timestamp: scrobbles.playedAt })
    .from(scrobbles)
    .innerJoin(tracks, eq(tracks.id, scrobbles.trackId))
    .innerJoin(artists, eq(artists.id, scrobbles.artistId))
    .leftJoin(albums, eq(albums.id, scrobbles.albumId))
    .where(eq(scrobbles.userId, userId))
    .orderBy(desc(scrobbles.playedAt));

export const exportLoved = (userId: number): Promise<ExportRow[]> =>
  db
    .select({ artist: artists.name, album: albums.title, track: tracks.title, timestamp: lovedTracks.createdAt })
    .from(lovedTracks)
    .innerJoin(tracks, eq(tracks.id, lovedTracks.trackId))
    .innerJoin(artists, eq(artists.id, tracks.artistId))
    .leftJoin(albums, eq(albums.id, tracks.albumId))
    .where(eq(lovedTracks.userId, userId))
    .orderBy(desc(lovedTracks.createdAt));

export async function dropExpiredNowPlaying(): Promise<void> {
  const expired = await db.delete(playing).where(lt(playing.expiresAt, now())).returning({ userId: playing.userId });
  for (const { userId } of expired) listeningChanged(userId, "nowplaying");
}

export async function topArtists(s: Scope, limit = 50, offset = 0): Promise<TopList<TopArtist>> {
  const r = await topArtistsRows(s, limit, offset);
  wantBare("artist", r.items, (r) => r.id);
  return r;
}

export async function topAlbums(s: Scope, limit = 50, offset = 0): Promise<TopList<TopAlbum>> {
  const r = await topAlbumsRows(s, limit, offset);
  wantBare("album", r.items, (r) => r.id);
  return r;
}

export async function topTracks(s: Scope, limit = 50, offset = 0): Promise<TopList<TopTrack>> {
  const r = await topTracksRows(s, limit, offset);
  wantCovers(r.items, (r) => r.id);
  return r;
}

export async function recent(s: Scope, limit = 50, offset = 0): Promise<TopList<RecentTrack>> {
  const r = await recentRows(s, limit, offset);
  wantCovers(r.items, (r) => r.trackId);
  return r;
}
