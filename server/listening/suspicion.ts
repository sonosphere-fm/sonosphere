import { and, eq, isNull, sql } from "drizzle-orm";
import * as Sentry from "@sentry/bun";
import { db } from "../db/client";
import { albums, artists, listeningSuspicion, reports, scrobbles, tracks } from "../db/schema";
import { first, now } from "../util";

// A scrobble that starts before the one ahead of it could have been played (half the track, at most four minutes)
// is a point. Points drain away over time, so an odd glitch is forgotten, and an account that piles them up is
// flagged to the admins. Nothing is ever refused. Imports are left out: their timing is whatever the old service kept.
const DRAIN_PER_HOUR = 10;
const FLAG_AT = 60;
const SLACK = 5;
// The same track from two connected services a few seconds apart is one play scrobbled twice, not farming.
const DOUBLE = 60;
// Impossible plays piled onto one track, album or artist look like pushing it up the charts, so they weigh more.
const TARGETED = { track: 3, album: 2, artist: 2 };
const TARGET_SHARE = 0.5;
const TARGET_MIN = 5;

type Play = { track: number; album: number | null; artist: number };
type Target = { kind: keyof typeof TARGETED; id: number };

/** The later scrobble of each neighbouring pair, one of them new, that are too close together to both be played. */
async function tooClose(userId: number, ids: number[], from: number, to: number): Promise<Play[]> {
  return db.execute<Play>(sql`
    WITH s AS (
      SELECT ${scrobbles.id} AS id, ${scrobbles.playedAt} AS at, ${scrobbles.trackId} AS track,
        ${scrobbles.albumId} AS album, ${scrobbles.artistId} AS artist, ${scrobbles.source} AS source,
        LAG(${scrobbles.id}) OVER w AS prev_id,
        LAG(${scrobbles.playedAt}) OVER w AS prev_at,
        LAG(${scrobbles.trackId}) OVER w AS prev_track,
        LAG(${scrobbles.source}) OVER w AS prev_source,
        LAG(${tracks.duration}) OVER w AS prev_duration
      FROM ${scrobbles} JOIN ${tracks} ON ${tracks.id} = ${scrobbles.trackId}
      WHERE ${scrobbles.userId} = ${userId} AND ${scrobbles.source} <> 'import'
        AND ${scrobbles.playedAt} BETWEEN ${from - 300} AND ${to + 300}
      WINDOW w AS (ORDER BY ${scrobbles.playedAt}, ${scrobbles.id})
    )
    SELECT track, album, artist FROM s
    WHERE prev_id IS NOT NULL
      AND (id IN ${ids} OR prev_id IN ${ids})
      AND at - prev_at < (CASE WHEN prev_duration > 0 THEN LEAST(prev_duration / 2, 240) ELSE 30 END) - ${SLACK}
      AND NOT (track = prev_track AND source <> prev_source AND at - prev_at < ${DOUBLE})`);
}

/** The track, album or artist that most of the plays went to, if any, the narrowest first. */
function targetOf(plays: Play[]): Target | null {
  if (plays.length < TARGET_MIN) return null;
  for (const kind of ["track", "album", "artist"] as const) {
    const counts = new Map<number, number>();
    for (const p of plays) if (p[kind] !== null) counts.set(p[kind], (counts.get(p[kind]) ?? 0) + 1);
    for (const [id, n] of counts) if (n / plays.length >= TARGET_SHARE) return { kind, id };
  }
  return null;
}

async function describe({ kind, id }: Target): Promise<string> {
  if (kind === "artist") {
    const a = await first(db.select({ name: artists.name }).from(artists).where(eq(artists.id, id)));
    return `the artist ${a?.name ?? id}`;
  }
  const table = kind === "track" ? tracks : albums;
  const row = await first(
    db
      .select({ title: table.title, artist: artists.name })
      .from(table)
      .innerJoin(artists, eq(artists.id, table.artistId))
      .where(eq(table.id, id))
  );
  return row ? `the ${kind} ${row.artist} - ${row.title}` : `${kind} ${id}`;
}

async function flag(userId: number, score: number, target: string | null) {
  const detail =
    `Scrobbled faster than the music could play: ${Math.round(score)} suspicion points. ` +
    "Each point is a scrobble that starts before the one ahead of it could have been played." +
    (target ? ` Most of them went to ${target}, as if pushing it up the charts.` : "");
  const open = await first(
    db
      .select({ id: reports.id })
      .from(reports)
      .where(
        and(
          isNull(reports.reporterId),
          eq(reports.reason, "listening"),
          eq(reports.targetType, "user"),
          eq(reports.targetId, userId),
          eq(reports.status, "open")
        )
      )
      .limit(1)
  );
  if (open) await db.update(reports).set({ detail }).where(eq(reports.id, open.id));
  else
    await db.insert(reports).values({
      reporterId: null,
      targetType: "user",
      targetId: userId,
      reason: "listening",
      detail,
      createdAt: now(),
    });
}

/** Scores the scrobbles just recorded and flags the account once it has scored too much too quickly. */
export async function weigh(userId: number, added: { id: number; playedAt: number }[]) {
  if (!added.length) return;
  try {
    const at = added.map((a) => a.playedAt);
    const plays = await tooClose(
      userId,
      added.map((a) => a.id),
      Math.min(...at),
      Math.max(...at)
    );
    if (!plays.length) return;
    const found = targetOf(plays);
    const points = plays.length * (found ? TARGETED[found.kind] : 1);
    const t = now();
    const was = await first(db.select().from(listeningSuspicion).where(eq(listeningSuspicion.userId, userId)));
    const drained = was ? Math.max(0, was.score - ((t - was.updatedAt) / 3600) * DRAIN_PER_HOUR) : 0;
    let score = drained + points;
    let target = found ? await describe(found) : (was?.target ?? null);
    if (score >= FLAG_AT) {
      await flag(userId, score, target);
      score = 0;
      target = null;
    }
    await db
      .insert(listeningSuspicion)
      .values({ userId, score, target, updatedAt: t })
      .onConflictDoUpdate({ target: listeningSuspicion.userId, set: { score, target, updatedAt: t } });
  } catch (e) {
    console.error("listening suspicion:", e);
    Sentry.captureException(e);
  }
}
