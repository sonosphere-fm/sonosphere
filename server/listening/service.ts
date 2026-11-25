import { findItem, resolveTrack, type TrackNames, type TrackRef } from "../catalog/repo";
import { correct } from "../corrections/service";
import { bad } from "../http";
import { tr, type ErrorKey } from "../i18n";
import type { Locale } from "../../shared/i18n/core";
import { saveRecordingMbids, tracksOfRecordings } from "../listenbrainz/repo";
import { clean, norm, now } from "../util";
import * as Sentry from "@sentry/bun";
import * as mbdb from "../metadata/mbdb";
import * as repo from "./repo";
import { listeningChanged } from "../realtime";
import { weigh } from "./suspicion";
import type { ImportRow } from "../../shared/imports";
import {
  type Blasts,
  daysBetween,
  type EditScope,
  type ListeningStats,
  MILESTONES,
  type Milestones,
  type Report,
  type ReportType,
  type ScrobbleResult,
  streaks,
} from "../../shared/listening";

/** Nothing about it has been checked yet. */
export type ScrobbleInput = {
  artist?: unknown;
  track?: unknown;
  album?: unknown;
  timestamp?: unknown;
  duration?: unknown;
};

export const OLDEST = 946684800;

const UPLOAD = /^(.+?)\s+[-–—]\s+(.+)$/;
const uploads = new Map<string, { artist: string; track: string } | null>();

/**
 * A video scrobbled under the channel that uploaded it ("HEMERA", "Jane Remover - Dooo it!"), or with the artist
 * repeated in the title, goes to the artist named in the title when MusicBrainz knows that song and not the one as sent.
 */
export async function unscramble(artist: string, track: string): Promise<{ artist: string; track: string } | null> {
  const m = UPLOAD.exec(track);
  if (!m || !mbdb.mbdbOn) return null;
  const key = `${norm(artist)}\n${norm(track)}`;
  if (uploads.has(key)) return uploads.get(key)!;
  let found: { artist: string; track: string } | null = null;
  try {
    const real = await mbdb.recorded(m[1]!, m[2]!);
    if (real && !(await mbdb.recorded(artist, track))) found = { artist: real.artist, track: real.title };
  } catch (e) {
    console.error("unscramble:", e);
    Sentry.captureException(e);
    return null;
  }
  if (uploads.size >= 5000) uploads.clear();
  uploads.set(key, found);
  return found;
}

/** The names after community corrections, or null when artist or track is missing. */
export async function names(input: ScrobbleInput): Promise<TrackNames | null> {
  let artist = clean(input.artist);
  let track = clean(input.track);
  if (!artist || !track) return null;
  const moved = await unscramble(artist, track);
  if (moved) ({ artist, track } = moved);
  return { ...correct(artist, track, clean(input.album)), duration: Number(input.duration) || 0 };
}

export async function resolve(input: ScrobbleInput): Promise<TrackRef | null> {
  const n = await names(input);
  return n && resolveTrack(n);
}

/** One result per input, in order. */
export async function scrobbleMany(
  userId: number,
  inputs: ScrobbleInput[],
  source = "web",
  locale: Locale = "en"
): Promise<ScrobbleResult[]> {
  const refused = (key: ErrorKey) => ({ accepted: false as const, reason: tr(locale, `errors.${key}`) });
  const checked = [];
  const prepared = new Map<string, TrackNames | null>();
  for (const input of inputs) {
    const ts = Math.floor(Number(input.timestamp) || now());
    if (ts > now() + 3600) checked.push(refused("timestampInFuture"));
    else if (ts < OLDEST) checked.push(refused("timestampTooOld"));
    else {
      const key = JSON.stringify([
        clean(input.artist),
        clean(input.track),
        clean(input.album),
        Number(input.duration) || 0,
      ]);
      let n = prepared.get(key);
      if (n === undefined) {
        n = await names(input);
        prepared.set(key, n);
      }
      checked.push(n ? { ...n, playedAt: ts } : refused("artistTrackRequired"));
    }
  }
  const filed = await repo.recordScrobbles(
    userId,
    checked.filter((c) => "playedAt" in c),
    source
  );
  if (filed.some(Boolean)) listeningChanged(userId, "scrobbles");
  if (source !== "import") {
    const plays = checked.filter((c) => "playedAt" in c);
    await weigh(
      userId,
      filed.flatMap((r, j) => (r ? [{ id: r.id, playedAt: plays[j]!.playedAt }] : []))
    );
  }
  let i = 0;
  return checked.map((c) => {
    if (!("playedAt" in c)) return c;
    const r = filed[i++];
    if (!r) return refused("duplicateScrobble");
    return { accepted: true as const, id: r.id, artistId: r.artistId, trackId: r.trackId, albumId: r.albumId };
  });
}

/** False when artist or track is missing. */
export async function setNowPlaying(userId: number, input: ScrobbleInput): Promise<TrackRef | null> {
  const ref = await resolve(input);
  if (!ref) return null;
  const seconds = Number(input.duration) || (await findItem("track", ref.trackId))?.duration || 240;
  await repo.saveNowPlaying(userId, ref, seconds);
  listeningChanged(userId, "nowplaying");
  return ref;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * One week (Monday to Sunday), calendar month or calendar year in the listener's time zone. `offset` counts back from the
 * current one; `tzMin` is their offset from UTC in minutes.
 */
export async function report(
  userId: number,
  type: ReportType,
  offset: number,
  tzMin: number,
  viewerId = 0
): Promise<Report> {
  const tz = Math.round(tzMin) * 60;
  const localNow = new Date((now() + tz) * 1000);
  let start: number;
  let end: number;
  let prevStart: number;
  let keys: string[];
  let labels: string[];
  const days = (from: number, n: number) =>
    Array.from({ length: n }, (_, i) => new Date((from + i * 86400) * 1000).toISOString().slice(0, 10));
  if (type === "week") {
    const dow = (localNow.getUTCDay() + 6) % 7;
    const monday =
      Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate() - dow - 7 * offset) / 1000;
    start = monday - tz;
    end = start + 7 * 86400;
    prevStart = start - 7 * 86400;
    keys = days(monday, 7);
    labels = DAYS;
  } else if (type === "month") {
    const y = localNow.getUTCFullYear();
    const m = localNow.getUTCMonth() - offset;
    const first = Date.UTC(y, m, 1) / 1000;
    const next = Date.UTC(y, m + 1, 1) / 1000;
    start = first - tz;
    end = next - tz;
    prevStart = Date.UTC(y, m - 1, 1) / 1000 - tz;
    keys = days(first, Math.round((next - first) / 86400));
    labels = keys.map((k) => String(Number(k.slice(8))));
  } else if (type === "year") {
    const y = localNow.getUTCFullYear() - offset;
    start = Date.UTC(y, 0, 1) / 1000 - tz;
    end = Date.UTC(y + 1, 0, 1) / 1000 - tz;
    prevStart = Date.UTC(y - 1, 0, 1) / 1000 - tz;
    keys = Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, "0")}`);
    labels = MONTHS;
  } else {
    start = Math.min((await repo.firstPlayedAt(userId)) ?? now(), now());
    end = now() + 1;
    prevStart = start;
    const first = new Date((start + tz) * 1000);
    const months =
      (localNow.getUTCFullYear() - first.getUTCFullYear()) * 12 + localNow.getUTCMonth() - first.getUTCMonth() + 1;
    keys = Array.from({ length: months }, (_, i) =>
      new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + i, 1)).toISOString().slice(0, 7)
    );
    labels = keys;
  }
  const cur: repo.Scope = { userId, from: start, to: end, viewerId };
  const prev: repo.Scope = { userId, from: prevStart, to: start };
  const bucketRows = await repo.series(cur, type === "year" || type === "all" ? "month" : "day", tzMin);
  const buckets = new Map(bucketRows.map((r) => [String(r.k), r.c]));
  const hourRows = await repo.series(cur, "hour", tzMin);
  const hours = new Map(hourRows.map((r) => [Number(r.k), r.c]));
  const fresh = await repo.newArtists(userId, start, end);
  return {
    type,
    offset: type === "all" ? 0 : offset,
    start,
    end,
    totals: await repo.counts(cur),
    previous:
      type === "all" ? { playcount: 0, artists: 0, albums: 0, tracks: 0, listeners: 0 } : await repo.counts(prev),
    listeningSeconds: await repo.listeningSeconds(userId, start, end),
    buckets: keys.map((k, i) => ({ key: k, label: labels[i], count: buckets.get(k) || 0 })),
    clock: Array.from({ length: 24 }, (_, h) => ({ hour: h, count: hours.get(h) || 0 })),
    topArtists: (await repo.topArtists(cur, 10)).items,
    topAlbums: (await repo.topAlbums(cur, 10)).items,
    topTracks: (await repo.topTracks(cur, 10)).items,
    newArtists: { count: fresh.length, items: fresh.slice(0, 6) },
    tags: await repo.playedTags(userId, start, end),
  };
}

/** Daily scrobbles for one calendar year plus all-time streaks, in the listener's time zone. */
export async function stats(userId: number, offset: number, tzMin: number, viewerId = 0): Promise<ListeningStats> {
  const tz = Math.round(tzMin) * 60;
  const localNow = new Date((now() + tz) * 1000);
  const today = localNow.toISOString().slice(0, 10);
  const year = localNow.getUTCFullYear() - offset;
  const all = (await repo.series({ userId, viewerId }, "day", tzMin)).map((r) => ({
    date: String(r.k),
    count: r.c,
  }));
  const { longest, last } = streaks(all.map((d) => d.date));
  const latest = all.at(-1)?.date;
  const days = all.filter((d) => d.date.startsWith(`${year}-`));
  const plays = days.reduce((sum, d) => sum + d.count, 0);
  const scope: repo.Scope = {
    userId,
    viewerId,
    from: Date.UTC(year, 0, 1) / 1000 - tz,
    to: Date.UTC(year + 1, 0, 1) / 1000 - tz,
  };
  const top = plays ? (await repo.topArtists(scope, 10)).items : [];
  return {
    year,
    firstYear: Number((all[0]?.date ?? today).slice(0, 4)),
    today,
    days,
    activeDays: all.length,
    longestStreak: longest,
    currentStreak: latest && daysBetween(latest, today) <= 1 ? last : 0,
    topShare: plays ? top.reduce((sum, a) => sum + a.playcount, 0) / plays : 0,
  };
}

export async function milestones(userId: number, viewerId = 0): Promise<Milestones> {
  const scope = { userId, viewerId };
  const [{ total }, firsts] = await Promise.all([repo.recent(scope, 1, 0, true), repo.firstPlays(userId, viewerId)]);
  const items = await repo.milestonePlays(
    userId,
    MILESTONES.filter((n) => n <= total),
    viewerId
  );
  return {
    total,
    items: items.sort((a, b) => b.n - a.n),
    next: MILESTONES.find((n) => n > total) ?? null,
    firsts,
  };
}

const DAY = 86400;
const isoDay = (t: number) => new Date(t * 1000).toISOString().slice(0, 10);

/** The same week in each earlier year, centred on today minus `offset` weeks. */
export async function blasts(userId: number, offset: number, tzMin: number, viewerId = 0): Promise<Blasts> {
  const tz = Math.round(tzMin) * 60;
  const centre = new Date((now() + tz - offset * 7 * DAY) * 1000);
  const firstPlay = await repo.firstScrobble(userId);
  const firstYear = firstPlay ? new Date((firstPlay + tz) * 1000).getUTCFullYear() : centre.getUTCFullYear();
  const years = [];
  for (let year = centre.getUTCFullYear() - 1; year >= firstYear; year--) years.push(year);
  const all = await Promise.all(
    years.map(async (year) => {
      const mid = Date.UTC(year, centre.getUTCMonth(), centre.getUTCDate()) / 1000;
      const scope: repo.Scope = { userId, viewerId, from: mid - 3 * DAY - tz, to: mid + 4 * DAY - tz };
      const [counts, artists, tracks] = await Promise.all([
        repo.counts(scope),
        repo.topArtists(scope, 5),
        repo.topTracks(scope, 5),
      ]);
      return {
        year,
        from: isoDay(mid - 3 * DAY),
        to: isoDay(mid + 3 * DAY),
        playcount: counts.playcount,
        topArtists: artists.items,
        topTracks: tracks.items,
      };
    })
  );
  return { date: isoDay(centre.getTime() / 1000), years: all.filter((y) => y.playcount) };
}

/** Keeps an album only when one is named. */
export async function editScrobble(id: number, input: ScrobbleInput): Promise<void> {
  const ref = (await resolve(input)) ?? bad("artistTrackRequired");
  const albumId = clean(input.album) ? ref.albumId : null;
  if (!(await repo.refileScrobble(id, { ...ref, albumId }))) bad("alreadyTrackScrobbledSameTime");
}

/** Names are used as typed (no community corrections). Returns how many plays changed. */
export async function editScrobbles(src: repo.Scrobble, scope: EditScope, input: ScrobbleInput): Promise<number> {
  if (scope === "album" && !src.albumId) bad("scrobbleNoAlbumEdit");
  const artist = clean(input.artist) || bad("artistRequired");
  const track = clean(input.track);
  const album = clean(input.album);
  if (scope === "track" && !track) bad("trackRequired");
  return repo.refileScrobbles(src, { scope, artist, track, album });
}

/** Returns how many were newly loved. */
export async function importLoved(userId: number, list: unknown[]): Promise<number> {
  const entries: { artist: string; track: string; lovedAt: number }[] = [];
  for (const item of list) {
    const t: { artist?: unknown; track?: unknown; timestamp?: unknown } =
      typeof item === "object" && item !== null ? item : {};
    const artist = clean(t.artist);
    const track = clean(t.track);
    if (!artist || !track) continue;
    const ts = Math.floor(Number(t.timestamp));
    const fixed = correct(artist, track);
    entries.push({ artist: fixed.artist, track: fixed.track, lovedAt: ts > OLDEST && ts <= now() ? ts : now() });
  }
  return repo.loveTracks(userId, entries);
}

/** Imports a slice of a ListenBrainz export: scrobbles with their recording IDs, then loves for those recordings. */
export async function importListenBrainz(userId: number, rows: ImportRow[]): Promise<number> {
  const plays = rows.filter((r) => !r.score);
  let accepted = 0;
  if (plays.length) {
    const results = await scrobbleMany(userId, plays, "import");
    const pairs: { mbid: string; trackId: number }[] = [];
    for (const [i, r] of results.entries()) {
      const mbid = plays[i]!.recordingMbid;
      if (r.accepted && mbid) pairs.push({ mbid, trackId: r.trackId });
    }
    await saveRecordingMbids(pairs);
    accepted += results.filter((r) => r.accepted).length;
  }
  // Feedback names only a recording MBID, so a love can only be restored when that recording was imported above.
  // A -1 score is a dislike; there is nowhere to store it, so it is left out.
  const loves = rows.filter((r) => r.score === 1 && r.recordingMbid);
  if (loves.length) accepted += await importFeedback(userId, loves);
  return accepted;
}

async function importFeedback(userId: number, rows: ImportRow[]): Promise<number> {
  const found = await tracksOfRecordings(rows.map((r) => r.recordingMbid!));
  const entries: { trackId: number; lovedAt: number }[] = [];
  for (const r of rows) {
    const trackId = found.get(r.recordingMbid!);
    if (!trackId) continue;
    const ts = Math.floor(Number(r.timestamp));
    entries.push({ trackId, lovedAt: ts > OLDEST && ts <= now() ? ts : now() });
  }
  return entries.length ? repo.loveTracksByIds(userId, entries) : 0;
}
