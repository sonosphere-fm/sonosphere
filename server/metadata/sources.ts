// Where catalogue details come from when nobody has filed them yet. MusicBrainz is the main source (open data we may
// keep): artists, albums with their dates and track lists, track lengths. The Cover Art Archive has album covers.
// Spotify, borrowing a connected listener's token, fills what MusicBrainz lacks and has the artist photos. Pictures
// from Spotify are shown from Spotify's servers, never copied here.
//
// MusicBrainz allows one request a second per site, so calls queue on a limit shared by every process (server/kv.ts).
// When musicbrainz.org is busy, VideoLAN's mirror (same interface) is asked instead. Our own copy of MusicBrainz
// (./mbdb, when MBDB_URL is set) is asked before either.
import { attempt, getJson, setJson } from "../kv";
import { AsyncLocalStorage } from "node:async_hooks";
import { catalogueGet, NoCapacity } from "../spotify/service";
import * as mbdb from "./mbdb";

// ---------- small JSON readers (every reply is untrusted input) ----------
type Json = Record<string, unknown>;
const obj = (v: unknown): Json | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : null);
const str = (v: unknown) => (typeof v === "string" ? v : "");
/** A name as people type it: MusicBrainz spells with typographic hyphens and quotes ("Don’t", "Anti‐Hero"), scrobbles don't. */
const tidy = (v: unknown) => str(v).replace(/[\u2010\u2011]/g, "-").replace(/[\u2018\u2019\u02bc]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/\u2026/g, "...");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const objs = (v: unknown): Json[] => list(v).map(obj).filter((x): x is Json => !!x);

/** Names compared loosely: case, accents, punctuation and a leading "The" don't matter. */
export const same = (a: string, b: string) => loose(a) === loose(b) && loose(a) !== "";
const loose = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/&/g, "and")
  .replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/^the /, "");

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
/** Too busy right now: the caller tries again another time. */
export class Busy extends Error {}

/** Waits for a turn under a shared limit of one call per `gapMs`, for at most `patience` ms. */
async function turn(name: string, gapMs: number, patience = 20_000) {
  const until = Date.now() + patience;
  while (!(await attempt(`meta-rate:${name}`, 1, gapMs))) {
    if (Date.now() > until) throw new Busy(name);
    await wait(150 + Math.random() * 250);
  }
}
const pauseKey = (name: string) => `meta-pause:${name}`;
async function pausedFor(name: string) { if (await getJson<number>(pauseKey(name))) throw new Busy(name); }
const pause = (name: string, seconds: number) => setJson(pauseKey(name), 1, Math.max(5, seconds) * 1000);

// ---------- MusicBrainz ----------
const MB = [{ name: "mb", base: "https://musicbrainz.org/ws/2" }, { name: "mb-videolan", base: "https://mb.videolan.org/ws/2" }];
// MusicBrainz asks every client to name itself and give a way to reach whoever runs it
const agent = () => `Sonosphere/1.0${process.env.SITE_URL ? ` ( ${process.env.SITE_URL} )` : ""}`;

async function mb(path: string, params: Record<string, string>): Promise<Json | null> {
  let res: Response | null = null;
  // MusicBrainz turns some requests away (503) when it is busy overall, even within the limit: the mirror is tried
  // next, then each again after a short wait
  for (let tries = 0; tries < 4 && !res; tries++) {
    const server = MB[tries % MB.length]!;
    if (await getJson<number>(pauseKey(server.name))) continue;
    if (tries >= MB.length) await wait(1000 + Math.random() * 1000);
    await turn(server.name, 1100);
    try {
      const r = await fetch(`${server.base}${path}?${new URLSearchParams({ ...params, fmt: "json" })}`, {
        headers: { "User-Agent": agent(), Accept: "application/json" }, signal: AbortSignal.timeout(15_000),
      });
      if (r.status === 503 || r.status === 429 || r.status >= 500) { if (tries >= MB.length) await pause(server.name, Number(r.headers.get("retry-after")) || 10); continue; }
      res = r;
    } catch (e) { if (tries >= MB.length - 1 && !(e instanceof Error && e.name === "TimeoutError")) throw e; }
  }
  if (!res) throw new Busy("mb");
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`MusicBrainz ${path} answered ${res.status}`);
  return obj(await res.json().catch(() => null));
}

/** A quoted term for a MusicBrainz (Lucene) search. */
const phrase = (s: string) => `"${s.replace(/[\\"]/g, m => `\\${m}`)}"`;
const credit = (v: unknown) => objs(v).map(c => tidy(c.name) + str(c.joinphrase)).join("");
const firstArtist = (v: unknown) => tidy(objs(v)[0]?.name);

export type MbArtist = { mbid: string; name: string };
async function apiArtist(name: string): Promise<MbArtist | null> {
  const r = await mb("/artist", { query: `artist:${phrase(name)}`, limit: "8" });
  // the best-scoring name match; ties go to the first, which MusicBrainz ranks as the better known
  const hit = objs(r?.artists).find(a => same(str(a.name), name) && num(a.score) >= 90);
  return hit ? { mbid: str(hit.id), name: tidy(hit.name) } : null;
}

/** The artist's Spotify id, when MusicBrainz links one. */
async function apiSpotifyId(mbid: string): Promise<string | null> {
  const r = await mb(`/artist/${mbid}`, { inc: "url-rels" });
  for (const rel of objs(r?.relations)) {
    const m = /open\.spotify\.com\/artist\/([A-Za-z0-9]{22})/.exec(str(obj(rel.url)?.resource));
    if (m) return m[1]!;
  }
  return null;
}

export type MbAlbum = { mbid: string; title: string; artist: string; date: string | null; type: string };
const album = (g: Json): MbAlbum => ({
  mbid: str(g.id), title: tidy(g.title), artist: firstArtist(g["artist-credit"]) || credit(g["artist-credit"]),
  date: str(g["first-release-date"]) || null, type: str(g["primary-type"]),
});
/** Studio albums, EPs and singles; compilations, live recordings, remixes and the like are left out. */
const plain = (g: Json) => ["Album", "EP", "Single"].includes(str(g["primary-type"])) && list(g["secondary-types"]).length === 0;

async function apiAlbum(artist: string, title: string): Promise<MbAlbum | null> {
  const r = await mb("/release-group", { query: `releasegroup:${phrase(title)} AND artist:${phrase(artist)}`, limit: "10" });
  const hits = objs(r?.["release-groups"]).filter(g => same(str(g.title), title) && same(firstArtist(g["artist-credit"]), artist));
  const hit = hits.find(plain) ?? hits[0];
  return hit ? album(hit) : null;
}

/** An artist's albums and EPs (singles would swamp the list), oldest first. */
async function apiDiscography(mbid: string): Promise<MbAlbum[]> {
  const r = await mb("/release-group", { artist: mbid, type: "album|ep", limit: "100" });
  return objs(r?.["release-groups"]).filter(plain).map(album).filter(a => a.title)
    .sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
}

export type MbTrack = { title: string; artist: string; seconds: number; album: MbAlbum | null };
async function apiTrack(artist: string, title: string): Promise<MbTrack | null> {
  const base = `recording:${phrase(title)} AND artist:${phrase(artist)}`;
  const find = async (q: string) => objs((await mb("/recording", { query: q, limit: "25" }))?.recordings)
    .filter(x => same(str(x.title), title) && same(firstArtist(x["artist-credit"]), artist) && num(x.score) >= 80);
  let hits = await find(`${base} AND status:official`);
  if (!hits.length) hits = await find(base);
  if (!hits.length) return null;
  // search ranks live takes, karaoke versions and compilations alongside the original, and often leaves the original
  // out: only a recording with no note ("live, 1994...") on an official album, EP or single counts, earliest first
  const studio = hits.filter(h => !str(h.disambiguation) && !h.video);
  let best: { rec: Json; g: Json; date: string; rank: number } | null = null;
  for (const rec of studio) for (const rel of objs(rec.releases)) {
    const g = obj(rel["release-group"]);
    if (!g || str(rel.status) !== "Official" || !plain(g)) continue;
    const rank = str(g["primary-type"]) === "Album" ? 0 : str(g["primary-type"]) === "EP" ? 1 : 2;
    const cand = { rec, g, date: str(rel.date) || "9999", rank };
    if (!best || cand.date.slice(0, 4) < best.date.slice(0, 4) || (cand.date.slice(0, 4) === best.date.slice(0, 4) && cand.rank < best.rank)) best = cand;
  }
  const rec = best?.rec ?? studio[0] ?? hits[0]!;
  const seconds = Math.round((num(rec.length) || studio.map(h => num(h.length)).find(n => n > 0) || 0) / 1000);
  const name = firstArtist(rec["artist-credit"]);
  return {
    title: tidy(rec.title), artist: name, seconds,
    album: best && best.rank < 2 ? { mbid: str(best.g.id), title: tidy(best.g.title), artist: name, date: best.date === "9999" ? null : best.date, type: str(best.g["primary-type"]) } : null,
  };
}

export type ListedTrack = { title: string; seconds: number };
/** The track list of an album's first official release (discs in order, video discs left out). */
async function apiTrackList(rgid: string): Promise<ListedTrack[]> {
  const r = await mb("/release", { "release-group": rgid, status: "official", inc: "recordings+media", limit: "50" });
  const pref = (c: string) => (c === "XW" ? 0 : c === "US" || c === "GB" ? 1 : 2);
  const releases = objs(r?.releases).filter(x => objs(x.media).some(m => objs(m.tracks).length))
    .sort((a, b) => (str(a.date) || "9999").localeCompare(str(b.date) || "9999") || pref(str(a.country)) - pref(str(b.country)));
  const pick = releases[0];
  if (!pick) return [];
  const out: ListedTrack[] = [];
  for (const m of objs(pick.media)) {
    if (/dvd|blu-ray|video/i.test(str(m.format))) continue;
    for (const t of objs(m.tracks)) {
      const title = tidy(t.title) || tidy(obj(t.recording)?.title);
      if (title) out.push({ title, seconds: Math.round((num(t.length) || num(obj(t.recording)?.length)) / 1000) });
    }
  }
  return out.slice(0, 100);
}

// Our own copy of MusicBrainz (./mbdb) answers first when there is one; musicbrainz.org when it can't be reached.
let ownDownAt = 0;
async function own<T>(local: () => Promise<T>, api: () => Promise<T>): Promise<T> {
  if (mbdb.mbdbOn && Date.now() - ownDownAt > 60_000) {
    try { return await local(); } catch (e) {
      ownDownAt = Date.now();
      console.error("MusicBrainz copy unavailable, asking musicbrainz.org for a minute:", e instanceof Error ? e.message : e);
    }
  }
  return api();
}
export const mbArtist = (name: string) => own(() => mbdb.artist(name), () => apiArtist(name));
export const mbSpotifyId = (mbid: string) => own(() => mbdb.spotifyId(mbid), () => apiSpotifyId(mbid));
export const mbAlbum = (artist: string, title: string) => own(() => mbdb.album(artist, title), () => apiAlbum(artist, title));
export const mbDiscography = (mbid: string) => own(() => mbdb.discography(mbid), () => apiDiscography(mbid));
export const mbTrack = (artist: string, title: string) => own(() => mbdb.track(artist, title), () => apiTrack(artist, title));
export const mbTrackList = (rgid: string) => own(() => mbdb.trackList(rgid), () => apiTrackList(rgid));
/** Whether lookups are cheap (our own copy) rather than limited to one a second. */
export const mbLocal = () => mbdb.mbdbOn && Date.now() - ownDownAt > 60_000;

// ---------- Cover Art Archive ----------
/** The front cover of an album (500px), or null when the archive has none. */
export async function coverArt(rgid: string): Promise<Uint8Array | null> {
  await turn("caa", 500);
  const res = await fetch(`https://coverartarchive.org/release-group/${rgid}/front-500`, { headers: { "User-Agent": agent() }, signal: AbortSignal.timeout(30_000) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Cover Art Archive answered ${res.status}`);
  if (Number(res.headers.get("content-length")) > 15_000_000) return null;
  const bytes = new Uint8Array(await res.arrayBuffer());
  return bytes.length && bytes.length <= 15_000_000 ? bytes : null;
}

// ---------- Spotify (through a connected listener's token, server/spotify) ----------
// Two lanes: lookups for a page someone opened go first; background filling ("spare time", see inSpareTime()) only uses
// Spotify while visitors aren't and the apps have room, one call a second at most, and gives up rather than waits.
const lane = new AsyncLocalStorage<"spare">();
/** Runs a job whose Spotify lookups only use spare capacity. */
export const inSpareTime = <T>(job: () => Promise<T>) => lane.run("spare", job);

async function sp(path: string): Promise<Json | null> {
  const spare = lane.getStore() === "spare";
  await pausedFor("spotify");
  if (spare) await turn("spotify-spare", 1000, 2000); else await turn("spotify", 150);
  try { return await catalogueGet(path, spare); } catch (e) {
    if (!(e instanceof NoCapacity)) throw e;
    // every connected app is resting after a 429 (or none is connected): page lookups wait a little; nothing counts as "not found"
    if (!spare) await pause("spotify", 15);
    throw new Busy("spotify");
  }
}
/** Whether Spotify lookups are waiting (see sp()). */
export const spotifyResting = async () => !!(await getJson<number>(pauseKey("spotify")));
const search = (type: string, q: string) => sp(`/search?${new URLSearchParams({ q, type, limit: "10" })}`);
const quoted = (s: string) => s.replace(/"/g, "");

export type Picture = { url: string; width: number | null; height: number | null };
/** The largest picture Spotify lists that is not huge (Spotify lists them largest first). */
const picture = (v: unknown): Picture | null => {
  const imgs = objs(v).filter(i => str(i.url).startsWith("https://"));
  const i = imgs.find(x => num(x.width) <= 1000) ?? imgs[0];
  return i ? { url: str(i.url), width: num(i.width) || null, height: num(i.height) || null } : null;
};

export type SpArtist = { id: string; name: string; picture: Picture | null };
export async function spArtist(name: string, id?: string | null): Promise<SpArtist | null> {
  const a = id ? await sp(`/artists/${encodeURIComponent(id)}`)
    : objs(obj((await search("artist", `artist:"${quoted(name)}"`))?.artists)?.items).find(x => same(str(x.name), name)) ?? null;
  return a && str(a.id) ? { id: str(a.id), name: tidy(a.name), picture: picture(a.images) } : null;
}

export type SpAlbum = { id: string; title: string; artist: string; date: string | null; picture: Picture | null };
const spAlbumOf = (a: Json): SpAlbum => ({ id: str(a.id), title: tidy(a.name), artist: firstArtist(a.artists), date: str(a.release_date) || null, picture: picture(a.images) });

export async function spAlbum(artist: string, title: string): Promise<SpAlbum | null> {
  const items = objs(obj((await search("album", `album:"${quoted(title)}" artist:"${quoted(artist)}"`))?.albums)?.items);
  const hit = items.find(a => same(str(a.name), title) && objs(a.artists).some(x => same(str(x.name), artist)));
  return hit ? spAlbumOf(hit) : null;
}

export async function spTrackList(albumId: string): Promise<ListedTrack[]> {
  const r = await sp(`/albums/${encodeURIComponent(albumId)}/tracks?limit=50`);
  return objs(r?.items).map(t => ({ title: tidy(t.name), seconds: Math.round(num(t.duration_ms) / 1000) })).filter(t => t.title);
}

export type SpTrack = { title: string; artist: string; seconds: number; album: SpAlbum | null };
export async function spTrack(artist: string, title: string): Promise<SpTrack | null> {
  const items = objs(obj((await search("track", `track:"${quoted(title)}" artist:"${quoted(artist)}"`))?.tracks)?.items);
  const hits = items.filter(t => same(str(t.name), title) && objs(t.artists).some(x => same(str(x.name), artist)));
  // the album version over singles and compilations where there is one
  const hit = hits.find(t => str(obj(t.album)?.album_type) === "album") ?? hits[0];
  if (!hit) return null;
  const al = obj(hit.album);
  return { title: tidy(hit.name), artist: firstArtist(hit.artists), seconds: Math.round(num(hit.duration_ms) / 1000), album: al && str(al.album_type) !== "compilation" ? spAlbumOf(al) : null };
}

// ---------- Last.fm ----------
// Fills what MusicBrainz and Spotify lack: album covers (shown from Last.fm's servers), track lengths, the album a
// track is on, album track lists, MusicBrainz ids. Its artist pictures are all one placeholder, so none are taken.
// Last.fm allows a few calls a second per key; one every 250ms, shared by every process.
export const LASTFM_KEY = "65fb65f79427db8ce5626269c0d7fa2b";
const LF_BLANK = "2a96cbd8b46e442fc41c2b86b821562f"; // the grey star Last.fm shows for "no picture"

/** A call to Last.fm's API: null when it has nothing by that name. */
export async function lastfm(method: string, params: Record<string, string>): Promise<Json | null> {
  await pausedFor("lastfm");
  await turn("lastfm", 250);
  let res: Response;
  try {
    res = await fetch(`https://ws.audioscrobbler.com/2.0/?${new URLSearchParams({ ...params, method, api_key: LASTFM_KEY, format: "json", autocorrect: "0" })}`,
      { headers: { "User-Agent": agent() }, signal: AbortSignal.timeout(15_000) });
  } catch { throw new Busy("lastfm"); }
  const body = obj(await res.json().catch(() => null));
  const code = num(body?.error);
  if (code === 6) return null; // no such artist, album or track
  if (code === 29 || res.status === 429) { await pause("lastfm", 60); throw new Busy("lastfm"); } // too many calls
  if (code === 11 || code === 16 || res.status >= 500) { await pause("lastfm", 15); throw new Busy("lastfm"); } // down for a moment
  if (code) throw new Error(`Last.fm ${method} answered error ${code}`);
  if (!res.ok) throw new Error(`Last.fm ${method} answered ${res.status}`);
  return body;
}

/** The largest picture Last.fm lists (300px), unless it is the placeholder. */
const lfPicture = (v: unknown): Picture | null => {
  const imgs = objs(v), big = ["mega", "extralarge", "large", "medium"];
  for (const size of big) {
    const url = str(imgs.find(i => str(i.size) === size)?.["#text"]);
    if (url.startsWith("https://") && !url.includes(LF_BLANK)) return { url, width: size === "mega" || size === "extralarge" ? 300 : null, height: size === "mega" || size === "extralarge" ? 300 : null };
  }
  return null;
};
const lfMbid = (v: unknown) => /^[0-9a-f-]{36}$/.test(str(v)) ? str(v) : null;

export type LfArtist = { name: string; mbid: string | null };
export async function lfArtist(name: string): Promise<LfArtist | null> {
  const a = obj((await lastfm("artist.getinfo", { artist: name }))?.artist);
  return a && same(str(a.name), name) ? { name: tidy(a.name), mbid: lfMbid(a.mbid) } : null;
}

export type LfAlbum = { title: string; artist: string; mbid: string | null; picture: Picture | null; tracks: ListedTrack[] };
export async function lfAlbum(artist: string, title: string): Promise<LfAlbum | null> {
  const a = obj((await lastfm("album.getinfo", { artist, album: title }))?.album);
  if (!a || !same(str(a.name), title) || !same(str(a.artist), artist)) return null;
  // a one-track album comes as an object rather than a list
  const raw = obj(a.tracks)?.track, tracks = (Array.isArray(raw) ? objs(raw) : obj(raw) ? [obj(raw)!] : [])
    .map(t => ({ title: tidy(t.name), seconds: Math.round(Number(t.duration) || 0) })).filter(t => t.title);
  return { title: tidy(a.name), artist: tidy(a.artist), mbid: lfMbid(a.mbid), picture: lfPicture(a.image), tracks };
}

export type LfTrack = { title: string; artist: string; seconds: number; album: { title: string; mbid: string | null; picture: Picture | null } | null };
export async function lfTrack(artist: string, title: string): Promise<LfTrack | null> {
  const t = obj((await lastfm("track.getinfo", { artist, track: title }))?.track);
  if (!t || !same(str(t.name), title) || !same(str(obj(t.artist)?.name), artist)) return null;
  const al = obj(t.album), alTitle = tidy(al?.title);
  return { title: tidy(t.name), artist: tidy(obj(t.artist)?.name), seconds: Math.round((Number(t.duration) || 0) / 1000),
    album: al && alTitle ? { title: alTitle, mbid: lfMbid(al.mbid), picture: lfPicture(al.image) } : null };
}
