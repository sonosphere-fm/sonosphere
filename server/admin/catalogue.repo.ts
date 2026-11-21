// Data access for catalogue upkeep by admins: searching artists, albums and tracks, merging two of them into one,
// renaming, finding and deleting items nothing uses, and listing and deleting tags.
//
// A merge moves everything that points at the source over to the target. Where the target already has the same
// row (the same listener's play at the same second, the same person's tag, a love, a lock) the source's copy is
// dropped instead. The per-listener play tallies (user_artists, user_albums, user_tracks) are not touched here:
// the triggers on `scrobbles` keep them in step as plays are moved or dropped.
import { and, asc, count, countDistinct, desc, eq, inArray, ne, notExists, or, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, transact, type Conn, type Tx } from "../db/client";
import {
  albums, albumTracks, artists, eventArtists, lovedTracks, nowPlaying, obsessions, playlistTracks, scrobbles, shouts, similarArtists,
  taggings, tags, tracks, userAlbums, userArtists, userTracks, wikiLocks, wikis,
} from "../db/schema";
import type { AuditEntry } from "../site/audit";
import type { AdminTag, CatalogueItem, CatalogueKind, DuplicateArtist, OrphanItem } from "../../shared/admin-content";
import { auditTx } from "../site/audit";

export type Kind = CatalogueKind;
type Actor = { id: number; username: string };
type Page = { limit: number; offset: number };
/** A catalogue item by the name it goes by. Albums and tracks also carry their artist. */
export type CatRow = { id: number; label: string; artist: string | null; artistId: number | null };

const one = sql`1`;
const matches = (column: AnyColumn, pattern: string) => sql`${column} LIKE ${pattern} ESCAPE '\\'`;
/** A subquery as a selected number. Wrapping it keeps the column names inside it qualified by their table. */
const number = (query: SQL | { getSQL(): SQL }) => sql<number>`(${query})`;
const tally = (plays: AnyColumn) => sql<number>`COALESCE(SUM(${plays}), 0)`;
const nothing = sql<null>`NULL`;
const total = async (rows: PromiseLike<{ c: number }[]>) => (await rows)[0]?.c ?? 0;

// ---------- lookups ----------
export async function catRowTx(conn: Conn, kind: Kind, id: number): Promise<CatRow | null> {
  if (kind === "artist") {
    const a = (await conn.select({ id: artists.id, label: artists.name }).from(artists).where(eq(artists.id, id)))[0];
    return a ? { ...a, artist: null, artistId: null } : null;
  }
  if (kind === "album")
    return (await conn.select({ id: albums.id, label: albums.title, artist: artists.name, artistId: albums.artistId }).from(albums).innerJoin(artists, eq(artists.id, albums.artistId)).where(eq(albums.id, id)))[0] ?? null;
  return (await conn.select({ id: tracks.id, label: tracks.title, artist: artists.name, artistId: tracks.artistId }).from(tracks).innerJoin(artists, eq(artists.id, tracks.artistId)).where(eq(tracks.id, id)))[0] ?? null;
}
export const catRow = async (kind: Kind, id: number): Promise<CatRow | null> => (await catRowTx(db, kind, id));
/** How an item is named in the audit log: "Title by Artist", or just the artist's name. */
export const describe = (r: CatRow) => (r.artist === null ? r.label : `${r.label} by ${r.artist}`);

// ---------- search ----------
const artistTracks = () => number(db.select({ c: count() }).from(tracks).where(eq(tracks.artistId, artists.id)));
const artistAlbums = () => number(db.select({ c: count() }).from(albums).where(eq(albums.artistId, artists.id)));
const artistPlays = () => number(db.select({ c: tally(userArtists.plays) }).from(userArtists).where(eq(userArtists.artistId, artists.id))).as("scrobbles");

const albumOrArtist = (pattern: string) => or(matches(albums.titleNorm, pattern), matches(artists.nameNorm, pattern));
const trackOrArtist = (pattern: string) => or(matches(tracks.titleNorm, pattern), matches(artists.nameNorm, pattern));

/** Items whose normalised name (or, for albums and tracks, artist name) matches a LIKE pattern, the most played first. */
export async function search(kind: Kind, pattern: string, pg: Page): Promise<CatalogueItem[]> {
  if (kind === "artist") {
    const plays = artistPlays();
    return db.select({ id: artists.id, name: artists.name, artist: nothing, createdAt: artists.createdAt, tracks: artistTracks(), albums: artistAlbums(), scrobbles: plays })
      .from(artists).where(matches(artists.nameNorm, pattern)).orderBy(desc(plays), artists.nameNorm).limit(pg.limit).offset(pg.offset);
  }
  if (kind === "album") {
    const plays = number(db.select({ c: tally(userAlbums.plays) }).from(userAlbums).where(eq(userAlbums.albumId, albums.id))).as("scrobbles");
    return db.select({
      id: albums.id, name: albums.title, artist: artists.name, createdAt: albums.createdAt,
      tracks: number(db.select({ c: count() }).from(tracks).where(eq(tracks.albumId, albums.id))), albums: nothing, scrobbles: plays,
    }).from(albums).innerJoin(artists, eq(artists.id, albums.artistId)).where(albumOrArtist(pattern)).orderBy(desc(plays), albums.titleNorm).limit(pg.limit).offset(pg.offset);
  }
  const plays = number(db.select({ c: tally(userTracks.plays) }).from(userTracks).where(eq(userTracks.trackId, tracks.id))).as("scrobbles");
  return db.select({ id: tracks.id, name: tracks.title, artist: artists.name, createdAt: tracks.createdAt, tracks: nothing, albums: nothing, scrobbles: plays })
    .from(tracks).innerJoin(artists, eq(artists.id, tracks.artistId)).where(trackOrArtist(pattern)).orderBy(desc(plays), tracks.titleNorm).limit(pg.limit).offset(pg.offset);
}
export function searchCount(kind: Kind, pattern: string): Promise<number> {
  if (kind === "artist") return total(db.select({ c: count() }).from(artists).where(matches(artists.nameNorm, pattern)));
  if (kind === "album") return total(db.select({ c: count() }).from(albums).innerJoin(artists, eq(artists.id, albums.artistId)).where(albumOrArtist(pattern)));
  return total(db.select({ c: count() }).from(tracks).innerJoin(artists, eq(artists.id, tracks.artistId)).where(trackOrArtist(pattern)));
}
/** Every artist with its play, track and album counts, for spotting duplicates. */
export const artistsWithCounts = (): Promise<DuplicateArtist[]> =>
  db.select({ id: artists.id, name: artists.name, scrobbles: artistPlays(), tracks: artistTracks(), albums: artistAlbums() }).from(artists).orderBy(artists.id);

// ---------- merging ----------
/** Points everything attached to catalogue item `src` (tags, wiki, shouts, lock) at `dst`. */
async function moveItemRefsTx(tx: Tx, type: Kind, src: number, dst: number): Promise<void> {
  const g = alias(taggings, "g"), l = alias(wikiLocks, "l");
  const sameTagging = and(sql`COALESCE(${g.userId}, 0) = COALESCE(${taggings.userId}, 0)`, eq(g.tagId, taggings.tagId), eq(g.itemType, type), eq(g.itemId, dst));
  await tx.update(taggings).set({ itemId: dst }).where(and(eq(taggings.itemType, type), eq(taggings.itemId, src), notExists(tx.select({ one }).from(g).where(sameTagging))));
  await tx.delete(taggings).where(and(eq(taggings.itemType, type), eq(taggings.itemId, src)));
  const srcTop = (await tx.select({ v: sql<number>`COALESCE(MAX(${wikis.version}), 0)` }).from(wikis).where(and(eq(wikis.itemType, type), eq(wikis.itemId, src))))[0]?.v ?? 0;
  if (srcTop) { // keep the destination's text current: its versions move above the source's history
    await tx.update(wikis).set({ version: sql`${wikis.version} + ${srcTop}` }).where(and(eq(wikis.itemType, type), eq(wikis.itemId, dst)));
    await tx.update(wikis).set({ itemId: dst }).where(and(eq(wikis.itemType, type), eq(wikis.itemId, src)));
  }
  await tx.update(shouts).set({ targetId: dst }).where(and(eq(shouts.targetType, type), eq(shouts.targetId, src)));
  await tx.update(wikiLocks).set({ itemId: dst }).where(and(eq(wikiLocks.itemType, type), eq(wikiLocks.itemId, src), notExists(tx.select({ one }).from(l).where(and(eq(l.itemType, type), eq(l.itemId, dst))))));
  await tx.delete(wikiLocks).where(and(eq(wikiLocks.itemType, type), eq(wikiLocks.itemId, src)));
}
/** The larger of a stored count and `n`. */
const atLeast = (column: AnyColumn, n: number) => sql`CASE WHEN ${column} < ${n} THEN ${n} ELSE ${column} END`;

async function mergeTrackTx(tx: Tx, src: number, dst: number): Promise<void> {
  const s = (await tx.select().from(tracks).where(eq(tracks.id, src)))[0], d = (await tx.select().from(tracks).where(eq(tracks.id, dst)))[0];
  if (!s || !d) return;
  // a scrobble that already exists on the destination (same listener, same second) is a duplicate and is dropped
  const x = alias(scrobbles, "x"), lv = alias(lovedTracks, "lv"), at = alias(albumTracks, "at");
  await tx.update(scrobbles).set({ trackId: dst, artistId: d.artistId }).where(and(eq(scrobbles.trackId, src),
    notExists(tx.select({ one }).from(x).where(and(eq(x.userId, scrobbles.userId), eq(x.trackId, dst), eq(x.playedAt, scrobbles.playedAt))))));
  await tx.delete(scrobbles).where(eq(scrobbles.trackId, src));
  await tx.update(lovedTracks).set({ trackId: dst }).where(and(eq(lovedTracks.trackId, src), notExists(tx.select({ one }).from(lv).where(and(eq(lv.userId, lovedTracks.userId), eq(lv.trackId, dst))))));
  await tx.delete(lovedTracks).where(eq(lovedTracks.trackId, src));
  await tx.update(albumTracks).set({ trackId: dst }).where(and(eq(albumTracks.trackId, src), notExists(tx.select({ one }).from(at).where(and(eq(at.albumId, albumTracks.albumId), eq(at.trackId, dst))))));
  await tx.delete(albumTracks).where(eq(albumTracks.trackId, src));
  await tx.update(playlistTracks).set({ trackId: dst }).where(eq(playlistTracks.trackId, src));
  await tx.update(obsessions).set({ trackId: dst }).where(eq(obsessions.trackId, src));
  await tx.update(nowPlaying).set({ trackId: dst }).where(eq(nowPlaying.trackId, src));
  await moveItemRefsTx(tx, "track", src, dst);
  await tx.update(tracks).set({
    basePlaycount: sql`${tracks.basePlaycount} + ${s.basePlaycount}`, baseListeners: atLeast(tracks.baseListeners, s.baseListeners),
    duration: sql`CASE WHEN ${tracks.duration} = 0 THEN ${s.duration} ELSE ${tracks.duration} END`, albumId: sql`COALESCE(${tracks.albumId}, ${s.albumId})`,
  }).where(eq(tracks.id, dst));
  await tx.delete(tracks).where(eq(tracks.id, src));
}

async function mergeAlbumTx(tx: Tx, src: number, dst: number): Promise<void> {
  const s = (await tx.select().from(albums).where(eq(albums.id, src)))[0];
  if (!s) return;
  const at = alias(albumTracks, "at");
  await tx.update(tracks).set({ albumId: dst }).where(eq(tracks.albumId, src));
  await tx.update(albumTracks).set({ albumId: dst }).where(and(eq(albumTracks.albumId, src), notExists(tx.select({ one }).from(at).where(and(eq(at.albumId, dst), eq(at.trackId, albumTracks.trackId))))));
  await tx.delete(albumTracks).where(eq(albumTracks.albumId, src));
  await tx.update(scrobbles).set({ albumId: dst }).where(eq(scrobbles.albumId, src));
  await tx.update(nowPlaying).set({ albumId: dst }).where(eq(nowPlaying.albumId, src));
  await moveItemRefsTx(tx, "album", src, dst);
  await tx.update(albums).set({
    basePlaycount: sql`${albums.basePlaycount} + ${s.basePlaycount}`, baseListeners: atLeast(albums.baseListeners, s.baseListeners),
    imageId: sql`COALESCE(${albums.imageId}, ${s.imageId})`, releaseDate: sql`COALESCE(${albums.releaseDate}, ${s.releaseDate})`,
  }).where(eq(albums.id, dst));
  await tx.delete(albums).where(eq(albums.id, src));
}

/** Albums and tracks the target already has under the same title are merged; the rest move over as they are. */
async function mergeArtistTx(tx: Tx, src: number, dst: number): Promise<{ merged: number; moved: number }> {
  const s = (await tx.select().from(artists).where(eq(artists.id, src)))[0];
  let merged = 0, moved = 0;
  if (!s) return { merged, moved };
  for (const t of await tx.select({ id: tracks.id, titleNorm: tracks.titleNorm }).from(tracks).where(eq(tracks.artistId, src)).orderBy(tracks.id)) {
    const twin = (await tx.select({ id: tracks.id }).from(tracks).where(and(eq(tracks.artistId, dst), eq(tracks.titleNorm, t.titleNorm))))[0];
    if (twin) { await mergeTrackTx(tx, t.id, twin.id); merged++; } else { (await tx.update(tracks).set({ artistId: dst }).where(eq(tracks.id, t.id))); moved++; }
  }
  for (const a of await tx.select({ id: albums.id, titleNorm: albums.titleNorm }).from(albums).where(eq(albums.artistId, src)).orderBy(albums.id)) {
    const twin = (await tx.select({ id: albums.id }).from(albums).where(and(eq(albums.artistId, dst), eq(albums.titleNorm, a.titleNorm))))[0];
    if (twin) { await mergeAlbumTx(tx, a.id, twin.id); merged++; } else { (await tx.update(albums).set({ artistId: dst }).where(eq(albums.id, a.id))); moved++; }
  }
  await tx.update(scrobbles).set({ artistId: dst }).where(eq(scrobbles.artistId, src));
  const o = alias(similarArtists, "o"), ea = alias(eventArtists, "ea");
  await tx.update(similarArtists).set({ artistId: dst }).where(and(eq(similarArtists.artistId, src), notExists(tx.select({ one }).from(o).where(and(eq(o.artistId, dst), eq(o.similarId, similarArtists.similarId))))));
  await tx.update(similarArtists).set({ similarId: dst }).where(and(eq(similarArtists.similarId, src), notExists(tx.select({ one }).from(o).where(and(eq(o.artistId, similarArtists.artistId), eq(o.similarId, dst))))));
  await tx.delete(similarArtists).where(or(eq(similarArtists.artistId, src), eq(similarArtists.similarId, src), eq(similarArtists.artistId, similarArtists.similarId)));
  await tx.update(eventArtists).set({ artistId: dst }).where(and(eq(eventArtists.artistId, src), notExists(tx.select({ one }).from(ea).where(and(eq(ea.eventId, eventArtists.eventId), eq(ea.artistId, dst))))));
  await tx.delete(eventArtists).where(eq(eventArtists.artistId, src));
  await moveItemRefsTx(tx, "artist", src, dst);
  await tx.update(artists).set({
    basePlaycount: sql`${artists.basePlaycount} + ${s.basePlaycount}`, baseListeners: atLeast(artists.baseListeners, s.baseListeners), imageId: sql`COALESCE(${artists.imageId}, ${s.imageId})`,
  }).where(eq(artists.id, dst));
  await tx.delete(artists).where(eq(artists.id, src));
  return { merged, moved };
}

export type MergeDetail = { merged?: number; moved?: number };
/**
 * Merges `src` into `dst` and records it, all or nothing. `entry` builds the audit record from the merge's counts.
 * Also returns the artists whose listeners changed, so their taste matches can be refreshed.
 */
export async function merge(kind: Kind, src: number, dst: number, actor: Actor, entry: (detail: MergeDetail) => AuditEntry): Promise<{ detail: MergeDetail; artists: number[] }> {
  return (await transact(async tx => {
    let detail: MergeDetail = {}, changed = [dst];
    if (kind === "artist") detail = (await mergeArtistTx(tx, src, dst));
    else if (kind === "album") { await mergeAlbumTx(tx, src, dst); changed = []; }
    else {
      changed = (await tx.select({ id: tracks.artistId }).from(tracks).where(inArray(tracks.id, [src, dst]))).map(t => t.id);
      await mergeTrackTx(tx, src, dst);
    }
    await auditTx(tx, actor, entry(detail));
    return { detail, artists: [...new Set(changed)] };
  }));
}

// ---------- renaming ----------
/** The id of another item that already goes by this normalised name (for albums and tracks: by the same artist). */
export async function nameClash(kind: Kind, row: CatRow, nameNorm: string): Promise<number | null> {
  if (kind === "artist") return (await db.select({ id: artists.id }).from(artists).where(and(eq(artists.nameNorm, nameNorm), ne(artists.id, row.id))).limit(1))[0]?.id ?? null;
  const table = kind === "album" ? albums : tracks;
  return (await db.select({ id: table.id }).from(table).where(and(eq(table.artistId, row.artistId ?? 0), eq(table.titleNorm, nameNorm), ne(table.id, row.id))).limit(1))[0]?.id ?? null;
}
export async function rename(kind: Kind, id: number, name: string, nameNorm: string): Promise<void> {
  if (kind === "artist") await db.update(artists).set({ name, nameNorm }).where(eq(artists.id, id));
  else if (kind === "album") await db.update(albums).set({ title: name, titleNorm: nameNorm }).where(eq(albums.id, id));
  else await db.update(tracks).set({ title: name, titleNorm: nameNorm }).where(eq(tracks.id, id));
}

// ---------- orphans ----------
const unused = (column: AnyColumn, by: AnyColumn) => notExists(db.select({ one }).from(by.table).where(eq(by, column)));
/** No tags, wiki or shouts are attached to the item. */
const unreferenced = (type: Kind, id: AnyColumn) => and(
  notExists(db.select({ one }).from(taggings).where(and(eq(taggings.itemType, type), eq(taggings.itemId, id)))),
  notExists(db.select({ one }).from(wikis).where(and(eq(wikis.itemType, type), eq(wikis.itemId, id)))),
  notExists(db.select({ one }).from(shouts).where(and(eq(shouts.targetType, type), eq(shouts.targetId, id)))),
);
/**
 * The condition for an item nothing points at. Items that came with imported play counts only qualify when
 * `imported` is set.
 */
function orphan(kind: Kind, imported: boolean): SQL | undefined {
  const table = kind === "track" ? tracks : kind === "album" ? albums : artists;
  const fresh = imported ? undefined : and(eq(table.basePlaycount, 0), eq(table.baseListeners, 0));
  if (kind === "track")
    return and(unused(tracks.id, scrobbles.trackId), unused(tracks.id, lovedTracks.trackId), unused(tracks.id, playlistTracks.trackId), unused(tracks.id, obsessions.trackId),
      unused(tracks.id, nowPlaying.trackId), unreferenced("track", tracks.id), fresh);
  if (kind === "album")
    return and(unused(albums.id, scrobbles.albumId), unused(albums.id, tracks.albumId), unused(albums.id, albumTracks.albumId), unused(albums.id, nowPlaying.albumId), unreferenced("album", albums.id), fresh);
  return and(unused(artists.id, tracks.artistId), unused(artists.id, albums.artistId), unused(artists.id, scrobbles.artistId), unused(artists.id, eventArtists.artistId), unreferenced("artist", artists.id), fresh);
}
/** Up to `limit` orphans, the newest first. */
export async function orphans(kind: Kind, imported: boolean, limit: number): Promise<OrphanItem[]> {
  if (kind === "artist")
    return db.select({ id: artists.id, name: artists.name, artist: nothing, createdAt: artists.createdAt, basePlaycount: artists.basePlaycount }).from(artists).where(orphan(kind, imported)).orderBy(desc(artists.createdAt)).limit(limit);
  if (kind === "album")
    return db.select({ id: albums.id, name: albums.title, artist: artists.name, createdAt: albums.createdAt, basePlaycount: albums.basePlaycount }).from(albums).innerJoin(artists, eq(artists.id, albums.artistId))
      .where(orphan(kind, imported)).orderBy(desc(albums.createdAt)).limit(limit);
  return db.select({ id: tracks.id, name: tracks.title, artist: artists.name, createdAt: tracks.createdAt, basePlaycount: tracks.basePlaycount }).from(tracks).innerJoin(artists, eq(artists.id, tracks.artistId))
    .where(orphan(kind, imported)).orderBy(desc(tracks.createdAt)).limit(limit);
}
export function orphanCount(kind: Kind, imported: boolean): Promise<number> {
  const table = kind === "track" ? tracks : kind === "album" ? albums : artists;
  return total(db.select({ c: count() }).from(table).where(orphan(kind, imported)));
}
/**
 * Deletes those of the given items that are still orphans (something may have started using one since the list
 * was loaded) and records it. `entry` builds the audit record from what was deleted. Returns how many went.
 */
export async function deleteOrphans(kind: Kind, ids: number[], actor: Actor, entry: (ids: number[], names: string[]) => AuditEntry): Promise<number> {
  return (await transact(async tx => {
    const table = kind === "track" ? tracks : kind === "album" ? albums : artists;
    const still = (await tx.select({ id: table.id }).from(table).where(and(inArray(table.id, ids), orphan(kind, true))).orderBy(table.id)).map(r => r.id);
    const names: string[] = [];
    for (const id of still) {
      const row = (await catRowTx(tx, kind, id));
      if (row) names.push(describe(row));
      await tx.delete(table).where(eq(table.id, id));
      if (kind === "artist") await tx.delete(similarArtists).where(or(eq(similarArtists.artistId, id), eq(similarArtists.similarId, id)));
    }
    if (still.length) await auditTx(tx, actor, entry(still, names));
    return still.length;
  }));
}

// ---------- tags ----------
const tagWhere = (pattern: string | null) => (pattern === null ? undefined : matches(tags.nameNorm, pattern));
/** Tags with how often each is used, by how many people, and how many uses came with imported data. */
export function tagRows(pattern: string | null, byName: boolean, pg: Page): Promise<AdminTag[]> {
  const uses = count(taggings.tagId).as("uses");
  return db.select({ id: tags.id, name: tags.name, uses, users: countDistinct(taggings.userId), imported: sql<number | null>`SUM(CASE WHEN ${taggings.userId} IS NULL THEN 1 ELSE 0 END)` })
    .from(tags).leftJoin(taggings, eq(taggings.tagId, tags.id)).where(tagWhere(pattern)).groupBy(tags.id)
    .orderBy(...(byName ? [asc(tags.nameNorm)] : [desc(uses), asc(tags.nameNorm)])).limit(pg.limit).offset(pg.offset);
}
export const tagCount = (pattern: string | null): Promise<number> => total(db.select({ c: count() }).from(tags).where(tagWhere(pattern)));
/**
 * Deletes a tag with every use of it, its wiki, its shouts and its wiki lock, and records it. `entry` builds the
 * audit record from the number of uses. Returns that number.
 */
export async function deleteTag(id: number, actor: Actor, entry: (uses: number) => AuditEntry): Promise<number> {
  return (await transact(async tx => {
    const uses = (await tx.select({ c: count() }).from(taggings).where(eq(taggings.tagId, id)))[0]?.c ?? 0;
    await tx.delete(taggings).where(eq(taggings.tagId, id));
    await tx.delete(wikis).where(and(eq(wikis.itemType, "tag"), eq(wikis.itemId, id)));
    await tx.delete(shouts).where(and(eq(shouts.targetType, "tag"), eq(shouts.targetId, id)));
    await tx.delete(wikiLocks).where(and(eq(wikiLocks.itemType, "tag"), eq(wikiLocks.itemId, id)));
    await tx.delete(tags).where(eq(tags.id, id));
    await auditTx(tx, actor, entry(uses));
    return uses;
  }));
}
