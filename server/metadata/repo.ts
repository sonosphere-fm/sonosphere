import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, lt, notInArray, or, sql } from "drizzle-orm";
import { db, transact, transactRetry } from "../db/client";
import { albums, albumTracks, artists, spotifyArtistPics, tracks } from "../db/schema";
import { getOrCreateAlbumTx, getOrCreateArtistTx, getOrCreateTrackTx } from "../catalog/repo";
import { first, norm, now } from "../util";

type Kind = "artist" | "album" | "track";
const table = { artist: artists, album: albums, track: tracks } as const;

/** Marks the item as looked up now, so two processes (or two visitors) don't both fetch it. */
export async function claim(kind: Kind, id: number, staleBefore: number): Promise<boolean> {
  const t = table[kind];
  const rows = await db
    .update(t)
    .set({ metaAt: now() })
    .where(and(eq(t.id, id), or(isNull(t.metaAt), lt(t.metaAt, staleBefore))))
    .returning({ id: t.id });
  return rows.length > 0;
}

export const addArtist = (name: string) => transact((tx) => getOrCreateArtistTx(tx, name));
export const addAlbum = (artistId: number, title: string, date: string | null) =>
  transact((tx) => getOrCreateAlbumTx(tx, artistId, title, date));
export const addTrack = (artistId: number, title: string, seconds: number) =>
  transact((tx) => getOrCreateTrackTx(tx, artistId, title, seconds));

export async function setArtist(
  id: number,
  set: { mbid?: string; spotifyId?: string; imageId?: string; metaAt?: number; wdAt?: number }
) {
  if (Object.keys(set).length) await db.update(artists).set(set).where(eq(artists.id, id));
}
export async function setAlbum(
  id: number,
  set: { mbid?: string; releaseDate?: string; imageId?: string; coverAt?: number | null; metaAt?: number }
) {
  if (!Object.keys(set).length) return;
  await db
    .update(albums)
    .set(set.mbid ? { ...set, releaseType: null } : set)
    .where(eq(albums.id, id));
}
export async function setTrack(id: number, set: { duration?: number; albumId?: number; metaAt?: number }) {
  if (Object.keys(set).length) await db.update(tracks).set(set).where(eq(tracks.id, id));
}

export const artistRow = (id: number) => first(db.select().from(artists).where(eq(artists.id, id)).limit(1));
export const albumRow = (id: number) => first(db.select().from(albums).where(eq(albums.id, id)).limit(1));
export const trackRow = (id: number) => first(db.select().from(tracks).where(eq(tracks.id, id)).limit(1));
export const albumByMbid = (artistId: number, mbid: string) =>
  first(
    db
      .select()
      .from(albums)
      .where(and(eq(albums.artistId, artistId), eq(albums.mbid, mbid)))
      .limit(1)
  );

export async function trackListSize(albumId: number): Promise<number> {
  const rows = await db.select({ id: albumTracks.trackId }).from(albumTracks).where(eq(albumTracks.albumId, albumId));
  return rows.length;
}

/** Tracks already on the album that the published list doesn't have (a bonus track someone scrobbled) go after it. */
export async function setTrackList(
  albumId: number,
  artistId: number,
  list: { title: string; seconds: number }[]
): Promise<void> {
  await transactRetry(async (tx) => {
    const place = (trackId: number, position: number) =>
      tx
        .update(albumTracks)
        .set({ position })
        .where(and(eq(albumTracks.albumId, albumId), eq(albumTracks.trackId, trackId)));
    const ids: number[] = [];
    for (const [i, t] of list.entries()) {
      const id = await getOrCreateTrackTx(tx, artistId, t.title, t.seconds, albumId, i + 1);
      if (!ids.includes(id)) ids.push(id);
    }
    for (const [i, id] of ids.entries()) await place(id, i + 1);
    const rest = await tx
      .select({ id: albumTracks.trackId })
      .from(albumTracks)
      .where(and(eq(albumTracks.albumId, albumId), ids.length ? notInArray(albumTracks.trackId, ids) : undefined))
      .orderBy(asc(albumTracks.position));
    for (const [i, r] of rest.entries()) await place(r.id, ids.length + i + 1);
  });
}

/** Adds the albums not filed yet (matched by name or MusicBrainz id) and returns how many. */
export async function addDiscography(
  artistId: number,
  list: { mbid: string; title: string; date: string | null }[]
): Promise<number> {
  const known = await db
    .select({ mbid: albums.mbid })
    .from(albums)
    .where(and(eq(albums.artistId, artistId), isNotNull(albums.mbid)));
  const have = new Set(known.map((k) => k.mbid));
  let added = 0;
  for (const a of list) {
    if (have.has(a.mbid)) continue;
    const id = await addAlbum(artistId, a.title, a.date);
    const row = await albumRow(id);
    if (!row || row.mbid) continue;
    const date = row.releaseDate || !a.date ? {} : { releaseDate: a.date };
    await setAlbum(id, { mbid: a.mbid, ...date });
    added++;
  }
  return added;
}

/** Albums with a MusicBrainz id but no cover that were never searched for one, oldest first. */
export const coverless = (limit: number) =>
  db
    .select({
      id: albums.id,
      mbid: albums.mbid,
      title: albums.title,
      artistId: albums.artistId,
      spAt: albums.spAt,
      lfAt: albums.lfAt,
    })
    .from(albums)
    .where(and(isNotNull(albums.mbid), isNull(albums.imageId), isNull(albums.coverAt)))
    .orderBy(asc(albums.id))
    .limit(limit);

export async function artistNames(ids: number[]) {
  if (!ids.length) return new Map<number, string>();
  const rows = await db.select({ id: artists.id, name: artists.name }).from(artists).where(inArray(artists.id, ids));
  return new Map(rows.map((r) => [r.id, r.name]));
}

/** Found or not, Spotify isn't asked again. */
export async function spotifyAnswered(kind: Kind, id: number) {
  const t = table[kind];
  await db.update(t).set({ spAt: now() }).where(eq(t.id, id));
}

/** Artists with a MusicBrainz id and no photo that Wikidata wasn't asked about since `due`. */
export const wikidataDueArtists = (limit: number, due: number) =>
  db
    .select({ id: artists.id, mbid: artists.mbid })
    .from(artists)
    .where(and(isNull(artists.imageId), isNotNull(artists.mbid), or(isNull(artists.wdAt), lt(artists.wdAt, due))))
    .orderBy(asc(artists.id))
    .limit(limit);

export async function wikidataAnswered(ids: number[]) {
  if (ids.length) await db.update(artists).set({ wdAt: now() }).where(inArray(artists.id, ids));
}

const pic = { url: spotifyArtistPics.url, width: spotifyArtistPics.width, height: spotifyArtistPics.height };

/** By Spotify id when known, else the most followed artist of that name. */
export async function catalogueCopyPicture(spotifyId: string | null, name: string) {
  const byId = spotifyId
    ? await first(db.select(pic).from(spotifyArtistPics).where(eq(spotifyArtistPics.spotifyId, spotifyId)))
    : null;
  if (byId) return byId;
  return first(
    db
      .select(pic)
      .from(spotifyArtistPics)
      .where(eq(spotifyArtistPics.nameNorm, norm(name)))
      .orderBy(desc(spotifyArtistPics.followers))
      .limit(1)
  );
}

export const picturelessArtists = (after: number, limit: number) =>
  db
    .select({ id: artists.id, name: artists.name, spotifyId: artists.spotifyId })
    .from(artists)
    .where(and(isNull(artists.imageId), gt(artists.id, after)))
    .orderBy(asc(artists.id))
    .limit(limit);

// Entries looked up elsewhere that still lack something Spotify might have and that Spotify was never asked about.
// Wikidata goes first for artists it can be asked about.
export const spotifyDueArtists = (limit: number) =>
  db
    .select({ id: artists.id })
    .from(artists)
    .where(
      and(
        isNull(artists.imageId),
        isNull(artists.spAt),
        isNotNull(artists.metaAt),
        or(isNull(artists.mbid), isNotNull(artists.wdAt))
      )
    )
    .orderBy(asc(artists.id))
    .limit(limit);
export const spotifyDueAlbums = (limit: number) =>
  db
    .select({ id: albums.id, artistId: albums.artistId, title: albums.title })
    .from(albums)
    .where(
      and(
        isNull(albums.imageId),
        isNull(albums.spAt),
        or(isNotNull(albums.coverAt), and(isNull(albums.mbid), isNotNull(albums.metaAt)))
      )
    )
    .orderBy(asc(albums.id))
    .limit(limit);
export const spotifyDueTracks = (limit: number) =>
  db
    .select({ id: tracks.id, artistId: tracks.artistId })
    .from(tracks)
    .where(and(isNull(tracks.spAt), isNotNull(tracks.metaAt), or(isNull(tracks.albumId), eq(tracks.duration, 0))))
    .orderBy(asc(tracks.id))
    .limit(limit);

/** Found or not, Last.fm isn't asked again. */
export async function lastfmAnswered(kind: "album" | "track", id: number) {
  const t = table[kind];
  await db.update(t).set({ lfAt: now() }).where(eq(t.id, id));
}

export const lastfmDueAlbums = (limit: number) =>
  db
    .select({ id: albums.id, artistId: albums.artistId, title: albums.title })
    .from(albums)
    .where(
      and(
        isNull(albums.imageId),
        isNull(albums.lfAt),
        or(isNotNull(albums.coverAt), and(isNull(albums.mbid), isNotNull(albums.metaAt)))
      )
    )
    .orderBy(asc(albums.id))
    .limit(limit);
export const lastfmDueTracks = (limit: number) =>
  db
    .select({ id: tracks.id, artistId: tracks.artistId })
    .from(tracks)
    .where(and(isNull(tracks.lfAt), isNotNull(tracks.metaAt), or(isNull(tracks.albumId), eq(tracks.duration, 0))))
    .orderBy(asc(tracks.id))
    .limit(limit);

// albums added from a discography already carry a MusicBrainz id, so only ones someone filed are looked up
export const unlookedArtists = (limit: number) =>
  db.select({ id: artists.id }).from(artists).where(isNull(artists.metaAt)).orderBy(asc(artists.id)).limit(limit);
export const unlookedAlbums = (limit: number) =>
  db
    .select({ id: albums.id, artistId: albums.artistId })
    .from(albums)
    .where(and(isNull(albums.metaAt), isNull(albums.mbid)))
    .orderBy(asc(albums.id))
    .limit(limit);
export const unlookedTracks = (limit: number) =>
  db
    .select({ id: tracks.id, artistId: tracks.artistId })
    .from(tracks)
    .where(and(isNull(tracks.metaAt), or(isNull(tracks.albumId), eq(tracks.duration, 0))))
    .orderBy(asc(tracks.id))
    .limit(limit);

export const untypedAlbums = (limit: number) =>
  db
    .select({ id: albums.id, mbid: albums.mbid })
    .from(albums)
    .where(and(isNotNull(albums.mbid), isNull(albums.releaseType)))
    .orderBy(asc(albums.id))
    .limit(limit);
export const setReleaseType = (id: number, releaseType: string) =>
  db.update(albums).set({ releaseType }).where(eq(albums.id, id));

/** Singles whose every listed track is also on one of the artist's albums or EPs, with the earliest such album. */
export async function singlesOnAlbums(limit: number): Promise<{ single: number; album: number }[]> {
  const rows = await db.execute<{ single: number; album: number }>(sql`
    SELECT * FROM (
      SELECT s.id AS single, (
        SELECT d.id FROM albums d
        WHERE d.artist_id = s.artist_id AND d.release_type IN ('album', 'ep')
          AND NOT EXISTS (
            SELECT 1 FROM album_tracks st WHERE st.album_id = s.id
              AND NOT EXISTS (SELECT 1 FROM album_tracks dt WHERE dt.album_id = d.id AND dt.track_id = st.track_id))
        ORDER BY d.release_type = 'ep', d.release_date NULLS LAST, d.id
        LIMIT 1) AS album
      FROM albums s
      WHERE s.release_type = 'single' AND EXISTS (SELECT 1 FROM album_tracks st WHERE st.album_id = s.id)
    ) x
    WHERE album IS NOT NULL
    ORDER BY single
    LIMIT ${limit}`);
  return [...rows];
}
