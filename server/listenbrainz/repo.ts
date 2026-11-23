import { and, asc, count, desc, eq, gt, gte, inArray, lt, max, min, sql, type SQL } from "drizzle-orm";
import { db } from "../db/client";
import { albums, artists, listenImports, lovedTracks, recordingMbids, scrobbles, tracks, users } from "../db/schema";
import { like, norm } from "../util";

export type Listen = {
  playedAt: number;
  trackId: number;
  title: string;
  duration: number;
  artist: string;
  artistMbid: string | null;
  album: string | null;
  albumMbid: string | null;
  recordingMbid: string | null;
};

const recordingMbid = (trackId: SQL | typeof tracks.id) =>
  sql<
    string | null
  >`(SELECT ${recordingMbids.mbid} FROM ${recordingMbids} WHERE ${recordingMbids.trackId} = ${trackId} LIMIT 1)`;

const listenCols = {
  trackId: tracks.id,
  title: tracks.title,
  duration: tracks.duration,
  artist: artists.name,
  artistMbid: artists.mbid,
  album: albums.title,
  albumMbid: albums.mbid,
  recordingMbid: recordingMbid(tracks.id),
};

/** Newest first. Only `min` given pages forward from it, as ListenBrainz does. */
export async function listens(userId: number, min_: number, max_: number, limit: number): Promise<Listen[]> {
  const c = [eq(scrobbles.userId, userId)];
  if (min_) c.push(gt(scrobbles.playedAt, min_));
  if (max_) c.push(lt(scrobbles.playedAt, max_));
  const forward = !!min_ && !max_;
  const rows = await db
    .select({ playedAt: scrobbles.playedAt, ...listenCols })
    .from(scrobbles)
    .innerJoin(tracks, eq(tracks.id, scrobbles.trackId))
    .innerJoin(artists, eq(artists.id, tracks.artistId))
    .leftJoin(albums, eq(albums.id, scrobbles.albumId))
    .where(and(...c))
    .orderBy(forward ? asc(scrobbles.playedAt) : desc(scrobbles.playedAt))
    .limit(limit);
  return forward ? rows.reverse() : rows;
}

export async function listenSpan(userId: number): Promise<{ oldest: number; latest: number; count: number }> {
  const [r] = await db
    .select({ oldest: min(scrobbles.playedAt), latest: max(scrobbles.playedAt), count: count() })
    .from(scrobbles)
    .where(eq(scrobbles.userId, userId));
  return { oldest: r?.oldest ?? 0, latest: r?.latest ?? 0, count: r?.count ?? 0 };
}

export async function trackListen(trackId: number): Promise<Omit<Listen, "playedAt"> | null> {
  const [r] = await db
    .select(listenCols)
    .from(tracks)
    .innerJoin(artists, eq(artists.id, tracks.artistId))
    .leftJoin(albums, eq(albums.id, tracks.albumId))
    .where(eq(tracks.id, trackId));
  return r ?? null;
}

export async function scrobbleAt(userId: number, trackId: number, playedAt: number): Promise<number | null> {
  const [r] = await db
    .select({ id: scrobbles.id })
    .from(scrobbles)
    .where(and(eq(scrobbles.userId, userId), eq(scrobbles.trackId, trackId), eq(scrobbles.playedAt, playedAt)));
  return r?.id ?? null;
}

export async function saveRecordingMbids(pairs: { mbid: string; trackId: number }[]): Promise<void> {
  if (pairs.length) await db.insert(recordingMbids).values(pairs).onConflictDoNothing();
}

export async function trackOfRecording(mbid: string): Promise<number | null> {
  const [r] = await db
    .select({ trackId: recordingMbids.trackId })
    .from(recordingMbids)
    .where(eq(recordingMbids.mbid, mbid));
  return r?.trackId ?? null;
}

export async function recordingsOf(trackIds: number[]): Promise<Map<number, string>> {
  if (!trackIds.length) return new Map();
  const rows = await db
    .select({ trackId: recordingMbids.trackId, mbid: recordingMbids.mbid })
    .from(recordingMbids)
    .where(inArray(recordingMbids.trackId, trackIds));
  return new Map(rows.map((r) => [r.trackId, r.mbid]));
}

export async function tracksOfRecordings(mbids: string[]): Promise<Map<string, number>> {
  if (!mbids.length) return new Map();
  const rows = await db
    .select({ mbid: recordingMbids.mbid, trackId: recordingMbids.trackId })
    .from(recordingMbids)
    .where(inArray(recordingMbids.mbid, [...new Set(mbids)]));
  return new Map(rows.map((r) => [r.mbid, r.trackId]));
}

export async function mbidsOf(table: typeof artists | typeof albums, ids: number[]): Promise<Map<number, string>> {
  if (!ids.length) return new Map();
  const rows = await db.select({ id: table.id, mbid: table.mbid }).from(table).where(inArray(table.id, ids));
  return new Map(rows.filter((r) => r.mbid).map((r) => [r.id, r.mbid!]));
}

export async function artistMbidsOf(table: typeof albums | typeof tracks, ids: number[]): Promise<Map<number, string>> {
  if (!ids.length) return new Map();
  const rows = await db
    .select({ id: table.id, mbid: artists.mbid })
    .from(table)
    .innerJoin(artists, eq(artists.id, table.artistId))
    .where(inArray(table.id, ids));
  return new Map(rows.filter((r) => r.mbid).map((r) => [r.id, r.mbid!]));
}

export type Love = { trackId: number; at: number; userId: number; username: string };

const loveCols = {
  trackId: lovedTracks.trackId,
  at: lovedTracks.createdAt,
  userId: users.id,
  username: users.username,
};

export async function lovesOf(
  userId: number,
  limit: number,
  offset: number
): Promise<{ items: Love[]; total: number }> {
  const w = eq(lovedTracks.userId, userId);
  const items = await db
    .select(loveCols)
    .from(lovedTracks)
    .innerJoin(users, eq(users.id, lovedTracks.userId))
    .where(w)
    .orderBy(desc(lovedTracks.createdAt))
    .limit(limit)
    .offset(offset);
  const [t] = await db.select({ c: count() }).from(lovedTracks).where(w);
  return { items, total: t?.c ?? 0 };
}

export const lovesAmong = (userId: number, trackIds: number[]): Promise<Love[]> =>
  trackIds.length
    ? db
        .select(loveCols)
        .from(lovedTracks)
        .innerJoin(users, eq(users.id, lovedTracks.userId))
        .where(and(eq(lovedTracks.userId, userId), inArray(lovedTracks.trackId, trackIds)))
    : Promise.resolve([]);

const openLover = and(eq(users.privateListening, false), eq(users.banned, false));

export async function loversOf(
  trackId: number,
  limit: number,
  offset: number
): Promise<{ items: Love[]; total: number }> {
  const w = and(eq(lovedTracks.trackId, trackId), openLover);
  const items = await db
    .select(loveCols)
    .from(lovedTracks)
    .innerJoin(users, eq(users.id, lovedTracks.userId))
    .where(w)
    .orderBy(desc(lovedTracks.createdAt))
    .limit(limit)
    .offset(offset);
  const [t] = await db
    .select({ c: count() })
    .from(lovedTracks)
    .innerJoin(users, eq(users.id, lovedTracks.userId))
    .where(w);
  return { items, total: t?.c ?? 0 };
}

export async function latestImport(userId: number, service: string): Promise<number> {
  const [r] = await db
    .select({ ts: listenImports.ts })
    .from(listenImports)
    .where(and(eq(listenImports.userId, userId), eq(listenImports.service, service)));
  return r?.ts ?? 0;
}

export async function setLatestImport(userId: number, service: string, ts: number): Promise<void> {
  await db
    .insert(listenImports)
    .values({ userId, service, ts })
    .onConflictDoUpdate({ target: [listenImports.userId, listenImports.service], set: { ts } });
}

export const searchUsers = (term: string): Promise<{ username: string }[]> =>
  db
    .select({ username: users.username })
    .from(users)
    .where(and(sql`${users.usernameNorm} LIKE ${like(norm(term))}`, eq(users.banned, false)))
    .orderBy(sql`length(${users.usernameNorm})`, asc(users.usernameNorm))
    .limit(10);

export async function byMbid(table: typeof artists | typeof albums, mbid: string) {
  const name = table === artists ? artists.name : albums.title;
  const [r] = await db.select({ id: table.id, name }).from(table).where(eq(table.mbid, mbid)).limit(1);
  return r ?? null;
}

/** The people who played the artist or album most, leaving out anyone who keeps their listening private. */
export async function topListeners(where: SQL, from: number, to: number, limit: number) {
  const w = and(
    where,
    gte(scrobbles.playedAt, from),
    lt(scrobbles.playedAt, to),
    eq(users.privateListening, false),
    eq(users.banned, false)
  );
  const plays = count().as("plays");
  const items = await db
    .select({ username: users.username, plays })
    .from(scrobbles)
    .innerJoin(users, eq(users.id, scrobbles.userId))
    .where(w)
    .groupBy(users.id)
    .orderBy(desc(plays))
    .limit(limit);
  const [t] = await db
    .select({ plays: count(), people: sql<number>`count(DISTINCT ${scrobbles.userId})::int` })
    .from(scrobbles)
    .innerJoin(users, eq(users.id, scrobbles.userId))
    .where(w);
  return { items, plays: t?.plays ?? 0, people: t?.people ?? 0 };
}

export type Bucket = "day" | "month" | "year";

export const activity = (userId: number, bucket: Bucket, from: number, to: number) =>
  db.execute<{ start: number; plays: number }>(sql`
    SELECT extract(epoch FROM date_trunc(${bucket}, to_timestamp(${scrobbles.playedAt}) AT TIME ZONE 'UTC'))::int AS start,
      count(*)::int AS plays
    FROM ${scrobbles}
    WHERE ${scrobbles.userId} = ${userId} AND ${scrobbles.playedAt} >= ${from} AND ${scrobbles.playedAt} < ${to}
    GROUP BY 1`);

export const hourly = (userId: number, from: number, to: number) =>
  db.execute<{ dow: number; hour: number; plays: number }>(sql`
    SELECT extract(isodow FROM to_timestamp(${scrobbles.playedAt}) AT TIME ZONE 'UTC')::int AS dow,
      extract(hour FROM to_timestamp(${scrobbles.playedAt}) AT TIME ZONE 'UTC')::int AS hour,
      count(*)::int AS plays
    FROM ${scrobbles}
    WHERE ${scrobbles.userId} = ${userId} AND ${scrobbles.playedAt} >= ${from} AND ${scrobbles.playedAt} < ${to}
    GROUP BY 1, 2`);
