// Data access for the catalogue: artists, albums and tracks, plus looking up any item by its type and id.
import { and, asc, count, desc, eq, exists, getTableColumns, gt, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { db, transact, type Tx } from "../db/client";
import { flag } from "../db/dialect";
import { albums, albumTracks, artists, eventArtists, eventAttendance, events, journals, lovedTracks, tags, tracks, userAlbums, userArtists, userTracks, users } from "../db/schema";
import { publicCols } from "../users/repo";
import { clean, first, norm, now } from "../util";
import type { ArtistAlbum, ArtistAlbumWithPlays, EventSummary, ItemType, LatestAlbum, Listener, OtherAlbum, TrackAlbum } from "../../shared/catalog";

export type Artist = typeof artists.$inferSelect;
export type Album = typeof albums.$inferSelect;
export type Track = typeof tracks.$inferSelect;
export type Tag = typeof tags.$inferSelect;
/** An album or track row with its artist's name alongside. */
export type AlbumWithArtist = Album & { artist: string };
export type TrackWithArtist = Track & { artist: string };
/** The stored row behind each item type. */
export type ItemRows = {
  artist: Artist; album: Album; track: Track; tag: Tag;
  user: typeof users.$inferSelect; event: typeof events.$inferSelect; journal: typeof journals.$inferSelect;
};

// ---------- lookups (names are matched in their normalised form) ----------
export const findArtist = (name: string): Promise<Artist | null> =>
  first(db.select().from(artists).where(eq(artists.nameNorm, norm(name))).limit(1));

export const findAlbum = (artist: string, title: string): Promise<AlbumWithArtist | null> =>
  first(db.select({ ...getTableColumns(albums), artist: artists.name }).from(albums).innerJoin(artists, eq(artists.id, albums.artistId))
    .where(and(eq(artists.nameNorm, norm(artist)), eq(albums.titleNorm, norm(title)))).limit(1));

export const findTrack = (artist: string, title: string): Promise<TrackWithArtist | null> =>
  first(db.select({ ...getTableColumns(tracks), artist: artists.name }).from(tracks).innerJoin(artists, eq(artists.id, tracks.artistId))
    .where(and(eq(artists.nameNorm, norm(artist)), eq(tracks.titleNorm, norm(title)))).limit(1));

export const findTag = (name: string): Promise<Tag | null> =>
  first(db.select().from(tags).where(eq(tags.nameNorm, norm(name))).limit(1));

const byId: { [K in ItemType]: (id: number) => Promise<ItemRows[K] | null> } = {
  artist: id => first(db.select().from(artists).where(eq(artists.id, id)).limit(1)),
  album: id => first(db.select().from(albums).where(eq(albums.id, id)).limit(1)),
  track: id => first(db.select().from(tracks).where(eq(tracks.id, id)).limit(1)),
  tag: id => first(db.select().from(tags).where(eq(tags.id, id)).limit(1)),
  user: id => first(db.select().from(users).where(eq(users.id, id)).limit(1)),
  event: id => first(db.select().from(events).where(eq(events.id, id)).limit(1)),
  journal: id => first(db.select().from(journals).where(eq(journals.id, id)).limit(1)),
};
/** Every item type there is. */
export const ITEM_TYPES = Object.keys(byId) as ItemType[];
/** The row for an item of the given type, e.g. the thing a shout or a tag is attached to. */
export const findItem = <K extends ItemType>(type: K, id: number): Promise<ItemRows[K] | null> => byId[type](id);

// ---------- get or create ----------
// Each comes in two forms: the plain one runs in its own transaction; the Tx one joins a transaction already open.
export function getOrCreateArtistTx(tx: Tx, name: string): number {
  const n = norm(name);
  const row = tx.select({ id: artists.id }).from(artists).where(eq(artists.nameNorm, n)).get();
  if (row) return row.id;
  return tx.insert(artists).values({ name: clean(name), nameNorm: n, createdAt: now() }).returning({ id: artists.id }).get().id;
}

export function getOrCreateAlbumTx(tx: Tx, artistId: number, title: string, releaseDate: string | null = null): number {
  const n = norm(title);
  const row = tx.select({ id: albums.id }).from(albums).where(and(eq(albums.artistId, artistId), eq(albums.titleNorm, n))).get();
  if (row) return row.id;
  return tx.insert(albums).values({ artistId, title: clean(title), titleNorm: n, releaseDate, createdAt: now() }).returning({ id: albums.id }).get().id;
}

/**
 * Finds or adds a track. A known track gains the duration or album if it had none, and when an album is given the
 * track is added to its track list (at `position`, or at the end).
 */
export function getOrCreateTrackTx(tx: Tx, artistId: number, title: string, duration = 0, albumId: number | null = null, position?: number): number {
  const n = norm(title);
  const row = tx.select({ id: tracks.id, duration: tracks.duration, albumId: tracks.albumId }).from(tracks)
    .where(and(eq(tracks.artistId, artistId), eq(tracks.titleNorm, n))).get();
  let id: number;
  if (!row) {
    id = tx.insert(tracks).values({ artistId, title: clean(title), titleNorm: n, duration: duration | 0, albumId, createdAt: now() }).returning({ id: tracks.id }).get().id;
  } else {
    id = row.id;
    if (!row.duration && duration > 0) tx.update(tracks).set({ duration: duration | 0 }).where(eq(tracks.id, id)).run();
    if (!row.albumId && albumId) tx.update(tracks).set({ albumId }).where(eq(tracks.id, id)).run();
  }
  if (albumId && !tx.select({ trackId: albumTracks.trackId }).from(albumTracks).where(and(eq(albumTracks.albumId, albumId), eq(albumTracks.trackId, id))).get()) {
    const next = () => tx.select({ p: sql<number>`COALESCE(MAX(${albumTracks.position}), 0) + 1` }).from(albumTracks).where(eq(albumTracks.albumId, albumId)).get()?.p ?? 1;
    tx.insert(albumTracks).values({ albumId, trackId: id, position: position ?? next() }).run();
  }
  return id;
}


/** The names a play arrives with. An empty or missing album means none was given. */
export type TrackNames = { artist: string; track: string; album?: string; duration?: number };
/** Where a play is filed. `albumId` falls back to the album the track is already known to be on. */
export type TrackRef = { artistId: number; trackId: number; albumId: number | null };

/** Turns names into catalogue ids, adding whatever is not there yet. */
export function resolveTrackTx(tx: Tx, names: TrackNames): TrackRef {
  const artistId = getOrCreateArtistTx(tx, names.artist);
  const albumId = names.album ? getOrCreateAlbumTx(tx, artistId, names.album) : null;
  const trackId = getOrCreateTrackTx(tx, artistId, names.track, names.duration ?? 0, albumId);
  const known = () => tx.select({ albumId: tracks.albumId }).from(tracks).where(eq(tracks.id, trackId)).get()?.albumId ?? null;
  return { artistId, trackId, albumId: albumId ?? known() };
}
export const resolveTrack = async (names: TrackNames): Promise<TrackRef> => transact(tx => resolveTrackTx(tx, names));

// ---------- what the artist, album and track pages show ----------
const single = async (rows: PromiseLike<{ c: number }[]>) => (await rows)[0]?.c ?? 0;

// Totals shown next to an album or track: everyone's running totals plus any imported base figures.
const albumListeners = sql<number>`((SELECT COUNT(*) FROM ${userAlbums} WHERE ${userAlbums.albumId} = ${albums.id}) + ${albums.baseListeners})`;
const albumPlays = sql<number>`((SELECT COALESCE(SUM(${userAlbums.plays}), 0) FROM ${userAlbums} WHERE ${userAlbums.albumId} = ${albums.id}) + ${albums.basePlaycount})`;
const albumSize = sql<number>`(SELECT COUNT(*) FROM ${albumTracks} WHERE ${albumTracks.albumId} = ${albums.id})`;
const trackListeners = sql<number>`((SELECT COUNT(*) FROM ${userTracks} WHERE ${userTracks.trackId} = ${tracks.id}) + ${tracks.baseListeners})`;
const trackPlays = sql<number>`((SELECT COALESCE(SUM(${userTracks.plays}), 0) FROM ${userTracks} WHERE ${userTracks.trackId} = ${tracks.id}) + ${tracks.basePlaycount})`;
const albumCard = { id: albums.id, title: albums.title, image: albums.imageId };

/** The people who play an item most. Those who hide their listening are left out. */
export async function topListeners(kind: "artist" | "album" | "track", id: number, limit: number): Promise<Listener[]> {
  const open = eq(users.hideRecent, false);
  if (kind === "artist") return db.select({ ...publicCols, playcount: userArtists.plays }).from(userArtists).innerJoin(users, eq(users.id, userArtists.userId))
    .where(and(eq(userArtists.artistId, id), open)).orderBy(desc(userArtists.plays)).limit(limit);
  if (kind === "album") return db.select({ ...publicCols, playcount: userAlbums.plays }).from(userAlbums).innerJoin(users, eq(users.id, userAlbums.userId))
    .where(and(eq(userAlbums.albumId, id), open)).orderBy(desc(userAlbums.plays)).limit(limit);
  return db.select({ ...publicCols, playcount: userTracks.plays }).from(userTracks).innerJoin(users, eq(users.id, userTracks.userId))
    .where(and(eq(userTracks.trackId, id), open)).orderBy(desc(userTracks.plays)).limit(limit);
}

/** An artist's albums with the most listeners. */
export async function popularAlbums(artistId: number, limit: number): Promise<ArtistAlbum[]> {
  const listeners = albumListeners.as("listeners");
  return db.select({ ...albumCard, releaseDate: albums.releaseDate, artist: artists.name, listeners, trackCount: albumSize })
    .from(albums).innerJoin(artists, eq(artists.id, albums.artistId)).where(eq(albums.artistId, artistId)).orderBy(desc(listeners)).limit(limit);
}

/** A page of an artist's discography, most listened to first. */
export async function discography(artistId: number, limit: number, offset: number): Promise<ArtistAlbumWithPlays[]> {
  const listeners = albumListeners.as("listeners"), playcount = albumPlays.as("playcount");
  return db.select({ ...albumCard, releaseDate: albums.releaseDate, artist: artists.name, playcount, listeners, trackCount: albumSize })
    .from(albums).innerJoin(artists, eq(artists.id, albums.artistId)).where(eq(albums.artistId, artistId))
    .orderBy(desc(listeners), desc(playcount)).limit(limit).offset(offset);
}

/** An artist's most recently released album, among those with a known release date. */
export const latestAlbum = (artistId: number): Promise<LatestAlbum | null> =>
  first(db.select({ ...albumCard, releaseDate: albums.releaseDate, artist: artists.name }).from(albums).innerJoin(artists, eq(artists.id, albums.artistId))
    .where(and(eq(albums.artistId, artistId), isNotNull(albums.releaseDate))).orderBy(desc(albums.releaseDate)).limit(1));

/** An artist's other albums, most listened to first. */
export async function otherAlbums(artistId: number, exceptAlbumId: number, limit: number): Promise<OtherAlbum[]> {
  const listeners = albumListeners.as("listeners");
  return db.select({ ...albumCard, artist: artists.name, listeners }).from(albums).innerJoin(artists, eq(artists.id, albums.artistId))
    .where(and(eq(albums.artistId, artistId), ne(albums.id, exceptAlbumId))).orderBy(desc(listeners)).limit(limit);
}

export const albumCount = (artistId: number): Promise<number> => single(db.select({ c: count() }).from(albums).where(eq(albums.artistId, artistId)));
export const trackCount = (artistId: number): Promise<number> => single(db.select({ c: count() }).from(tracks).where(eq(tracks.artistId, artistId)));

/** A row of an album's track list. `loved` is 1 when the viewer has loved the track, otherwise 0. */
export type TrackListRow = { position: number; id: number; title: string; duration: number; playcount: number; listeners: number; loved: number };
/** An album's track list in order. */
export async function trackList(albumId: number, viewerId: number): Promise<TrackListRow[]> {
  const loved = flag(exists(db.select({ one: sql`1` }).from(lovedTracks).where(and(eq(lovedTracks.userId, viewerId), eq(lovedTracks.trackId, tracks.id)))));
  return db.select({ position: albumTracks.position, id: tracks.id, title: tracks.title, duration: tracks.duration, playcount: trackPlays, listeners: trackListeners, loved })
    .from(albumTracks).innerJoin(tracks, eq(tracks.id, albumTracks.trackId)).where(eq(albumTracks.albumId, albumId)).orderBy(albumTracks.position);
}

/** Every album a track appears on. `artist` is the name to show on each (the track's artist). */
export async function albumsWithTrack(trackId: number, artist: string): Promise<TrackAlbum[]> {
  const rows = await db.select(albumCard).from(albumTracks).innerJoin(albums, eq(albums.id, albumTracks.albumId)).where(eq(albumTracks.trackId, trackId));
  return rows.map(r => ({ ...r, artist }));
}

// ---------- borrowed from other domains (see the note in each) ----------
// Listening: one person's running total for a track, and loves.
export const trackPlaysBy = (trackId: number, userId: number): Promise<number> =>
  single(db.select({ c: sql<number>`COALESCE(SUM(${userTracks.plays}), 0)` }).from(userTracks).where(and(eq(userTracks.trackId, trackId), eq(userTracks.userId, userId))));
export const hasLoved = async (userId: number, trackId: number): Promise<boolean> =>
  !!(await first(db.select({ one: sql`1` }).from(lovedTracks).where(and(eq(lovedTracks.userId, userId), eq(lovedTracks.trackId, trackId))).limit(1)));
export const loveCount = (trackId: number): Promise<number> => single(db.select({ c: count() }).from(lovedTracks).where(eq(lovedTracks.trackId, trackId)));

// Events: the listing an artist page shows. Belongs with the events domain once that exists.
/** Events an artist plays that start after `after`, soonest first, with the viewer's own answer to each. */
export async function eventsWithArtist(artistId: number, after: number, viewerId: number, limit: number): Promise<EventSummary[]> {
  const answers = (status: string) => sql<number>`(SELECT COUNT(*) FROM ${eventAttendance} WHERE ${eventAttendance.eventId} = ${events.id} AND ${eventAttendance.status} = ${status})`;
  const mine = sql<string | null>`(SELECT ${eventAttendance.status} FROM ${eventAttendance} WHERE ${eventAttendance.eventId} = ${events.id} AND ${eventAttendance.userId} = ${viewerId})`;
  const rows = await db.select({
    id: events.id, title: events.title, venue: events.venue, city: events.city, country: events.country, startsAt: events.startsAt,
    description: events.description, url: events.url, creator: users.username, going: answers("going"), interested: answers("interested"), status: mine,
  }).from(events).leftJoin(users, eq(users.id, events.creatorId))
    .where(and(gt(events.startsAt, after), inArray(events.id, db.select({ id: eventArtists.eventId }).from(eventArtists).where(eq(eventArtists.artistId, artistId)))))
    .orderBy(asc(events.startsAt)).limit(limit);
  const out: EventSummary[] = [];
  for (const e of rows) {
    const lineup = await db.select({ name: artists.name, image: artists.imageId }).from(eventArtists).innerJoin(artists, eq(artists.id, eventArtists.artistId))
      .where(eq(eventArtists.eventId, e.id)).orderBy(eventArtists.position);
    out.push({ ...e, artists: lineup });
  }
  return out;
}
