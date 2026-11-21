// Filling in the catalogue from MusicBrainz, the Cover Art Archive, Last.fm and Spotify (server/metadata/sources.ts).
// Each fills what the ones before it lack: MusicBrainz first, then Last.fm (generous limits), then Spotify (scarce).
//
// Spotify lookups borrow a connected listener's token (server/spotify).
// - An artist, album or track page we have nothing for, opened by a signed-in account with a confirmed email, is
//   looked up and filed, so the page can show. Names nobody has heard of are remembered for a day and not looked up again.
// - An entry those accounts open that was never looked up (or not for a month) is filled in the background: the
//   artist's photo and albums, the album's cover, date and track list, the track's length and album.
// - A background loop slowly finds covers for albums filed this way, and another fills in entries never looked up:
//   first those shown somewhere as a card without a picture (want()), then the rest in order. It runs in "spare time":
//   its Spotify lookups wait for capacity visitors' page lookups don't need (sources.ts).
// - Spotify is asked about an entry once. A real answer, found or not, is remembered (spAt) and never asked again; a
//   lookup that couldn't be made (rate limited) leaves it unasked, and the background loop asks again later.
// Only matches by name are taken, so a lookup never renames or merges anything already filed.
import { correct, mbidOfAlbum, mbidOfArtist } from "../corrections/service";
import { HttpError, type Viewer } from "../http";
import { saveImage, saveRemoteImage } from "../images/repo";
import { convert } from "../images/process";
import { attempt, exclusive, getJson, setAdd, setJson, setTake } from "../kv";
import { isStaff } from "../site/roles";
import { norm, now } from "../util";
import { findAlbum, findArtist, findTrack, type AlbumWithArtist, type Artist, type TrackWithArtist } from "../catalog/repo";
import * as repo from "./repo";
import * as src from "./sources";
import { WANTED } from "./wanted";

const MONTH = 30 * 86400, DAY = 86400_000;

/** Lookups are for signed-in accounts with a confirmed email, and limited per account. */
const allowed = (u: Viewer | null): u is Viewer => !!u && !u.banned && (!!u.emailVerifiedAt || isStaff(u));
const quota = (u: Viewer) => attempt(`meta-user:${u.id}`, 120, 3600_000);

const missKey = (kind: string, key: string) => `meta-miss:${kind}:${key}`;
const aliasKey = (kind: string, key: string) => `meta-alias:${kind}:${key}`;

// one lookup per name at a time in this process; a second visitor waits for the first
const inFlight = new Map<string, Promise<unknown>>();
function once<T>(key: string, job: () => Promise<T>): Promise<T> {
  const running = inFlight.get(key);
  if (running) return running as Promise<T>;
  const p = job().finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

const quiet = (what: string) => (e: unknown) => { if (!(e instanceof src.Busy)) console.error(`metadata (${what}):`, e); };
const later = (what: string, job: () => Promise<unknown>) => { job().catch(quiet(what)); };

// ---------- pictures ----------
/** Stores an album cover from the Cover Art Archive. False when there is none (or storage refused it). */
async function storeCover(albumId: number, rgid: string): Promise<boolean> {
  const bytes = await src.coverArt(rgid);
  if (!bytes) return false;
  try {
    const id = await saveImage(await convert(bytes), null);
    await repo.setAlbum(albumId, { imageId: id });
    return true;
  } catch (e) {
    if (e instanceof HttpError && e.status === 503) throw new src.Busy("storage"); // today's storage allowance is used up
    if (e instanceof HttpError) return false; // not a usable picture
    throw e;
  }
}
const showPicture = (p: src.Picture) => saveRemoteImage(p.url, p.width, p.height);

/**
 * Asks Spotify about an entry unless it already answered for it. Undefined when it couldn't be asked now (every app
 * rate limited, or an error): the entry stays unasked and is asked again later.
 */
async function askSpotify<T>(kind: "artist" | "album" | "track", id: number, spAt: number | null, ask: () => Promise<T | null>): Promise<T | null | undefined> {
  if (spAt) return null;
  try {
    const r = await ask();
    await repo.spotifyAnswered(kind, id);
    return r;
  } catch (e) { quiet(`spotify ${kind} ${id}`)(e); return undefined; }
}
/** Asks Last.fm about an album or track once, like askSpotify(). */
async function askLastfm<T>(kind: "album" | "track", id: number, lfAt: number | null, ask: () => Promise<T | null>): Promise<T | null | undefined> {
  if (lfAt) return null;
  try {
    const r = await ask();
    await repo.lastfmAnswered(kind, id);
    return r;
  } catch (e) { quiet(`lastfm ${kind} ${id}`)(e); return undefined; }
}
/** One Last.fm album lookup per album however many steps need it. */
function albumOnLastfm(id: number, lfAt: number | null, artist: string, title: string) {
  let asked: Promise<src.LfAlbum | null> | null = null;
  return () => (asked ??= askLastfm("album", id, lfAt, () => src.lfAlbum(artist, title)).then(r => r ?? null));
}
const noLastfm = async () => null;
/** One Spotify album lookup per album however many steps need it. */
function albumOnSpotify(id: number, spAt: number | null, artist: string, title: string) {
  let asked: Promise<src.SpAlbum | null> | null = null;
  return () => (asked ??= askSpotify("album", id, spAt, () => src.spAlbum(artist, title)).then(r => r ?? null));
}

/** Finds an album a cover: the Cover Art Archive first, then Last.fm, then Spotify (both shown from there). */
async function findCover(albumId: number, mbid: string | null, spotify: () => Promise<src.SpAlbum | null>, lastfm: () => Promise<src.LfAlbum | null>): Promise<void> {
  if (await getJson<number>(COVERS_PAUSED)) return;
  await repo.setAlbum(albumId, { coverAt: now() });
  try {
    if (mbid && (await storeCover(albumId, mbid))) return;
  } catch (e) {
    // out of storage for today: covers wait an hour, and this album is searched again then
    if (e instanceof src.Busy && e.message === "storage") { await repo.setAlbum(albumId, { coverAt: null }); await setJson(COVERS_PAUSED, 1, 3600_000); return; }
    throw e;
  }
  const lf = await lastfm();
  if (lf?.picture) { await repo.setAlbum(albumId, { imageId: await showPicture(lf.picture) }); return; }
  const s = await spotify();
  if (s?.picture) await repo.setAlbum(albumId, { imageId: await showPicture(s.picture) });
}
const COVERS_PAUSED = "meta-pause:covers";

// ---------- filling in ----------
async function fillArtist(id: number): Promise<void> {
  const a = await repo.artistRow(id);
  if (!a) return;
  const mbid = a.mbid || mbidOfArtist(a.name) || (await src.mbArtist(a.name))?.mbid || (await src.lfArtist(a.name).catch(() => null))?.mbid || null;
  if (mbid && mbid !== a.mbid) await repo.setArtist(id, { mbid });
  if (!a.imageId) await artistPhoto(a, mbid);
  if (mbid) await repo.addDiscography(id, await src.mbDiscography(mbid)); // their covers come from the background loop
}

/** The artist's photo from Spotify (by the Spotify id MusicBrainz links, else by name). */
async function artistPhoto(a: { id: number; name: string; spotifyId: string | null; spAt: number | null }, mbid: string | null) {
  const s = await askSpotify("artist", a.id, a.spAt, async () => src.spArtist(a.name, a.spotifyId || (mbid ? await src.mbSpotifyId(mbid) : null)));
  if (s) await repo.setArtist(a.id, { spotifyId: s.id, ...(s.picture ? { imageId: await showPicture(s.picture) } : {}) });
}

async function fillAlbum(id: number, artist: string, hint?: src.MbAlbum | null): Promise<void> {
  const al = await repo.albumRow(id);
  if (!al) return;
  const found = hint !== undefined ? hint : al.mbid ? null : await src.mbAlbum(artist, al.title);
  const mbid = al.mbid || mbidOfAlbum(artist, al.title) || found?.mbid || null;
  const date = al.releaseDate || found?.date || undefined;
  await repo.setAlbum(id, { ...(mbid && mbid !== al.mbid ? { mbid } : {}), ...(date && date !== al.releaseDate ? { releaseDate: date } : {}) });
  const spotify = albumOnSpotify(id, al.spAt, artist, al.title), lastfm = albumOnLastfm(id, al.lfAt, artist, al.title);
  if ((await repo.trackListSize(id)) < 2) {
    let list = mbid ? await src.mbTrackList(mbid) : [];
    if (!list.length) list = (await lastfm())?.tracks ?? [];
    if (!list.length) { const sp = await spotify(); if (sp) list = await src.spTrackList(sp.id).catch(e => { quiet(`album ${id} tracks`)(e); return []; }); }
    if (list.length) await repo.setTrackList(id, al.artistId, list);
  }
  if (!al.imageId) await findCover(id, mbid, spotify, lastfm);
}

async function fillTrack(id: number, artist: string): Promise<void> {
  const t = await repo.trackRow(id);
  // a track filed with its album (from a scrobble) shows that album's cover: fill the album if nobody has
  if (t?.albumId && (await repo.claim("album", t.albumId, now() - MONTH))) await fillAlbum(t.albumId, artist);
  if (!t || (t.duration && t.albumId)) return;
  const mb = await src.mbTrack(artist, t.title);
  const lf = !mb?.album || !mb.seconds ? ((await askLastfm("track", id, t.lfAt, () => src.lfTrack(artist, t.title))) ?? null) : null;
  const sp = !mb && !lf?.album ? ((await askSpotify("track", id, t.spAt, () => src.spTrack(artist, t.title))) ?? null) : null;
  const seconds = mb?.seconds || lf?.seconds || sp?.seconds || 0;
  if (!t.duration && seconds) await repo.setTrack(id, { duration: seconds });
  if (!t.albumId) {
    const albumId = mb?.album || !lf?.album ? await fileAlbum(t.artistId, artist, mb?.album ?? null, sp?.album ?? null) : await lastfmAlbum(t.artistId, artist, lf.album);
    if (albumId) await repo.setTrack(id, { albumId });
  }
}

/** Files the album Last.fm says a track is on, with its cover when Last.fm has one. Returns its id. */
async function lastfmAlbum(artistId: number, artist: string, al: NonNullable<src.LfTrack["album"]>): Promise<number> {
  const id = await repo.addAlbum(artistId, al.title, null);
  const row = await repo.albumRow(id);
  if (row && !row.imageId && al.picture) await repo.setAlbum(id, { imageId: await showPicture(al.picture), coverAt: now() });
  if (await repo.claim("album", id, now() - MONTH)) await fillAlbum(id, artist);
  return id;
}

/** Files the album a track was found on, with its track list and cover. Returns its id. */
async function fileAlbum(artistId: number, artist: string, mb: src.MbAlbum | null, sp: src.SpAlbum | null): Promise<number | null> {
  if (mb) {
    const id = (await repo.albumByMbid(artistId, mb.mbid))?.id ?? (await repo.addAlbum(artistId, mb.title, mb.date));
    if (await repo.claim("album", id, now() - MONTH)) await fillAlbum(id, artist, mb);
    return id;
  }
  if (sp) {
    const id = await repo.addAlbum(artistId, sp.title, sp.date);
    if (await repo.claim("album", id, now() - MONTH)) {
      const al = await repo.albumRow(id);
      if (al && (await repo.trackListSize(id)) < 2) { const list = await src.spTrackList(sp.id); if (list.length) await repo.setTrackList(id, artistId, list); }
      if (al && !al.imageId) await findCover(id, null, async () => sp, albumOnLastfm(id, al.lfAt, artist, sp.title));
    }
    return id;
  }
  return null;
}

// ---------- for the catalogue routes ----------
/** Refreshes an entry in the background when the viewer may trigger lookups and it is due. */
export function refresh(viewer: Viewer | null, kind: "artist", row: Artist): void;
export function refresh(viewer: Viewer | null, kind: "album", row: AlbumWithArtist): void;
export function refresh(viewer: Viewer | null, kind: "track", row: TrackWithArtist): void;
export function refresh(viewer: Viewer | null, kind: "artist" | "album" | "track", row: Artist | AlbumWithArtist | TrackWithArtist): void {
  if (!allowed(viewer) || (row.metaAt && row.metaAt > now() - MONTH)) return;
  later(`${kind} ${row.id}`, async () => {
    if (!(await quota(viewer)) || !(await repo.claim(kind, row.id, now() - MONTH))) return;
    if (kind === "artist") await fillArtist(row.id);
    else if (kind === "album") await fillAlbum(row.id, (row as AlbumWithArtist).artist);
    else await fillTrack(row.id, (row as TrackWithArtist).artist);
  });
}

/**
 * Runs a catalogue lookup; when it ends in "not found" and the viewer may trigger lookups, tries to file the entry
 * from outside and returns that instead.
 */
async function orImport<T>(viewer: Viewer | null, lookup: () => Promise<T>, kind: string, key: string, fetch: () => Promise<T | null>): Promise<T> {
  try { return await lookup(); } catch (e) {
    if (!(e instanceof HttpError) || e.status !== 404 || !allowed(viewer) || !key.replace(/\n/g, "").trim()) throw e;
    if (await getJson<number>(missKey(kind, key))) throw e;
    if (!(await quota(viewer))) throw e;
    const found = await once(`${kind}:${key}`, async () => {
      try {
        const r = await fetch();
        if (!r) await setJson(missKey(kind, key), 1, DAY);
        return r;
      } catch (err) { quiet(`${kind} lookup`)(err); return null; } // a failed lookup is just "not found"
    });
    if (!found) throw e;
    return found;
  }
}

/** Remembers that a name was filed under another spelling (e.g. "beatles" as "The Beatles"), so it isn't looked up again. */
const alias = (kind: string, key: string, to: string[]) => setJson(aliasKey(kind, key), to, MONTH * 1000);
/** The spelling a looked-up name was filed under, if it was (server/catalog/service.ts tries it before giving up). */
export const aliasOf = (kind: "artist" | "album" | "track", names: (string | null)[]) =>
  getJson<string[]>(aliasKey(kind, names.map(n => norm(n || "")).join("\n")));

export async function artistOrImport(name: string, viewer: Viewer | null, lookup: () => Promise<Artist>): Promise<Artist> {
  const key = norm(name);
  return orImport(viewer, lookup, "artist", key, async () => {
    const mb = await src.mbArtist(name);
    const sp = !mb ? await src.spArtist(name) : null;
    const canonical = mb?.name || sp?.name;
    if (!canonical) return null;
    const id = await repo.addArtist(canonical);
    await repo.setArtist(id, { ...(mb ? { mbid: mb.mbid } : {}), ...(sp ? { spotifyId: sp.id } : {}), metaAt: now() });
    if (sp?.picture) await repo.setArtist(id, { imageId: await showPicture(sp.picture) });
    // the photo and the albums (fetched before the page shows, so it isn't empty); covers follow in the background
    await fillArtist(id).catch(quiet(`artist ${id}`));
    if (norm(canonical) !== key) await alias("artist", key, [canonical]);
    return repo.artistRow(id);
  });
}

export async function albumOrImport(artist: string, title: string, viewer: Viewer | null, lookup: () => Promise<AlbumWithArtist>): Promise<AlbumWithArtist> {
  const key = `${norm(artist)}\n${norm(title)}`;
  return orImport(viewer, lookup, "album", key, async () => {
    const fixed = correct(artist, "").artist || artist;
    const mb = await src.mbAlbum(fixed, title);
    const sp = !mb ? await src.spAlbum(fixed, title) : null;
    const found = mb ?? sp;
    if (!found) return null;
    const artistName = (await findArtist(fixed))?.name || found.artist || fixed;
    const artistId = await repo.addArtist(artistName);
    const id = await fileAlbum(artistId, artistName, mb, sp);
    const row = id ? await repo.albumRow(id) : null;
    if (!row) return null;
    later(`artist ${artistId}`, async () => { if (await repo.claim("artist", artistId, now() - MONTH)) await fillArtist(artistId); });
    if (norm(artistName) !== norm(artist) || norm(row.title) !== norm(title)) await alias("album", key, [artistName, row.title]);
    return findAlbum(artistName, row.title);
  });
}

export async function trackOrImport(artist: string, title: string, viewer: Viewer | null, lookup: () => Promise<TrackWithArtist>): Promise<TrackWithArtist> {
  const key = `${norm(artist)}\n${norm(title)}`;
  return orImport(viewer, lookup, "track", key, async () => {
    const fixed = correct(artist, "").artist || artist;
    const mb = await src.mbTrack(fixed, title);
    const sp = !mb ? await src.spTrack(fixed, title) : null;
    const found = mb ?? sp;
    if (!found) return null;
    const artistName = (await findArtist(fixed))?.name || found.artist || fixed;
    const artistId = await repo.addArtist(artistName);
    const id = await repo.addTrack(artistId, found.title, found.seconds);
    await repo.setTrack(id, { metaAt: now() });
    const albumId = await fileAlbum(artistId, artistName, mb?.album ?? null, sp?.album ?? null).catch(e => { quiet("track album")(e); return null; });
    const t = await repo.trackRow(id);
    if (albumId && t && !t.albumId) await repo.setTrack(id, { albumId });
    later(`artist ${artistId}`, async () => { if (await repo.claim("artist", artistId, now() - MONTH)) await fillArtist(artistId); });
    if (norm(artistName) !== norm(artist) || norm(found.title) !== norm(title)) await alias("track", key, [artistName, found.title]);
    return findTrack(artistName, found.title);
  });
}

// ---------- background loop ----------
let busy = false;
async function tick() {
  if (busy) return;
  busy = true;
  try {
    await exclusive("metadata-covers", 5 * 60_000, async () => {
      const rows = await repo.coverless(5);
      const names = await repo.artistNames([...new Set(rows.map(r => r.artistId))]);
      for (const r of rows) await findCover(r.id, r.mbid, albumOnSpotify(r.id, r.spAt, names.get(r.artistId) ?? "", r.title), albumOnLastfm(r.id, r.lfAt, names.get(r.artistId) ?? "", r.title)).catch(quiet(`cover ${r.id}`));
    });
  } catch (e) { quiet("cover loop")(e); }
  finally { busy = false; }
}

export { want } from "./wanted";

// Entries filed before lookups existed (or by scrobbles, which never trigger one) are filled in slowly, a batch every
// 20 seconds, while our own copy of MusicBrainz answers; through musicbrainz.org's one-a-second limit it would crowd
// out the lookups visitors are waiting for. Then Spotify is asked about whatever is still missing a picture (or an
// album or length, for tracks) and was never asked, while it has capacity to spare.
let filling = false;
async function backfill() {
  if (filling) return;
  filling = true;
  try {
    await exclusive("metadata-backfill", 10 * 60_000, () => src.inSpareTime(async () => {
      const until = Date.now() + 18_000, due = now() - MONTH;
      if (src.mbLocal()) {
        // the wanted first, then everything never looked up
        for (const w of await setTake(WANTED, 40)) {
          if (Date.now() > until) { await setAdd(WANTED, [w], 20_000); continue; }
          const [kind, n] = w.split(":"), id = Number(n);
          await fillWanted(kind as "artist" | "album" | "track", id, due).catch(quiet(`wanted ${w}`));
        }
        for (const r of await repo.unlookedArtists(15)) if (await repo.claim("artist", r.id, due)) await fillArtist(r.id).catch(quiet(`artist ${r.id}`));
        const albums = await repo.unlookedAlbums(15), tracks = await repo.unlookedTracks(25);
        const names = await repo.artistNames([...new Set([...albums, ...tracks].map(r => r.artistId))]);
        for (const r of albums) if (await repo.claim("album", r.id, due)) await fillAlbum(r.id, names.get(r.artistId) ?? "").catch(quiet(`album ${r.id}`));
        for (const r of tracks) if (await repo.claim("track", r.id, due)) await fillTrack(r.id, names.get(r.artistId) ?? "").catch(quiet(`track ${r.id}`));
      }
      await spotifyBackfill(until);
    }));
  } catch (e) { quiet("backfill")(e); }
  finally { filling = false; }
}

/** A wanted entry: looked up in full if it never was, else just asked of Spotify if it wasn't yet. */
async function fillWanted(kind: "artist" | "album" | "track", id: number, due: number) {
  if (kind === "artist") {
    if (await repo.claim("artist", id, due)) return fillArtist(id);
    const a = await repo.artistRow(id);
    if (a && !a.imageId && !a.spAt) await artistPhoto(a, a.mbid);
    return;
  }
  if (kind === "album") {
    const al = await repo.albumRow(id);
    if (!al || al.imageId) return;
    const artist = (await repo.artistNames([al.artistId])).get(al.artistId) ?? "";
    if (await repo.claim("album", id, due)) return fillAlbum(id, artist);
    if (!al.spAt || !al.lfAt) await findCover(id, null, albumOnSpotify(id, al.spAt, artist, al.title), albumOnLastfm(id, al.lfAt, artist, al.title));
    return;
  }
  const t = await repo.trackRow(id);
  if (!t) return;
  const artist = (await repo.artistNames([t.artistId])).get(t.artistId) ?? "";
  if (await repo.claim("track", id, due)) return fillTrack(id, artist);
  if (t.albumId) await fillWanted("album", t.albumId, due);
  else if (!t.lfAt) await lastfmTrack(t, artist);
  else if (!t.spAt) await spotifyTrack(t, artist);
}

/** A track MusicBrainz didn't place: its length and album from Last.fm. */
async function lastfmTrack(t: { id: number; artistId: number; title: string; duration: number; albumId: number | null; lfAt: number | null }, artist: string) {
  const lf = await askLastfm("track", t.id, t.lfAt, () => src.lfTrack(artist, t.title));
  if (!lf) return;
  if (!t.duration && lf.seconds) await repo.setTrack(t.id, { duration: lf.seconds });
  if (!t.albumId && lf.album) await repo.setTrack(t.id, { albumId: await lastfmAlbum(t.artistId, artist, lf.album) });
}

/** A track MusicBrainz didn't place: its length and album from Spotify. */
async function spotifyTrack(t: { id: number; artistId: number; title: string; duration: number; albumId: number | null; spAt: number | null }, artist: string) {
  const sp = await askSpotify("track", t.id, t.spAt, () => src.spTrack(artist, t.title));
  if (!sp) return;
  if (!t.duration && sp.seconds) await repo.setTrack(t.id, { duration: sp.seconds });
  if (!t.albumId) { const albumId = await fileAlbum(t.artistId, artist, null, sp.album); if (albumId) await repo.setTrack(t.id, { albumId }); }
}

/** Asks Spotify about entries looked up elsewhere that still lack something, until it has no capacity to spare. */
async function spotifyBackfill(until: number) {
  const going = async () => Date.now() < until && !(await src.spotifyResting());
  for (const r of await repo.spotifyDueArtists(10)) {
    if (!(await going())) return;
    const a = await repo.artistRow(r.id);
    if (a && !a.imageId && !a.spAt) await artistPhoto(a, a.mbid).catch(quiet(`artist ${r.id}`));
  }
  const albums = await repo.spotifyDueAlbums(10), tracks = await repo.spotifyDueTracks(10);
  const names = await repo.artistNames([...new Set([...albums, ...tracks].map(r => r.artistId))]);
  for (const r of albums) {
    if (!(await going())) return;
    await findCover(r.id, null, albumOnSpotify(r.id, null, names.get(r.artistId) ?? "", r.title), noLastfm).catch(quiet(`album ${r.id}`));
  }
  for (const r of tracks) {
    if (!(await going())) return;
    const t = await repo.trackRow(r.id);
    if (t) await spotifyTrack(t, names.get(r.artistId) ?? "").catch(quiet(`track ${r.id}`));
  }
}

/**
 * Asks Last.fm about albums and tracks looked up elsewhere that still lack a cover, length or album, a batch every 20
 * seconds (about 40 calls, well within its limit).
 */
let lfFilling = false;
async function lastfmBackfill() {
  if (lfFilling) return;
  lfFilling = true;
  try {
    await exclusive("metadata-lastfm", 5 * 60_000, async () => {
      if (await getJson<number>("meta-pause:lastfm")) return;
      const albums = await repo.lastfmDueAlbums(15), tracks = await repo.lastfmDueTracks(25);
      const names = await repo.artistNames([...new Set([...albums, ...tracks].map(r => r.artistId))]);
      for (const r of albums) await findCover(r.id, null, noSpotify, albumOnLastfm(r.id, null, names.get(r.artistId) ?? "", r.title)).catch(quiet(`lastfm album ${r.id}`));
      for (const r of tracks) {
        const t = await repo.trackRow(r.id);
        if (t) await lastfmTrack(t, names.get(r.artistId) ?? "").catch(quiet(`lastfm track ${r.id}`));
      }
    });
  } catch (e) { quiet("lastfm backfill")(e); }
  finally { lfFilling = false; }
}
const noSpotify = async () => null;

/** Started once at boot (server/index.ts). */
export function startMetadata() {
  const g = globalThis as { __spinMetadata?: ReturnType<typeof setInterval> }; // survives hot reloads in development
  clearInterval(g.__spinMetadata);
  g.__spinMetadata = setInterval(() => { src.inSpareTime(tick); backfill(); lastfmBackfill(); }, 20_000);
}
