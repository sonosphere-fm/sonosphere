// Data access for the development importer (import.ts). The whole import is one transaction, so everything here
// is handed out as a set of writers bound to that transaction.
import { and, count, eq, isNull } from "drizzle-orm";
import { getOrCreateAlbumTx, getOrCreateArtistTx, getOrCreateTrackTx } from "../catalog/repo";
import { db, transact, type Tx } from "../db/client";
import {
  albums, artists, eventArtists, eventAttendance, events, follows, images, lovedTracks, meta, obsessions, playlists, scrobbles, shouts, similarArtists,
  taggings, tags, tracks, users, wikis,
} from "../db/schema";
import { getOrCreateTagTx } from "../tags/repo";
import { first } from "../util";

/** Whether the saved pages have been loaded into this database already. */
export const imported = async (): Promise<boolean> => !!(await first(db.select({ key: meta.key }).from(meta).where(eq(meta.key, "import")).limit(1)));

const CATALOGUE = { artists, albums, tracks };
export type CatalogueTable = keyof typeof CATALOGUE;
/** What can carry a picture. Tracks borrow their album's. */
export type Pictured = "artists" | "albums" | "users";
const EVENT_TEXT = { venue: events.venue, city: events.city, country: events.country, url: events.url, description: events.description };
export type EventText = keyof typeof EVENT_TEXT;
export type NewUser = { username: string; usernameNorm: string; email: string; passwordHash: string; registeredAt: number };

function writer(tx: Tx) {
  const total = (table: typeof artists | typeof albums | typeof tracks | typeof tags) => tx.select({ c: count() }).from(table).get()?.c ?? 0;
  return {
    // ---------- catalogue ----------
    artist: (name: string) => getOrCreateArtistTx(tx, name),
    album: (artistId: number, title: string) => getOrCreateAlbumTx(tx, artistId, title),
    track: (artistId: number, title: string, duration = 0, albumId: number | null = null, position?: number) => getOrCreateTrackTx(tx, artistId, title, duration, albumId, position),
    tag: (name: string) => getOrCreateTagTx(tx, name),
    albumArtist: (albumId: number) => tx.select({ artistId: albums.artistId }).from(albums).where(eq(albums.id, albumId)).get()?.artistId,
    /** Raises the listener and play totals the site itself reported. They only ever go up, and plays are never below listeners. */
    raiseBase(table: CatalogueTable, id: number, listeners: number, plays: number) {
      const t = CATALOGUE[table];
      const row = tx.select({ listeners: t.baseListeners, plays: t.basePlaycount }).from(t).where(eq(t.id, id)).get();
      if (row) tx.update(t).set({ baseListeners: Math.max(row.listeners, listeners), basePlaycount: Math.max(row.plays, plays, listeners) }).where(eq(t.id, id)).run();
    },
    /** Files a track under an album. With `onlyIfNone` a track that already has one keeps it. */
    setTrackAlbum(trackId: number, albumId: number, onlyIfNone: boolean) {
      tx.update(tracks).set({ albumId }).where(and(eq(tracks.id, trackId), onlyIfNone ? isNull(tracks.albumId) : undefined)).run();
    },
    setDuration(trackId: number, duration: number, onlyIfNone: boolean) {
      tx.update(tracks).set({ duration }).where(and(eq(tracks.id, trackId), onlyIfNone ? eq(tracks.duration, 0) : undefined)).run();
    },
    setReleaseDate(albumId: number, releaseDate: string | null, onlyIfNone: boolean) {
      tx.update(albums).set({ releaseDate }).where(and(eq(albums.id, albumId), onlyIfNone ? isNull(albums.releaseDate) : undefined)).run();
    },
    addSimilar(artistId: number, similarId: number, score: number) {
      tx.insert(similarArtists).values({ artistId, similarId, score, source: "import" })
        .onConflictDoUpdate({ target: [similarArtists.artistId, similarArtists.similarId], set: { score, source: "import" } }).run();
    },
    addTagging(tagId: number, itemType: string, itemId: number, weight: number, at: number) {
      tx.insert(taggings).values({ userId: null, tagId, itemType, itemId, createdAt: at, weight }).onConflictDoNothing().run();
    },
    addWiki(itemType: string, itemId: number, content: string, at: number) {
      tx.insert(wikis).values({ itemType, itemId, content, authorId: null, version: 1, createdAt: at }).run();
    },
    catalogueSizes: () => ({ artists: total(artists), albums: total(albums), tracks: total(tracks), tags: total(tags) }),

    // ---------- images ----------
    addImage: (mime: string, data: Buffer, at: number) => tx.insert(images).values({ mime, data, createdAt: at }).returning({ id: images.id }).get().id,
    setImage(table: Pictured, id: number, imageId: number) {
      if (table === "users") tx.update(users).set({ imageId }).where(eq(users.id, id)).run();
      else if (table === "albums") tx.update(albums).set({ imageId }).where(eq(albums.id, id)).run();
      else tx.update(artists).set({ imageId }).where(eq(artists.id, id)).run();
    },

    // ---------- people ----------
    userId: (usernameNorm: string) => tx.select({ id: users.id }).from(users).where(eq(users.usernameNorm, usernameNorm)).get()?.id,
    addUser: (u: NewUser) => tx.insert(users).values(u).returning({ id: users.id }).get().id,
    setRegistered(userId: number, registeredAt: number) { tx.update(users).set({ registeredAt }).where(eq(users.id, userId)).run(); },
    setRealname(userId: number, realname: string) { tx.update(users).set({ realname }).where(eq(users.id, userId)).run(); },
    /** These three return how many rows were added: 0 when it was there already. */
    addScrobble: (userId: number, trackId: number, artistId: number, albumId: number | null, playedAt: number) =>
      tx.insert(scrobbles).values({ userId, trackId, artistId, albumId, playedAt, source: "import" }).onConflictDoNothing().returning({ id: scrobbles.id }).all().length,
    addLoved: (userId: number, trackId: number, at: number) =>
      tx.insert(lovedTracks).values({ userId, trackId, createdAt: at }).onConflictDoNothing().returning({ trackId: lovedTracks.trackId }).all().length,
    addFollow: (followerId: number, followeeId: number, at: number) =>
      tx.insert(follows).values({ followerId, followeeId, createdAt: at }).onConflictDoNothing().returning({ followeeId: follows.followeeId }).all().length,
    /** Adds an empty playlist unless this person has one by that title. Returns whether it was added. */
    addPlaylist(userId: number, title: string, at: number): boolean {
      if (tx.select({ id: playlists.id }).from(playlists).where(and(eq(playlists.userId, userId), eq(playlists.title, title))).get()) return false;
      tx.insert(playlists).values({ userId, title, createdAt: at }).run();
      return true;
    },
    addObsession(userId: number, trackId: number, at: number): boolean {
      if (tx.select({ id: obsessions.id }).from(obsessions).where(and(eq(obsessions.userId, userId), eq(obsessions.trackId, trackId))).get()) return false;
      tx.insert(obsessions).values({ userId, trackId, createdAt: at }).run();
      return true;
    },
    addTagShout(authorId: number, tagId: number, body: string, at: number) {
      tx.insert(shouts).values({ authorId, targetType: "tag", targetId: tagId, body, createdAt: at }).run();
    },

    // ---------- events ----------
    addEvent: (title: string, startsAt: number, at: number) =>
      tx.insert(events).values({ title, venue: "", city: "", country: "", startsAt, createdAt: at }).returning({ id: events.id }).get().id,
    /** Fills one text field of an event. With `overwrite` off, a field that already says something is left alone. */
    setEventText(id: number, field: EventText, value: string, overwrite: boolean) {
      const patch: Partial<Record<EventText, string>> = { [field]: value };
      tx.update(events).set(patch).where(and(eq(events.id, id), overwrite ? undefined : eq(EVENT_TEXT[field], ""))).run();
    },
    setEventStart(id: number, startsAt: number) { tx.update(events).set({ startsAt }).where(eq(events.id, id)).run(); },
    addEventArtist(eventId: number, artistId: number, position: number) { tx.insert(eventArtists).values({ eventId, artistId, position }).onConflictDoNothing().run(); },
    addAttendance(eventId: number, userId: number, status: string, at: number) {
      tx.insert(eventAttendance).values({ eventId, userId, status, createdAt: at }).onConflictDoNothing().run();
    },

    /** Leaves the marker that says the import has run, with a summary of what it loaded. */
    markImported(summary: string) {
      tx.insert(meta).values({ key: "import", value: summary }).onConflictDoUpdate({ target: meta.key, set: { value: summary } }).run();
    },
  };
}
export type Writer = ReturnType<typeof writer>;

/** Runs `fn` in one transaction: either everything it writes is kept or none of it is. `fn` must not be async. */
export const load = <T>(fn: (w: Writer) => T): T => transact(tx => fn(writer(tx)));
