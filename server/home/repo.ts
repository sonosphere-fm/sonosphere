import { and, asc, count, countDistinct, desc, eq, exists, gte, lte, or, sql, type SQL } from "drizzle-orm";
import { trackImage } from "../catalog/art";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../db/client";
import { getJson, setJson } from "../kv";
import { flag } from "../db/dialect";
import {
  albums,
  artists,
  eventArtists,
  eventAttendance,
  events,
  follows,
  lovedTracks,
  scrobbles,
  taggings,
  tags,
  tracks,
  userArtists,
  userTracks,
  users,
} from "../db/schema";
import { openListener, publicCols, publicUser } from "../users/repo";
import { now } from "../util";
import type { EventSummary } from "../../shared/events";
import type { ChartTag, Devotee, FriendLove, Leader, Leaderboard, LeaderPeriod, SiteTotals } from "../../shared/home";
import type { TagCount } from "../../shared/tags";
import type { PublicUser } from "../../shared/users";

const total = async (rows: PromiseLike<{ c: number }[]>) => (await rows)[0]?.c ?? 0;

const applied = count().as("count");

export const tagChart = (limit: number, offset: number): Promise<ChartTag[]> =>
  db
    .select({ name: tags.name, count: applied, taggers: countDistinct(taggings.userId).as("taggers") })
    .from(taggings)
    .innerJoin(tags, eq(tags.id, taggings.tagId))
    .groupBy(tags.id)
    .orderBy(desc(applied))
    .limit(limit)
    .offset(offset);

export const usedTagCount = (): Promise<number> =>
  total(db.select({ c: countDistinct(taggings.tagId) }).from(taggings));

export const popularTags = (limit: number): Promise<TagCount[]> =>
  db
    .select({ name: tags.name, count: applied })
    .from(taggings)
    .innerJoin(tags, eq(tags.id, taggings.tagId))
    .groupBy(tags.id)
    .orderBy(desc(applied))
    .limit(limit);

const headCount = (status: string) => {
  const q = db
    .select({ c: count() })
    .from(eventAttendance)
    .where(and(eq(eventAttendance.eventId, events.id), eq(eventAttendance.status, status)));
  return sql<number>`(${q})`;
};

const answerOf = (viewerId: number) => {
  const q = db
    .select({ status: eventAttendance.status })
    .from(eventAttendance)
    .where(and(eq(eventAttendance.eventId, events.id), eq(eventAttendance.userId, viewerId)));
  return sql<EventSummary["status"]>`(${q})`;
};

const lineupOf = (eventId: number) =>
  db
    .select({ name: artists.name, image: artists.imageId })
    .from(eventArtists)
    .innerJoin(artists, eq(artists.id, eventArtists.artistId))
    .where(eq(eventArtists.eventId, eventId))
    .orderBy(eventArtists.position);

export async function upcomingEvents(
  from: number,
  viewerId: number | undefined,
  limit: number
): Promise<EventSummary[]> {
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
      going: headCount("going"),
      interested: headCount("interested"),
      status: answerOf(viewerId || 0),
    })
    .from(events)
    .leftJoin(users, eq(users.id, events.creatorId))
    .where(gte(events.startsAt, from))
    .orderBy(asc(events.startsAt))
    .limit(limit);
  return Promise.all(rows.map(async (e) => ({ ...e, artists: await lineupOf(e.id) })));
}

// whole-table counts are slow and only shown rounded down, so a few minutes old is fine
export async function siteTotals(): Promise<SiteTotals> {
  const cached = await getJson<SiteTotals>("site-totals");
  if (cached) return cached;
  const rows = (table: typeof scrobbles | typeof users | typeof artists | typeof tracks) =>
    total(db.select({ c: count() }).from(table));
  const [s, u, a, t] = await Promise.all([rows(scrobbles), rows(users), rows(artists), rows(tracks)]);
  const totals = { scrobbles: s, users: u, artists: a, tracks: t };
  await setJson("site-totals", totals, 300_000);
  return totals;
}

const LEADERS = 5;
const ranked = and(openListener(), eq(users.suspended, false));
// Tracks of unknown length count as three and a half minutes, as in listening reports.
const length = sql`CASE WHEN ${tracks.duration} > 0 THEN ${tracks.duration} ELSE 210 END`;

/** Plays, distinct artists and seconds per listener: from the log for a window, from the tallies for all time. */
function perListener(from: number) {
  if (from) {
    return db
      .select({
        userId: scrobbles.userId,
        plays: count().as("plays"),
        artists: countDistinct(scrobbles.artistId).as("artists"),
        seconds: sql<number>`SUM(${length})`.mapWith(Number).as("seconds"),
      })
      .from(scrobbles)
      .innerJoin(tracks, eq(tracks.id, scrobbles.trackId))
      .where(gte(scrobbles.playedAt, from))
      .groupBy(scrobbles.userId)
      .as("t");
  }
  const byArtist = db
    .select({
      userId: userArtists.userId,
      plays: sql<number>`SUM(${userArtists.plays})`.mapWith(Number).as("plays"),
      artists: count().as("artists"),
    })
    .from(userArtists)
    .groupBy(userArtists.userId)
    .as("a");
  const byTrack = db
    .select({
      userId: userTracks.userId,
      seconds: sql<number>`SUM(${userTracks.plays} * ${length})`.mapWith(Number).as("seconds"),
    })
    .from(userTracks)
    .innerJoin(tracks, eq(tracks.id, userTracks.trackId))
    .groupBy(userTracks.userId)
    .as("s");
  return db
    .select({
      userId: byArtist.userId,
      plays: byArtist.plays,
      artists: byArtist.artists,
      seconds: sql<number>`COALESCE(${byTrack.seconds}, 0)`.mapWith(Number).as("seconds"),
    })
    .from(byArtist)
    .leftJoin(byTrack, eq(byTrack.userId, byArtist.userId))
    .as("t");
}

type Metric = "seconds" | "plays" | "artists";

// Totals cover every listener; only open listeners are ranked, so they sort ahead of the rest in each order.
async function listenerBoards(from: number) {
  const t = perListener(from);
  const rankBy = (col: SQL.Aliased<number>) =>
    sql<number>`ROW_NUMBER() OVER (ORDER BY ${ranked} DESC, ${col} DESC, ${t.userId})`;
  const r = db
    .select({
      userId: t.userId,
      seconds: t.seconds,
      plays: t.plays,
      artists: t.artists,
      open: sql<boolean>`${ranked}`.as("open"),
      bySeconds: rankBy(t.seconds).mapWith(Number).as("by_seconds"),
      byPlays: rankBy(t.plays).mapWith(Number).as("by_plays"),
      byArtists: rankBy(t.artists).mapWith(Number).as("by_artists"),
      allSeconds: sql<number>`SUM(${t.seconds}) OVER ()`.mapWith(Number).as("all_seconds"),
      allPlays: sql<number>`SUM(${t.plays}) OVER ()`.mapWith(Number).as("all_plays"),
      listeners: sql<number>`COUNT(*) OVER ()`.mapWith(Number).as("listeners"),
    })
    .from(t)
    .innerJoin(users, eq(users.id, t.userId))
    .as("r");
  const rows = await db
    .select({
      ...publicCols,
      seconds: r.seconds,
      plays: r.plays,
      artists: r.artists,
      bySeconds: r.bySeconds,
      byPlays: r.byPlays,
      byArtists: r.byArtists,
      allSeconds: r.allSeconds,
      allPlays: r.allPlays,
      listeners: r.listeners,
    })
    .from(r)
    .innerJoin(users, eq(users.id, r.userId))
    .where(and(r.open, or(lte(r.bySeconds, LEADERS), lte(r.byPlays, LEADERS), lte(r.byArtists, LEADERS))));
  const board = (metric: Metric, rank: "bySeconds" | "byPlays" | "byArtists"): Leader[] =>
    rows
      .filter((row) => row[rank] <= LEADERS)
      .sort((a, b) => a[rank] - b[rank])
      .map((row) => ({ ...publicUser(row), value: row[metric] }));
  const top = rows[0];
  return {
    totals: { seconds: top?.allSeconds ?? 0, plays: top?.allPlays ?? 0, listeners: top?.listeners ?? 0 },
    seconds: board("seconds", "bySeconds"),
    plays: board("plays", "byPlays"),
    artists: board("artists", "byArtists"),
  };
}

async function loveBoard(from: number): Promise<Leader[]> {
  const loves = count().as("loves");
  const rows = await db
    .select({ ...publicCols, value: loves })
    .from(lovedTracks)
    .innerJoin(users, eq(users.id, lovedTracks.userId))
    .where(and(ranked, gte(lovedTracks.createdAt, from)))
    .groupBy(users.id)
    .orderBy(desc(loves), users.id)
    .limit(LEADERS);
  return rows.map((row) => ({ ...publicUser(row), value: row.value }));
}

/** Each open listener's most played artist, the biggest such devotion first. */
async function devotedBoard(from: number): Promise<Devotee[]> {
  const pairs = from
    ? db
        .select({ userId: scrobbles.userId, artistId: scrobbles.artistId, n: count().as("n") })
        .from(scrobbles)
        .where(gte(scrobbles.playedAt, from))
        .groupBy(scrobbles.userId, scrobbles.artistId)
        .as("p")
    : db
        .select({
          userId: userArtists.userId,
          artistId: userArtists.artistId,
          n: sql<number>`${userArtists.plays}`.as("n"),
        })
        .from(userArtists)
        .as("p");
  const best = db
    .selectDistinctOn([pairs.userId], { userId: pairs.userId, artistId: pairs.artistId, n: pairs.n })
    .from(pairs)
    .innerJoin(users, eq(users.id, pairs.userId))
    .where(ranked)
    .orderBy(pairs.userId, desc(pairs.n), pairs.artistId)
    .as("b");
  const rows = await db
    .select({ ...publicCols, value: best.n, artist: artists.name })
    .from(best)
    .innerJoin(users, eq(users.id, best.userId))
    .innerJoin(artists, eq(artists.id, best.artistId))
    .orderBy(desc(best.n), best.userId)
    .limit(LEADERS);
  return rows.map((row) => ({ ...publicUser(row), value: Number(row.value), artist: row.artist }));
}

const LEADER_DAYS: Record<LeaderPeriod, number> = { "7day": 7, "1month": 30, "12month": 365, overall: 0 };

// These scan a whole window of plays; ten minutes old is fresh enough for a leaderboard.
export async function leaderboard(period: LeaderPeriod): Promise<Leaderboard> {
  const key = `leaderboard:${period}`;
  const cached = await getJson<Leaderboard>(key);
  if (cached) return cached;
  const days = LEADER_DAYS[period];
  const from = days ? now() - days * 86400 : 0;
  const [listeners, loves, devoted] = await Promise.all([listenerBoards(from), loveBoard(from), devotedBoard(from)]);
  const out = { period, ...listeners, loves, devoted };
  await setJson(key, out, 600_000);
  return out;
}

export const openFollowees = (userId: number): Promise<PublicUser[]> =>
  db
    .select(publicCols)
    .from(follows)
    .innerJoin(users, eq(users.id, follows.followeeId))
    .where(and(eq(follows.followerId, userId), openListener()));

export function friendLoves(userId: number, limit: number): Promise<FriendLove[]> {
  const own = alias(lovedTracks, "v");
  const lovedByViewer = db
    .select({ one: sql`1` })
    .from(own)
    .where(and(eq(own.userId, userId), eq(own.trackId, tracks.id)));
  return db
    .select({
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
    .where(and(eq(users.privateListening, false), eq(users.banned, false)))
    .orderBy(desc(lovedTracks.createdAt))
    .limit(limit);
}
