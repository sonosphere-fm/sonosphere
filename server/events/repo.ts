// Data access for events, their line-ups and who is going.
import { and, asc, count, desc, eq, gte, inArray, lt, or, sql, type SQL } from "drizzle-orm";
import { getOrCreateArtistTx } from "../catalog/repo";
import { db, transact } from "../db/client";
import { artists, eventArtists, eventAttendance, events, userArtists, users } from "../db/schema";
import { publicCols } from "../users/repo";
import { now } from "../util";
import type { Attendance, EventArtist, EventSummary } from "../../shared/events";
import type { PublicUser } from "../../shared/users";

/** Which events a list covers. Every field narrows it. */
export type Filter = {
  id?: number;
  /** Starting before this time (Unix seconds). */
  before?: number;
  /** Starting at or after this time. */
  from?: number;
  /** Lower-case text to find in the title, venue, city or country. `%` and `_` act as wildcards, as they always have. */
  text?: string;
  /** Events this user has said they are going to or interested in. */
  attendee?: number;
  /** Events with one of this user's 50 most played artists on the bill. */
  fanOf?: number;
  /** Events at a venue within `km` of a point. */
  near?: { lat: number; lon: number; km: number };
  /** Events in this country (its English name, as stored). */
  country?: string;
};

function matching(f: Filter): SQL | undefined {
  const c: SQL[] = [];
  if (f.id !== undefined) c.push(eq(events.id, f.id));
  if (f.before !== undefined) c.push(lt(events.startsAt, f.before));
  if (f.from !== undefined) c.push(gte(events.startsAt, f.from));
  if (f.text) {
    const pattern = `%${f.text}%`;
    const any = or(...[events.city, events.country, events.venue, events.title].map(col => sql`lower(${col}) LIKE ${pattern}`));
    if (any) c.push(any);
  }
  if (f.attendee !== undefined) c.push(inArray(events.id, db.select({ id: eventAttendance.eventId }).from(eventAttendance).where(eq(eventAttendance.userId, f.attendee))));
  if (f.fanOf !== undefined) {
    const favourites = db.select({ id: userArtists.artistId }).from(userArtists).where(eq(userArtists.userId, f.fanOf)).orderBy(desc(userArtists.plays)).limit(50);
    c.push(inArray(events.id, db.select({ id: eventArtists.eventId }).from(eventArtists).where(inArray(eventArtists.artistId, favourites))));
  }
  if (f.near) {
    const { lat, lon, km } = f.near, dLat = km / 111, dLon = km / (111 * Math.max(0.1, Math.cos(lat * Math.PI / 180)));
    // a box first (cheap), then the great-circle distance
    c.push(sql`${events.lat} BETWEEN ${lat - dLat} AND ${lat + dLat} AND ${events.lon} BETWEEN ${lon - dLon} AND ${lon + dLon}`);
    c.push(sql`6371 * 2 * asin(sqrt(power(sin(radians(${events.lat} - ${lat}) / 2), 2)
      + cos(radians(${lat})) * cos(radians(${events.lat})) * power(sin(radians(${events.lon} - ${lon}) / 2), 2))) <= ${km}`);
  }
  if (f.country) c.push(sql`lower(${events.country}) = ${f.country.toLowerCase()}`);
  return and(...c);
}

const headCount = (status: Attendance) => db.select({ c: count() }).from(eventAttendance).where(and(eq(eventAttendance.eventId, events.id), eq(eventAttendance.status, status)));

/** An event's line-up, in billing order. */
export const lineup = (eventId: number): Promise<EventArtist[]> =>
  db.select({ name: artists.name, image: artists.imageId }).from(eventArtists).innerJoin(artists, eq(artists.id, eventArtists.artistId))
    .where(eq(eventArtists.eventId, eventId)).orderBy(asc(eventArtists.position));

/** Events matching a filter, by start time, each with its line-up, head counts and what the viewer said about it. */
export async function listEvents(f: Filter, viewerId: number | undefined, order: "asc" | "desc", limit: number, offset = 0): Promise<EventSummary[]> {
  const mine = db.select({ status: eventAttendance.status }).from(eventAttendance).where(and(eq(eventAttendance.eventId, events.id), eq(eventAttendance.userId, viewerId || 0)));
  const rows = await db.select({
    id: events.id, title: events.title, venue: events.venue, city: events.city, country: events.country, startsAt: events.startsAt,
    description: events.description, url: events.url, creator: users.username, source: events.source,
    going: sql<number>`${headCount("going")}`, interested: sql<number>`${headCount("interested")}`,
    // the status column only ever holds the two values of Attendance (see setAttendance)
    status: sql<Attendance | null>`${mine}`,
  }).from(events).leftJoin(users, eq(users.id, events.creatorId)).where(matching(f))
    .orderBy(order === "asc" ? asc(events.startsAt) : desc(events.startsAt)).limit(limit).offset(offset);
  return Promise.all(rows.map(async e => ({ ...e, artists: await lineup(e.id) })));
}

export const countEvents = async (f: Filter): Promise<number> => (await db.select({ c: count() }).from(events).where(matching(f)))[0]?.c ?? 0;

/** The latest 40 people who gave this answer for an event. */
export const attendees = (eventId: number, status: Attendance): Promise<PublicUser[]> =>
  db.select(publicCols).from(eventAttendance).innerJoin(users, eq(users.id, eventAttendance.userId))
    .where(and(eq(eventAttendance.eventId, eventId), eq(eventAttendance.status, status))).orderBy(desc(eventAttendance.createdAt)).limit(40);

export type NewEvent = { title: string; venue: string; city: string; country: string; startsAt: number; description: string; url: string };

/**
 * Adds an event with its line-up (artists new to the catalogue are added to it) and marks the creator as going.
 * Returns the event's id.
 */
export async function createEvent(e: NewEvent, artistNames: string[], creatorId: number): Promise<number> {
  return (await transact(async tx => {
    const id = (await tx.insert(events).values({ ...e, creatorId, createdAt: now() }).returning({ id: events.id }))[0].id;
    for (const [position, name] of artistNames.entries()) {
      await tx.insert(eventArtists).values({ eventId: id, artistId: await getOrCreateArtistTx(tx, name), position }).onConflictDoNothing();
    }
    await tx.insert(eventAttendance).values({ eventId: id, userId: creatorId, status: "going", createdAt: now() });
    return id;
  }));
}

/** Deletes an event if this user created it. False when they did not (or there is no such event). */
export const deleteOwnEvent = async (id: number, creatorId: number): Promise<boolean> =>
  (await db.delete(events).where(and(eq(events.id, id), eq(events.creatorId, creatorId))).returning({ id: events.id })).length > 0;

/** Records what a user says about an event, replacing any earlier answer. Null withdraws it. */
export async function setAttendance(eventId: number, userId: number, status: Attendance | null): Promise<void> {
  await transact(async tx => {
    await tx.delete(eventAttendance).where(and(eq(eventAttendance.eventId, eventId), eq(eventAttendance.userId, userId)));
    if (status) await tx.insert(eventAttendance).values({ eventId, userId, status, createdAt: now() });
  });
}
