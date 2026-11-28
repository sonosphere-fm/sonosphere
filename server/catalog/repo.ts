import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  getTableColumns,
  gt,
  inArray,
  isNotNull,
  isNull,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { db, transact, type Tx } from "../db/client";
import { flag } from "../db/dialect";
import {
  albumFolds,
  albums,
  albumTracks,
  artists,
  eventArtists,
  eventAttendance,
  events,
  journals,
  lovedTracks,
  recordingMbids,
  tags,
  tracks,
  userAlbums,
  userArtists,
  userTracks,
  users,
} from "../db/schema";
import { artistComment, creditsAny, mbdbOn } from "../metadata/mbdb";
import { openListener, publicCols } from "../users/repo";
import { clean, first, norm, now } from "../util";
import type {
  ArtistAlbum,
  ArtistAlbumWithPlays,
  EventSummary,
  ItemType,
  LatestAlbum,
  Listener,
  OtherAlbum,
  TrackAlbum,
} from "../../shared/catalog";

export type Artist = typeof artists.$inferSelect;
type Album = typeof albums.$inferSelect;
type Track = typeof tracks.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type AlbumWithArtist = Album & { artist: string };
export type TrackWithArtist = Track & { artist: string };
export type ItemRows = {
  artist: Artist;
  album: Album;
  track: Track;
  tag: Tag;
  user: typeof users.$inferSelect;
  event: typeof events.$inferSelect;
  journal: typeof journals.$inferSelect;
};

export const findArtist = (name: string): Promise<Artist | null> =>
  first(
    db
      .select()
      .from(artists)
      .where(eq(artists.nameNorm, norm(name)))
      .limit(1)
  );

export const findAlbum = (artist: string, title: string): Promise<AlbumWithArtist | null> =>
  first(
    db
      .select({ ...getTableColumns(albums), artist: artists.name })
      .from(albums)
      .innerJoin(artists, eq(artists.id, albums.artistId))
      .where(and(eq(artists.nameNorm, norm(artist)), eq(albums.titleNorm, norm(title))))
      .limit(1)
  );

export const findTrack = (artist: string, title: string): Promise<TrackWithArtist | null> =>
  first(
    db
      .select({ ...getTableColumns(tracks), artist: artists.name })
      .from(tracks)
      .innerJoin(artists, eq(artists.id, tracks.artistId))
      .where(and(eq(artists.nameNorm, norm(artist)), eq(tracks.titleNorm, norm(title))))
      .limit(1)
  );

export const findTag = (name: string): Promise<Tag | null> =>
  first(
    db
      .select()
      .from(tags)
      .where(eq(tags.nameNorm, norm(name)))
      .limit(1)
  );

const byId: { [K in ItemType]: (id: number) => Promise<ItemRows[K] | null> } = {
  artist: (id) => first(db.select().from(artists).where(eq(artists.id, id)).limit(1)),
  album: (id) => first(db.select().from(albums).where(eq(albums.id, id)).limit(1)),
  track: (id) => first(db.select().from(tracks).where(eq(tracks.id, id)).limit(1)),
  tag: (id) => first(db.select().from(tags).where(eq(tags.id, id)).limit(1)),
  user: (id) => first(db.select().from(users).where(eq(users.id, id)).limit(1)),
  event: (id) => first(db.select().from(events).where(eq(events.id, id)).limit(1)),
  journal: (id) => first(db.select().from(journals).where(eq(journals.id, id)).limit(1)),
};
export const ITEM_TYPES = Object.keys(byId) as ItemType[];
export const findItem = <K extends ItemType>(type: K, id: number): Promise<ItemRows[K] | null> => byId[type](id);

const commentOf = (mbid: string) => (mbdbOn ? artistComment(mbid).catch(() => "") : Promise.resolve(""));
const labelled = (name: string, disambig: string) => `${name} (${disambig})`;
/** Whether a recording listened to as the artist's is credited to that id, or null when that can't be told. */
async function heard(tx: Tx, artistId: number, mbid: string): Promise<boolean | null> {
  if (!mbdbOn) return null;
  const recordings = await tx
    .select({ mbid: recordingMbids.mbid })
    .from(recordingMbids)
    .innerJoin(tracks, eq(tracks.id, recordingMbids.trackId))
    .where(eq(tracks.artistId, artistId));
  return creditsAny(
    recordings.map((r) => r.mbid),
    mbid
  ).catch(() => null);
}
const taken = async (tx: Tx, name: string) =>
  !!(await first(
    tx
      .select({ id: artists.id })
      .from(artists)
      .where(eq(artists.nameNorm, norm(name)))
      .limit(1)
  ));

/**
 * A MusicBrainz id picks among artists of one name: the one under the bare name when it has that id or none yet,
 * otherwise another, named with MusicBrainz's comment in brackets ("ACE (Japanese heavy metal band)").
 */
export async function getOrCreateArtistTx(tx: Tx, name: string, mbid?: string | null): Promise<number> {
  const n = norm(name);
  const [main] = await tx.select({ id: artists.id, mbid: artists.mbid }).from(artists).where(eq(artists.nameNorm, n));
  if (main && (!mbid || main.mbid === mbid)) return main.id;
  if (mbid) {
    const others = await tx
      .select({ id: artists.id, nameNorm: artists.nameNorm, disambig: artists.disambig })
      .from(artists)
      .where(and(eq(artists.mbid, mbid), ne(artists.disambig, "")));
    const known = others.find((a) => a.nameNorm === norm(labelled(n, a.disambig)));
    if (known) return known.id;
  }
  if (main) {
    const confirmed = main.mbid ? await heard(tx, main.id, main.mbid) : false;
    if (confirmed === null) return main.id;
    // an id found by looking the name up can be another artist of it; one sent with a listen is what was heard
    if (!confirmed) {
      await tx.update(artists).set({ mbid, metaAt: null }).where(eq(artists.id, main.id));
      return main.id;
    }
  }
  let shown = clean(name);
  let disambig = "";
  if (main) {
    disambig = await commentOf(mbid!);
    for (let i = 2; !disambig || (await taken(tx, labelled(shown, disambig))); i++) disambig = String(i);
    shown = labelled(shown, disambig);
  }
  const [created] = await tx
    .insert(artists)
    .values({ name: shown, nameNorm: norm(shown), disambig, mbid: mbid || null, createdAt: now() })
    .onConflictDoNothing({ target: artists.nameNorm })
    .returning({ id: artists.id });
  if (created) return created.id;

  // a concurrent caller created it first; take that row
  const [existing] = await tx
    .select({ id: artists.id })
    .from(artists)
    .where(eq(artists.nameNorm, norm(shown)));
  if (!existing) throw new Error("Artist disappeared after concurrent creation");
  return existing.id;
}

export async function getOrCreateAlbumTx(
  tx: Tx,
  artistId: number,
  title: string,
  releaseDate: string | null = null
): Promise<number> {
  const n = norm(title);
  const [row] = await tx
    .select({ id: albums.id })
    .from(albums)
    .where(and(eq(albums.artistId, artistId), eq(albums.titleNorm, n)));
  if (row) return row.id;
  const [folded] = await tx
    .select({ id: albumFolds.albumId })
    .from(albumFolds)
    .where(and(eq(albumFolds.artistId, artistId), eq(albumFolds.titleNorm, n)));
  if (folded) return folded.id;
  const [created] = await tx
    .insert(albums)
    .values({ artistId, title: clean(title), titleNorm: n, releaseDate, createdAt: now() })
    .onConflictDoNothing({ target: [albums.artistId, albums.titleNorm] })
    .returning({ id: albums.id });
  if (created) return created.id;

  // A concurrent creator may have committed after our lookup; read it in a fresh statement snapshot.
  const [existing] = await tx
    .select({ id: albums.id })
    .from(albums)
    .where(and(eq(albums.artistId, artistId), eq(albums.titleNorm, n)));
  if (!existing) throw new Error("Album disappeared after concurrent creation");
  return existing.id;
}

/**
 * A known track gains the duration or album if it had none. When an album is given the track is added to its
 * track list (at `position`, or at the end), unless an admin has locked that list.
 */
export async function getOrCreateTrackTx(
  tx: Tx,
  artistId: number,
  title: string,
  duration = 0,
  albumId: number | null = null,
  position?: number
): Promise<number> {
  const n = norm(title);
  const [row] = await tx
    .select({ id: tracks.id, duration: tracks.duration, albumId: tracks.albumId })
    .from(tracks)
    .where(and(eq(tracks.artistId, artistId), eq(tracks.titleNorm, n)));
  let id: number;
  let currentAlbumId: number | null;
  if (row) {
    id = row.id;
    currentAlbumId = row.albumId;
  } else {
    const [created] = await tx
      .insert(tracks)
      .values({ artistId, title: clean(title), titleNorm: n, duration: duration | 0, albumId, createdAt: now() })
      .onConflictDoNothing({ target: [tracks.artistId, tracks.titleNorm] })
      .returning({ id: tracks.id });
    if (created) {
      id = created.id;
      currentAlbumId = albumId;
    } else {
      // a concurrent caller created it first; take that row
      const [existing] = await tx
        .select({ id: tracks.id, albumId: tracks.albumId })
        .from(tracks)
        .where(and(eq(tracks.artistId, artistId), eq(tracks.titleNorm, n)));
      if (!existing) throw new Error("Track disappeared after concurrent creation");
      id = existing.id;
      currentAlbumId = existing.albumId;
    }
  }
  if (duration > 0)
    await tx
      .update(tracks)
      .set({ duration: duration | 0 })
      .where(and(eq(tracks.id, id), eq(tracks.duration, 0)));
  if (!albumId) return id;

  const [listed] = await tx
    .select({ trackId: albumTracks.trackId })
    .from(albumTracks)
    .where(and(eq(albumTracks.albumId, albumId), eq(albumTracks.trackId, id)));
  if (!listed) {
    const [album] = await tx.select({ locked: albums.tracklistLocked }).from(albums).where(eq(albums.id, albumId));
    if (album?.locked) return id;
  }
  if (!currentAlbumId)
    await tx
      .update(tracks)
      .set({ albumId })
      .where(and(eq(tracks.id, id), isNull(tracks.albumId)));
  if (!listed) {
    let pos = position;
    if (pos === undefined) {
      const [last] = await tx
        .select({ p: sql<number>`COALESCE(MAX(${albumTracks.position}), 0) + 1` })
        .from(albumTracks)
        .where(eq(albumTracks.albumId, albumId));
      pos = last?.p ?? 1;
    }
    // another caller may have listed it after our lookup; its position wins
    await tx.insert(albumTracks).values({ albumId, trackId: id, position: pos }).onConflictDoNothing();
  }
  return id;
}

/** An empty or missing album means none was given. */
export type TrackNames = {
  artist: string;
  track: string;
  album?: string;
  duration?: number;
  artistMbid?: string | null;
};
/** `albumId` falls back to the album the track is already known to be on. */
export type TrackRef = { artistId: number; trackId: number; albumId: number | null };

export type ResolutionCache = { artists: Map<string, number>; albums: Map<string, number> };

export async function resolveTrackTx(tx: Tx, names: TrackNames, cache?: ResolutionCache): Promise<TrackRef> {
  const artistKey = `${norm(names.artist)}\n${names.artistMbid ?? ""}`;
  const artistId = cache?.artists.get(artistKey) ?? (await getOrCreateArtistTx(tx, names.artist, names.artistMbid));
  cache?.artists.set(artistKey, artistId);
  let albumId: number | null = null;
  if (names.album) {
    const albumKey = JSON.stringify([artistId, norm(names.album)]);
    albumId = cache?.albums.get(albumKey) ?? (await getOrCreateAlbumTx(tx, artistId, names.album));
    cache?.albums.set(albumKey, albumId);
  }
  const trackId = await getOrCreateTrackTx(tx, artistId, names.track, names.duration ?? 0, albumId);
  if (albumId !== null) return { artistId, trackId, albumId };
  const [known] = await tx.select({ albumId: tracks.albumId }).from(tracks).where(eq(tracks.id, trackId));
  return { artistId, trackId, albumId: known?.albumId ?? null };
}

export const resolveTrack = (names: TrackNames): Promise<TrackRef> => transact((tx) => resolveTrackTx(tx, names));

const single = async (rows: PromiseLike<{ c: number }[]>) => (await rows)[0]?.c ?? 0;

// running totals plus any imported base figures
const albumListeners = sql<number>`((SELECT COUNT(*) FROM ${userAlbums} WHERE ${userAlbums.albumId} = ${albums.id}) + ${albums.baseListeners})`;
const albumPlays = sql<number>`((SELECT COALESCE(SUM(${userAlbums.plays}), 0) FROM ${userAlbums} WHERE ${userAlbums.albumId} = ${albums.id}) + ${albums.basePlaycount})`;
const albumSize = sql<number>`(SELECT COUNT(*) FROM ${albumTracks} WHERE ${albumTracks.albumId} = ${albums.id})`;
const trackListeners = sql<number>`((SELECT COUNT(*) FROM ${userTracks} WHERE ${userTracks.trackId} = ${tracks.id}) + ${tracks.baseListeners})`;
const trackPlays = sql<number>`((SELECT COALESCE(SUM(${userTracks.plays}), 0) FROM ${userTracks} WHERE ${userTracks.trackId} = ${tracks.id}) + ${tracks.basePlaycount})`;
const albumCard = { id: albums.id, title: albums.title, image: albums.imageId };

/** Those who hide their listening are left out. */
export async function topListeners(kind: "artist" | "album" | "track", id: number, limit: number): Promise<Listener[]> {
  const open = openListener();
  if (kind === "artist") {
    return db
      .select({ ...publicCols, playcount: userArtists.plays })
      .from(userArtists)
      .innerJoin(users, eq(users.id, userArtists.userId))
      .where(and(eq(userArtists.artistId, id), open))
      .orderBy(desc(userArtists.plays))
      .limit(limit);
  }
  if (kind === "album") {
    return db
      .select({ ...publicCols, playcount: userAlbums.plays })
      .from(userAlbums)
      .innerJoin(users, eq(users.id, userAlbums.userId))
      .where(and(eq(userAlbums.albumId, id), open))
      .orderBy(desc(userAlbums.plays))
      .limit(limit);
  }
  return db
    .select({ ...publicCols, playcount: userTracks.plays })
    .from(userTracks)
    .innerJoin(users, eq(users.id, userTracks.userId))
    .where(and(eq(userTracks.trackId, id), open))
    .orderBy(desc(userTracks.plays))
    .limit(limit);
}

const releases = (artistId: number, singles: boolean) =>
  and(
    eq(albums.artistId, artistId),
    singles ? eq(albums.releaseType, "single") : or(isNull(albums.releaseType), ne(albums.releaseType, "single"))
  );

export async function popularAlbums(artistId: number, singles: boolean, limit: number): Promise<ArtistAlbum[]> {
  const listeners = albumListeners.as("listeners");
  return db
    .select({ ...albumCard, releaseDate: albums.releaseDate, artist: artists.name, listeners, trackCount: albumSize })
    .from(albums)
    .innerJoin(artists, eq(artists.id, albums.artistId))
    .where(releases(artistId, singles))
    .orderBy(desc(listeners))
    .limit(limit);
}

export async function discography(
  artistId: number,
  singles: boolean,
  limit: number,
  offset: number
): Promise<ArtistAlbumWithPlays[]> {
  const listeners = albumListeners.as("listeners");
  const playcount = albumPlays.as("playcount");
  return db
    .select({
      ...albumCard,
      releaseDate: albums.releaseDate,
      artist: artists.name,
      playcount,
      listeners,
      trackCount: albumSize,
    })
    .from(albums)
    .innerJoin(artists, eq(artists.id, albums.artistId))
    .where(releases(artistId, singles))
    .orderBy(desc(listeners), desc(playcount))
    .limit(limit)
    .offset(offset);
}

export const latestAlbum = (artistId: number): Promise<LatestAlbum | null> =>
  first(
    db
      .select({ ...albumCard, releaseDate: albums.releaseDate, artist: artists.name })
      .from(albums)
      .innerJoin(artists, eq(artists.id, albums.artistId))
      .where(and(eq(albums.artistId, artistId), isNotNull(albums.releaseDate)))
      .orderBy(desc(albums.releaseDate))
      .limit(1)
  );

export async function otherAlbums(artistId: number, exceptAlbumId: number, limit: number): Promise<OtherAlbum[]> {
  const listeners = albumListeners.as("listeners");
  return db
    .select({ ...albumCard, artist: artists.name, listeners })
    .from(albums)
    .innerJoin(artists, eq(artists.id, albums.artistId))
    .where(and(eq(albums.artistId, artistId), ne(albums.id, exceptAlbumId)))
    .orderBy(desc(listeners))
    .limit(limit);
}

export const albumCount = (artistId: number, singles: boolean): Promise<number> =>
  single(db.select({ c: count() }).from(albums).where(releases(artistId, singles)));
export const trackCount = (artistId: number): Promise<number> =>
  single(db.select({ c: count() }).from(tracks).where(eq(tracks.artistId, artistId)));

type TrackListRow = {
  position: number;
  id: number;
  title: string;
  duration: number;
  playcount: number;
  listeners: number;
  loved: number;
};

export async function trackList(albumId: number, viewerId: number): Promise<TrackListRow[]> {
  const lovedByViewer = db
    .select({ one: sql`1` })
    .from(lovedTracks)
    .where(and(eq(lovedTracks.userId, viewerId), eq(lovedTracks.trackId, tracks.id)));
  return db
    .select({
      position: albumTracks.position,
      id: tracks.id,
      title: tracks.title,
      duration: tracks.duration,
      playcount: trackPlays,
      listeners: trackListeners,
      loved: flag(exists(lovedByViewer)),
    })
    .from(albumTracks)
    .innerJoin(tracks, eq(tracks.id, albumTracks.trackId))
    .where(eq(albumTracks.albumId, albumId))
    .orderBy(albumTracks.position);
}

export async function albumsWithTrack(trackId: number, artist: string): Promise<TrackAlbum[]> {
  const rows = await db
    .select(albumCard)
    .from(albumTracks)
    .innerJoin(albums, eq(albums.id, albumTracks.albumId))
    .where(eq(albumTracks.trackId, trackId));
  return rows.map((r) => ({ ...r, artist }));
}

export const trackPlaysBy = (trackId: number, userId: number): Promise<number> =>
  single(
    db
      .select({ c: sql<number>`COALESCE(SUM(${userTracks.plays}), 0)` })
      .from(userTracks)
      .where(and(eq(userTracks.trackId, trackId), eq(userTracks.userId, userId)))
  );

export const hasLoved = async (userId: number, trackId: number): Promise<boolean> => {
  const row = await first(
    db
      .select({ one: sql`1` })
      .from(lovedTracks)
      .where(and(eq(lovedTracks.userId, userId), eq(lovedTracks.trackId, trackId)))
      .limit(1)
  );
  return !!row;
};

export const loveCount = (trackId: number): Promise<number> =>
  single(db.select({ c: count() }).from(lovedTracks).where(eq(lovedTracks.trackId, trackId)));

/** Events an artist plays that start after `after`, soonest first, with the viewer's own answer to each. */
export async function eventsWithArtist(
  artistId: number,
  after: number,
  viewerId: number,
  limit: number
): Promise<EventSummary[]> {
  const answers = (status: string) => sql<number>`(
    SELECT COUNT(*) FROM ${eventAttendance}
    WHERE ${eventAttendance.eventId} = ${events.id} AND ${eventAttendance.status} = ${status}
  )`;
  const mine = sql<string | null>`(
    SELECT ${eventAttendance.status} FROM ${eventAttendance}
    WHERE ${eventAttendance.eventId} = ${events.id} AND ${eventAttendance.userId} = ${viewerId}
  )`;
  const withArtist = db
    .select({ id: eventArtists.eventId })
    .from(eventArtists)
    .where(eq(eventArtists.artistId, artistId));
  const rows = await db
    .select({
      id: events.id,
      title: events.title,
      venue: events.venue,
      city: events.city,
      country: events.country,
      startsAt: events.startsAt,
      description: events.description,
      url: events.url,
      creator: users.username,
      source: events.source,
      going: answers("going"),
      interested: answers("interested"),
      status: mine,
    })
    .from(events)
    .leftJoin(users, eq(users.id, events.creatorId))
    .where(and(gt(events.startsAt, after), inArray(events.id, withArtist)))
    .orderBy(asc(events.startsAt))
    .limit(limit);
  const out: EventSummary[] = [];
  for (const e of rows) {
    const lineup = await db
      .select({ name: artists.name, image: artists.imageId })
      .from(eventArtists)
      .innerJoin(artists, eq(artists.id, eventArtists.artistId))
      .where(eq(eventArtists.eventId, e.id))
      .orderBy(eventArtists.position);
    out.push({ ...e, artists: lineup });
  }
  return out;
}
