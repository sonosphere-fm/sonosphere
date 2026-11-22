// A merge moves everything that points at the source over to the target, dropping the source's copy where the
// target already has the same row. The per-listener tallies (user_artists etc.) are kept in step by the triggers
// on `scrobbles`, so they are not touched here.
import { and, asc, count, countDistinct, desc, eq, inArray, isNull, ne, notExists, notInArray, or, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, transact, type Conn, type Tx } from "../db/client";
import {
  albumFolds, albums, albumTracks, artists, eventArtists, lovedTracks, nowPlaying, obsessions, playlistTracks, scrobbles, shouts, similarArtists,
  taggings, tags, tracks, userAlbums, userArtists, userTracks, wikiLocks, wikis,
} from "../db/schema";
import type { AuditEntry } from "../site/audit";
import type { AdminTag, CatalogueItem, TracklistTrack, CatalogueKind, DuplicateArtist, OrphanItem } from "../../shared/admin-content";
import { auditTx } from "../site/audit";

export type Kind = CatalogueKind;
export type Actor = { id: number | null; username: string };
type Page = { limit: number; offset: number };
export type CatRow = { id: number; label: string; artist: string | null; artistId: number | null };

const one = sql`1`;
const matches = (column: AnyColumn, pattern: string) => sql`${column} LIKE ${pattern} ESCAPE '\\'`;
// Wrapping the subquery keeps the column names inside it qualified by their table.
const number = (query: SQL | { getSQL(): SQL }) => sql<number>`(${query})`;
const tally = (plays: AnyColumn) => sql<number>`COALESCE(SUM(${plays}), 0)`;
const nothing = sql<null>`NULL`;
const total = async (rows: PromiseLike<{ c: number }[]>) => (await rows)[0]?.c ?? 0;
const tableOf = (kind: Kind) => (kind === "track" ? tracks : kind === "album" ? albums : artists);

async function catRowTx(conn: Conn, kind: Kind, id: number): Promise<CatRow | null> {
  if (kind === "artist") {
    const [a] = await conn.select({ id: artists.id, label: artists.name }).from(artists).where(eq(artists.id, id));
    return a ? { ...a, artist: null, artistId: null } : null;
  }
  if (kind === "album") {
    const [al] = await conn.select({ id: albums.id, label: albums.title, artist: artists.name, artistId: albums.artistId })
      .from(albums)
      .innerJoin(artists, eq(artists.id, albums.artistId))
      .where(eq(albums.id, id));
    return al ?? null;
  }
  const [t] = await conn.select({ id: tracks.id, label: tracks.title, artist: artists.name, artistId: tracks.artistId })
    .from(tracks)
    .innerJoin(artists, eq(artists.id, tracks.artistId))
    .where(eq(tracks.id, id));
  return t ?? null;
}

export const catRow = (kind: Kind, id: number): Promise<CatRow | null> => catRowTx(db, kind, id);
export const describe = (r: CatRow) => (r.artist === null ? r.label : `${r.label} by ${r.artist}`);

const artistTracks = () => number(db.select({ c: count() }).from(tracks).where(eq(tracks.artistId, artists.id)));
const artistAlbums = () => number(db.select({ c: count() }).from(albums).where(eq(albums.artistId, artists.id)));
const artistPlays = () =>
  number(db.select({ c: tally(userArtists.plays) }).from(userArtists).where(eq(userArtists.artistId, artists.id))).as("scrobbles");

const albumOrArtist = (pattern: string) => or(matches(albums.titleNorm, pattern), matches(artists.nameNorm, pattern));
const trackOrArtist = (pattern: string) => or(matches(tracks.titleNorm, pattern), matches(artists.nameNorm, pattern));

export async function search(kind: Kind, pattern: string, pg: Page): Promise<CatalogueItem[]> {
  if (kind === "artist") {
    const plays = artistPlays();
    return db.select({
      id: artists.id,
      name: artists.name,
      artist: nothing,
      createdAt: artists.createdAt,
      tracks: artistTracks(),
      albums: artistAlbums(),
      scrobbles: plays,
    })
      .from(artists)
      .where(matches(artists.nameNorm, pattern))
      .orderBy(desc(plays), artists.nameNorm)
      .limit(pg.limit)
      .offset(pg.offset);
  }
  if (kind === "album") {
    const plays = number(db.select({ c: tally(userAlbums.plays) }).from(userAlbums).where(eq(userAlbums.albumId, albums.id))).as("scrobbles");
    const albumTrackCount = number(db.select({ c: count() }).from(tracks).where(eq(tracks.albumId, albums.id)));
    return db.select({
      id: albums.id,
      name: albums.title,
      artist: artists.name,
      createdAt: albums.createdAt,
      tracks: albumTrackCount,
      albums: nothing,
      scrobbles: plays,
    })
      .from(albums)
      .innerJoin(artists, eq(artists.id, albums.artistId))
      .where(albumOrArtist(pattern))
      .orderBy(desc(plays), albums.titleNorm)
      .limit(pg.limit)
      .offset(pg.offset);
  }
  const plays = number(db.select({ c: tally(userTracks.plays) }).from(userTracks).where(eq(userTracks.trackId, tracks.id))).as("scrobbles");
  return db.select({
    id: tracks.id,
    name: tracks.title,
    artist: artists.name,
    createdAt: tracks.createdAt,
    tracks: nothing,
    albums: nothing,
    scrobbles: plays,
  })
    .from(tracks)
    .innerJoin(artists, eq(artists.id, tracks.artistId))
    .where(trackOrArtist(pattern))
    .orderBy(desc(plays), tracks.titleNorm)
    .limit(pg.limit)
    .offset(pg.offset);
}

export function searchCount(kind: Kind, pattern: string): Promise<number> {
  if (kind === "artist") {
    return total(db.select({ c: count() }).from(artists).where(matches(artists.nameNorm, pattern)));
  }
  if (kind === "album") {
    return total(db.select({ c: count() }).from(albums).innerJoin(artists, eq(artists.id, albums.artistId)).where(albumOrArtist(pattern)));
  }
  return total(db.select({ c: count() }).from(tracks).innerJoin(artists, eq(artists.id, tracks.artistId)).where(trackOrArtist(pattern)));
}

export const artistsWithCounts = (): Promise<DuplicateArtist[]> =>
  db.select({ id: artists.id, name: artists.name, scrobbles: artistPlays(), tracks: artistTracks(), albums: artistAlbums() })
    .from(artists)
    .orderBy(artists.id);

// Tags, wiki, shouts and lock.
async function moveItemRefsTx(tx: Tx, type: Kind, src: number, dst: number): Promise<void> {
  const g = alias(taggings, "g");
  const l = alias(wikiLocks, "l");
  const sameTagging = and(
    sql`COALESCE(${g.userId}, 0) = COALESCE(${taggings.userId}, 0)`,
    eq(g.tagId, taggings.tagId),
    eq(g.itemType, type),
    eq(g.itemId, dst),
  );
  const srcTaggings = and(eq(taggings.itemType, type), eq(taggings.itemId, src));
  await tx.update(taggings).set({ itemId: dst }).where(and(srcTaggings, notExists(tx.select({ one }).from(g).where(sameTagging))));
  await tx.delete(taggings).where(srcTaggings);

  const [top] = await tx.select({ v: sql<number>`COALESCE(MAX(${wikis.version}), 0)` })
    .from(wikis)
    .where(and(eq(wikis.itemType, type), eq(wikis.itemId, src)));
  const srcTop = top?.v ?? 0;
  if (srcTop) {
    // the destination's versions move above the source's history so its text stays current
    await tx.update(wikis).set({ version: sql`${wikis.version} + ${srcTop}` }).where(and(eq(wikis.itemType, type), eq(wikis.itemId, dst)));
    await tx.update(wikis).set({ itemId: dst }).where(and(eq(wikis.itemType, type), eq(wikis.itemId, src)));
  }

  await tx.update(shouts).set({ targetId: dst }).where(and(eq(shouts.targetType, type), eq(shouts.targetId, src)));

  const dstLocked = tx.select({ one }).from(l).where(and(eq(l.itemType, type), eq(l.itemId, dst)));
  const srcLock = and(eq(wikiLocks.itemType, type), eq(wikiLocks.itemId, src));
  await tx.update(wikiLocks).set({ itemId: dst }).where(and(srcLock, notExists(dstLocked)));
  await tx.delete(wikiLocks).where(srcLock);
}

const atLeast = (column: AnyColumn, n: number) => sql`CASE WHEN ${column} < ${n} THEN ${n} ELSE ${column} END`;

async function mergeTrackTx(tx: Tx, src: number, dst: number): Promise<void> {
  const [s] = await tx.select().from(tracks).where(eq(tracks.id, src));
  const [d] = await tx.select().from(tracks).where(eq(tracks.id, dst));
  if (!s || !d) return;
  const x = alias(scrobbles, "x");
  const lv = alias(lovedTracks, "lv");
  const at = alias(albumTracks, "at");

  // a play already on the destination (same listener, same second) is a duplicate and is dropped
  const dupPlay = tx.select({ one }).from(x)
    .where(and(eq(x.userId, scrobbles.userId), eq(x.trackId, dst), eq(x.playedAt, scrobbles.playedAt)));
  await tx.update(scrobbles).set({ trackId: dst, artistId: d.artistId }).where(and(eq(scrobbles.trackId, src), notExists(dupPlay)));
  await tx.delete(scrobbles).where(eq(scrobbles.trackId, src));

  const dupLove = tx.select({ one }).from(lv).where(and(eq(lv.userId, lovedTracks.userId), eq(lv.trackId, dst)));
  await tx.update(lovedTracks).set({ trackId: dst }).where(and(eq(lovedTracks.trackId, src), notExists(dupLove)));
  await tx.delete(lovedTracks).where(eq(lovedTracks.trackId, src));

  const dupListing = tx.select({ one }).from(at).where(and(eq(at.albumId, albumTracks.albumId), eq(at.trackId, dst)));
  await tx.update(albumTracks).set({ trackId: dst }).where(and(eq(albumTracks.trackId, src), notExists(dupListing)));
  await tx.delete(albumTracks).where(eq(albumTracks.trackId, src));

  await tx.update(playlistTracks).set({ trackId: dst }).where(eq(playlistTracks.trackId, src));
  await tx.update(obsessions).set({ trackId: dst }).where(eq(obsessions.trackId, src));
  await tx.update(nowPlaying).set({ trackId: dst }).where(eq(nowPlaying.trackId, src));
  await moveItemRefsTx(tx, "track", src, dst);
  await tx.update(tracks).set({
    basePlaycount: sql`${tracks.basePlaycount} + ${s.basePlaycount}`,
    baseListeners: atLeast(tracks.baseListeners, s.baseListeners),
    duration: sql`CASE WHEN ${tracks.duration} = 0 THEN ${s.duration} ELSE ${tracks.duration} END`,
    albumId: sql`COALESCE(${tracks.albumId}, ${s.albumId})`,
  }).where(eq(tracks.id, dst));
  await tx.delete(tracks).where(eq(tracks.id, src));
}

async function mergeAlbumTx(tx: Tx, src: number, dst: number): Promise<void> {
  const [s] = await tx.select().from(albums).where(eq(albums.id, src));
  if (!s) return;
  const at = alias(albumTracks, "at");
  await tx.update(tracks).set({ albumId: dst }).where(eq(tracks.albumId, src));
  const dupListing = tx.select({ one }).from(at).where(and(eq(at.albumId, dst), eq(at.trackId, albumTracks.trackId)));
  await tx.update(albumTracks).set({ albumId: dst }).where(and(eq(albumTracks.albumId, src), notExists(dupListing)));
  await tx.delete(albumTracks).where(eq(albumTracks.albumId, src));
  await tx.update(scrobbles).set({ albumId: dst }).where(eq(scrobbles.albumId, src));
  await tx.update(nowPlaying).set({ albumId: dst }).where(eq(nowPlaying.albumId, src));
  await moveItemRefsTx(tx, "album", src, dst);
  await tx.update(albumFolds).set({ albumId: dst }).where(eq(albumFolds.albumId, src));
  await tx.insert(albumFolds)
    .values({ artistId: s.artistId, titleNorm: s.titleNorm, albumId: dst })
    .onConflictDoUpdate({ target: [albumFolds.artistId, albumFolds.titleNorm], set: { albumId: dst } });
  await tx.update(albums).set({
    basePlaycount: sql`${albums.basePlaycount} + ${s.basePlaycount}`,
    baseListeners: atLeast(albums.baseListeners, s.baseListeners),
    imageId: sql`COALESCE(${albums.imageId}, ${s.imageId})`,
    releaseDate: sql`COALESCE(${albums.releaseDate}, ${s.releaseDate})`,
  }).where(eq(albums.id, dst));
  await tx.delete(albums).where(eq(albums.id, src));
}

// Albums and tracks the target already has under the same title are merged; the rest move over as they are.
async function mergeArtistTx(tx: Tx, src: number, dst: number): Promise<{ merged: number; moved: number }> {
  const [s] = await tx.select().from(artists).where(eq(artists.id, src));
  let merged = 0;
  let moved = 0;
  if (!s) return { merged, moved };

  const srcTracks = await tx.select({ id: tracks.id, titleNorm: tracks.titleNorm }).from(tracks)
    .where(eq(tracks.artistId, src))
    .orderBy(tracks.id);
  for (const t of srcTracks) {
    const [twin] = await tx.select({ id: tracks.id }).from(tracks)
      .where(and(eq(tracks.artistId, dst), eq(tracks.titleNorm, t.titleNorm)));
    if (twin) {
      await mergeTrackTx(tx, t.id, twin.id);
      merged++;
    } else {
      await tx.update(tracks).set({ artistId: dst }).where(eq(tracks.id, t.id));
      moved++;
    }
  }

  const srcAlbums = await tx.select({ id: albums.id, titleNorm: albums.titleNorm }).from(albums)
    .where(eq(albums.artistId, src))
    .orderBy(albums.id);
  for (const a of srcAlbums) {
    const [twin] = await tx.select({ id: albums.id }).from(albums)
      .where(and(eq(albums.artistId, dst), eq(albums.titleNorm, a.titleNorm)));
    if (twin) {
      await mergeAlbumTx(tx, a.id, twin.id);
      merged++;
    } else {
      await tx.update(albums).set({ artistId: dst }).where(eq(albums.id, a.id));
      moved++;
    }
  }

  await tx.update(scrobbles).set({ artistId: dst }).where(eq(scrobbles.artistId, src));

  const o = alias(similarArtists, "o");
  const ea = alias(eventArtists, "ea");
  const dupSimilarFrom = tx.select({ one }).from(o).where(and(eq(o.artistId, dst), eq(o.similarId, similarArtists.similarId)));
  const dupSimilarTo = tx.select({ one }).from(o).where(and(eq(o.artistId, similarArtists.artistId), eq(o.similarId, dst)));
  await tx.update(similarArtists).set({ artistId: dst }).where(and(eq(similarArtists.artistId, src), notExists(dupSimilarFrom)));
  await tx.update(similarArtists).set({ similarId: dst }).where(and(eq(similarArtists.similarId, src), notExists(dupSimilarTo)));
  await tx.delete(similarArtists).where(or(
    eq(similarArtists.artistId, src),
    eq(similarArtists.similarId, src),
    eq(similarArtists.artistId, similarArtists.similarId),
  ));

  const dupEvent = tx.select({ one }).from(ea).where(and(eq(ea.eventId, eventArtists.eventId), eq(ea.artistId, dst)));
  await tx.update(eventArtists).set({ artistId: dst }).where(and(eq(eventArtists.artistId, src), notExists(dupEvent)));
  await tx.delete(eventArtists).where(eq(eventArtists.artistId, src));

  await moveItemRefsTx(tx, "artist", src, dst);
  await tx.update(artists).set({
    basePlaycount: sql`${artists.basePlaycount} + ${s.basePlaycount}`,
    baseListeners: atLeast(artists.baseListeners, s.baseListeners),
    imageId: sql`COALESCE(${artists.imageId}, ${s.imageId})`,
  }).where(eq(artists.id, dst));
  await tx.delete(artists).where(eq(artists.id, src));
  return { merged, moved };
}

export const tracklist = (albumId: number): Promise<TracklistTrack[]> =>
  db.select({ id: tracks.id, name: tracks.title, artist: artists.name })
    .from(albumTracks)
    .innerJoin(tracks, eq(tracks.id, albumTracks.trackId))
    .innerJoin(artists, eq(artists.id, tracks.artistId))
    .where(eq(albumTracks.albumId, albumId))
    .orderBy(asc(albumTracks.position));

export async function existingTracks(ids: number[]): Promise<number> {
  if (!ids.length) return 0;
  return total(db.select({ c: count() }).from(tracks).where(inArray(tracks.id, ids)));
}

// Tracks taken off no longer point at the album; the list is locked so scrobbles can't add them back.
export async function setTracklist(albumId: number, trackIds: number[], actor: Actor, entry: AuditEntry): Promise<void> {
  await transact(async tx => {
    await tx.delete(albumTracks).where(eq(albumTracks.albumId, albumId));
    if (trackIds.length) {
      await tx.insert(albumTracks).values(trackIds.map((trackId, i) => ({ albumId, trackId, position: i + 1 })));
      await tx.update(tracks).set({ albumId }).where(and(inArray(tracks.id, trackIds), isNull(tracks.albumId)));
    }
    const removed = trackIds.length ? notInArray(tracks.id, trackIds) : undefined;
    await tx.update(tracks).set({ albumId: null }).where(and(eq(tracks.albumId, albumId), removed));
    await tx.update(albums).set({ tracklistLocked: true }).where(eq(albums.id, albumId));
    await auditTx(tx, actor, entry);
  });
}

type MergeDetail = { merged?: number; moved?: number };

// Also returns the artists whose listeners changed, so their taste matches can be refreshed.
export async function merge(
  kind: Kind,
  src: number,
  dst: number,
  actor: Actor,
  entry: (detail: MergeDetail) => AuditEntry,
): Promise<{ detail: MergeDetail; artists: number[] }> {
  return transact(async tx => {
    let detail: MergeDetail = {};
    let changed = [dst];
    if (kind === "artist") {
      detail = await mergeArtistTx(tx, src, dst);
    } else if (kind === "album") {
      await mergeAlbumTx(tx, src, dst);
      changed = [];
    } else {
      const rows = await tx.select({ id: tracks.artistId }).from(tracks).where(inArray(tracks.id, [src, dst]));
      changed = rows.map(t => t.id);
      await mergeTrackTx(tx, src, dst);
    }
    await auditTx(tx, actor, entry(detail));
    return { detail, artists: [...new Set(changed)] };
  });
}

// For albums and tracks, a clash is only with the same artist.
export async function nameClash(kind: Kind, row: CatRow, nameNorm: string): Promise<number | null> {
  if (kind === "artist") {
    const [a] = await db.select({ id: artists.id }).from(artists)
      .where(and(eq(artists.nameNorm, nameNorm), ne(artists.id, row.id)))
      .limit(1);
    return a?.id ?? null;
  }
  const table = kind === "album" ? albums : tracks;
  const [r] = await db.select({ id: table.id }).from(table)
    .where(and(eq(table.artistId, row.artistId ?? 0), eq(table.titleNorm, nameNorm), ne(table.id, row.id)))
    .limit(1);
  return r?.id ?? null;
}

export async function rename(kind: Kind, id: number, name: string, nameNorm: string): Promise<void> {
  if (kind === "artist") await db.update(artists).set({ name, nameNorm }).where(eq(artists.id, id));
  else if (kind === "album") await db.update(albums).set({ title: name, titleNorm: nameNorm }).where(eq(albums.id, id));
  else await db.update(tracks).set({ title: name, titleNorm: nameNorm }).where(eq(tracks.id, id));
}

const unused = (column: AnyColumn, by: AnyColumn) => notExists(db.select({ one }).from(by.table).where(eq(by, column)));

const unreferenced = (type: Kind, id: AnyColumn) => and(
  notExists(db.select({ one }).from(taggings).where(and(eq(taggings.itemType, type), eq(taggings.itemId, id)))),
  notExists(db.select({ one }).from(wikis).where(and(eq(wikis.itemType, type), eq(wikis.itemId, id)))),
  notExists(db.select({ one }).from(shouts).where(and(eq(shouts.targetType, type), eq(shouts.targetId, id)))),
);

// Items that came with imported play counts only qualify when `imported` is set.
function orphan(kind: Kind, imported: boolean): SQL | undefined {
  const table = tableOf(kind);
  const fresh = imported ? undefined : and(eq(table.basePlaycount, 0), eq(table.baseListeners, 0));
  if (kind === "track") {
    return and(
      unused(tracks.id, scrobbles.trackId),
      unused(tracks.id, lovedTracks.trackId),
      unused(tracks.id, playlistTracks.trackId),
      unused(tracks.id, obsessions.trackId),
      unused(tracks.id, nowPlaying.trackId),
      unreferenced("track", tracks.id),
      fresh,
    );
  }
  if (kind === "album") {
    return and(
      unused(albums.id, scrobbles.albumId),
      unused(albums.id, tracks.albumId),
      unused(albums.id, albumTracks.albumId),
      unused(albums.id, nowPlaying.albumId),
      unreferenced("album", albums.id),
      fresh,
    );
  }
  return and(
    unused(artists.id, tracks.artistId),
    unused(artists.id, albums.artistId),
    unused(artists.id, scrobbles.artistId),
    unused(artists.id, eventArtists.artistId),
    unreferenced("artist", artists.id),
    fresh,
  );
}

export async function orphans(kind: Kind, imported: boolean, limit: number): Promise<OrphanItem[]> {
  if (kind === "artist") {
    return db.select({ id: artists.id, name: artists.name, artist: nothing, createdAt: artists.createdAt, basePlaycount: artists.basePlaycount })
      .from(artists)
      .where(orphan(kind, imported))
      .orderBy(desc(artists.createdAt))
      .limit(limit);
  }
  if (kind === "album") {
    return db.select({ id: albums.id, name: albums.title, artist: artists.name, createdAt: albums.createdAt, basePlaycount: albums.basePlaycount })
      .from(albums)
      .innerJoin(artists, eq(artists.id, albums.artistId))
      .where(orphan(kind, imported))
      .orderBy(desc(albums.createdAt))
      .limit(limit);
  }
  return db.select({ id: tracks.id, name: tracks.title, artist: artists.name, createdAt: tracks.createdAt, basePlaycount: tracks.basePlaycount })
    .from(tracks)
    .innerJoin(artists, eq(artists.id, tracks.artistId))
    .where(orphan(kind, imported))
    .orderBy(desc(tracks.createdAt))
    .limit(limit);
}

export function orphanCount(kind: Kind, imported: boolean): Promise<number> {
  return total(db.select({ c: count() }).from(tableOf(kind)).where(orphan(kind, imported)));
}

// Rechecks each id, since something may have started using an item since the list was loaded.
export async function deleteOrphans(
  kind: Kind,
  ids: number[],
  actor: Actor,
  entry: (ids: number[], names: string[]) => AuditEntry,
): Promise<number> {
  return transact(async tx => {
    const table = tableOf(kind);
    const rows = await tx.select({ id: table.id }).from(table)
      .where(and(inArray(table.id, ids), orphan(kind, true)))
      .orderBy(table.id);
    const still = rows.map(r => r.id);
    const names: string[] = [];
    for (const id of still) {
      const row = await catRowTx(tx, kind, id);
      if (row) names.push(describe(row));
      await tx.delete(table).where(eq(table.id, id));
      if (kind === "artist") {
        await tx.delete(similarArtists).where(or(eq(similarArtists.artistId, id), eq(similarArtists.similarId, id)));
      }
    }
    if (still.length) await auditTx(tx, actor, entry(still, names));
    return still.length;
  });
}

const tagWhere = (pattern: string | null) => (pattern === null ? undefined : matches(tags.nameNorm, pattern));

export function tagRows(pattern: string | null, byName: boolean, pg: Page): Promise<AdminTag[]> {
  const uses = count(taggings.tagId).as("uses");
  const imported = sql<number | null>`SUM(CASE WHEN ${taggings.userId} IS NULL THEN 1 ELSE 0 END)`;
  const order = byName ? [asc(tags.nameNorm)] : [desc(uses), asc(tags.nameNorm)];
  return db.select({ id: tags.id, name: tags.name, uses, users: countDistinct(taggings.userId), imported })
    .from(tags)
    .leftJoin(taggings, eq(taggings.tagId, tags.id))
    .where(tagWhere(pattern))
    .groupBy(tags.id)
    .orderBy(...order)
    .limit(pg.limit)
    .offset(pg.offset);
}

export const tagCount = (pattern: string | null): Promise<number> =>
  total(db.select({ c: count() }).from(tags).where(tagWhere(pattern)));

// Returns how many uses the tag had.
export async function deleteTag(id: number, actor: Actor, entry: (uses: number) => AuditEntry): Promise<number> {
  return transact(async tx => {
    const uses = await total(tx.select({ c: count() }).from(taggings).where(eq(taggings.tagId, id)));
    await tx.delete(taggings).where(eq(taggings.tagId, id));
    await tx.delete(wikis).where(and(eq(wikis.itemType, "tag"), eq(wikis.itemId, id)));
    await tx.delete(shouts).where(and(eq(shouts.targetType, "tag"), eq(shouts.targetId, id)));
    await tx.delete(wikiLocks).where(and(eq(wikiLocks.itemType, "tag"), eq(wikiLocks.itemId, id)));
    await tx.delete(tags).where(eq(tags.id, id));
    await auditTx(tx, actor, entry(uses));
    return uses;
  });
}
