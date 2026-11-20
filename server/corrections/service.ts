// Community name corrections. They are applied in two places: to every incoming scrobble before it is matched
// against the catalogue, and as a sweep over the names already stored. The data is downloaded at most once a day
// (see store.ts). Set CORRECTIONS=0 to switch all of this off.
import { clean, norm, now } from "../util";
import * as repo from "./repo";
import * as store from "./store";

const enabled = process.env.CORRECTIONS !== "0";

type Moved = { artist: string; album: string };
let artistCase = new Map<string, string>();    // same name, the right capitals
let artistMove = new Map<string, string>();    // a different name altogether (redirects, "a;b" pairs)
let titles = new Map<string, repo.Titles>();   // per artist: album and track titles
let albumMove = new Map<string, Map<string, Moved>>(); // album filed under the wrong artist
let artistMbid = new Map<string, string>(), albumMbid = new Map<string, string>();
let versions: Record<string, string> = {};

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? clean(v) : "");
const isMbid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
/** The entries of a downloaded object, or none if it is not one. Each file carries a "version" entry that is not data. */
const entries = (o: unknown): [string, unknown][] => (isObject(o) ? Object.entries(o).filter(([k]) => k !== "version") : []);
const field = (v: unknown, key: string): unknown => (isObject(v) ? v[key] : undefined);

/** Turns the downloaded files into the lookup tables above. */
function build(raw: store.Raw) {
  const aCase = new Map<string, string>(), aMove = new Map<string, string>(), t = new Map<string, repo.Titles>(), alMove = new Map<string, Map<string, Moved>>();
  const put = (k: string, v: string, same: Map<string, string>, other: Map<string, string>) => {
    if (!k || !v) return;
    if (norm(k) === norm(v)) same.set(norm(k), v); else other.set(norm(k), v);
  };
  for (const [k, v] of entries(raw.artist)) put(str(k), str(v), aCase, aMove);
  for (const [k, v] of entries(raw.combined)) { // "bob marley;the wailers" -> "Bob Marley & The Wailers", however the pair was joined
    const parts = str(k).split(";").map(s => s.trim()).filter(Boolean), name = str(v);
    if (parts.length < 2 || !name) continue;
    for (const sep of [";", "; ", ", ", " & ", " and ", " / "]) if (norm(parts.join(sep)) !== norm(name)) aMove.set(norm(parts.join(sep)), name);
  }
  for (const [artist, map] of entries(raw.albumTrack)) {
    const e: repo.Titles = { fix: new Map(), move: new Map() };
    for (const [k, v] of entries(map)) put(str(k), str(v), e.fix, e.move);
    if (e.fix.size || e.move.size) t.set(norm(artist), e);
  }
  for (const [artist, map] of entries(raw.redirects)) for (const [k, v] of entries(map)) {
    if (k === "_") { if (str(v) && norm(str(v)) !== norm(artist)) aMove.set(norm(artist), str(v)); continue; }
    const to = { artist: str(field(v, "artist")), album: str(field(v, "album")) };
    if (!to.artist || !to.album) continue;
    const moves = alMove.get(norm(artist)) ?? new Map<string, Moved>();
    alMove.set(norm(artist), moves.set(norm(k), to));
  }
  const am = new Map<string, string>(), lm = new Map<string, string>();
  const current = (a: string) => norm(aMove.get(norm(a)) ?? a); // ids are listed under the old spelling too
  for (const [k, v] of entries(raw.mbArtists)) if (isMbid(v)) { am.set(norm(k), v.toLowerCase()); am.set(current(k), v.toLowerCase()); }
  for (const [artist, map] of entries(raw.mbAlbums)) for (const [k, v] of entries(map)) {
    const id = field(v, "id");
    if (isMbid(id)) for (const a of [norm(artist), current(artist)]) lm.set(`${a}\n${norm(k)}`, id.toLowerCase());
  }
  artistCase = aCase; artistMove = aMove; titles = t; albumMove = alMove; artistMbid = am; albumMbid = lm;
  versions = Object.fromEntries(store.SOURCES.map(k => [k, String(field(raw[k], "version") ?? "")]));
}

/** The names a scrobble should be filed under. Anything not covered by a correction comes back unchanged. */
export function correct(artist: string, track: string, album = ""): { artist: string; track: string; album: string } {
  if (!enabled) return { artist, track, album };
  artist = artistMove.get(norm(artist)) ?? artist;
  const moved = album ? albumMove.get(norm(artist))?.get(norm(album)) : undefined;
  if (moved) { artist = moved.artist; album = moved.album; }
  artist = artistCase.get(norm(artist)) ?? artist;
  const t = titles.get(norm(artist));
  if (t) {
    const title = (s: string) => { const m = t.move.get(norm(s)) ?? s; return t.fix.get(norm(m)) ?? m; };
    track = title(track); if (album) album = title(album);
  }
  return { artist, track, album };
}
/** The MusicBrainz id of an artist or album, or "" when it is not known. */
export const mbidOfArtist = (name: string): string => artistMbid.get(norm(name)) || "";
export const mbidOfAlbum = (artist: string, title: string): string => albumMbid.get(`${norm(artist)}\n${norm(title)}`) || "";

/** Bring names already in the catalogue into line. Renames only; two existing entries are never merged automatically. */
export function sweep(): repo.SweepResult {
  const rules = { artists: artistCase.size + artistMove.size, titles: [...titles.values()].reduce((s, t) => s + t.fix.size + t.move.size, 0), mbids: artistMbid.size + albumMbid.size };
  return repo.sweep({ artistCase, artistMove, titles }, r => JSON.stringify({ at: now(), versions, fixed: r.fixed, renamed: r.renamed, clashes: r.clashes, rules }));
}

/** Load the saved copy straight away, then refresh from the network when it is more than a day old. */
export async function syncCorrections(force = false): Promise<repo.SweepResult | null> {
  if (!enabled) return null;
  let raw = store.readSaved();
  if (raw) build(raw);
  if (force || !raw || now() - raw.at > 86400) {
    try { raw = await store.download(); store.save(raw); build(raw); }
    catch (e) { console.error("Corrections: download failed, keeping the saved copy.", String(e)); }
  }
  if (!raw) return null;
  const r = sweep();
  if (r.fixed || r.renamed) console.log(`Corrections: ${r.fixed} capitalisations fixed, ${r.renamed} renamed${r.clashes ? `, ${r.clashes} left for a manual merge` : ""}.`);
  return r;
}
