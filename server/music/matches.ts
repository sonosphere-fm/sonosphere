import { norm } from "../util";
import type { MusicMatch } from "../../shared/music-match";

const HOUR = 3600_000;
const FIVE_MINUTES = 300_000;
const MAX_ENTRIES = 500;

type Entry = { matches: MusicMatch[]; until: number };
const entries = new Map<string, Entry>();

const keyOf = (cache: string, userId: number, artist: string, track: string) =>
  `${cache}:${userId}:${norm(artist)}:${norm(track)}`;

export function cachedMatches(cache: string, userId: number, artist: string, track: string): MusicMatch[] | null {
  const key = keyOf(cache, userId, artist, track);
  const entry = entries.get(key);
  if (!entry) return null;
  if (entry.until <= Date.now()) {
    entries.delete(key);
    return null;
  }
  return entry.matches;
}

export function rememberMatches(
  cache: string,
  userId: number,
  artist: string,
  track: string,
  matches: MusicMatch[]
): void {
  if (entries.size >= MAX_ENTRIES) {
    const oldest = entries.keys().next().value;
    if (oldest !== undefined) entries.delete(oldest);
  }
  entries.set(keyOf(cache, userId, artist, track), {
    matches,
    until: Date.now() + (matches.length ? HOUR : FIVE_MINUTES),
  });
}

export function forgetMatches(cache: string, userId: number): void {
  const prefix = `${cache}:${userId}:`;
  for (const key of entries.keys()) {
    if (key.startsWith(prefix)) entries.delete(key);
  }
}
