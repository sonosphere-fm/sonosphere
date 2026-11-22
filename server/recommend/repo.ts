import { and, asc, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { trackImage } from "../catalog/art";
import { db, transact } from "../db/client";
export { databaseUrl } from "../db/client";
import {
  albums,
  artists,
  lovedTracks,
  meta,
  scrobbles,
  similarArtists,
  taggings,
  tasteFactors,
  tasteNorms,
  tasteQueue,
  tracks,
  userArtists,
  userNeighbours,
  userTracks,
  users,
} from "../db/schema";
import type { TopTrack } from "../../shared/listening";
import { now } from "../util";
import { flag } from "../db/dialect";

type Kind = "artist" | "user";
// log-scaled so one obsessive listener does not outweigh many casual ones
const weight = (plays: unknown) => sql`ln(1 + ${plays})`;
const WATERMARK = "taste_watermark";
const rowsOf = async <T>(query: SQL): Promise<T[]> => [...(await db.execute(query))] as T[];
const maxScrobbleId = sql<number>`COALESCE(MAX(${scrobbles.id}), 0)`;
const listenerCount = sql<number>`((SELECT COUNT(*) FROM ${userArtists} WHERE ${userArtists.artistId} = ${artists.id}) + ${artists.baseListeners})`;
const idList = (ids: number[]) =>
  sql.join(
    ids.map((id) => sql`${id}`),
    sql`, `
  );

/** Queues every artist and user scrobbled since the last call. Returns how many scrobbles were new. */
export async function queueChanged(): Promise<number> {
  return transact(async (tx) => {
    const mark = (await tx.select({ value: meta.value }).from(meta).where(eq(meta.key, WATERMARK)))[0];
    const last = (await tx.select({ id: maxScrobbleId }).from(scrobbles))[0]?.id ?? 0;
    const at = now();
    const queuedAt = sql<number>`${at}::integer`.as("queued_at");
    const artistKind = sql<string>`'artist'`.as("kind");
    const userKind = sql<string>`'user'`.as("kind");
    if (!mark) {
      // first run: everything with any listening is due
      const artistRows = tx.selectDistinct({ kind: artistKind, id: userArtists.artistId, queuedAt }).from(userArtists);
      const userRows = tx.selectDistinct({ kind: userKind, id: userArtists.userId, queuedAt }).from(userArtists);
      await tx.insert(tasteQueue).select(artistRows).onConflictDoNothing();
      await tx.insert(tasteQueue).select(userRows).onConflictDoNothing();
    } else {
      const from = Number(mark.value) || 0;
      if (last <= from) return 0;
      const fresh = and(sql`${scrobbles.id} > ${from}`, sql`${scrobbles.id} <= ${last}`);
      const artistRows = tx
        .selectDistinct({ kind: artistKind, id: scrobbles.artistId, queuedAt })
        .from(scrobbles)
        .where(fresh);
      const userRows = tx
        .selectDistinct({ kind: userKind, id: scrobbles.userId, queuedAt })
        .from(scrobbles)
        .where(fresh);
      await tx.insert(tasteQueue).select(artistRows).onConflictDoNothing();
      await tx.insert(tasteQueue).select(userRows).onConflictDoNothing();
    }
    await tx
      .insert(meta)
      .values({ key: WATERMARK, value: String(last) })
      .onConflictDoUpdate({ target: meta.key, set: { value: String(last) } });
    return last - (Number(mark?.value) || 0);
  });
}

export async function queue(kind: Kind, id: number) {
  await db.insert(tasteQueue).values({ kind, id, queuedAt: now() }).onConflictDoNothing();
}

export async function due(limit: number): Promise<{ kind: Kind; id: number }[]> {
  const rows = await db
    .select({ kind: tasteQueue.kind, id: tasteQueue.id })
    .from(tasteQueue)
    .orderBy(asc(tasteQueue.queuedAt))
    .limit(limit);
  return rows.map((r) => ({ kind: r.kind === "user" ? "user" : "artist", id: r.id }));
}

export async function done(kind: Kind, id: number) {
  await db.delete(tasteQueue).where(and(eq(tasteQueue.kind, kind), eq(tasteQueue.id, id)));
}

export async function refreshNorms(kind: Kind, ids: number[]) {
  if (!ids.length) return;
  const key = kind === "artist" ? userArtists.artistId : userArtists.userId;
  const norm = sql<number>`sqrt(SUM(${weight(userArtists.plays)} * ${weight(userArtists.plays)}))`;
  const rows = await db.select({ id: key, norm }).from(userArtists).where(inArray(key, ids)).groupBy(key);
  if (!rows.length) return;
  const at = now();
  await db
    .insert(tasteNorms)
    .values(rows.map((r) => ({ kind, id: r.id, norm: r.norm, computedAt: at })))
    .onConflictDoUpdate({
      target: [tasteNorms.kind, tasteNorms.id],
      set: { norm: sql`excluded.norm`, computedAt: at },
    });
}

/** Stored figures of one kind, without computing missing ones. */
export async function storedNorms(kind: string, ids: number[]): Promise<Map<number, number>> {
  if (!ids.length) return new Map();
  const rows = await db
    .select({ id: tasteNorms.id, norm: tasteNorms.norm })
    .from(tasteNorms)
    .where(and(eq(tasteNorms.kind, kind), inArray(tasteNorms.id, ids)));
  return new Map(rows.map((r) => [r.id, r.norm]));
}

/** Stored vector lengths, computing any that are missing. */
export async function norms(kind: Kind, ids: number[]): Promise<Map<number, number>> {
  if (!ids.length) return new Map();
  let found = await storedNorms(kind, ids);
  const absent = ids.filter((id) => !found.has(id));
  if (absent.length) {
    await refreshNorms(kind, absent);
    found = await storedNorms(kind, ids);
  }
  return found;
}

export async function saveNorm(kind: string, id: number, norm: number) {
  await db
    .insert(tasteNorms)
    .values({ kind, id, norm, computedAt: now() })
    .onConflictDoUpdate({ target: [tasteNorms.kind, tasteNorms.id], set: { norm, computedAt: now() } });
}

/** Only the artist's top `fans` listeners are read, so a hugely popular artist costs the same as a small one. */
export async function artistOverlap(artistId: number, fans: number, limit: number) {
  const rows = await rowsOf<{ id: number; dot: number; own: number; fans: number }>(sql`
    WITH fans AS (SELECT ${userArtists.userId} AS user_id, ${weight(userArtists.plays)} AS w FROM ${userArtists}
      WHERE ${userArtists.artistId} = ${artistId} ORDER BY ${userArtists.plays} DESC LIMIT ${fans})
    SELECT y.artist_id AS id, SUM(fans.w * ln(1 + y.plays)) AS dot, (SELECT sqrt(SUM(w * w)) FROM fans) AS own, (SELECT COUNT(*) FROM fans) AS fans
    FROM fans JOIN ${userArtists} y ON y.user_id = fans.user_id
    WHERE y.artist_id != ${artistId} GROUP BY y.artist_id ORDER BY dot DESC, y.artist_id LIMIT ${limit}`);
  return {
    own: rows[0]?.own ?? 0,
    fans: rows[0]?.fans ?? 0,
    others: rows.map((r) => ({ id: r.id, dot: r.dot })),
  };
}

export async function artistTagSets(ids: number[]): Promise<Map<number, Set<number>>> {
  const sets = new Map<number, Set<number>>();
  if (!ids.length) return sets;
  const rows = await db
    .selectDistinct({ artist: taggings.itemId, tag: taggings.tagId })
    .from(taggings)
    .where(and(eq(taggings.itemType, "artist"), inArray(taggings.itemId, ids)));
  for (const r of rows) {
    let s = sets.get(r.artist);
    if (!s) {
      s = new Set();
      sets.set(r.artist, s);
    }
    s.add(r.tag);
  }
  return sets;
}

/**
 * Each match is also written the other way round, so the other artist's list picks it up without waiting for its
 * own refresh. Matches that came with imported data are left alone.
 */
export async function saveSimilar(artistId: number, matches: { id: number; score: number }[]) {
  await transact(async (tx) => {
    await tx
      .delete(similarArtists)
      .where(and(eq(similarArtists.artistId, artistId), eq(similarArtists.source, "computed")));
    if (!matches.length) return;
    await tx
      .insert(similarArtists)
      .values(matches.map((m) => ({ artistId, similarId: m.id, score: m.score })))
      .onConflictDoNothing();
    await tx
      .insert(similarArtists)
      .values(matches.map((m) => ({ artistId: m.id, similarId: artistId, score: m.score })))
      .onConflictDoUpdate({
        target: [similarArtists.artistId, similarArtists.similarId],
        set: { score: sql`excluded.score` },
        setWhere: eq(similarArtists.source, "computed"),
      });
  });
}

export async function similarIds(artistId: number, limit: number) {
  return db
    .select({ id: similarArtists.similarId, score: similarArtists.score })
    .from(similarArtists)
    .where(eq(similarArtists.artistId, artistId))
    .orderBy(desc(similarArtists.score), asc(similarArtists.similarId))
    .limit(limit);
}

export async function similarArtistRows(artistId: number, limit: number) {
  return db
    .select({
      id: artists.id,
      name: artists.name,
      image: artists.imageId,
      match: similarArtists.score,
      listeners: listenerCount,
    })
    .from(similarArtists)
    .innerJoin(artists, eq(artists.id, similarArtists.similarId))
    .where(eq(similarArtists.artistId, artistId))
    .orderBy(desc(similarArtists.score), asc(similarArtists.similarId))
    .limit(limit);
}

export async function topWeights(userId: number, limit: number) {
  return db
    .select({ artist: userArtists.artistId, plays: userArtists.plays, w: sql<number>`${weight(userArtists.plays)}` })
    .from(userArtists)
    .where(eq(userArtists.userId, userId))
    .orderBy(desc(userArtists.plays), asc(userArtists.artistId))
    .limit(limit);
}

export async function topListeners(artistId: number, limit: number) {
  return db
    .select({ user: userArtists.userId, w: sql<number>`${weight(userArtists.plays)}` })
    .from(userArtists)
    .where(eq(userArtists.artistId, artistId))
    .orderBy(desc(userArtists.plays))
    .limit(limit);
}

export async function userOverlap(userId: number, others: number[], depth: number): Promise<Map<number, number>> {
  if (!others.length) return new Map();
  const rows = await rowsOf<{ id: number; dot: number }>(sql`
    WITH mine AS (SELECT ${userArtists.artistId} AS artist_id, ${weight(userArtists.plays)} AS w FROM ${userArtists}
      WHERE ${userArtists.userId} = ${userId} ORDER BY ${userArtists.plays} DESC LIMIT ${depth})
    SELECT y.user_id AS id, SUM(mine.w * ln(1 + y.plays)) AS dot
    FROM mine JOIN ${userArtists} y ON y.artist_id = mine.artist_id
    WHERE y.user_id IN (${idList(others)}) GROUP BY y.user_id`);
  return new Map(rows.map((r) => [r.id, r.dot]));
}

export async function saveNeighbours(userId: number, matches: { id: number; score: number }[]) {
  await transact(async (tx) => {
    await tx.delete(userNeighbours).where(eq(userNeighbours.userId, userId));
    if (!matches.length) return;
    await tx
      .insert(userNeighbours)
      .values(matches.map((m) => ({ userId, neighbourId: m.id, score: m.score })))
      .onConflictDoNothing();
  });
}

export async function neighbourRows(userId: number, limit: number) {
  return db
    .select({
      id: users.id,
      username: users.username,
      realname: users.realname,
      country: users.country,
      image: users.imageId,
      match: userNeighbours.score,
    })
    .from(userNeighbours)
    .innerJoin(users, eq(users.id, userNeighbours.neighbourId))
    .where(and(eq(userNeighbours.userId, userId), eq(users.privateListening, false)))
    .orderBy(desc(userNeighbours.score), asc(users.id))
    .limit(limit);
}

export async function sharedArtists(a: number, b: number, limit = 5) {
  return rowsOf<{ name: string; image: string | null; weight: number }>(sql`
    SELECT ar.name AS name, ar.image_id AS image, LEAST(x.plays, y.plays) AS weight FROM ${userArtists} x
      JOIN ${userArtists} y ON y.artist_id = x.artist_id AND y.user_id = ${b} JOIN ${artists} ar ON ar.id = x.artist_id
    WHERE x.user_id = ${a} ORDER BY weight DESC LIMIT ${limit}`);
}

/** Cosine similarity of two users' listening, worked out on the spot. */
export async function userSimilarity(a: number, b: number): Promise<number> {
  const [row] = await rowsOf<{ dot: number | null; na: number | null; nb: number | null }>(sql`
    SELECT (SELECT SUM(ln(1 + x.plays) * ln(1 + y.plays)) FROM ${userArtists} x JOIN ${userArtists} y ON y.user_id = ${b} AND y.artist_id = x.artist_id WHERE x.user_id = ${a}) AS dot,
      (SELECT SUM(ln(1 + plays) * ln(1 + plays)) FROM ${userArtists} WHERE user_id = ${a}) AS na,
      (SELECT SUM(ln(1 + plays) * ln(1 + plays)) FROM ${userArtists} WHERE user_id = ${b}) AS nb`);
  if (!row?.dot || !row.na || !row.nb) return 0;
  return row.dot / Math.sqrt(row.na * row.nb);
}

export async function library(userId: number) {
  return db
    .select({ id: userArtists.artistId, name: artists.name, c: userArtists.plays })
    .from(userArtists)
    .innerJoin(artists, eq(artists.id, userArtists.artistId))
    .where(eq(userArtists.userId, userId))
    .orderBy(desc(userArtists.plays));
}

export async function similarFor(artistIds: number[]) {
  if (!artistIds.length) return [];
  return db
    .select({ from: similarArtists.artistId, id: similarArtists.similarId, score: similarArtists.score })
    .from(similarArtists)
    .where(inArray(similarArtists.artistId, artistIds));
}

export async function artistCards(ids: number[]) {
  if (!ids.length) return [];
  return db
    .select({ id: artists.id, name: artists.name, image: artists.imageId, listeners: listenerCount })
    .from(artists)
    .where(inArray(artists.id, ids));
}

/**
 * Artists played straight before or after this one by the same person (within `gap` seconds), from its latest
 * `sample` plays. Each person counts with diminishing returns, so one listener's habit does not swamp the rest.
 */
export async function sessionNeighbours(
  artistId: number,
  sample: number,
  gap: number
): Promise<{ total: number; rows: { id: number; w: number }[] }> {
  const rows = await rowsOf<{ id: number; w: number }>(sql`
    WITH s AS (SELECT user_id, played_at FROM ${scrobbles} WHERE artist_id = ${artistId} ORDER BY played_at DESC LIMIT ${sample}),
    nb AS (
      SELECT s.user_id AS u, (SELECT x.artist_id FROM ${scrobbles} x WHERE x.user_id = s.user_id AND x.played_at > s.played_at AND x.played_at <= s.played_at + ${gap} ORDER BY x.played_at LIMIT 1) AS b FROM s
      UNION ALL
      SELECT s.user_id, (SELECT x.artist_id FROM ${scrobbles} x WHERE x.user_id = s.user_id AND x.played_at < s.played_at AND x.played_at >= s.played_at - ${gap} ORDER BY x.played_at DESC LIMIT 1) FROM s),
    per AS (SELECT b, COUNT(*) AS n FROM nb WHERE b IS NOT NULL AND b != ${artistId} GROUP BY b, u)
    SELECT b AS id, SUM(ln(1 + n)) AS w FROM per GROUP BY b`);
  return { total: rows.reduce((t, r) => t + r.w, 0), rows };
}

/** Each play counts less the older it is (`scale` seconds to fall to 1/e). */
export async function recentWeights(userId: number, since: number, scale: number, cap: number) {
  return rowsOf<{ id: number; w: number }>(sql`
    SELECT artist_id AS id, SUM(exp(-(${now()} - played_at) / ${scale}::double precision)) AS w FROM
      (SELECT artist_id, played_at FROM ${scrobbles} WHERE user_id = ${userId} AND played_at >= ${since} ORDER BY played_at DESC LIMIT ${cap}) recent
    GROUP BY artist_id`);
}

/** The top artists of a user's closest neighbours, weighted by how close each neighbour is. */
export async function neighbourArtists(userId: number, neighbours: number, per: number) {
  return rowsOf<{ id: number; w: number }>(sql`
    WITH nb AS (SELECT neighbour_id AS id, score FROM ${userNeighbours} WHERE user_id = ${userId} ORDER BY score DESC LIMIT ${neighbours})
    SELECT ua.artist_id AS id, SUM(nb.score * ln(1 + ua.plays)) AS w FROM nb JOIN ${userArtists} ua ON ua.user_id = nb.id
      AND ua.artist_id IN (SELECT artist_id FROM ${userArtists} WHERE user_id = nb.id ORDER BY plays DESC LIMIT ${per})
    GROUP BY ua.artist_id`);
}

export async function neighbourCount(userId: number): Promise<number> {
  const rows = await db
    .select({ c: sql<number>`COUNT(*)` })
    .from(userNeighbours)
    .where(eq(userNeighbours.userId, userId));
  return rows[0]?.c ?? 0;
}

// a track played once is still worth suggesting
const TRACK_KNOWN = 2;

/** Tracks a user's closest neighbours play most that the user has not really heard. */
export async function neighbourTracks(userId: number, neighbours: number, per: number) {
  return rowsOf<{ id: number; artist: number; w: number }>(sql`
    WITH nb AS (SELECT neighbour_id AS id, score FROM ${userNeighbours} WHERE user_id = ${userId} ORDER BY score DESC LIMIT ${neighbours})
    SELECT t.id AS id, t.artist_id AS artist, SUM(nb.score * ln(1 + ut.plays)) AS w FROM nb JOIN ${userTracks} ut ON ut.user_id = nb.id
      AND ut.track_id IN (SELECT track_id FROM ${userTracks} WHERE user_id = nb.id ORDER BY plays DESC LIMIT ${per})
      JOIN ${tracks} t ON t.id = ut.track_id
    WHERE NOT EXISTS (SELECT 1 FROM ${userTracks} m WHERE m.user_id = ${userId} AND m.track_id = ut.track_id AND m.plays >= ${TRACK_KNOWN})
    GROUP BY t.id`);
}

/** Each artist's `per` most heard tracks that the user has not really heard. */
export async function unplayedTopTracks(artistIds: number[], userId: number, per: number) {
  if (!artistIds.length) return [];
  return rowsOf<{ id: number; artist: number; r: number }>(sql`
    SELECT id, artist, r FROM (SELECT t.id AS id, t.artist_id AS artist, ROW_NUMBER() OVER (PARTITION BY t.artist_id
        ORDER BY t.base_listeners + (SELECT COUNT(*) FROM ${userTracks} x WHERE x.track_id = t.id) DESC, t.id) AS r
      FROM ${tracks} t WHERE t.artist_id IN (${idList(artistIds)})
        AND NOT EXISTS (SELECT 1 FROM ${userTracks} m WHERE m.user_id = ${userId} AND m.track_id = t.id AND m.plays >= ${TRACK_KNOWN})) ranked
    WHERE r <= ${per}`);
}

export async function trackCards(ids: number[], viewerId: number): Promise<TopTrack[]> {
  if (!ids.length) return [];
  return db
    .select({
      id: tracks.id,
      title: tracks.title,
      duration: tracks.duration,
      artist: artists.name,
      album: albums.title,
      image: trackImage(),
      playcount: sql<number>`${tracks.basePlaycount} + COALESCE((SELECT SUM(plays) FROM ${userTracks} WHERE track_id = ${tracks.id}), 0)`,
      listeners: sql<number>`${tracks.baseListeners} + (SELECT COUNT(*) FROM ${userTracks} WHERE track_id = ${tracks.id})`,
      loved: flag(sql`EXISTS (SELECT 1 FROM ${lovedTracks} WHERE user_id = ${viewerId} AND track_id = ${tracks.id})`),
    })
    .from(tracks)
    .innerJoin(artists, eq(artists.id, tracks.artistId))
    .leftJoin(albums, eq(albums.id, tracks.albumId))
    .where(inArray(tracks.id, ids));
}

type ModelInfo = { at: number; k: number; quality: number };

export async function modelInfo(): Promise<ModelInfo | null> {
  const value = await getMeta("taste_model");
  if (value === null) return null;
  try {
    return JSON.parse(value) as ModelInfo;
  } catch {
    return null;
  }
}

const floats = (b: Uint8Array) => new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));

export async function artistVectors(): Promise<{ id: number; vec: Float32Array }[]> {
  const rows = await db
    .select({ id: tasteFactors.id, vec: tasteFactors.vec })
    .from(tasteFactors)
    .where(eq(tasteFactors.kind, "artist"));
  return rows.map((r) => ({ id: r.id, vec: floats(r.vec) }));
}

export async function userVector(userId: number): Promise<Float32Array | null> {
  const rows = await db
    .select({ vec: tasteFactors.vec })
    .from(tasteFactors)
    .where(and(eq(tasteFactors.kind, "user"), eq(tasteFactors.id, userId)));
  return rows[0] ? floats(rows[0].vec) : null;
}

/** The newest scrobble id, to tell when there is enough new listening to retrain. */
export async function scrobbleMark(): Promise<number> {
  return (await db.select({ id: maxScrobbleId }).from(scrobbles))[0]?.id ?? 0;
}

export async function getMeta(key: string): Promise<string | null> {
  return (await db.select({ value: meta.value }).from(meta).where(eq(meta.key, key)))[0]?.value ?? null;
}

export async function saveMeta(key: string, value: string) {
  await db.insert(meta).values({ key, value }).onConflictDoUpdate({ target: meta.key, set: { value } });
}
