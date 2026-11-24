import { and, count, desc, eq, exists, inArray, min, or, sql } from "drizzle-orm";
import { trackImage } from "../catalog/art";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../db/client";
import { flag } from "../db/dialect";
import {
  albums,
  artists,
  blocks,
  follows,
  journals,
  lovedTracks,
  scrobbles,
  taggings,
  tags,
  tracks,
  userArtists,
  users,
} from "../db/schema";
import { first, norm, now } from "../util";
import type { TagCount } from "../../shared/tags";
import { aliasUser } from "../account/usernames";
import type { LovedTrack, Person, PublicUser, TaggedItem } from "../../shared/users";
import { appearanceCols, userAppearance } from "./appearance";

export type User = typeof users.$inferSelect;

export const openListener = () => and(eq(users.hideRecent, false), eq(users.privateListening, false));
export const publicCols = {
  ...appearanceCols,
  id: users.id,
  username: users.username,
  realname: users.realname,
  country: users.country,
  image: users.imageId,
};

type Named = Pick<
  User,
  "id" | "username" | "realname" | "country" | "usernameFont" | "profileAccent" | "profileAccentEnd"
>;
// Accepts a stored row or a row selected with `publicCols`.
export const publicUser = (u: Named & ({ imageId: string | null } | { image: string | null })): PublicUser => ({
  ...userAppearance(u),
  id: u.id,
  username: u.username,
  realname: u.realname,
  country: u.country,
  image: "imageId" in u ? u.imageId : u.image,
});

export const findByName = async (name: string): Promise<User | null> =>
  (await first(
    db
      .select()
      .from(users)
      .where(eq(users.usernameNorm, norm(name)))
      .limit(1)
  )) ?? aliasUser(name);
export const findById = (id: number): Promise<User | null> =>
  first(db.select().from(users).where(eq(users.id, id)).limit(1));

export async function blockedEither(a: number, b: number): Promise<boolean> {
  const either = or(
    and(eq(blocks.blockerId, a), eq(blocks.blockedId, b)),
    and(eq(blocks.blockerId, b), eq(blocks.blockedId, a))
  );
  return !!(await first(db.select({ one: sql`1` }).from(blocks).where(either).limit(1)));
}

// Those of `among` who have blocked, or been blocked by, any of `of`.
export async function blockedAmong(of: number[], among: number[]): Promise<Set<number>> {
  const rows = await db
    .select({ blocker: blocks.blockerId, blocked: blocks.blockedId })
    .from(blocks)
    .where(
      or(
        and(inArray(blocks.blockerId, of), inArray(blocks.blockedId, among)),
        and(inArray(blocks.blockedId, of), inArray(blocks.blockerId, among))
      )
    );
  const others = new Set(among);
  return new Set(rows.map((r) => (others.has(r.blocked) ? r.blocked : r.blocker)));
}

const total = async (rows: PromiseLike<{ c: number }[]>) => (await rows)[0]?.c ?? 0;
const found = async (rows: PromiseLike<unknown[]>) => (await rows).length > 0;

export const followerCount = (userId: number): Promise<number> =>
  total(db.select({ c: count() }).from(follows).where(eq(follows.followeeId, userId)));
export const followingCount = (userId: number): Promise<number> =>
  total(db.select({ c: count() }).from(follows).where(eq(follows.followerId, userId)));
export const isFollowing = (followerId: number, followeeId: number): Promise<boolean> =>
  found(
    db
      .select({ one: sql`1` })
      .from(follows)
      .where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)))
      .limit(1)
  );
export const hasBlocked = (blockerId: number, blockedId: number): Promise<boolean> =>
  found(
    db
      .select({ one: sql`1` })
      .from(blocks)
      .where(and(eq(blocks.blockerId, blockerId), eq(blocks.blockedId, blockedId)))
      .limit(1)
  );

// False when they were followed already.
export const follow = (followerId: number, followeeId: number): Promise<boolean> =>
  found(
    db
      .insert(follows)
      .values({ followerId, followeeId, createdAt: now() })
      .onConflictDoNothing()
      .returning({ id: follows.followeeId })
  );
export async function unfollow(followerId: number, followeeId: number): Promise<void> {
  await db.delete(follows).where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)));
}

const followingList = (userId: number) =>
  db
    .select(publicCols)
    .from(follows)
    .innerJoin(users, eq(users.id, follows.followeeId))
    .where(eq(follows.followerId, userId))
    .orderBy(desc(follows.createdAt))
    .$dynamic();
const followerList = (userId: number) =>
  db
    .select(publicCols)
    .from(follows)
    .innerJoin(users, eq(users.id, follows.followerId))
    .where(eq(follows.followeeId, userId))
    .orderBy(desc(follows.createdAt))
    .$dynamic();
export const followingOf = (userId: number): Promise<PublicUser[]> => followingList(userId);
export const followersOf = (userId: number): Promise<PublicUser[]> => followerList(userId);
export const followingPage = (userId: number, limit: number, offset: number): Promise<PublicUser[]> =>
  followingList(userId).limit(limit).offset(offset);
export const followerPage = (userId: number, limit: number, offset: number): Promise<PublicUser[]> =>
  followerList(userId).limit(limit).offset(offset);

export async function playcounts(ids: number[]): Promise<Map<number, number>> {
  if (!ids.length) return new Map();
  const rows = await db
    .select({ id: userArtists.userId, c: sql<number>`COALESCE(SUM(${userArtists.plays}), 0)`.mapWith(Number) })
    .from(userArtists)
    .where(inArray(userArtists.userId, ids))
    .groupBy(userArtists.userId);
  return new Map(rows.map((r) => [r.id, r.c]));
}

export async function followedAmong(followerId: number, ids: number[]): Promise<Set<number>> {
  if (!ids.length) return new Set();
  const rows = await db
    .select({ id: follows.followeeId })
    .from(follows)
    .where(and(eq(follows.followerId, followerId), inArray(follows.followeeId, ids)));
  return new Set(rows.map((r) => r.id));
}

export async function privateAmong(ids: number[]): Promise<Set<number>> {
  if (!ids.length) return new Set();
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(inArray(users.id, ids), eq(users.privateListening, true)));
  return new Set(rows.map((r) => r.id));
}

type LastTrack = NonNullable<Person["lastTrack"]>;
export async function lastTracks(ids: number[]): Promise<Map<number, LastTrack>> {
  if (!ids.length) return new Map();
  const last = db
    .select({ title: tracks.title, artist: artists.name, playedAt: scrobbles.playedAt })
    .from(scrobbles)
    .innerJoin(tracks, eq(tracks.id, scrobbles.trackId))
    .innerJoin(artists, eq(artists.id, scrobbles.artistId))
    .where(eq(scrobbles.userId, users.id))
    .orderBy(desc(scrobbles.playedAt))
    .limit(1)
    .as("last");
  const rows = await db
    .select({ id: users.id, title: last.title, artist: last.artist, playedAt: last.playedAt })
    .from(users)
    .innerJoinLateral(last, sql`true`)
    .where(and(inArray(users.id, ids), openListener()));
  return new Map(rows.map(({ id, ...t }) => [id, t]));
}

export async function firstPlay(userId: number, artistId: number): Promise<number | null> {
  const row = await first(
    db
      .select({ t: min(scrobbles.playedAt) })
      .from(scrobbles)
      .where(and(eq(scrobbles.userId, userId), eq(scrobbles.artistId, artistId)))
  );
  return row?.t ?? null;
}

export const journalCount = (userId: number): Promise<number> =>
  total(db.select({ c: count() }).from(journals).where(eq(journals.userId, userId)));

// For selects that join `tracks`.
export const lovedBy = (viewerId: number | undefined) =>
  flag(
    exists(
      db
        .select({ one: sql`1` })
        .from(lovedTracks)
        .where(and(eq(lovedTracks.userId, viewerId || 0), eq(lovedTracks.trackId, tracks.id)))
    )
  );

export const lovedCount = (userId: number): Promise<number> =>
  total(db.select({ c: count() }).from(lovedTracks).where(eq(lovedTracks.userId, userId)));

export function lovedTracksOf(
  userId: number,
  viewerId: number | undefined,
  limit: number,
  offset: number
): Promise<LovedTrack[]> {
  const l = alias(lovedTracks, "l");
  return db
    .select({
      id: tracks.id,
      title: tracks.title,
      duration: tracks.duration,
      artist: artists.name,
      album: albums.title,
      image: trackImage(),
      lovedAt: l.createdAt,
      loved: lovedBy(viewerId),
    })
    .from(l)
    .innerJoin(tracks, eq(tracks.id, l.trackId))
    .innerJoin(artists, eq(artists.id, tracks.artistId))
    .leftJoin(albums, eq(albums.id, tracks.albumId))
    .where(eq(l.userId, userId))
    .orderBy(desc(l.createdAt))
    .limit(limit)
    .offset(offset);
}

export function tagsUsedBy(userId: number): Promise<TagCount[]> {
  const uses = count().as("count");
  return db
    .select({ name: tags.name, count: uses })
    .from(taggings)
    .innerJoin(tags, eq(tags.id, taggings.tagId))
    .where(eq(taggings.userId, userId))
    .groupBy(tags.id)
    .orderBy(desc(uses), tags.name);
}

export function taggedBy(userId: number, tagId: number): Promise<TaggedItem[]> {
  const x = alias(taggings, "x");
  const a = alias(artists, "a");
  const artistName = db.select({ n: artists.name }).from(artists).where(eq(artists.id, x.itemId));
  const albumTitle = db.select({ n: albums.title }).from(albums).where(eq(albums.id, x.itemId));
  const trackTitle = db.select({ n: tracks.title }).from(tracks).where(eq(tracks.id, x.itemId));
  const albumArtist = db
    .select({ n: a.name })
    .from(albums)
    .innerJoin(a, eq(a.id, albums.artistId))
    .where(eq(albums.id, x.itemId));
  const trackArtist = db
    .select({ n: a.name })
    .from(tracks)
    .innerJoin(a, eq(a.id, tracks.artistId))
    .where(eq(tracks.id, x.itemId));
  return db
    .select({
      type: x.itemType,
      id: x.itemId,
      name: sql<
        string | null
      >`CASE ${x.itemType} WHEN 'artist' THEN ${artistName} WHEN 'album' THEN ${albumTitle} ELSE ${trackTitle} END`,
      artist: sql<
        string | null
      >`CASE ${x.itemType} WHEN 'artist' THEN NULL WHEN 'album' THEN ${albumArtist} ELSE ${trackArtist} END`,
    })
    .from(x)
    .where(and(eq(x.userId, userId), eq(x.tagId, tagId)))
    .orderBy(desc(x.createdAt));
}
