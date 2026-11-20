// Data access for taste matching: similar artists, listening neighbours and the queue of what needs refreshing.
// Scores are cosine similarity over log-scaled play counts. Every query here is bounded: it reads a capped sample
// of listeners or artists, never the whole listening history, so the cost per artist or user stays flat as the site grows.
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db, transact } from "../db/client";
import { artists, meta, scrobbles, similarArtists, taggings, tasteNorms, tasteQueue, userArtists, userNeighbours, users } from "../db/schema";
import { now } from "../util";

export type Kind = "artist" | "user";
/** Play counts are log-scaled so one obsessive listener does not outweigh many casual ones. */
const weight = (plays: unknown) => sql`ln(1 + ${plays})`;
const WATERMARK = "taste_watermark";
/** SQLite needs a WHERE on the SELECT of an INSERT ... SELECT ... ON CONFLICT to parse it. */
const always = sql`true`;

// ---------- the queue ----------
/** Queues every artist and user that has been scrobbled since the last call. Returns how many scrobbles were new. */
export function queueChanged(): number {
  return transact(tx => {
    const mark = tx.select({ value: meta.value }).from(meta).where(eq(meta.key, WATERMARK)).get();
    const last = tx.select({ id: sql<number>`COALESCE(MAX(${scrobbles.id}), 0)` }).from(scrobbles).get()?.id ?? 0;
    const at = now();
    if (!mark) {
      // First run: everything with any listening is due.
      tx.insert(tasteQueue).select(tx.selectDistinct({ kind: sql<string>`'artist'`.as("kind"), id: userArtists.artistId, queuedAt: sql<number>`${at}`.as("queued_at") }).from(userArtists).where(always)).onConflictDoNothing().run();
      tx.insert(tasteQueue).select(tx.selectDistinct({ kind: sql<string>`'user'`.as("kind"), id: userArtists.userId, queuedAt: sql<number>`${at}`.as("queued_at") }).from(userArtists).where(always)).onConflictDoNothing().run();
    } else {
      const from = Number(mark.value) || 0;
      if (last <= from) return 0;
      const fresh = and(sql`${scrobbles.id} > ${from}`, sql`${scrobbles.id} <= ${last}`);
      tx.insert(tasteQueue).select(tx.selectDistinct({ kind: sql<string>`'artist'`.as("kind"), id: scrobbles.artistId, queuedAt: sql<number>`${at}`.as("queued_at") }).from(scrobbles).where(fresh)).onConflictDoNothing().run();
      tx.insert(tasteQueue).select(tx.selectDistinct({ kind: sql<string>`'user'`.as("kind"), id: scrobbles.userId, queuedAt: sql<number>`${at}`.as("queued_at") }).from(scrobbles).where(fresh)).onConflictDoNothing().run();
    }
    tx.insert(meta).values({ key: WATERMARK, value: String(last) }).onConflictDoUpdate({ target: meta.key, set: { value: String(last) } }).run();
    return last - (Number(mark?.value) || 0);
  });
}
/** Asks for one artist or user to be refreshed (after a merge or a bulk delete, say). */
export async function queue(kind: Kind, id: number) {
  await db.insert(tasteQueue).values({ kind, id, queuedAt: now() }).onConflictDoNothing();
}
/** The oldest entries waiting in the queue. */
export async function due(limit: number): Promise<{ kind: Kind; id: number }[]> {
  const rows = await db.select({ kind: tasteQueue.kind, id: tasteQueue.id }).from(tasteQueue).orderBy(asc(tasteQueue.queuedAt)).limit(limit);
  return rows.map(r => ({ kind: r.kind === "user" ? "user" : "artist", id: r.id }));
}
export async function done(kind: Kind, id: number) {
  await db.delete(tasteQueue).where(and(eq(tasteQueue.kind, kind), eq(tasteQueue.id, id)));
}

// ---------- vector lengths ----------
/** Recomputes and stores the vector length of the given artists or users. */
export async function refreshNorms(kind: Kind, ids: number[]) {
  if (!ids.length) return;
  const key = kind === "artist" ? userArtists.artistId : userArtists.userId;
  const rows = await db.select({ id: key, norm: sql<number>`sqrt(SUM(${weight(userArtists.plays)} * ${weight(userArtists.plays)}))` }).from(userArtists).where(inArray(key, ids)).groupBy(key);
  if (!rows.length) return;
  const at = now();
  await db.insert(tasteNorms).values(rows.map(r => ({ kind, id: r.id, norm: r.norm, computedAt: at })))
    .onConflictDoUpdate({ target: [tasteNorms.kind, tasteNorms.id], set: { norm: sql`excluded.norm`, computedAt: at } });
}
/** Stored vector lengths, computing any that are missing. */
export async function norms(kind: Kind, ids: number[]): Promise<Map<number, number>> {
  const read = async () => new Map((await db.select({ id: tasteNorms.id, norm: tasteNorms.norm }).from(tasteNorms).where(and(eq(tasteNorms.kind, kind), inArray(tasteNorms.id, ids)))).map(r => [r.id, r.norm]));
  if (!ids.length) return new Map();
  let found = await read();
  const absent = ids.filter(id => !found.has(id));
  if (absent.length) { await refreshNorms(kind, absent); found = await read(); }
  return found;
}

// ---------- artists ----------
/**
 * Overlap between one artist and the artists its keenest listeners also play. Only the artist's top `fans` listeners
 * are read, so a hugely popular artist costs the same as a small one.
 */
export async function artistOverlap(artistId: number, fans: number, limit: number) {
  const rows = await db.all<{ id: number; dot: number; own: number }>(sql`
    WITH fans AS (SELECT ${userArtists.userId} AS user_id, ${weight(userArtists.plays)} AS w FROM ${userArtists}
      WHERE ${userArtists.artistId} = ${artistId} ORDER BY ${userArtists.plays} DESC LIMIT ${fans})
    SELECT y.artist_id AS id, SUM(fans.w * ln(1 + y.plays)) AS dot, (SELECT sqrt(SUM(w * w)) FROM fans) AS own
    FROM fans JOIN ${userArtists} y ON y.user_id = fans.user_id
    WHERE y.artist_id != ${artistId} GROUP BY y.artist_id ORDER BY dot DESC, y.artist_id LIMIT ${limit}`);
  return { own: rows[0]?.own ?? 0, others: rows.map(r => ({ id: r.id, dot: r.dot })) };
}
/** The set of tags on each of the given artists. */
export async function artistTagSets(ids: number[]): Promise<Map<number, Set<number>>> {
  const sets = new Map<number, Set<number>>();
  if (!ids.length) return sets;
  const rows = await db.selectDistinct({ artist: taggings.itemId, tag: taggings.tagId }).from(taggings).where(and(eq(taggings.itemType, "artist"), inArray(taggings.itemId, ids)));
  for (const r of rows) { let s = sets.get(r.artist); if (!s) sets.set(r.artist, (s = new Set())); s.add(r.tag); }
  return sets;
}
/**
 * Replaces an artist's computed matches. Each match is also written the other way round, so the other artist's
 * list picks it up without waiting for its own refresh. Matches that came with imported data are left alone.
 */
export function saveSimilar(artistId: number, matches: { id: number; score: number }[]) {
  transact(tx => {
    tx.delete(similarArtists).where(and(eq(similarArtists.artistId, artistId), eq(similarArtists.source, "computed"))).run();
    if (!matches.length) return;
    tx.insert(similarArtists).values(matches.map(m => ({ artistId, similarId: m.id, score: m.score }))).onConflictDoNothing().run();
    tx.insert(similarArtists).values(matches.map(m => ({ artistId: m.id, similarId: artistId, score: m.score })))
      .onConflictDoUpdate({ target: [similarArtists.artistId, similarArtists.similarId], set: { score: sql`excluded.score` }, setWhere: eq(similarArtists.source, "computed") }).run();
  });
}
/** An artist's stored matches, best first. */
export async function similarIds(artistId: number, limit: number) {
  return db.select({ id: similarArtists.similarId, score: similarArtists.score }).from(similarArtists).where(eq(similarArtists.artistId, artistId)).orderBy(desc(similarArtists.score), asc(similarArtists.similarId)).limit(limit);
}
/** An artist's stored matches with what a listing needs to show them. */
export async function similarArtistRows(artistId: number, limit: number) {
  return db.select({
    id: artists.id, name: artists.name, image: artists.imageId, match: similarArtists.score,
    listeners: sql<number>`((SELECT COUNT(*) FROM ${userArtists} WHERE ${userArtists.artistId} = ${artists.id}) + ${artists.baseListeners})`,
  }).from(similarArtists).innerJoin(artists, eq(artists.id, similarArtists.similarId)).where(eq(similarArtists.artistId, artistId)).orderBy(desc(similarArtists.score), asc(similarArtists.similarId)).limit(limit);
}

// ---------- users ----------
/** A user's most played artists with their weights. */
export async function topWeights(userId: number, limit: number) {
  return db.select({ artist: userArtists.artistId, plays: userArtists.plays, w: sql<number>`${weight(userArtists.plays)}` }).from(userArtists).where(eq(userArtists.userId, userId)).orderBy(desc(userArtists.plays), asc(userArtists.artistId)).limit(limit);
}
/** The keenest listeners of one artist. */
export async function topListeners(artistId: number, limit: number) {
  return db.select({ user: userArtists.userId, w: sql<number>`${weight(userArtists.plays)}` }).from(userArtists).where(eq(userArtists.artistId, artistId)).orderBy(desc(userArtists.plays)).limit(limit);
}
/** Exact overlap between one user's top artists and each of the given users. */
export async function userOverlap(userId: number, others: number[], depth: number): Promise<Map<number, number>> {
  if (!others.length) return new Map();
  const rows = await db.all<{ id: number; dot: number }>(sql`
    WITH mine AS (SELECT ${userArtists.artistId} AS artist_id, ${weight(userArtists.plays)} AS w FROM ${userArtists}
      WHERE ${userArtists.userId} = ${userId} ORDER BY ${userArtists.plays} DESC LIMIT ${depth})
    SELECT y.user_id AS id, SUM(mine.w * ln(1 + y.plays)) AS dot
    FROM mine JOIN ${userArtists} y ON y.artist_id = mine.artist_id
    WHERE y.user_id IN (${sql.join(others.map(o => sql`${o}`), sql`, `)}) GROUP BY y.user_id`);
  return new Map(rows.map(r => [r.id, r.dot]));
}
export function saveNeighbours(userId: number, matches: { id: number; score: number }[]) {
  transact(tx => {
    tx.delete(userNeighbours).where(eq(userNeighbours.userId, userId)).run();
    if (matches.length) tx.insert(userNeighbours).values(matches.map(m => ({ userId, neighbourId: m.id, score: m.score }))).onConflictDoNothing().run();
  });
}
/** A user's stored neighbours, closest first. */
export async function neighbourRows(userId: number, limit: number) {
  return db.select({ id: users.id, username: users.username, realname: users.realname, country: users.country, image: users.imageId, match: userNeighbours.score })
    .from(userNeighbours).innerJoin(users, eq(users.id, userNeighbours.neighbourId)).where(eq(userNeighbours.userId, userId)).orderBy(desc(userNeighbours.score), asc(users.id)).limit(limit);
}
/** Artists two users both play, the most shared first. */
export async function sharedArtists(a: number, b: number, limit = 5) {
  return db.all<{ name: string; image: number | null; weight: number }>(sql`
    SELECT ar.name AS name, ar.image_id AS image, MIN(x.plays, y.plays) AS weight FROM ${userArtists} x
      JOIN ${userArtists} y ON y.artist_id = x.artist_id AND y.user_id = ${b} JOIN ${artists} ar ON ar.id = x.artist_id
    WHERE x.user_id = ${a} ORDER BY weight DESC LIMIT ${limit}`);
}
/** Cosine similarity of two users' listening, worked out on the spot (two index range reads). */
export async function userSimilarity(a: number, b: number): Promise<number> {
  const [row] = await db.all<{ dot: number | null; na: number | null; nb: number | null }>(sql`
    SELECT (SELECT SUM(ln(1 + x.plays) * ln(1 + y.plays)) FROM ${userArtists} x JOIN ${userArtists} y ON y.user_id = ${b} AND y.artist_id = x.artist_id WHERE x.user_id = ${a}) AS dot,
      (SELECT SUM(ln(1 + plays) * ln(1 + plays)) FROM ${userArtists} WHERE user_id = ${a}) AS na,
      (SELECT SUM(ln(1 + plays) * ln(1 + plays)) FROM ${userArtists} WHERE user_id = ${b}) AS nb`);
  if (!row?.dot || !row.na || !row.nb) return 0;
  return row.dot / Math.sqrt(row.na * row.nb);
}

// ---------- recommendations ----------
/** Everything a user has played, most played first. */
export async function library(userId: number) {
  return db.select({ id: userArtists.artistId, name: artists.name, c: userArtists.plays }).from(userArtists).innerJoin(artists, eq(artists.id, userArtists.artistId)).where(eq(userArtists.userId, userId)).orderBy(desc(userArtists.plays));
}
/** Stored matches for several artists at once. */
export async function similarFor(artistIds: number[]) {
  if (!artistIds.length) return [];
  return db.select({ from: similarArtists.artistId, id: similarArtists.similarId, score: similarArtists.score }).from(similarArtists).where(inArray(similarArtists.artistId, artistIds));
}
export async function artistCards(ids: number[]) {
  if (!ids.length) return [];
  return db.select({
    id: artists.id, name: artists.name, image: artists.imageId,
    listeners: sql<number>`((SELECT COUNT(*) FROM ${userArtists} WHERE ${userArtists.artistId} = ${artists.id}) + ${artists.baseListeners})`,
  }).from(artists).where(inArray(artists.id, ids));
}
