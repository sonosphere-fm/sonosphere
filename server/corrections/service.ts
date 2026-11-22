import { exclusive } from "../kv";
import { clean, norm, now } from "../util";
import * as Sentry from "@sentry/bun";
import * as repo from "./repo";
import * as store from "./store";

const enabled = process.env.CORRECTIONS !== "0";

type Moved = { artist: string; album: string };
type Tables = {
  artistCase: Map<string, string>;
  artistMove: Map<string, string>;
  titles: Map<string, repo.Titles>;
  albumMove: Map<string, Map<string, Moved>>;
  artistMbid: Map<string, string>;
  albumMbid: Map<string, string>;
};

let tables: Tables = {
  artistCase: new Map(),
  artistMove: new Map(),
  titles: new Map(),
  albumMove: new Map(),
  artistMbid: new Map(),
  albumMbid: new Map(),
};
let versions: Record<string, string> = {};

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? clean(v) : "");
const isMbid = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
// each file carries a "version" entry that is not data
const entries = (o: unknown): [string, unknown][] =>
  isObject(o) ? Object.entries(o).filter(([k]) => k !== "version") : [];
const field = (v: unknown, key: string): unknown => (isObject(v) ? v[key] : undefined);

function put(k: string, v: string, same: Map<string, string>, other: Map<string, string>) {
  if (!k || !v) return;
  if (norm(k) === norm(v)) same.set(norm(k), v);
  else other.set(norm(k), v);
}

function build(raw: store.Raw): Tables {
  const artistCase = new Map<string, string>();
  const artistMove = new Map<string, string>();
  const titles = new Map<string, repo.Titles>();
  const albumMove = new Map<string, Map<string, Moved>>();
  const artistMbid = new Map<string, string>();
  const albumMbid = new Map<string, string>();

  for (const [k, v] of entries(raw.artist)) put(str(k), str(v), artistCase, artistMove);

  // "bob marley;the wailers" -> "Bob Marley & The Wailers", however the pair was joined
  for (const [k, v] of entries(raw.combined)) {
    const parts = str(k)
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    const name = str(v);
    if (parts.length < 2 || !name) continue;
    for (const sep of [";", "; ", ", ", " & ", " and ", " / "]) {
      const joined = norm(parts.join(sep));
      if (joined !== norm(name)) artistMove.set(joined, name);
    }
  }

  for (const [artist, map] of entries(raw.albumTrack)) {
    const e: repo.Titles = { fix: new Map(), move: new Map() };
    for (const [k, v] of entries(map)) put(str(k), str(v), e.fix, e.move);
    if (e.fix.size || e.move.size) titles.set(norm(artist), e);
  }

  for (const [artist, map] of entries(raw.redirects)) {
    for (const [k, v] of entries(map)) {
      if (k === "_") {
        if (str(v) && norm(str(v)) !== norm(artist)) artistMove.set(norm(artist), str(v));
        continue;
      }
      const to = { artist: str(field(v, "artist")), album: str(field(v, "album")) };
      if (!to.artist || !to.album) continue;
      const moves = albumMove.get(norm(artist)) ?? new Map<string, Moved>();
      albumMove.set(norm(artist), moves.set(norm(k), to));
    }
  }

  // ids are listed under the old spelling too
  const current = (a: string) => norm(artistMove.get(norm(a)) ?? a);
  for (const [k, v] of entries(raw.mbArtists)) {
    if (!isMbid(v)) continue;
    artistMbid.set(norm(k), v.toLowerCase());
    artistMbid.set(current(k), v.toLowerCase());
  }
  for (const [artist, map] of entries(raw.mbAlbums)) {
    for (const [k, v] of entries(map)) {
      const id = field(v, "id");
      if (!isMbid(id)) continue;
      for (const a of [norm(artist), current(artist)]) albumMbid.set(`${a}\n${norm(k)}`, id.toLowerCase());
    }
  }

  return { artistCase, artistMove, titles, albumMove, artistMbid, albumMbid };
}

function load(raw: store.Raw) {
  tables = build(raw);
  versions = Object.fromEntries(store.SOURCES.map((k) => [k, String(field(raw[k], "version") ?? "")]));
}

export function correct(artist: string, track: string, album = ""): { artist: string; track: string; album: string } {
  if (!enabled) return { artist, track, album };
  artist = tables.artistMove.get(norm(artist)) ?? artist;
  const moved = album ? tables.albumMove.get(norm(artist))?.get(norm(album)) : undefined;
  if (moved) {
    artist = moved.artist;
    album = moved.album;
  }
  artist = tables.artistCase.get(norm(artist)) ?? artist;
  const t = tables.titles.get(norm(artist));
  if (t) {
    const title = (s: string) => {
      const m = t.move.get(norm(s)) ?? s;
      return t.fix.get(norm(m)) ?? m;
    };
    track = title(track);
    if (album) album = title(album);
  }
  return { artist, track, album };
}

export const mbidOfArtist = (name: string): string => tables.artistMbid.get(norm(name)) || "";
export const mbidOfAlbum = (artist: string, title: string): string =>
  tables.albumMbid.get(`${norm(artist)}\n${norm(title)}`) || "";

async function sweep(): Promise<repo.SweepResult> {
  const { artistCase, artistMove, titles, artistMbid, albumMbid } = tables;
  const rules = {
    artists: artistCase.size + artistMove.size,
    titles: [...titles.values()].reduce((s, t) => s + t.fix.size + t.move.size, 0),
    mbids: artistMbid.size + albumMbid.size,
  };
  return repo.sweep({ artistCase, artistMove, titles }, (r) =>
    JSON.stringify({ at: now(), versions, fixed: r.fixed, renamed: r.renamed, clashes: r.clashes, rules })
  );
}

export async function syncCorrections(): Promise<repo.SweepResult | null> {
  if (!enabled) return null;
  let raw = store.readSaved();
  // every process corrects incoming scrobbles, so every process loads the saved copy
  if (raw) load(raw);
  return exclusive("corrections", 30 * 60_000, async () => {
    if (!raw || now() - raw.at > 86400) {
      try {
        raw = await store.download();
        store.save(raw);
        load(raw);
      } catch (e) {
        console.error("Corrections: download failed, keeping the saved copy.", String(e));
        Sentry.captureException(e);
      }
    }
    if (!raw) return null;
    const r = await sweep();
    if (r.fixed || r.renamed) {
      const clashes = r.clashes ? `, ${r.clashes} left for a manual merge` : "";
      console.log(`Corrections: ${r.fixed} capitalisations fixed, ${r.renamed} renamed${clashes}.`);
    }
    return r;
  });
}
