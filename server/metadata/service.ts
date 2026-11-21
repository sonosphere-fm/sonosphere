// Filling in the catalogue from MusicBrainz, the Cover Art Archive and Spotify (server/metadata/sources.ts).
//
// Spotify lookups borrow a connected listener's token (server/spotify).
// - An artist, album or track page we have nothing for, opened by a signed-in account with a confirmed email, is
//   looked up and filed, so the page can show. Names nobody has heard of are remembered for a day and not looked up again.
// - An entry those accounts open that was never looked up (or not for a month) is filled in the background: the
//   artist's photo and albums, the album's cover, date and track list, the track's length and album.
// - A background loop slowly finds covers for albums filed this way.
// Only matches by name are taken, so a lookup never renames or merges anything already filed.
import { correct, mbidOfAlbum, mbidOfArtist } from "../corrections/service";
import { HttpError, type Viewer } from "../http";
import { saveImage, saveRemoteImage } from "../images/repo";
import { convert } from "../images/process";
import { attempt, exclusive, getJson, setJson } from "../kv";
import { isStaff } from "../site/roles";
import { norm, now } from "../util";
import { findAlbum, findArtist, findTrack, type AlbumWithArtist, type Artist, type TrackWithArtist } from "../catalog/repo";
import * as repo from "./repo";
import * as src from "./sources";

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
    if (e instanceof HttpError) return false; // not a usable picture, or today's storage allowance is used up
    throw e;
  }
}
const showPicture = (p: src.Picture) => saveRemoteImage(p.url, p.width, p.height);

/** Finds an album a cover: the Cover Art Archive first, then Spotify (shown from there). */
async function findCover(albumId: number, artist: string, title: string, mbid: string | null, sp?: src.SpAlbum | null): Promise<void> {
  await repo.setAlbum(albumId, { coverAt: now() });
  if (mbid && (await storeCover(albumId, mbid))) return;
  const s = sp !== undefined ? sp : await src.spAlbum(artist, title);
  if (s?.picture) await repo.setAlbum(albumId, { imageId: await showPicture(s.picture) });
}

// ---------- filling in ----------
async function fillArtist(id: number): Promise<void> {
  const a = await repo.artistRow(id);
  if (!a) return;
  const mbid = a.mbid || mbidOfArtist(a.name) || (await src.mbArtist(a.name))?.mbid || null;
  if (mbid && mbid !== a.mbid) await repo.setArtist(id, { mbid });
  if (!a.imageId) {
    const spId = a.spotifyId || (mbid ? await src.mbSpotifyId(mbid) : null);
    const s = await src.spArtist(a.name, spId);
    if (s) await repo.setArtist(id, { spotifyId: s.id, ...(s.picture ? { imageId: await showPicture(s.picture) } : {}) });
  }
  if (mbid) await repo.addDiscography(id, await src.mbDiscography(mbid)); // their covers come from the background loop
}

async function fillAlbum(id: number, artist: string, hint?: src.MbAlbum | null): Promise<void> {
  const al = await repo.albumRow(id);
  if (!al) return;
  const found = hint !== undefined ? hint : al.mbid ? null : await src.mbAlbum(artist, al.title);
  const mbid = al.mbid || mbidOfAlbum(artist, al.title) || found?.mbid || null;
  const date = al.releaseDate || found?.date || undefined;
  await repo.setAlbum(id, { ...(mbid && mbid !== al.mbid ? { mbid } : {}), ...(date && date !== al.releaseDate ? { releaseDate: date } : {}) });
  let sp: src.SpAlbum | null | undefined;
  if ((await repo.trackListSize(id)) < 2) {
    let list = mbid ? await src.mbTrackList(mbid) : [];
    if (!list.length) { sp = await src.spAlbum(artist, al.title); if (sp) list = await src.spTrackList(sp.id); }
    if (list.length) await repo.setTrackList(id, al.artistId, list);
  }
  if (!al.imageId) await findCover(id, artist, al.title, mbid, sp);
}

async function fillTrack(id: number, artist: string): Promise<void> {
  const t = await repo.trackRow(id);
  if (!t || (t.duration && t.albumId)) return;
  const mb = await src.mbTrack(artist, t.title);
  const sp = !mb ? await src.spTrack(artist, t.title) : null;
  const seconds = mb?.seconds || sp?.seconds || 0;
  if (!t.duration && seconds) await repo.setTrack(id, { duration: seconds });
  if (!t.albumId) {
    const albumId = await fileAlbum(t.artistId, artist, mb?.album ?? null, sp?.album ?? null);
    if (albumId) await repo.setTrack(id, { albumId });
  }
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
      if (al && !al.imageId) await findCover(id, artist, sp.title, null, sp);
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
      for (const r of rows) await findCover(r.id, names.get(r.artistId) ?? "", r.title, r.mbid).catch(quiet(`cover ${r.id}`));
    });
  } catch (e) { quiet("cover loop")(e); }
  finally { busy = false; }
}

/** Started once at boot (server/index.ts). */
export function startMetadata() {
  const g = globalThis as { __spinMetadata?: ReturnType<typeof setInterval> }; // survives hot reloads in development
  clearInterval(g.__spinMetadata);
  g.__spinMetadata = setInterval(tick, 20_000);
}
