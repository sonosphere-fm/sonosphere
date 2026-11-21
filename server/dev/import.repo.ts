import { and, count, eq, isNull } from "drizzle-orm";
import { getOrCreateAlbumTx, getOrCreateArtistTx, getOrCreateTrackTx } from "../catalog/repo";
import { db, transact, type Tx } from "../db/client";
import {
  albums, artists, eventArtists, eventAttendance, events, follows, lovedTracks, meta, obsessions, playlists, scrobbles, shouts, similarArtists,
  taggings, tags, tracks, users, wikis,
} from "../db/schema";
import { getOrCreateTagTx } from "../tags/repo";
import { convert } from "../images/process";
import { saveImage } from "../images/repo";
import { first } from "../util";

export const imported = async (): Promise<boolean> => {
  const row = await first(db.select({ key: meta.key }).from(meta).where(eq(meta.key, "import")).limit(1));
  return !!row;
};

const CATALOGUE = { artists, albums, tracks };
export type CatalogueTable = keyof typeof CATALOGUE;
/** Tracks borrow their album's picture. */
export type Pictured = "artists" | "albums" | "users";
const EVENT_TEXT = { venue: events.venue, city: events.city, country: events.country, url: events.url, description: events.description };
export type EventText = keyof typeof EVENT_TEXT;
type NewUser = { username: string; usernameNorm: string; email: string; passwordHash: string; registeredAt: number };

function writer(tx: Tx) {
  const total = async (table: typeof artists | typeof albums | typeof tracks | typeof tags) =>
    (await tx.select({ c: count() }).from(table))[0]?.c ?? 0;

  return {
    artist: (name: string) => getOrCreateArtistTx(tx, name),
    album: (artistId: number, title: string) => getOrCreateAlbumTx(tx, artistId, title),
    track: (artistId: number, title: string, duration = 0, albumId: number | null = null, position?: number) =>
      getOrCreateTrackTx(tx, artistId, title, duration, albumId, position),
    tag: (name: string) => getOrCreateTagTx(tx, name),
    albumArtist: async (albumId: number) =>
      (await tx.select({ artistId: albums.artistId }).from(albums).where(eq(albums.id, albumId)))[0]?.artistId,

    /** Totals only ever go up, and plays are never below listeners. */
    async raiseBase(table: CatalogueTable, id: number, listeners: number, plays: number) {
      const t = CATALOGUE[table];
      const row = (await tx.select({ listeners: t.baseListeners, plays: t.basePlaycount }).from(t).where(eq(t.id, id)))[0];
      if (!row) return;
      await tx.update(t)
        .set({ baseListeners: Math.max(row.listeners, listeners), basePlaycount: Math.max(row.plays, plays, listeners) })
        .where(eq(t.id, id));
    },
    async setTrackAlbum(trackId: number, albumId: number, onlyIfNone: boolean) {
      const condition = onlyIfNone ? isNull(tracks.albumId) : undefined;
      await tx.update(tracks).set({ albumId }).where(and(eq(tracks.id, trackId), condition));
    },
    async setDuration(trackId: number, duration: number, onlyIfNone: boolean) {
      const condition = onlyIfNone ? eq(tracks.duration, 0) : undefined;
      await tx.update(tracks).set({ duration }).where(and(eq(tracks.id, trackId), condition));
    },
    async setReleaseDate(albumId: number, releaseDate: string | null, onlyIfNone: boolean) {
      const condition = onlyIfNone ? isNull(albums.releaseDate) : undefined;
      await tx.update(albums).set({ releaseDate }).where(and(eq(albums.id, albumId), condition));
    },
    async addSimilar(artistId: number, similarId: number, score: number) {
      await tx.insert(similarArtists)
        .values({ artistId, similarId, score, source: "import" })
        .onConflictDoUpdate({ target: [similarArtists.artistId, similarArtists.similarId], set: { score, source: "import" } });
    },
    async addTagging(tagId: number, itemType: string, itemId: number, weight: number, at: number) {
      await tx.insert(taggings).values({ userId: null, tagId, itemType, itemId, createdAt: at, weight }).onConflictDoNothing();
    },
    async addWiki(itemType: string, itemId: number, content: string, at: number) {
      await tx.insert(wikis).values({ itemType, itemId, content, authorId: null, version: 1, createdAt: at });
    },
    catalogueSizes: async () => ({
      artists: await total(artists),
      albums: await total(albums),
      tracks: await total(tracks),
      tags: await total(tags),
    }),

    // stored outside the transaction (files can't be rolled back); pictures left unused by a failed import are swept later
    addImage: async (data: Buffer, at: number) => {
      try {
        return await saveImage(await convert(data), null, at);
      } catch {
        return null;
      }
    },
    async setImage(table: Pictured, id: number, imageId: string) {
      if (table === "users") await tx.update(users).set({ imageId }).where(eq(users.id, id));
      else if (table === "albums") await tx.update(albums).set({ imageId }).where(eq(albums.id, id));
      else await tx.update(artists).set({ imageId }).where(eq(artists.id, id));
    },

    userId: async (usernameNorm: string) =>
      (await tx.select({ id: users.id }).from(users).where(eq(users.usernameNorm, usernameNorm)))[0]?.id,
    addUser: async (u: NewUser) => (await tx.insert(users).values(u).returning({ id: users.id }))[0].id,
    async setRegistered(userId: number, registeredAt: number) {
      await tx.update(users).set({ registeredAt }).where(eq(users.id, userId));
    },
    async setRealname(userId: number, realname: string) {
      await tx.update(users).set({ realname }).where(eq(users.id, userId));
    },

    // these three return how many rows were added: 0 when it was there already
    async addScrobble(userId: number, trackId: number, artistId: number, albumId: number | null, playedAt: number) {
      const rows = await tx.insert(scrobbles)
        .values({ userId, trackId, artistId, albumId, playedAt, source: "import" })
        .onConflictDoNothing()
        .returning({ id: scrobbles.id });
      return rows.length;
    },
    async addLoved(userId: number, trackId: number, at: number) {
      const rows = await tx.insert(lovedTracks)
        .values({ userId, trackId, createdAt: at })
        .onConflictDoNothing()
        .returning({ trackId: lovedTracks.trackId });
      return rows.length;
    },
    async addFollow(followerId: number, followeeId: number, at: number) {
      const rows = await tx.insert(follows)
        .values({ followerId, followeeId, createdAt: at })
        .onConflictDoNothing()
        .returning({ followeeId: follows.followeeId });
      return rows.length;
    },

    async addPlaylist(userId: number, title: string, at: number): Promise<boolean> {
      const existing = await tx.select({ id: playlists.id })
        .from(playlists)
        .where(and(eq(playlists.userId, userId), eq(playlists.title, title)));
      if (existing[0]) return false;
      await tx.insert(playlists).values({ userId, title, createdAt: at });
      return true;
    },
    async addObsession(userId: number, trackId: number, at: number): Promise<boolean> {
      const existing = await tx.select({ id: obsessions.id })
        .from(obsessions)
        .where(and(eq(obsessions.userId, userId), eq(obsessions.trackId, trackId)));
      if (existing[0]) return false;
      await tx.insert(obsessions).values({ userId, trackId, createdAt: at });
      return true;
    },
    async addTagShout(authorId: number, tagId: number, body: string, at: number) {
      await tx.insert(shouts).values({ authorId, targetType: "tag", targetId: tagId, body, createdAt: at });
    },

    addEvent: async (title: string, startsAt: number, at: number) => {
      const rows = await tx.insert(events)
        .values({ title, venue: "", city: "", country: "", startsAt, createdAt: at })
        .returning({ id: events.id });
      return rows[0].id;
    },
    /** With `overwrite` off, a field that already says something is left alone. */
    async setEventText(id: number, field: EventText, value: string, overwrite: boolean) {
      const patch: Partial<Record<EventText, string>> = { [field]: value };
      const condition = overwrite ? undefined : eq(EVENT_TEXT[field], "");
      await tx.update(events).set(patch).where(and(eq(events.id, id), condition));
    },
    async setEventStart(id: number, startsAt: number) {
      await tx.update(events).set({ startsAt }).where(eq(events.id, id));
    },
    async addEventArtist(eventId: number, artistId: number, position: number) {
      await tx.insert(eventArtists).values({ eventId, artistId, position }).onConflictDoNothing();
    },
    async addAttendance(eventId: number, userId: number, status: string, at: number) {
      await tx.insert(eventAttendance).values({ eventId, userId, status, createdAt: at }).onConflictDoNothing();
    },

    async markImported(summary: string) {
      await tx.insert(meta)
        .values({ key: "import", value: summary })
        .onConflictDoUpdate({ target: meta.key, set: { value: summary } });
    },
  };
}
export type Writer = ReturnType<typeof writer>;

export const load = <T>(fn: (w: Writer) => T): Promise<T> => transact(async tx => fn(writer(tx)));
