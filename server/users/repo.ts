// Data access for accounts, and the public shape of one.
import { and, count, desc, eq, exists, min, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { db } from "../db/client";
import { flag } from "../db/dialect";
import { albums, artists, blocks, follows, journals, lovedTracks, scrobbles, taggings, tags, tracks, userArtists, users } from "../db/schema";
import { first, norm, now } from "../util";
import type { TagCount } from "../../shared/tags";
import type { LovedTrack, Person, PublicUser, TaggedItem } from "../../shared/users";

/** An account as stored. */
export type User = typeof users.$inferSelect;

/** The columns that make a PublicUser. Spread into a select to add a person to any query that joins `users`. */
export const publicCols = { id: users.id, username: users.username, realname: users.realname, country: users.country, image: users.imageId };

type Named = Pick<User, "id" | "username" | "realname" | "country">;
/** The public part of an account, from a stored row or from a row selected with `publicCols` plus other fields. */
export const publicUser = (u: Named & ({ imageId: number | null } | { image: number | null })): PublicUser =>
  ({ id: u.id, username: u.username, realname: u.realname, country: u.country, image: ("imageId" in u ? u.imageId : u.image) ?? null });

export const findByName = (name: string): Promise<User | null> => first(db.select().from(users).where(eq(users.usernameNorm, norm(name))).limit(1));
export const findById = (id: number): Promise<User | null> => first(db.select().from(users).where(eq(users.id, id)).limit(1));

/** True when either account has blocked the other. */
export async function blockedEither(a: number, b: number): Promise<boolean> {
  return !!(await first(db.select({ one: sql`1` }).from(blocks)
    .where(or(and(eq(blocks.blockerId, a), eq(blocks.blockedId, b)), and(eq(blocks.blockerId, b), eq(blocks.blockedId, a)))).limit(1)));
}

const total = async (rows: PromiseLike<{ c: number }[]>) => (await rows)[0]?.c ?? 0;
const found = async (rows: PromiseLike<unknown[]>) => (await rows).length > 0;

// ---------- following and blocking ----------
export const followerCount = (userId: number): Promise<number> => total(db.select({ c: count() }).from(follows).where(eq(follows.followeeId, userId)));
export const followingCount = (userId: number): Promise<number> => total(db.select({ c: count() }).from(follows).where(eq(follows.followerId, userId)));
/** True when `followerId` follows `followeeId`. */
export const isFollowing = (followerId: number, followeeId: number): Promise<boolean> =>
  found(db.select({ one: sql`1` }).from(follows).where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId))).limit(1));
/** True when `blockerId` has blocked `blockedId` (one direction only, unlike blockedEither). */
export const hasBlocked = (blockerId: number, blockedId: number): Promise<boolean> =>
  found(db.select({ one: sql`1` }).from(blocks).where(and(eq(blocks.blockerId, blockerId), eq(blocks.blockedId, blockedId))).limit(1));

/** Starts following someone. False when they were followed already. */
export const follow = (followerId: number, followeeId: number): Promise<boolean> =>
  found(db.insert(follows).values({ followerId, followeeId, createdAt: now() }).onConflictDoNothing().returning({ id: follows.followeeId }));
export async function unfollow(followerId: number, followeeId: number): Promise<void> {
  await db.delete(follows).where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)));
}

/** The people a user follows, the latest first. */
export const followingOf = (userId: number): Promise<PublicUser[]> =>
  db.select(publicCols).from(follows).innerJoin(users, eq(users.id, follows.followeeId)).where(eq(follows.followerId, userId)).orderBy(desc(follows.createdAt));
/** The people who follow a user, the latest first. */
export const followersOf = (userId: number): Promise<PublicUser[]> =>
  db.select(publicCols).from(follows).innerJoin(users, eq(users.id, follows.followerId)).where(eq(follows.followeeId, userId)).orderBy(desc(follows.createdAt));

// ---------- a listener at a glance ----------
/** Everything a user has ever played, from the running totals. */
export const playcount = (userId: number): Promise<number> =>
  total(db.select({ c: sql<number>`COALESCE(SUM(${userArtists.plays}), 0)` }).from(userArtists).where(eq(userArtists.userId, userId)));

/** The last thing a user played, or null when there is nothing or they keep their listening private. */
export const lastTrack = (userId: number): Promise<Person["lastTrack"]> =>
  first(db.select({ title: tracks.title, artist: artists.name, playedAt: scrobbles.playedAt }).from(scrobbles)
    .innerJoin(tracks, eq(tracks.id, scrobbles.trackId)).innerJoin(artists, eq(artists.id, scrobbles.artistId)).innerJoin(users, eq(users.id, scrobbles.userId))
    .where(and(eq(scrobbles.userId, userId), eq(users.hideRecent, false))).orderBy(desc(scrobbles.playedAt)).limit(1));

/** When a user first played an artist, or null if they never have. */
export const firstPlay = async (userId: number, artistId: number): Promise<number | null> =>
  (await first(db.select({ t: min(scrobbles.playedAt) }).from(scrobbles).where(and(eq(scrobbles.userId, userId), eq(scrobbles.artistId, artistId)))))?.t ?? null;

export const journalCount = (userId: number): Promise<number> => total(db.select({ c: count() }).from(journals).where(eq(journals.userId, userId)));

// ---------- loved tracks ----------
/** 1 when the viewer has loved the track in the row, otherwise 0. For selects that join `tracks`. */
export const lovedBy = (viewerId: number | undefined) => flag(exists(db.select({ one: sql`1` }).from(lovedTracks)
  .where(and(eq(lovedTracks.userId, viewerId || 0), eq(lovedTracks.trackId, tracks.id)))));

export const lovedCount = (userId: number): Promise<number> => total(db.select({ c: count() }).from(lovedTracks).where(eq(lovedTracks.userId, userId)));

/** The tracks a user loves, the latest first. `loved` says whether the viewer loves each one too. */
export function lovedTracksOf(userId: number, viewerId: number | undefined, limit: number, offset: number): Promise<LovedTrack[]> {
  const l = alias(lovedTracks, "l");
  return db.select({
    id: tracks.id, title: tracks.title, duration: tracks.duration, artist: artists.name, album: albums.title, image: albums.imageId,
    lovedAt: l.createdAt, loved: lovedBy(viewerId),
  }).from(l).innerJoin(tracks, eq(tracks.id, l.trackId)).innerJoin(artists, eq(artists.id, tracks.artistId)).leftJoin(albums, eq(albums.id, tracks.albumId))
    .where(eq(l.userId, userId)).orderBy(desc(l.createdAt)).limit(limit).offset(offset);
}

// ---------- tags a user has used ----------
/** A user's tags, the most used first. */
export function tagsUsedBy(userId: number): Promise<TagCount[]> {
  const uses = count().as("count");
  return db.select({ name: tags.name, count: uses }).from(taggings).innerJoin(tags, eq(tags.id, taggings.tagId))
    .where(eq(taggings.userId, userId)).groupBy(tags.id).orderBy(desc(uses), tags.name);
}

/** The artists, albums and tracks a user put one tag on, the latest first. */
export function taggedBy(userId: number, tagId: number): Promise<TaggedItem[]> {
  const x = alias(taggings, "x"), a = alias(artists, "a");
  const artistName = db.select({ n: artists.name }).from(artists).where(eq(artists.id, x.itemId));
  const albumTitle = db.select({ n: albums.title }).from(albums).where(eq(albums.id, x.itemId));
  const trackTitle = db.select({ n: tracks.title }).from(tracks).where(eq(tracks.id, x.itemId));
  const albumArtist = db.select({ n: a.name }).from(albums).innerJoin(a, eq(a.id, albums.artistId)).where(eq(albums.id, x.itemId));
  const trackArtist = db.select({ n: a.name }).from(tracks).innerJoin(a, eq(a.id, tracks.artistId)).where(eq(tracks.id, x.itemId));
  return db.select({
    type: x.itemType, id: x.itemId,
    name: sql<string | null>`CASE ${x.itemType} WHEN 'artist' THEN ${artistName} WHEN 'album' THEN ${albumTitle} ELSE ${trackTitle} END`,
    artist: sql<string | null>`CASE ${x.itemType} WHEN 'artist' THEN NULL WHEN 'album' THEN ${albumArtist} ELSE ${trackArtist} END`,
  }).from(x).where(and(eq(x.userId, userId), eq(x.tagId, tagId))).orderBy(desc(x.createdAt));
}

