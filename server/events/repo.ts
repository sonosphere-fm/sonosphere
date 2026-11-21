import { and, asc, count, desc, eq, gte, inArray, lt, or, sql, type SQL } from "drizzle-orm";
import { getOrCreateArtistTx } from "../catalog/repo";
import { db, transact } from "../db/client";
import { artists, eventArtists, eventAttendance, events, userArtists, users } from "../db/schema";
import { publicCols } from "../users/repo";
import { now } from "../util";
import type { Attendance, EventArtist, EventPlace, EventSummary } from "../../shared/events";
import type { PublicUser } from "../../shared/users";

/** Every field narrows the list. */
export type Filter = {
  id?: number;
  before?: number;
  from?: number;
  /** Lower-case; `%` and `_` act as wildcards, as they always have. */
  text?: string;
  attendee?: number;
  /** Events with one of this user's 50 most played artists on the bill. */
  fanOf?: number;
  near?: { lat: number; lon: number; km: number };
  country?: string;
};

function nearby(lat: number, lon: number, km: number): SQL[] {
  const dLat = km / 111;
  const dLon = km / (111 * Math.max(0.1, Math.cos(lat * Math.PI / 180)));
  // a cheap bounding box first, then the great-circle distance
  return [
    sql`${events.lat} BETWEEN ${lat - dLat} AND ${lat + dLat} AND ${events.lon} BETWEEN ${lon - dLon} AND ${lon + dLon}`,
    sql`6371 * 2 * asin(sqrt(power(sin(radians(${events.lat} - ${lat}) / 2), 2)
      + cos(radians(${lat})) * cos(radians(${events.lat})) * power(sin(radians(${events.lon} - ${lon}) / 2), 2))) <= ${km}`,
  ];
}

function matching(f: Filter): SQL | undefined {
  const c: SQL[] = [];
  if (f.id !== undefined) c.push(eq(events.id, f.id));
  if (f.before !== undefined) c.push(lt(events.startsAt, f.before));
  if (f.from !== undefined) c.push(gte(events.startsAt, f.from));
  if (f.text) {
    const pattern = `%${f.text}%`;
    const cols = [events.city, events.country, events.venue, events.title];
    const any = or(...cols.map(col => sql`lower(${col}) LIKE ${pattern}`));
    if (any) c.push(any);
  }
  if (f.attendee !== undefined) {
    const attending = db.select({ id: eventAttendance.eventId }).from(eventAttendance).where(eq(eventAttendance.userId, f.attendee));
    c.push(inArray(events.id, attending));
  }
  if (f.fanOf !== undefined) {
    const favourites = db.select({ id: userArtists.artistId }).from(userArtists)
      .where(eq(userArtists.userId, f.fanOf))
      .orderBy(desc(userArtists.plays))
      .limit(50);
    const billed = db.select({ id: eventArtists.eventId }).from(eventArtists).where(inArray(eventArtists.artistId, favourites));
    c.push(inArray(events.id, billed));
  }
  if (f.near) c.push(...nearby(f.near.lat, f.near.lon, f.near.km));
  if (f.country) c.push(sql`lower(${events.country}) = ${f.country.toLowerCase()}`);
  return and(...c);
}

const headCount = (status: Attendance) =>
  db.select({ c: count() }).from(eventAttendance)
    .where(and(eq(eventAttendance.eventId, events.id), eq(eventAttendance.status, status)));

const lineup = (eventId: number): Promise<EventArtist[]> =>
  db.select({ name: artists.name, image: artists.imageId })
    .from(eventArtists)
    .innerJoin(artists, eq(artists.id, eventArtists.artistId))
    .where(eq(eventArtists.eventId, eventId))
    .orderBy(asc(eventArtists.position));

export async function listEvents(f: Filter, viewerId: number | undefined, order: "asc" | "desc", limit: number, offset = 0): Promise<EventSummary[]> {
  const mine = db.select({ status: eventAttendance.status }).from(eventAttendance)
    .where(and(eq(eventAttendance.eventId, events.id), eq(eventAttendance.userId, viewerId || 0)));
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
    going: sql<number>`${headCount("going")}`,
    interested: sql<number>`${headCount("interested")}`,
    status: sql<Attendance | null>`${mine}`,
  })
    .from(events)
    .leftJoin(users, eq(users.id, events.creatorId))
    .where(matching(f))
    .orderBy(order === "asc" ? asc(events.startsAt) : desc(events.startsAt))
    .limit(limit)
    .offset(offset);
  return Promise.all(rows.map(async e => ({ ...e, artists: await lineup(e.id) })));
}

export const countEvents = async (f: Filter): Promise<number> => {
  const [row] = await db.select({ c: count() }).from(events).where(matching(f));
  return row?.c ?? 0;
};

/** The latest 40 people who gave this answer. */
export const attendees = (eventId: number, status: Attendance): Promise<PublicUser[]> =>
  db.select(publicCols)
    .from(eventAttendance)
    .innerJoin(users, eq(users.id, eventAttendance.userId))
    .where(and(eq(eventAttendance.eventId, eventId), eq(eventAttendance.status, status)))
    .orderBy(desc(eventAttendance.createdAt))
    .limit(40);

type NewEvent = { title: string; venue: string; city: string; country: string; startsAt: number; description: string; url: string };

export async function createEvent(e: NewEvent, artistNames: string[], creatorId: number): Promise<number> {
  return transact(async tx => {
    const [row] = await tx.insert(events).values({ ...e, creatorId, createdAt: now() }).returning({ id: events.id });
    const id = row!.id;
    for (const [position, name] of artistNames.entries()) {
      const artistId = await getOrCreateArtistTx(tx, name);
      await tx.insert(eventArtists).values({ eventId: id, artistId, position }).onConflictDoNothing();
    }
    await tx.insert(eventAttendance).values({ eventId: id, userId: creatorId, status: "going", createdAt: now() });
    return id;
  });
}

export const deleteOwnEvent = async (id: number, creatorId: number): Promise<boolean> => {
  const deleted = await db.delete(events)
    .where(and(eq(events.id, id), eq(events.creatorId, creatorId)))
    .returning({ id: events.id });
  return deleted.length > 0;
};

/** Null withdraws the answer. */
export async function setAttendance(eventId: number, userId: number, status: Attendance | null): Promise<void> {
  await transact(async tx => {
    await tx.delete(eventAttendance).where(and(eq(eventAttendance.eventId, eventId), eq(eventAttendance.userId, userId)));
    if (status) await tx.insert(eventAttendance).values({ eventId, userId, status, createdAt: now() });
  });
}

/** Suggestions for the add form, most used first. Countries come all at once (there are few). */
export async function places(field: "venue" | "city" | "country", q: string): Promise<EventPlace[]> {
  const col = events[field];
  const n = sql<number>`count(*)::int`;
  const like = `%${q.toLowerCase().replace(/[\\%_]/g, c => "\\" + c)}%`;
  const where = and(sql`${col} <> ''`, field === "country" || !q ? undefined : sql`lower(${col}) LIKE ${like}`);
  if (field === "country") {
    return db.select({ name: col, count: n }).from(events).where(where).groupBy(col).orderBy(desc(n));
  }
  // the most common city and country seen with each name
  const city = sql<string>`mode() within group (order by ${events.city})`;
  const country = sql<string>`mode() within group (order by ${events.country})`;
  return db.select({ name: col, count: n, ...(field === "venue" && { city }), country })
    .from(events)
    .where(where)
    .groupBy(col)
    .orderBy(desc(n), asc(col))
    .limit(8);
}
