import { and, asc, count, countDistinct, desc, eq, exists, gte, sql } from "drizzle-orm";
import { trackImage } from "../catalog/art";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../db/client";
import { flag } from "../db/dialect";
import { albums, artists, eventArtists, eventAttendance, events, follows, lovedTracks, scrobbles, taggings, tags, tracks, users } from "../db/schema";
import { openListener, publicCols } from "../users/repo";
import type { EventSummary } from "../../shared/events";
import type { ChartTag, FriendLove, SiteTotals } from "../../shared/home";
import type { TagCount } from "../../shared/tags";
import type { PublicUser } from "../../shared/users";

const total = async (rows: PromiseLike<{ c: number }[]>) => (await rows)[0]?.c ?? 0;

const applied = count().as("count");

export const tagChart = (limit: number, offset: number): Promise<ChartTag[]> =>
  db.select({ name: tags.name, count: applied, taggers: countDistinct(taggings.userId).as("taggers") }).from(taggings)
    .innerJoin(tags, eq(tags.id, taggings.tagId))
    .groupBy(tags.id)
    .orderBy(desc(applied))
    .limit(limit)
    .offset(offset);

export const usedTagCount = (): Promise<number> =>
  total(db.select({ c: countDistinct(taggings.tagId) }).from(taggings));

export const popularTags = (limit: number): Promise<TagCount[]> =>
  db.select({ name: tags.name, count: applied }).from(taggings)
    .innerJoin(tags, eq(tags.id, taggings.tagId))
    .groupBy(tags.id)
    .orderBy(desc(applied))
    .limit(limit);

const headCount = (status: string) => {
  const q = db.select({ c: count() }).from(eventAttendance)
    .where(and(eq(eventAttendance.eventId, events.id), eq(eventAttendance.status, status)));
  return sql<number>`(${q})`;
};

const answerOf = (viewerId: number) => {
  const q = db.select({ status: eventAttendance.status }).from(eventAttendance)
    .where(and(eq(eventAttendance.eventId, events.id), eq(eventAttendance.userId, viewerId)));
  return sql<EventSummary["status"]>`(${q})`;
};

const lineupOf = (eventId: number) =>
  db.select({ name: artists.name, image: artists.imageId }).from(eventArtists)
    .innerJoin(artists, eq(artists.id, eventArtists.artistId))
    .where(eq(eventArtists.eventId, eventId))
    .orderBy(eventArtists.position);

export async function upcomingEvents(from: number, viewerId: number | undefined, limit: number): Promise<EventSummary[]> {
  const rows = await db.select({
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
    going: headCount("going"),
    interested: headCount("interested"),
    status: answerOf(viewerId || 0),
  })
    .from(events)
    .leftJoin(users, eq(users.id, events.creatorId))
    .where(gte(events.startsAt, from))
    .orderBy(asc(events.startsAt))
    .limit(limit);
  const out: EventSummary[] = [];
  for (const e of rows) {
    out.push({ ...e, artists: await lineupOf(e.id) });
  }
  return out;
}

export async function siteTotals(): Promise<SiteTotals> {
  return {
    scrobbles: await total(db.select({ c: count() }).from(scrobbles)),
    users: await total(db.select({ c: count() }).from(users)),
    artists: await total(db.select({ c: count() }).from(artists)),
    tracks: await total(db.select({ c: count() }).from(tracks)),
  };
}

export const openFollowees = (userId: number): Promise<PublicUser[]> =>
  db.select(publicCols).from(follows)
    .innerJoin(users, eq(users.id, follows.followeeId))
    .where(and(eq(follows.followerId, userId), openListener()));

export function friendLoves(userId: number, limit: number): Promise<FriendLove[]> {
  const own = alias(lovedTracks, "v");
  const lovedByViewer = db.select({ one: sql`1` }).from(own)
    .where(and(eq(own.userId, userId), eq(own.trackId, tracks.id)));
  return db.select({
    id: tracks.id,
    title: tracks.title,
    duration: tracks.duration,
    artist: artists.name,
    album: albums.title,
    image: trackImage(),
    lovedAt: lovedTracks.createdAt,
    user: users.username,
    userImage: users.imageId,
    loved: flag(exists(lovedByViewer)),
  })
    .from(lovedTracks)
    .innerJoin(follows, and(eq(follows.followeeId, lovedTracks.userId), eq(follows.followerId, userId)))
    .innerJoin(users, eq(users.id, lovedTracks.userId))
    .innerJoin(tracks, eq(tracks.id, lovedTracks.trackId))
    .innerJoin(artists, eq(artists.id, tracks.artistId))
    .leftJoin(albums, eq(albums.id, tracks.albumId))
    .where(eq(users.privateListening, false))
    .orderBy(desc(lovedTracks.createdAt))
    .limit(limit);
}
