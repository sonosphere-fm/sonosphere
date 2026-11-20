// Rules for taking in plays (which names they are filed under, which are refused) and for building listening reports.
import { findItem, resolveTrack, type TrackNames, type TrackRef } from "../catalog/repo";
import { correct } from "../corrections/service";
import { bad } from "../http";
import { clean, now } from "../util";
import * as repo from "./repo";
import type { EditScope, Report, ScrobbleResult } from "../../shared/listening";

/** A play as submitted: nothing about it has been checked yet. */
export type ScrobbleInput = { artist?: unknown; track?: unknown; album?: unknown; timestamp?: unknown; duration?: unknown };

/** The names a submitted play is filed under, after community corrections, or null when artist or track is missing. */
function names(input: ScrobbleInput): TrackNames | null {
  const raw = { artist: clean(input.artist), track: clean(input.track), album: clean(input.album) };
  if (!raw.artist || !raw.track) return null;
  return { ...correct(raw.artist, raw.track, raw.album), duration: Number(input.duration) || 0 };
}

/** Catalogue ids for a submitted play, adding the artist, album and track if they are new. Null when artist or track is missing. */
export async function resolve(input: ScrobbleInput): Promise<TrackRef | null> {
  const n = names(input);
  return n && resolveTrack(n);
}

/** Records a batch of plays in one transaction. Returns one result per input, in order. */
export async function scrobbleMany(userId: number, inputs: ScrobbleInput[], source = "web"): Promise<ScrobbleResult[]> {
  const refused = (reason: string) => ({ accepted: false as const, reason });
  const checked = inputs.map(input => {
    const ts = Math.floor(Number(input.timestamp) || now());
    if (ts > now() + 3600) return refused("Timestamp is in the future");
    if (ts < 946684800) return refused("Timestamp is too old");
    const n = names(input);
    return n ? { ...n, playedAt: ts } : refused("Artist and track are required");
  });
  const filed = await repo.recordScrobbles(userId, checked.filter(c => "playedAt" in c), source);
  let i = 0;
  return checked.map(c => {
    if (!("playedAt" in c)) return c;
    const r = filed[i++];
    return r ? { accepted: true as const, id: r.id, artistId: r.artistId, trackId: r.trackId, albumId: r.albumId } : refused("Duplicate scrobble");
  });
}

export async function scrobble(userId: number, input: ScrobbleInput, source = "web"): Promise<ScrobbleResult> {
  const [result] = await scrobbleMany(userId, [input], source);
  return result ?? { accepted: false, reason: "Artist and track are required" };
}

/** Marks what someone is listening to. False when artist or track is missing. */
export async function setNowPlaying(userId: number, input: ScrobbleInput): Promise<boolean> {
  const ref = await resolve(input);
  if (!ref) return false;
  const seconds = Number(input.duration) || (await findItem("track", ref.trackId))?.duration || 240;
  await repo.saveNowPlaying(userId, ref, seconds);
  return true;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * A listener's report for one week (Monday to Sunday) or one calendar year in their own time zone.
 * `offset` counts back from the current one; `tzMin` is their offset from UTC in minutes.
 */
export async function report(userId: number, type: "week" | "year", offset: number, tzMin: number, viewerId = 0): Promise<Report> {
  const tz = Math.round(tzMin) * 60;
  const localNow = new Date((now() + tz) * 1000);
  let start: number, end: number, prevStart: number, keys: string[];
  if (type === "week") {
    const dow = (localNow.getUTCDay() + 6) % 7; // Monday = 0
    const monday = Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate() - dow - 7 * offset) / 1000;
    start = monday - tz; end = start + 7 * 86400; prevStart = start - 7 * 86400;
    keys = Array.from({ length: 7 }, (_, i) => new Date((monday + i * 86400) * 1000).toISOString().slice(0, 10));
  } else {
    const y = localNow.getUTCFullYear() - offset;
    start = Date.UTC(y, 0, 1) / 1000 - tz; end = Date.UTC(y + 1, 0, 1) / 1000 - tz; prevStart = Date.UTC(y - 1, 0, 1) / 1000 - tz;
    keys = Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, "0")}`);
  }
  const labels = type === "week" ? DAYS : MONTHS;
  const cur: repo.Scope = { userId, from: start, to: end, viewerId }, prev: repo.Scope = { userId, from: prevStart, to: start };
  const buckets = new Map((await repo.series(cur, type === "week" ? "day" : "month", tzMin)).map(r => [String(r.k), r.c]));
  const hours = new Map((await repo.series(cur, "hour", tzMin)).map(r => [Number(r.k), r.c]));
  const fresh = await repo.newArtists(userId, start, end);
  return {
    type, offset, start, end,
    totals: await repo.counts(cur), previous: await repo.counts(prev), listeningSeconds: await repo.listeningSeconds(userId, start, end),
    buckets: keys.map((k, i) => ({ key: k, label: labels[i] ?? "", count: buckets.get(k) || 0 })),
    clock: Array.from({ length: 24 }, (_, h) => ({ hour: h, count: hours.get(h) || 0 })),
    topArtists: (await repo.topArtists(cur, 10)).items, topAlbums: (await repo.topAlbums(cur, 10)).items, topTracks: (await repo.topTracks(cur, 10)).items,
    newArtists: { count: fresh.length, items: fresh.slice(0, 6) }, tags: await repo.playedTags(userId, start, end),
  };
}

// ---------- editing plays and loving tracks ----------
/** Files one play under the names given, with corrections applied; it keeps an album only when one is named. Throws 400 when that cannot be done. */
export async function editScrobble(id: number, input: ScrobbleInput): Promise<void> {
  const ref = (await resolve(input)) ?? bad("Artist and track are required");
  if (!(await repo.refileScrobble(id, { ...ref, albumId: clean(input.album) ? ref.albumId : null }))) bad("You already have that track scrobbled at the same time");
}

/**
 * Applies one correction to every play of the listener's that shares `src`'s track, album or artist. The names
 * are used as typed (no community corrections). Returns how many plays changed.
 */
export async function editScrobbles(src: repo.Scrobble, scope: EditScope, input: ScrobbleInput): Promise<number> {
  if (scope === "album" && !src.albumId) bad("This scrobble has no album to edit");
  const artist = clean(input.artist) || bad("Artist is required"), track = clean(input.track), album = clean(input.album);
  if (scope === "track" && !track) bad("Track is required");
  return repo.refileScrobbles(src, { scope, artist, track, album });
}

/**
 * Loves a batch of tracks by name, e.g. from a Last.fm loved-tracks dump. Unknown music is added to the catalogue;
 * entries without an artist or track are skipped. Returns how many were newly loved.
 */
export async function importLoved(userId: number, list: unknown[]): Promise<number> {
  const entries: { artist: string; track: string; lovedAt: number }[] = [];
  for (const item of list) {
    const t: { artist?: unknown; track?: unknown; timestamp?: unknown } = typeof item === "object" && item !== null ? item : {};
    const artist = clean(t.artist), track = clean(t.track);
    if (!artist || !track) continue;
    const ts = Math.floor(Number(t.timestamp)), fixed = correct(artist, track);
    entries.push({ artist: fixed.artist, track: fixed.track, lovedAt: ts > 946684800 && ts <= now() ? ts : now() });
  }
  return repo.loveTracks(userId, entries);
}
