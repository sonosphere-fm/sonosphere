// Data access for the staff dashboard: site-wide totals, daily activity and the newest accounts.
import { and, count, countDistinct, desc, eq, gte, isNull, ne, sql } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { db } from "../db/client";
import { albums, artists, dmFlags, journals, reports, scrobbles, shouts, tracks, users, wikiLocks, wikis } from "../db/schema";
import { timeBucket } from "../db/dialect";
import { publicCols } from "../users/repo";
import type { Dashboard, DayCount } from "../../shared/admin";

const DAY = 86400;

/** Site-wide counts as of `t` (Unix seconds). */
export async function totals(t: number): Promise<Dashboard["totals"]> {
  const week = t - 7 * DAY, staffOnly = and(eq(users.isAdmin, true), eq(users.banned, false));
  const active = await db.select({ c: countDistinct(scrobbles.userId) }).from(scrobbles).where(gte(scrobbles.playedAt, week));
  return {
    users: await db.$count(users),
    newUsers7: await db.$count(users, gte(users.registeredAt, week)),
    newUsers30: await db.$count(users, gte(users.registeredAt, t - 30 * DAY)),
    active7: active[0]?.c ?? 0,
    scrobbles: await db.$count(scrobbles),
    scrobbles7: await db.$count(scrobbles, gte(scrobbles.playedAt, week)),
    openReports: await db.$count(reports, eq(reports.status, "open")),
    openFlags: await db.$count(dmFlags, isNull(dmFlags.resolvedAt)),
    reports7: await db.$count(reports, gte(reports.createdAt, week)),
    suspended: await db.$count(users, and(eq(users.suspended, true), eq(users.banned, false))),
    banned: await db.$count(users, eq(users.banned, true)),
    admins: await db.$count(users, and(staffOnly, ne(users.role, "moderator"))),
    moderators: await db.$count(users, and(staffOnly, eq(users.role, "moderator"))),
    shouts7: await db.$count(shouts, gte(shouts.createdAt, week)),
    journals7: await db.$count(journals, gte(journals.createdAt, week)),
    wikis7: await db.$count(wikis, gte(wikis.createdAt, week)),
    artists: await db.$count(artists), albums: await db.$count(albums), tracks: await db.$count(tracks),
    lockedWikis: await db.$count(wikiLocks),
  };
}

/** Rows per UTC day ("YYYY-MM-DD") since `from`, counted on a time column. */
async function perDay(table: PgTable, time: PgColumn, from: number): Promise<Map<string, number>> {
  const day = timeBucket(time, "day");
  const rows = await db.select({ d: day, c: count() }).from(table).where(gte(time, from)).groupBy(sql`1`);
  return new Map(rows.map(r => [String(r.d), r.c]));
}
/** One entry per day for `days` days starting at `from`, adding up the given per-day counts. */
function series(from: number, days: number, ...counts: Map<string, number>[]): DayCount[] {
  return Array.from({ length: days }, (_, i) => {
    const ts = from + i * DAY, d = new Date(ts * 1000).toISOString().slice(0, 10);
    return { day: ts, count: counts.reduce((n, m) => n + (m.get(d) ?? 0), 0) };
  });
}
/** Daily activity for `days` days starting at `from` (the start of a UTC day). */
export async function activity(from: number, days: number): Promise<Dashboard["series"]> {
  return {
    scrobbles: series(from, days, await perDay(scrobbles, scrobbles.playedAt, from)),
    signups: series(from, days, await perDay(users, users.registeredAt, from)),
    reports: series(from, days, await perDay(reports, reports.createdAt, from)),
    posts: series(from, days, await perDay(shouts, shouts.createdAt, from), await perDay(journals, journals.createdAt, from), await perDay(wikis, wikis.createdAt, from)),
  };
}

export const newestUsers = (limit: number): Promise<Dashboard["recentUsers"]> =>
  db.select({ ...publicCols, registeredAt: users.registeredAt }).from(users).orderBy(desc(users.registeredAt), desc(users.id)).limit(limit);
