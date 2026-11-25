// lotus (github.com/katelyynn/lotus, GPL-3.0): downloaded, never bundled
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { isObject, now } from "../util";

const RAW = "https://raw.githubusercontent.com/katelyynn";
const FILES = {
  artist: `${RAW}/lotus/main/artist.json`,
  albumTrack: `${RAW}/lotus/main/album_track.json`,
  combined: `${RAW}/lotus/main/combined_artists.json`,
  redirects: `${RAW}/lotus/main/redirects.json`,
  mbArtists: `${RAW}/oracle/main/artists.json`,
  mbAlbums: `${RAW}/oracle/main/albums.json`,
} as const;
type Source = keyof typeof FILES;
export const SOURCES = Object.keys(FILES) as Source[];
/** Unchecked contents of each file, and when they were fetched. */
export type Raw = Record<Source, unknown> & { at: number };

const CACHE = `${process.env.DATA_DIR || "data"}/corrections.json`;

export function readSaved(): Raw | null {
  let saved: unknown;
  try {
    saved = JSON.parse(readFileSync(CACHE, "utf8"));
  } catch {
    return null;
  }
  if (!isObject(saved)) return null;
  return {
    artist: saved.artist,
    albumTrack: saved.albumTrack,
    combined: saved.combined,
    redirects: saved.redirects,
    mbArtists: saved.mbArtists,
    mbAlbums: saved.mbAlbums,
    at: Number(saved.at),
  };
}

export function save(raw: Raw): void {
  mkdirSync(dirname(CACHE), { recursive: true });
  writeFileSync(CACHE, JSON.stringify(raw));
}

async function fetchObject(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const text = await res.text();
  if (text.length > 5_000_000) throw new Error(`${url}: unexpectedly large`);
  const json: unknown = JSON.parse(text);
  if (!isObject(json)) throw new Error(`${url}: not a JSON object`);
  return json;
}

export async function download(): Promise<Raw> {
  const at = now();
  return {
    at,
    artist: await fetchObject(FILES.artist),
    albumTrack: await fetchObject(FILES.albumTrack),
    combined: await fetchObject(FILES.combined),
    redirects: await fetchObject(FILES.redirects),
    mbArtists: await fetchObject(FILES.mbArtists),
    mbAlbums: await fetchObject(FILES.mbAlbums),
  };
}
