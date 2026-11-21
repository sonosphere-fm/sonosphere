// Data access for filling in the catalogue from outside sources (server/metadata/service.ts).
import { and, asc, eq, inArray, isNotNull, isNull, lt, notInArray, or } from "drizzle-orm";
import { db, transact } from "../db/client";
import { albums, albumTracks, artists, tracks } from "../db/schema";
import { getOrCreateAlbumTx, getOrCreateArtistTx, getOrCreateTrackTx } from "../catalog/repo";
import { first, now } from "../util";

type Kind = "artist" | "album" | "track";
const table = { artist: artists, album: albums, track: tracks } as const;

/**
 * Claims an item for a lookup: true when it was never looked up or last was before `staleBefore`, and marks it as
 * looked up now, so two processes (or two visitors) don't both fetch it.
 */
export async function claim(kind: Kind, id: number, staleBefore: number): Promise<boolean> {
  const t = table[kind];
  const rows = await db.update(t).set({ metaAt: now() }).where(and(eq(t.id, id), or(isNull(t.metaAt), lt(t.metaAt, staleBefore)))).returning({ id: t.id });
  return rows.length > 0;
}

export const addArtist = (name: string) => transact(tx => getOrCreateArtistTx(tx, name));
export const addAlbum = (artistId: number, title: string, date: string | null) => transact(tx => getOrCreateAlbumTx(tx, artistId, title, date));
export const addTrack = (artistId: number, title: string, seconds: number) => transact(tx => getOrCreateTrackTx(tx, artistId, title, seconds));

export async function setArtist(id: number, set: { mbid?: string; spotifyId?: string; imageId?: string; metaAt?: number }) {
  if (Object.keys(set).length) await db.update(artists).set(set).where(eq(artists.id, id));
}
export async function setAlbum(id: number, set: { mbid?: string; releaseDate?: string; imageId?: string; coverAt?: number | null; metaAt?: number }) {
  if (Object.keys(set).length) await db.update(albums).set(set).where(eq(albums.id, id));
}
export async function setTrack(id: number, set: { duration?: number; albumId?: number; metaAt?: number }) {
  if (Object.keys(set).length) await db.update(tracks).set(set).where(eq(tracks.id, id));
}

export const artistRow = (id: number) => first(db.select().from(artists).where(eq(artists.id, id)).limit(1));
export const albumRow = (id: number) => first(db.select().from(albums).where(eq(albums.id, id)).limit(1));
export const trackRow = (id: number) => first(db.select().from(tracks).where(eq(tracks.id, id)).limit(1));
export const albumByMbid = (artistId: number, mbid: string) => first(db.select().from(albums).where(and(eq(albums.artistId, artistId), eq(albums.mbid, mbid))).limit(1));

export async function trackListSize(albumId: number): Promise<number> {
  return (await db.select({ id: albumTracks.trackId }).from(albumTracks).where(eq(albumTracks.albumId, albumId))).length;
}

/**
 * Puts an album's tracks in the published order, adding the ones not filed yet. Tracks already on the album that the
 * published list doesn't have (a bonus track someone scrobbled) keep their place after it.
 */
export async function setTrackList(albumId: number, artistId: number, list: { title: string; seconds: number }[]): Promise<void> {
  await transact(async tx => {
    const ids: number[] = [];
    for (const [i, t] of list.entries()) {
      const id = await getOrCreateTrackTx(tx, artistId, t.title, t.seconds, albumId, i + 1);
      if (!ids.includes(id)) ids.push(id);
    }
    for (const [i, id] of ids.entries()) await tx.update(albumTracks).set({ position: i + 1 }).where(and(eq(albumTracks.albumId, albumId), eq(albumTracks.trackId, id)));
    const rest = await tx.select({ id: albumTracks.trackId }).from(albumTracks)
      .where(and(eq(albumTracks.albumId, albumId), ids.length ? notInArray(albumTracks.trackId, ids) : undefined)).orderBy(asc(albumTracks.position));
    for (const [i, r] of rest.entries()) await tx.update(albumTracks).set({ position: ids.length + i + 1 }).where(and(eq(albumTracks.albumId, albumId), eq(albumTracks.trackId, r.id)));
  });
}

/** Adds an artist's albums that aren't filed yet (matched by name or MusicBrainz id) and returns how many. */
export async function addDiscography(artistId: number, list: { mbid: string; title: string; date: string | null }[]): Promise<number> {
  const known = await db.select({ mbid: albums.mbid }).from(albums).where(and(eq(albums.artistId, artistId), isNotNull(albums.mbid)));
  const have = new Set(known.map(k => k.mbid));
  let added = 0;
  for (const a of list) {
    if (have.has(a.mbid)) continue;
    const id = await addAlbum(artistId, a.title, a.date);
    const row = await albumRow(id);
    if (row && !row.mbid) { await setAlbum(id, { mbid: a.mbid, ...(row.releaseDate || !a.date ? {} : { releaseDate: a.date }) }); added++; }
  }
  return added;
}

/** Albums with a MusicBrainz id but no cover that were never searched for one, oldest first. */
export const coverless = (limit: number) =>
  db.select({ id: albums.id, mbid: albums.mbid, title: albums.title, artistId: albums.artistId, spAt: albums.spAt, lfAt: albums.lfAt }).from(albums)
    .where(and(isNotNull(albums.mbid), isNull(albums.imageId), isNull(albums.coverAt))).orderBy(asc(albums.id)).limit(limit);

export const artistNames = async (ids: number[]) =>
  new Map((ids.length ? await db.select({ id: artists.id, name: artists.name }).from(artists).where(inArray(artists.id, ids)) : []).map(r => [r.id, r.name]));

/**
 * Entries never looked up, oldest first, for the background backfill: artists; albums someone filed (ones added from a
 * discography already carry a MusicBrainz id); tracks missing a length or an album.
 */
/** Spotify answered for an entry (found or not): it isn't asked again. */
export async function spotifyAnswered(kind: Kind, id: number) {
  const t = table[kind];
  await db.update(t).set({ spAt: now() }).where(eq(t.id, id));
}
/** Entries looked up elsewhere that still lack something Spotify might have and that Spotify was never asked about. */
export const spotifyDueArtists = (limit: number) =>
  db.select({ id: artists.id }).from(artists).where(and(isNull(artists.imageId), isNull(artists.spAt), isNotNull(artists.metaAt))).orderBy(asc(artists.id)).limit(limit);
export const spotifyDueAlbums = (limit: number) =>
  db.select({ id: albums.id, artistId: albums.artistId, title: albums.title }).from(albums)
    .where(and(isNull(albums.imageId), isNull(albums.spAt), or(isNotNull(albums.coverAt), and(isNull(albums.mbid), isNotNull(albums.metaAt))))).orderBy(asc(albums.id)).limit(limit);
export const spotifyDueTracks = (limit: number) =>
  db.select({ id: tracks.id, artistId: tracks.artistId }).from(tracks)
    .where(and(isNull(tracks.spAt), isNotNull(tracks.metaAt), or(isNull(tracks.albumId), eq(tracks.duration, 0)))).orderBy(asc(tracks.id)).limit(limit);

/** Last.fm answered for an album or track (found or not): it isn't asked again. */
export async function lastfmAnswered(kind: "album" | "track", id: number) {
  const t = table[kind];
  await db.update(t).set({ lfAt: now() }).where(eq(t.id, id));
}
/** Albums and tracks looked up elsewhere that still lack a cover (or a length or album) and Last.fm was never asked about. */
export const lastfmDueAlbums = (limit: number) =>
  db.select({ id: albums.id, artistId: albums.artistId, title: albums.title }).from(albums)
    .where(and(isNull(albums.imageId), isNull(albums.lfAt), or(isNotNull(albums.coverAt), and(isNull(albums.mbid), isNotNull(albums.metaAt))))).orderBy(asc(albums.id)).limit(limit);
export const lastfmDueTracks = (limit: number) =>
  db.select({ id: tracks.id, artistId: tracks.artistId }).from(tracks)
    .where(and(isNull(tracks.lfAt), isNotNull(tracks.metaAt), or(isNull(tracks.albumId), eq(tracks.duration, 0)))).orderBy(asc(tracks.id)).limit(limit);

export const unlookedArtists = (limit: number) =>
  db.select({ id: artists.id }).from(artists).where(isNull(artists.metaAt)).orderBy(asc(artists.id)).limit(limit);
export const unlookedAlbums = (limit: number) =>
  db.select({ id: albums.id, artistId: albums.artistId }).from(albums).where(and(isNull(albums.metaAt), isNull(albums.mbid))).orderBy(asc(albums.id)).limit(limit);
export const unlookedTracks = (limit: number) =>
  db.select({ id: tracks.id, artistId: tracks.artistId }).from(tracks)
    .where(and(isNull(tracks.metaAt), or(isNull(tracks.albumId), eq(tracks.duration, 0)))).orderBy(asc(tracks.id)).limit(limit);
