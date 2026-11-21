import { correct, mbidOfAlbum, mbidOfArtist } from "../corrections/service";
import { HttpError, type Viewer } from "../http";
import { saveImage, saveRemoteImage } from "../images/repo";
import { convert } from "../images/process";
import { attempt, exclusive, getJson, setAdd, setJson, setTake } from "../kv";
import { isStaff } from "../site/roles";
import { norm, now } from "../util";
import * as Sentry from "@sentry/bun";
import { findAlbum, findArtist, findTrack, type AlbumWithArtist, type Artist, type TrackWithArtist } from "../catalog/repo";
import * as repo from "./repo";
import * as src from "./sources";
import * as mbdb from "./mbdb";
import { WANTED } from "./wanted";

const MONTH = 30 * 86400;
const DAY = 86400_000;

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

const quiet = (what: string) => (e: unknown) => {
  if (e instanceof src.Busy) return;
  if (e instanceof HttpError && e.status < 500) return;
  console.error(`metadata (${what}):`, e);
  Sentry.captureException(e);
};
const later = (what: string, job: () => Promise<unknown>) => {
  job().catch(quiet(what));
};

/** False when the archive has no cover (or storage refused it). */
async function storeCover(albumId: number, mbid: string, of: "release-group" | "release" = "release-group"): Promise<boolean> {
  const bytes = await src.coverArt(mbid, of);
  if (!bytes) return false;
  try {
    const id = await saveImage(await convert(bytes), null);
    await repo.setAlbum(albumId, { imageId: id });
    return true;
  } catch (e) {
    // 503: today's storage allowance is used up; any other refusal: not a usable picture
    if (e instanceof HttpError && e.status === 503) throw new src.Busy("storage");
    if (e instanceof HttpError) return false;
    throw e;
  }
}
const showPicture = (p: src.Picture) => saveRemoteImage(p.url, p.width, p.height);

/** Undefined when Spotify couldn't be asked now: the entry stays unasked and is asked again later. */
async function askSpotify<T>(kind: "artist" | "album" | "track", id: number, spAt: number | null, ask: () => Promise<T | null>): Promise<T | null | undefined> {
  if (spAt) return null;
  try {
    const r = await ask();
    await repo.spotifyAnswered(kind, id);
    return r;
  } catch (e) {
    quiet(`spotify ${kind} ${id}`)(e);
    return undefined;
  }
}
async function askLastfm<T>(kind: "album" | "track", id: number, lfAt: number | null, ask: () => Promise<T | null>): Promise<T | null | undefined> {
  if (lfAt) return null;
  try {
    const r = await ask();
    await repo.lastfmAnswered(kind, id);
    return r;
  } catch (e) {
    quiet(`lastfm ${kind} ${id}`)(e);
    return undefined;
  }
}
/** One Last.fm album lookup per album however many steps need it. */
function albumOnLastfm(id: number, lfAt: number | null, artist: string, title: string) {
  let asked: Promise<src.LfAlbum | null> | null = null;
  return () => (asked ??= askLastfm("album", id, lfAt, () => src.lfAlbum(artist, title)).then(r => r ?? null));
}
const noLastfm = async () => null;
function albumOnSpotify(id: number, spAt: number | null, artist: string, title: string) {
  let asked: Promise<src.SpAlbum | null> | null = null;
  return () => (asked ??= askSpotify("album", id, spAt, () => src.spAlbum(artist, title)).then(r => r ?? null));
}

/** The Cover Art Archive first (by MusicBrainz id, else via Last.fm's release), then Last.fm's picture, then Spotify's. */
async function findCover(albumId: number, mbid: string | null, spotify: () => Promise<src.SpAlbum | null>, lastfm: () => Promise<src.LfAlbum | null>): Promise<void> {
  if (await getJson<number>(COVERS_PAUSED)) return;
  await repo.setAlbum(albumId, { coverAt: now() });
  try {
    if (mbid && (await storeCover(albumId, mbid))) return;
    if (!mbid && (await viaLastfmRelease(albumId, await lastfm()))) return;
  } catch (e) {
    if (!(e instanceof src.Busy) || e.message !== "storage") throw e;
    // out of storage for today: covers wait an hour, and this album is searched again then
    await repo.setAlbum(albumId, { coverAt: null });
    await setJson(COVERS_PAUSED, 1, 3600_000);
    return;
  }
  const lf = await lastfm();
  if (lf?.picture) {
    await repo.setAlbum(albumId, { imageId: await showPicture(lf.picture) });
    return;
  }
  const s = await spotify();
  if (s?.picture) await repo.setAlbum(albumId, { imageId: await showPicture(s.picture) });
}
const COVERS_PAUSED = "meta-pause:covers";

/** Notes the MusicBrainz album of the release Last.fm links, so its date and track list can come from there next time. */
async function viaLastfmRelease(albumId: number, lf: src.LfAlbum | null): Promise<boolean> {
  if (!lf?.mbid) return false;
  const rg = src.mbLocal() ? await mbdb.releaseGroupOf(lf.mbid).catch(() => null) : null;
  if (rg) {
    await repo.setAlbum(albumId, { mbid: rg });
    if (await storeCover(albumId, rg)) return true;
  }
  return storeCover(albumId, lf.mbid, "release");
}

async function artistMbid(a: { mbid: string | null; name: string }): Promise<string | null> {
  if (a.mbid) return a.mbid;
  const corrected = mbidOfArtist(a.name);
  if (corrected) return corrected;
  const mb = await src.mbArtist(a.name);
  if (mb?.mbid) return mb.mbid;
  const lf = await src.lfArtist(a.name).catch(() => null);
  return lf?.mbid || null;
}

async function fillArtist(id: number): Promise<void> {
  const a = await repo.artistRow(id);
  if (!a) return;
  const mbid = await artistMbid(a);
  if (mbid && mbid !== a.mbid) await repo.setArtist(id, { mbid });
  if (!a.imageId) await artistPhoto(a, mbid);
  // their covers come from the background loop
  if (mbid) await repo.addDiscography(id, await src.mbDiscography(mbid));
}

/** True when the copy of Spotify's catalogue has a picture; it knows no artist newer than early 2025. */
async function fromCatalogueCopy(a: { id: number; name: string; spotifyId: string | null }, mbid: string | null) {
  const spotifyId = a.spotifyId || (mbid && src.mbLocal() ? await src.mbSpotifyId(mbid) : null);
  const p = await repo.catalogueCopyPicture(spotifyId, a.name);
  if (p) await repo.setArtist(a.id, { imageId: await showPicture(p) });
  return !!p;
}

/** From the catalogue copy, else Wikidata by MusicBrainz id, else Spotify (by the Spotify id MusicBrainz links, else by name). */
async function artistPhoto(a: { id: number; name: string; spotifyId: string | null; spAt: number | null }, mbid: string | null) {
  if (await fromCatalogueCopy(a, mbid)) return;
  if (mbid) {
    const found = await src.wikiPhotos([mbid]).then(
      m => m.get(mbid) ?? null,
      e => {
        quiet(`wikidata artist ${a.id}`)(e);
        return undefined;
      },
    );
    if (found !== undefined) {
      const image = found ? { imageId: await showPicture(found) } : {};
      await repo.setArtist(a.id, { wdAt: now(), ...image });
    }
    if (found) return;
  }
  const s = await askSpotify("artist", a.id, a.spAt, async () => {
    const spotifyId = a.spotifyId || (mbid ? await src.mbSpotifyId(mbid) : null);
    return src.spArtist(a.name, spotifyId);
  });
  if (!s) return;
  const image = s.picture ? { imageId: await showPicture(s.picture) } : {};
  await repo.setArtist(a.id, { spotifyId: s.id, ...image });
}

async function fillAlbum(id: number, artist: string, hint?: src.MbAlbum | null): Promise<void> {
  const al = await repo.albumRow(id);
  if (!al) return;
  const found = hint !== undefined ? hint : al.mbid ? null : await src.mbAlbum(artist, al.title);
  const mbid = al.mbid || mbidOfAlbum(artist, al.title) || found?.mbid || null;
  const date = al.releaseDate || found?.date || undefined;
  await repo.setAlbum(id, {
    ...(mbid && mbid !== al.mbid ? { mbid } : {}),
    ...(date && date !== al.releaseDate ? { releaseDate: date } : {}),
  });
  const spotify = albumOnSpotify(id, al.spAt, artist, al.title);
  const lastfm = albumOnLastfm(id, al.lfAt, artist, al.title);
  if ((await repo.trackListSize(id)) < 2) {
    let list = mbid ? await src.mbTrackList(mbid) : [];
    if (!list.length) list = (await lastfm())?.tracks ?? [];
    if (!list.length) {
      const sp = await spotify();
      if (sp) {
        list = await src.spTrackList(sp.id).catch(e => {
          quiet(`album ${id} tracks`)(e);
          return [];
        });
      }
    }
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
  let lf: src.LfTrack | null = null;
  if (!mb?.album || !mb.seconds) lf = (await askLastfm("track", id, t.lfAt, () => src.lfTrack(artist, t.title))) ?? null;
  let sp: Awaited<ReturnType<typeof src.spTrack>> = null;
  if (!mb && !lf?.album) sp = (await askSpotify("track", id, t.spAt, () => src.spTrack(artist, t.title))) ?? null;
  const seconds = mb?.seconds || lf?.seconds || sp?.seconds || 0;
  if (!t.duration && seconds) await repo.setTrack(id, { duration: seconds });
  if (t.albumId) return;
  const albumId = mb?.album || !lf?.album
    ? await fileAlbum(t.artistId, artist, mb?.album ?? null, sp?.album ?? null)
    : await lastfmAlbum(t.artistId, artist, lf.album);
  if (albumId) await repo.setTrack(id, { albumId });
}

/** Files the album Last.fm says a track is on, with its cover when Last.fm has one. */
async function lastfmAlbum(artistId: number, artist: string, al: NonNullable<src.LfTrack["album"]>): Promise<number> {
  const id = await repo.addAlbum(artistId, al.title, null);
  const row = await repo.albumRow(id);
  if (row && !row.imageId && al.picture) await repo.setAlbum(id, { imageId: await showPicture(al.picture), coverAt: now() });
  if (await repo.claim("album", id, now() - MONTH)) await fillAlbum(id, artist);
  return id;
}

/** Files the album a track was found on, with its track list and cover. */
async function fileAlbum(artistId: number, artist: string, mb: src.MbAlbum | null, sp: src.SpAlbum | null): Promise<number | null> {
  if (mb) {
    const id = (await repo.albumByMbid(artistId, mb.mbid))?.id ?? (await repo.addAlbum(artistId, mb.title, mb.date));
    if (await repo.claim("album", id, now() - MONTH)) await fillAlbum(id, artist, mb);
    return id;
  }
  if (!sp) return null;
  const id = await repo.addAlbum(artistId, sp.title, sp.date);
  if (!(await repo.claim("album", id, now() - MONTH))) return id;
  const al = await repo.albumRow(id);
  if (al && (await repo.trackListSize(id)) < 2) {
    const list = await src.spTrackList(sp.id);
    if (list.length) await repo.setTrackList(id, artistId, list);
  }
  if (al && !al.imageId) await findCover(id, null, async () => sp, albumOnLastfm(id, al.lfAt, artist, sp.title));
  return id;
}

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

/** When the lookup ends in "not found" and the viewer may trigger lookups, tries to file the entry from outside. */
async function orImport<T>(viewer: Viewer | null, lookup: () => Promise<T>, kind: string, key: string, fetch: () => Promise<T | null>): Promise<T> {
  try {
    return await lookup();
  } catch (e) {
    if (!(e instanceof HttpError) || e.status !== 404 || !allowed(viewer) || !key.replace(/\n/g, "").trim()) throw e;
    if (await getJson<number>(missKey(kind, key))) throw e;
    if (!(await quota(viewer))) throw e;
    const found = await once(`${kind}:${key}`, async () => {
      try {
        const r = await fetch();
        if (!r) await setJson(missKey(kind, key), 1, DAY);
        return r;
      } catch (err) {
        // a failed lookup is just "not found"
        quiet(`${kind} lookup`)(err);
        return null;
      }
    });
    if (!found) throw e;
    return found;
  }
}

/** Remembers a name filed under another spelling (e.g. "beatles" as "The Beatles"), so it isn't looked up again. */
const alias = (kind: string, key: string, to: string[]) => setJson(aliasKey(kind, key), to, MONTH * 1000);
/** server/catalog/service.ts tries this spelling before giving up. */
export const aliasOf = (kind: "artist" | "album" | "track", names: (string | null)[]) =>
  getJson<string[]>(aliasKey(kind, names.map(n => norm(n || "")).join("\n")));

const fillArtistLater = (artistId: number) =>
  later(`artist ${artistId}`, async () => {
    if (await repo.claim("artist", artistId, now() - MONTH)) await fillArtist(artistId);
  });

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
    // the photo and albums before the page shows, so it isn't empty; covers follow in the background
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
    fillArtistLater(artistId);
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
    const albumId = await fileAlbum(artistId, artistName, mb?.album ?? null, sp?.album ?? null).catch(e => {
      quiet("track album")(e);
      return null;
    });
    const t = await repo.trackRow(id);
    if (albumId && t && !t.albumId) await repo.setTrack(id, { albumId });
    fillArtistLater(artistId);
    if (norm(artistName) !== norm(artist) || norm(found.title) !== norm(title)) await alias("track", key, [artistName, found.title]);
    return findTrack(artistName, found.title);
  });
}

const namesFor = (rows: { artistId: number }[]) => repo.artistNames([...new Set(rows.map(r => r.artistId))]);

let busy = false;
async function tick() {
  if (busy) return;
  busy = true;
  try {
    await exclusive("metadata-covers", 5 * 60_000, async () => {
      const rows = await repo.coverless(5);
      const names = await namesFor(rows);
      for (const r of rows) {
        const artist = names.get(r.artistId) ?? "";
        const spotify = albumOnSpotify(r.id, r.spAt, artist, r.title);
        const lastfm = albumOnLastfm(r.id, r.lfAt, artist, r.title);
        await findCover(r.id, r.mbid, spotify, lastfm).catch(quiet(`cover ${r.id}`));
      }
    });
  } catch (e) {
    quiet("cover loop")(e);
  } finally {
    busy = false;
  }
}

// Entries never looked up are filled only while our own copy of MusicBrainz answers: through musicbrainz.org's
// one-a-second limit they would crowd out the lookups visitors are waiting for.
let filling = false;
async function backfill() {
  if (filling) return;
  filling = true;
  try {
    await exclusive("metadata-backfill", 10 * 60_000, () => src.inSpareTime(async () => {
      const until = Date.now() + 18_000;
      const due = now() - MONTH;
      if (src.mbLocal()) {
        await fillAllWanted(due);
        await fillUnlooked(until, due);
      }
      await spotifyBackfill(until);
    }));
  } catch (e) {
    quiet("backfill")(e);
  } finally {
    filling = false;
  }
}

// at most half the time, so the backlog of entries never looked up always moves too
async function fillAllWanted(due: number) {
  const half = Date.now() + 9_000;
  for (const w of await setTake(WANTED, 40)) {
    if (Date.now() > half) {
      await setAdd(WANTED, [w], 20_000);
      continue;
    }
    const [kind, n] = w.split(":");
    await fillWanted(kind as "artist" | "album" | "track", Number(n), due).catch(quiet(`wanted ${w}`));
  }
}

// four at a time: most of each is waiting on a download
async function fillUnlooked(until: number, due: number) {
  while (Date.now() < until) {
    const artists = await repo.unlookedArtists(8);
    const albums = await repo.unlookedAlbums(12);
    const tracks = await repo.unlookedTracks(12);
    if (!artists.length && !albums.length && !tracks.length) break;
    const names = await namesFor([...albums, ...tracks]);
    await inParallel(4, [
      ...artists.map(r => async () => {
        if (await repo.claim("artist", r.id, due)) await fillArtist(r.id).catch(quiet(`artist ${r.id}`));
      }),
      ...albums.map(r => async () => {
        if (await repo.claim("album", r.id, due)) await fillAlbum(r.id, names.get(r.artistId) ?? "").catch(quiet(`album ${r.id}`));
      }),
      ...tracks.map(r => async () => {
        if (await repo.claim("track", r.id, due)) await fillTrack(r.id, names.get(r.artistId) ?? "").catch(quiet(`track ${r.id}`));
      }),
    ]);
  }
}

async function inParallel(n: number, jobs: (() => Promise<void>)[]) {
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) await jobs[next++]!();
  };
  await Promise.all(Array.from({ length: Math.min(n, jobs.length) }, worker));
}

/** Looked up in full if it never was, else just asked of the outside sources not yet asked. */
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
    if (al.spAt && al.lfAt) return;
    await findCover(id, null, albumOnSpotify(id, al.spAt, artist, al.title), albumOnLastfm(id, al.lfAt, artist, al.title));
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

type UnplacedTrack = { id: number; artistId: number; title: string; duration: number; albumId: number | null };

async function lastfmTrack(t: UnplacedTrack & { lfAt: number | null }, artist: string) {
  const lf = await askLastfm("track", t.id, t.lfAt, () => src.lfTrack(artist, t.title));
  if (!lf) return;
  if (!t.duration && lf.seconds) await repo.setTrack(t.id, { duration: lf.seconds });
  if (!t.albumId && lf.album) await repo.setTrack(t.id, { albumId: await lastfmAlbum(t.artistId, artist, lf.album) });
}

async function spotifyTrack(t: UnplacedTrack & { spAt: number | null }, artist: string) {
  const sp = await askSpotify("track", t.id, t.spAt, () => src.spTrack(artist, t.title));
  if (!sp) return;
  if (!t.duration && sp.seconds) await repo.setTrack(t.id, { duration: sp.seconds });
  if (t.albumId) return;
  const albumId = await fileAlbum(t.artistId, artist, null, sp.album);
  if (albumId) await repo.setTrack(t.id, { albumId });
}

/** Stops as soon as Spotify has no capacity to spare. */
async function spotifyBackfill(until: number) {
  const going = async () => Date.now() < until && !(await src.spotifyResting());
  for (const r of await repo.spotifyDueArtists(10)) {
    if (!(await going())) return;
    const a = await repo.artistRow(r.id);
    if (a && !a.imageId && !a.spAt) await artistPhoto(a, a.mbid).catch(quiet(`artist ${r.id}`));
  }
  const albums = await repo.spotifyDueAlbums(10);
  const tracks = await repo.spotifyDueTracks(10);
  const names = await namesFor([...albums, ...tracks]);
  for (const r of albums) {
    if (!(await going())) return;
    const spotify = albumOnSpotify(r.id, null, names.get(r.artistId) ?? "", r.title);
    await findCover(r.id, null, spotify, noLastfm).catch(quiet(`album ${r.id}`));
  }
  for (const r of tracks) {
    if (!(await going())) return;
    const t = await repo.trackRow(r.id);
    if (t) await spotifyTrack(t, names.get(r.artistId) ?? "").catch(quiet(`track ${r.id}`));
  }
}

// about 40 calls every 20 seconds, well within Last.fm's limit
let lfFilling = false;
async function lastfmBackfill() {
  if (lfFilling) return;
  lfFilling = true;
  try {
    await exclusive("metadata-lastfm", 5 * 60_000, async () => {
      if (await getJson<number>("meta-pause:lastfm")) return;
      const albums = await repo.lastfmDueAlbums(15);
      const tracks = await repo.lastfmDueTracks(25);
      const names = await namesFor([...albums, ...tracks]);
      for (const r of albums) {
        const lastfm = albumOnLastfm(r.id, null, names.get(r.artistId) ?? "", r.title);
        await findCover(r.id, null, noSpotify, lastfm).catch(quiet(`lastfm album ${r.id}`));
      }
      for (const r of tracks) {
        const t = await repo.trackRow(r.id);
        if (t) await lastfmTrack(t, names.get(r.artistId) ?? "").catch(quiet(`lastfm track ${r.id}`));
      }
    });
  } catch (e) {
    quiet("lastfm backfill")(e);
  } finally {
    lfFilling = false;
  }
}
const noSpotify = async () => null;

// fifty to a query every 20 seconds clears the backlog in an hour or two, so Spotify is only asked about the artists
// Wikidata has nothing for
let wdFilling = false;
async function wikidataBackfill() {
  if (wdFilling) return;
  wdFilling = true;
  try {
    await exclusive("metadata-wikidata", 5 * 60_000, async () => {
      const rows = await repo.wikidataDueArtists(50, now() - MONTH);
      if (!rows.length) return;
      const photos = await src.wikiPhotos(rows.map(r => r.mbid!));
      for (const r of rows) {
        const p = photos.get(r.mbid!);
        if (p) await repo.setArtist(r.id, { imageId: await showPicture(p) });
      }
      await repo.wikidataAnswered(rows.map(r => r.id));
    });
  } catch (e) {
    quiet("wikidata backfill")(e);
  } finally {
    wdFilling = false;
  }
}

// artists filed before the catalogue copy was loaded; one pass, which only reads our own database
const COPY_AFTER = "catalogue-copy-after";
async function catalogueCopyBackfill() {
  try {
    await exclusive(COPY_AFTER, 60_000, async () => {
      const after = (await getJson<number>(COPY_AFTER)) ?? 0;
      const rows = await repo.picturelessArtists(after, 100);
      for (const a of rows) await fromCatalogueCopy(a, null);
      if (rows.length) await setJson(COPY_AFTER, rows[rows.length - 1].id, 365 * DAY);
    });
  } catch (e) {
    quiet("catalogue copy")(e);
  }
}

export function startMetadata() {
  // on globalThis so hot reload replaces the interval instead of stacking
  const g = globalThis as { __spinMetadata?: ReturnType<typeof setInterval> };
  clearInterval(g.__spinMetadata);
  g.__spinMetadata = setInterval(() => {
    src.inSpareTime(tick);
    backfill();
    lastfmBackfill();
    wikidataBackfill();
    catalogueCopyBackfill();
  }, 20_000);
}
