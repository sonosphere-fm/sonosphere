// Where the corrections data lives: two public data sets on the network (downloaded, never bundled) and the copy
// of them saved in a JSON file next to the database.
//   lotus  (github.com/katelyynn/lotus, GPL-3.0)  the capitalisation artists actually use, plus a few redirects
//   oracle (github.com/katelyynn/oracle)          MusicBrainz ids for artists and albums
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { now } from "../util";

const RAW = "https://raw.githubusercontent.com/katelyynn";
const FILES = {
  artist: `${RAW}/lotus/main/artist.json`, albumTrack: `${RAW}/lotus/main/album_track.json`, combined: `${RAW}/lotus/main/combined_artists.json`,
  redirects: `${RAW}/lotus/main/redirects.json`, mbArtists: `${RAW}/oracle/main/artists.json`, mbAlbums: `${RAW}/oracle/main/albums.json`,
} as const;
export type Source = keyof typeof FILES;
// Object.keys is typed string[]; these are exactly the keys of FILES.
export const SOURCES = Object.keys(FILES) as Source[];
/** The downloaded files as they came (nothing in them has been checked) and when they were fetched. */
export type Raw = Record<Source, unknown> & { at: number };

const CACHE = `${process.env.DATA_DIR || "data"}/corrections.json`;
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** The saved copy, or null when there is none or it cannot be read. */
export function readSaved(): Raw | null {
  try {
    if (!existsSync(CACHE)) return null;
    const saved: unknown = JSON.parse(readFileSync(CACHE, "utf8"));
    if (!isObject(saved)) return null;
    return { artist: saved.artist, albumTrack: saved.albumTrack, combined: saved.combined, redirects: saved.redirects, mbArtists: saved.mbArtists, mbAlbums: saved.mbAlbums, at: Number(saved.at) };
  } catch { return null; }
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

/** Fetches every file. Throws if any of them is missing, too large or not a JSON object. */
export async function download(): Promise<Raw> {
  const at = now();
  return {
    at,
    artist: await fetchObject(FILES.artist), albumTrack: await fetchObject(FILES.albumTrack), combined: await fetchObject(FILES.combined),
    redirects: await fetchObject(FILES.redirects), mbArtists: await fetchObject(FILES.mbArtists), mbAlbums: await fetchObject(FILES.mbAlbums),
  };
}
