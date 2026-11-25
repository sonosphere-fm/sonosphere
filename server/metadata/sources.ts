import { attempt, getJson, setJson } from "../kv";
import { asObject } from "../util";
import { AsyncLocalStorage } from "node:async_hooks";
import { catalogueGet, NoCapacity } from "../spotify/service";
import * as mbdb from "./mbdb";
import { spotifyCatalogue } from "../spotify/catalogue";

type Json = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");
// MusicBrainz spells with typographic hyphens and quotes ("Don’t", "Anti‐Hero"), scrobbles don't
const tidy = (v: unknown) =>
  str(v)
    .replace(/[\u2010\u2011]/g, "-")
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2026/g, "...");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const objs = (v: unknown): Json[] =>
  list(v)
    .map(asObject)
    .filter((x): x is Json => !!x);

const loose = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, "and")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/^the /, "");
const same = (a: string, b: string) => loose(a) === loose(b) && loose(a) !== "";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Too busy right now: try again another time. */
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
async function pausedFor(name: string) {
  if (await getJson<number>(pauseKey(name))) throw new Busy(name);
}
const pause = (name: string, seconds: number) => setJson(pauseKey(name), 1, Math.max(5, seconds) * 1000);

// VideoLAN runs a mirror with the same interface for when musicbrainz.org is busy
const MB = [
  { name: "mb", base: "https://musicbrainz.org/ws/2" },
  { name: "mb-videolan", base: "https://mb.videolan.org/ws/2" },
];
// MusicBrainz asks every client to name itself and give a way to reach whoever runs it
export const agent = () => `Sonosphere/1.0${process.env.SITE_URL ? ` ( ${process.env.SITE_URL} )` : ""}`;

async function mb(path: string, params: Record<string, string>): Promise<Json | null> {
  let res: Response | null = null;
  // MusicBrainz turns requests away (503) when busy overall, even within the limit: try the mirror, then each again
  for (let tries = 0; tries < 4 && !res; tries++) {
    const server = MB[tries % MB.length]!;
    if (await getJson<number>(pauseKey(server.name))) continue;
    if (tries >= MB.length) await wait(1000 + Math.random() * 1000);
    await turn(server.name, 1100);
    try {
      const r = await fetch(`${server.base}${path}?${new URLSearchParams({ ...params, fmt: "json" })}`, {
        headers: { "User-Agent": agent(), Accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
      });
      if (r.status === 429 || r.status >= 500) {
        if (tries >= MB.length) await pause(server.name, Number(r.headers.get("retry-after")) || 10);
        continue;
      }
      res = r;
    } catch (e) {
      const timedOut = e instanceof Error && e.name === "TimeoutError";
      if (tries >= MB.length - 1 && !timedOut) throw e;
    }
  }
  if (!res) throw new Busy("mb");
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`MusicBrainz ${path} answered ${res.status}`);
  return asObject(await res.json().catch(() => null));
}

const phrase = (s: string) => `"${s.replace(/[\\"]/g, (m) => `\\${m}`)}"`;
const credit = (v: unknown) =>
  objs(v)
    .map((c) => tidy(c.name) + str(c.joinphrase))
    .join("");
const firstArtist = (v: unknown) => tidy(objs(v)[0]?.name);

export type MbArtist = { mbid: string; name: string };
async function apiArtist(name: string): Promise<MbArtist | null> {
  const r = await mb("/artist", { query: `artist:${phrase(name)}`, limit: "8" });
  // the best-scoring name match; ties go to the first, which MusicBrainz ranks as the better known
  const hit = objs(r?.artists).find((a) => same(str(a.name), name) && num(a.score) >= 90);
  return hit ? { mbid: str(hit.id), name: tidy(hit.name) } : null;
}

async function apiSpotifyId(mbid: string): Promise<string | null> {
  const r = await mb(`/artist/${mbid}`, { inc: "url-rels" });
  for (const rel of objs(r?.relations)) {
    const m = /open\.spotify\.com\/artist\/([A-Za-z0-9]{22})/.exec(str(asObject(rel.url)?.resource));
    if (m) return m[1]!;
  }
  return null;
}

export type MbAlbum = { mbid: string; title: string; artist: string; date: string | null; type: string };
const album = (g: Json): MbAlbum => ({
  mbid: str(g.id),
  title: tidy(g.title),
  artist: firstArtist(g["artist-credit"]) || credit(g["artist-credit"]),
  date: str(g["first-release-date"]) || null,
  type: str(g["primary-type"]),
});
// albums, EPs and singles; compilations, live recordings, remixes and the like are left out
const plain = (g: Json) =>
  ["Album", "EP", "Single"].includes(str(g["primary-type"])) && list(g["secondary-types"]).length === 0;

async function apiAlbum(artist: string, title: string): Promise<MbAlbum | null> {
  const r = await mb("/release-group", {
    query: `releasegroup:${phrase(title)} AND artist:${phrase(artist)}`,
    limit: "10",
  });
  const hits = objs(r?.["release-groups"]).filter(
    (g) => same(str(g.title), title) && same(firstArtist(g["artist-credit"]), artist)
  );
  const hit = hits.find(plain) ?? hits[0];
  return hit ? album(hit) : null;
}

// singles would swamp the list
async function apiDiscography(mbid: string): Promise<MbAlbum[]> {
  const r = await mb("/release-group", { artist: mbid, type: "album|ep", limit: "100" });
  return objs(r?.["release-groups"])
    .filter(plain)
    .map(album)
    .filter((a) => a.title)
    .sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
}

export type MbTrack = { title: string; artist: string; seconds: number; album: MbAlbum | null };
async function apiTrack(artist: string, title: string): Promise<MbTrack | null> {
  const base = `recording:${phrase(title)} AND artist:${phrase(artist)}`;
  const find = async (q: string) => {
    const r = await mb("/recording", { query: q, limit: "25" });
    return objs(r?.recordings).filter(
      (x) => same(str(x.title), title) && same(firstArtist(x["artist-credit"]), artist) && num(x.score) >= 80
    );
  };
  let hits = await find(`${base} AND status:official`);
  if (!hits.length) hits = await find(base);
  if (!hits.length) return null;
  // search ranks live takes, karaoke versions and compilations alongside the original, and often leaves the original
  // out: only a recording with no note ("live, 1994...") on an official album, EP or single counts, earliest first
  const studio = hits.filter((h) => !str(h.disambiguation) && !h.video);
  let best: { rec: Json; g: Json; date: string; rank: number } | null = null;
  for (const rec of studio) {
    for (const rel of objs(rec.releases)) {
      const g = asObject(rel["release-group"]);
      if (!g || str(rel.status) !== "Official" || !plain(g)) continue;
      const type = str(g["primary-type"]);
      const rank = type === "Album" ? 0 : type === "EP" ? 1 : 2;
      const cand = { rec, g, date: str(rel.date) || "9999", rank };
      const year = cand.date.slice(0, 4);
      const bestYear = best?.date.slice(0, 4);
      if (!best || year < bestYear! || (year === bestYear && cand.rank < best.rank)) best = cand;
    }
  }
  const rec = best?.rec ?? studio[0] ?? hits[0]!;
  const ms = num(rec.length) || studio.map((h) => num(h.length)).find((n) => n > 0) || 0;
  const name = firstArtist(rec["artist-credit"]);
  let album: MbAlbum | null = null;
  if (best && best.rank < 2) {
    album = {
      mbid: str(best.g.id),
      title: tidy(best.g.title),
      artist: name,
      date: best.date === "9999" ? null : best.date,
      type: str(best.g["primary-type"]),
    };
  }
  return { title: tidy(rec.title), artist: name, seconds: Math.round(ms / 1000), album };
}

export type ListedTrack = { title: string; seconds: number };
/** The first official release's tracks, video discs left out. */
async function apiTrackList(rgid: string): Promise<ListedTrack[]> {
  const r = await mb("/release", { "release-group": rgid, status: "official", inc: "recordings+media", limit: "50" });
  const pref = (c: string) => (c === "XW" ? 0 : c === "US" || c === "GB" ? 1 : 2);
  const byDate = (a: Json, b: Json) => (str(a.date) || "9999").localeCompare(str(b.date) || "9999");
  const releases = objs(r?.releases)
    .filter((x) => objs(x.media).some((m) => objs(m.tracks).length))
    .sort((a, b) => byDate(a, b) || pref(str(a.country)) - pref(str(b.country)));
  const pick = releases[0];
  if (!pick) return [];
  const out: ListedTrack[] = [];
  for (const m of objs(pick.media)) {
    if (/dvd|blu-ray|video/i.test(str(m.format))) continue;
    for (const t of objs(m.tracks)) {
      const recording = asObject(t.recording);
      const title = tidy(t.title) || tidy(recording?.title);
      const ms = num(t.length) || num(recording?.length);
      if (title) out.push({ title, seconds: Math.round(ms / 1000) });
    }
  }
  return out.slice(0, 100);
}

async function apiReleaseTypes(mbids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const mbid of mbids) out.set(mbid, str((await mb(`/release-group/${mbid}`, {}))?.["primary-type"]));
  return out;
}

let ownDownAt = 0;
async function own<T>(local: () => Promise<T>, api: () => Promise<T>): Promise<T> {
  if (mbdb.mbdbOn && Date.now() - ownDownAt > 60_000) {
    try {
      return await local();
    } catch (e) {
      ownDownAt = Date.now();
      console.error(
        "MusicBrainz copy unavailable, asking musicbrainz.org for a minute:",
        e instanceof Error ? e.message : e
      );
    }
  }
  return api();
}
export const mbArtist = (name: string) =>
  own(
    () => mbdb.artist(name),
    () => apiArtist(name)
  );
export const mbSpotifyId = (mbid: string) =>
  own(
    () => mbdb.spotifyId(mbid),
    () => apiSpotifyId(mbid)
  );
export const mbAlbum = (artist: string, title: string) =>
  own(
    () => mbdb.album(artist, title),
    () => apiAlbum(artist, title)
  );
export const mbDiscography = (mbid: string) =>
  own(
    () => mbdb.discography(mbid),
    () => apiDiscography(mbid)
  );
export const mbTrack = (artist: string, title: string) =>
  own(
    () => mbdb.track(artist, title),
    () => apiTrack(artist, title)
  );
export const mbTrackList = (rgid: string) =>
  own(
    () => mbdb.trackList(rgid),
    () => apiTrackList(rgid)
  );
export const mbReleaseTypes = (mbids: string[]) =>
  own(
    () => mbdb.releaseTypes(mbids),
    () => apiReleaseTypes(mbids)
  );
/** Whether lookups are cheap (our own copy) rather than one a second. */
export const mbLocal = () => mbdb.mbdbOn && Date.now() - ownDownAt > 60_000;

const WDQS = "https://query.wikidata.org/sparql";

/** Keyed by MusicBrainz id (P434), photo from Commons (P18). Throws when Wikidata can't answer. */
export async function wikiPhotos(mbids: string[]): Promise<Map<string, Picture>> {
  const ids = mbids.filter((m) => /^[0-9a-f-]{36}$/.test(m));
  const out = new Map<string, Picture>();
  if (!ids.length) return out;
  await pausedFor("wikidata");
  await turn("wikidata", 1000);
  const values = ids.map((m) => `"${m}"`).join(" ");
  const query = `SELECT ?mbid (SAMPLE(?img) AS ?image) WHERE { VALUES ?mbid { ${values} } ?item wdt:P434 ?mbid; wdt:P18 ?img. } GROUP BY ?mbid`;
  let payload: unknown;
  try {
    const res = await fetch(`${WDQS}?${new URLSearchParams({ query, format: "json" })}`, {
      headers: { "User-Agent": agent(), Accept: "application/sparql-results+json" },
      signal: AbortSignal.timeout(30_000),
    });
    if (res.status === 429 || res.status >= 500) {
      await pause("wikidata", Number(res.headers.get("retry-after")) || 60);
      throw new Busy("wikidata");
    }
    if (!res.ok) throw new Error(`Wikidata answered ${res.status}`);
    payload = await res.json();
  } catch (e) {
    // Wikidata is slow under load; another query soon would only add to it
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
      await pause("wikidata", 60);
      throw new Busy("wikidata");
    }
    throw e;
  }
  const rows = objs(asObject(asObject(payload)?.results)?.bindings);
  for (const r of rows) {
    const mbid = str(asObject(r.mbid)?.value);
    const img = str(asObject(r.image)?.value);
    const file = /\/Special:FilePath\/(.+)$/.exec(img)?.[1];
    if (!mbid || !file) continue;
    out.set(mbid, {
      url: `https://commons.wikimedia.org/wiki/Special:FilePath/${file}?width=500`,
      width: null,
      height: null,
    });
  }
  return out;
}

/** The 1200px front cover from the Cover Art Archive; null when it has none. */
export async function coverArt(
  mbid: string,
  of: "release-group" | "release" = "release-group"
): Promise<Uint8Array | null> {
  await pausedFor("caa");
  await turn("caa", 250);
  const res = await fetch(`https://coverartarchive.org/${of}/${mbid}/front-1200`, {
    headers: { "User-Agent": agent() },
    signal: AbortSignal.timeout(30_000),
  });
  if (res.status === 404) return null;
  if (res.status === 429) {
    await pause("caa", Number(res.headers.get("retry-after")) || 60);
    throw new Busy("caa");
  }
  if (res.status >= 500) return null;
  if (!res.ok) throw new Error(`Cover Art Archive answered ${res.status}`);
  if (Number(res.headers.get("content-length")) > 15_000_000) return null;
  const bytes = new Uint8Array(await res.arrayBuffer());
  return bytes.length && bytes.length <= 15_000_000 ? bytes : null;
}

// Lookups for a page someone opened go first; background jobs in spare time use Spotify only when the apps have
// room, one call a second at most, and give up rather than wait.
const lane = new AsyncLocalStorage<"spare">();
export const inSpareTime = <T>(job: () => Promise<T>) => lane.run("spare", job);

async function sp(path: string): Promise<Json | null> {
  if (!spotifyCatalogue()) throw new Busy("spotify");
  const spare = lane.getStore() === "spare";
  await pausedFor("spotify");
  if (spare) await turn("spotify-spare", 1000, 2000);
  else await turn("spotify", 150);
  try {
    return await catalogueGet(path, spare);
  } catch (e) {
    if (!(e instanceof NoCapacity)) throw e;
    // every app is resting after a 429 (or none is connected); this must not count as "not found"
    if (!spare) await pause("spotify", 15);
    throw new Busy("spotify");
  }
}
export const spotifyResting = async () => !spotifyCatalogue() || !!(await getJson<number>(pauseKey("spotify")));
const search = (type: string, q: string) => sp(`/search?${new URLSearchParams({ q, type, limit: "10" })}`);
const quoted = (s: string) => s.replace(/"/g, "");

export type Picture = { url: string; width: number | null; height: number | null };
// Spotify lists pictures largest first
const picture = (v: unknown): Picture | null => {
  const imgs = objs(v).filter((i) => str(i.url).startsWith("https://"));
  const i = imgs.find((x) => num(x.width) <= 1000) ?? imgs[0];
  return i ? { url: str(i.url), width: num(i.width) || null, height: num(i.height) || null } : null;
};

type SpArtist = { id: string; name: string; picture: Picture | null };
export async function spArtist(name: string, id?: string | null): Promise<SpArtist | null> {
  let a: Json | null;
  if (id) {
    a = await sp(`/artists/${encodeURIComponent(id)}`);
  } else {
    const r = await search("artist", `artist:"${quoted(name)}"`);
    a = objs(asObject(r?.artists)?.items).find((x) => same(str(x.name), name)) ?? null;
  }
  return a && str(a.id) ? { id: str(a.id), name: tidy(a.name), picture: picture(a.images) } : null;
}

export type SpAlbum = { id: string; title: string; artist: string; date: string | null; picture: Picture | null };
const spAlbumOf = (a: Json): SpAlbum => ({
  id: str(a.id),
  title: tidy(a.name),
  artist: firstArtist(a.artists),
  date: str(a.release_date) || null,
  picture: picture(a.images),
});

export async function spAlbum(artist: string, title: string): Promise<SpAlbum | null> {
  const r = await search("album", `album:"${quoted(title)}" artist:"${quoted(artist)}"`);
  const items = objs(asObject(r?.albums)?.items);
  const hit = items.find((a) => same(str(a.name), title) && objs(a.artists).some((x) => same(str(x.name), artist)));
  return hit ? spAlbumOf(hit) : null;
}

export async function spTrackList(albumId: string): Promise<ListedTrack[]> {
  const r = await sp(`/albums/${encodeURIComponent(albumId)}/tracks?limit=50`);
  return objs(r?.items)
    .map((t) => ({ title: tidy(t.name), seconds: Math.round(num(t.duration_ms) / 1000) }))
    .filter((t) => t.title);
}

type SpTrack = { title: string; artist: string; seconds: number; album: SpAlbum | null };
export async function spTrack(artist: string, title: string): Promise<SpTrack | null> {
  const r = await search("track", `track:"${quoted(title)}" artist:"${quoted(artist)}"`);
  const items = objs(asObject(r?.tracks)?.items);
  const hits = items.filter((t) => same(str(t.name), title) && objs(t.artists).some((x) => same(str(x.name), artist)));
  // the album version over singles and compilations where there is one
  const hit = hits.find((t) => str(asObject(t.album)?.album_type) === "album") ?? hits[0];
  if (!hit) return null;
  const al = asObject(hit.album);
  return {
    title: tidy(hit.name),
    artist: firstArtist(hit.artists),
    seconds: Math.round(num(hit.duration_ms) / 1000),
    album: al && str(al.album_type) !== "compilation" ? spAlbumOf(al) : null,
  };
}

// Last.fm's artist pictures are all one placeholder, so none are taken. A key that is refused or fails rests and
// the next in the pool is tried.
const LASTFM_KEYS = [
  "65fb65f79427db8ce5626269c0d7fa2b",
  "b78b45822bf96da886e41623cd85a280",
  "ad74f41f756691160923dbb55219c7cb",
  "63ee7f19c3ed5f781dcf7c810e5e6913",
  "f3dcf9598625bbd0e657377b9f822465",
  "f27fb27503f9aa73c6f308fd9e3bc7f0",
  "f332496fd8c26c0ee467cbc72c76717a",
  "80bc71f587173ac1268627cde1021429",
  "5e0318e76aed3ee67e256ee7b543caae",
  "1c577c2b8de945f82181a654317fc4e2",
  "5c22d0c4d4ed2d089c3523638c657d37",
];
const keyRest = (i: number) => `lastfm-key-rest:${i}`;

// error 10 invalid key, 26 suspended: an hour; 29 rate limited: a minute; 11, 16, server errors, no answer: 15s
function restSeconds(res: Response | null, body: Json | null): number {
  const code = num(body?.error);
  if (code === 10 || code === 26) return 3600;
  if (code === 29 || res?.status === 429) return 60;
  if (!res || code === 11 || code === 16 || res.status >= 500 || (!body && !res.ok)) return 15;
  return 0;
}

/** Answers about the request itself (no such user, private profile) come back as they are; null when no key got through. */
export async function lastfmCall(
  params: Record<string, string>,
  timeoutMs = 15_000
): Promise<{ status: number; body: Json | null } | null> {
  for (const [i, key] of LASTFM_KEYS.entries()) {
    if (await getJson<number>(keyRest(i))) continue;
    const q = new URLSearchParams({ ...params, api_key: key, format: "json" });
    let res: Response | null = null;
    try {
      res = await fetch(`https://ws.audioscrobbler.com/2.0/?${q}`, {
        headers: { "User-Agent": agent() },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {}
    const body = res ? asObject(await res.json().catch(() => null)) : null;
    const rest = restSeconds(res, body);
    if (rest) {
      await setJson(keyRest(i), 1, rest * 1000);
      continue;
    }
    return { status: res!.status, body };
  }
  return null;
}
// the grey star Last.fm shows for "no picture"
const LF_BLANK = "2a96cbd8b46e442fc41c2b86b821562f";

/** Null when Last.fm has nothing by that name. */
async function lastfm(method: string, params: Record<string, string>): Promise<Json | null> {
  await pausedFor("lastfm");
  await turn("lastfm", 250);
  const r = await lastfmCall({ ...params, method, autocorrect: "0" });
  if (!r) {
    await pause("lastfm", 15);
    throw new Busy("lastfm");
  }
  const code = num(r.body?.error);
  // 6: no such artist, album or track
  if (code === 6) return null;
  if (code) throw new Error(`Last.fm ${method} answered error ${code}`);
  if (r.status >= 400 || !r.body) throw new Error(`Last.fm ${method} answered ${r.status}`);
  return r.body;
}

const lfPicture = (v: unknown): Picture | null => {
  const imgs = objs(v);
  for (const size of ["mega", "extralarge", "large", "medium"]) {
    const url = str(imgs.find((i) => str(i.size) === size)?.["#text"]);
    if (!url.startsWith("https://") || url.includes(LF_BLANK)) continue;
    const px = size === "mega" || size === "extralarge" ? 300 : null;
    return { url, width: px, height: px };
  }
  return null;
};
const lfMbid = (v: unknown) => (/^[0-9a-f-]{36}$/.test(str(v)) ? str(v) : null);

type LfArtist = { name: string; mbid: string | null };
export async function lfArtist(name: string): Promise<LfArtist | null> {
  const a = asObject((await lastfm("artist.getinfo", { artist: name }))?.artist);
  return a && same(str(a.name), name) ? { name: tidy(a.name), mbid: lfMbid(a.mbid) } : null;
}

export type LfAlbum = {
  title: string;
  artist: string;
  mbid: string | null;
  picture: Picture | null;
  tracks: ListedTrack[];
};
export async function lfAlbum(artist: string, title: string): Promise<LfAlbum | null> {
  const a = asObject((await lastfm("album.getinfo", { artist, album: title }))?.album);
  if (!a || !same(str(a.name), title) || !same(str(a.artist), artist)) return null;
  // a one-track album comes as an object rather than a list
  const raw = asObject(a.tracks)?.track;
  const single = asObject(raw);
  const rawTracks = Array.isArray(raw) ? objs(raw) : single ? [single] : [];
  const tracks = rawTracks
    .map((t) => ({ title: tidy(t.name), seconds: Math.round(Number(t.duration) || 0) }))
    .filter((t) => t.title);
  return { title: tidy(a.name), artist: tidy(a.artist), mbid: lfMbid(a.mbid), picture: lfPicture(a.image), tracks };
}

export type LfTrack = {
  title: string;
  artist: string;
  seconds: number;
  album: { title: string; mbid: string | null; picture: Picture | null } | null;
};
export async function lfTrack(artist: string, title: string): Promise<LfTrack | null> {
  const t = asObject((await lastfm("track.getinfo", { artist, track: title }))?.track);
  if (!t || !same(str(t.name), title) || !same(str(asObject(t.artist)?.name), artist)) return null;
  const al = asObject(t.album);
  const alTitle = tidy(al?.title);
  return {
    title: tidy(t.name),
    artist: tidy(asObject(t.artist)?.name),
    seconds: Math.round((Number(t.duration) || 0) / 1000),
    album: al && alTitle ? { title: alTitle, mbid: lfMbid(al.mbid), picture: lfPicture(al.image) } : null,
  };
}
