import type { TrackLinks } from "../../shared/catalog";
import { fail } from "../http";
import { getJson, setJson } from "../kv";
import { norm } from "../util";

const HOUR = 3600_000;
const DAY = 24 * HOUR;

type Song = { artist: string; title: string; album?: string | null; duration: number };

const remoteJson = (url: string) =>
  fetch(url, {
    headers: { Accept: "application/json" },
    redirect: "error",
    signal: AbortSignal.timeout(4500),
  }).catch(() => fail(502, "songLinksTemporarilyUnavailable"));

export async function resolveTrackLinks(song: Song): Promise<TrackLinks> {
  const key = `track-links:${JSON.stringify([song.artist, song.title, song.album, song.duration])}`;
  const cached = await getJson<TrackLinks>(key);
  if (cached) return cached;

  const query = new URLSearchParams({
    term: `${song.title} ${song.artist}`.slice(0, 300),
    entity: "song",
    country: "US",
    explicit: "Yes",
    limit: "50",
  });
  const response = await remoteJson(`https://itunes.apple.com/search?${query}`);
  if (!response.ok) fail(502, "songLinksTemporarilyUnavailable");

  const body = (await response.json().catch(() => fail(502, "songLinksTemporarilyUnavailable"))) as {
    results?: {
      kind?: string;
      trackName?: string;
      artistName?: string;
      collectionName?: string;
      trackTimeMillis?: number;
      trackId?: number;
      collectionId?: number;
    }[];
  };
  const songTitle = (title: string) => norm(title).replace(/\s+[([]feat\. .+[)\]]$/, "");
  const title = songTitle(song.title);
  const artist = norm(song.artist);
  const album = song.album ? norm(song.album) : undefined;
  const distance = (time: number | undefined) =>
    song.duration > 0 && time ? Math.abs(time / 1000 - song.duration) : 0;
  const matches = (Array.isArray(body?.results) ? body.results : []).filter(
    (track) =>
      track?.kind === "song" &&
      typeof track.trackName === "string" &&
      songTitle(track.trackName) === title &&
      typeof track.artistName === "string" &&
      norm(track.artistName) === artist &&
      Number.isSafeInteger(track.trackId) &&
      Number.isSafeInteger(track.collectionId) &&
      distance(track.trackTimeMillis) <= 10
  );
  const sameAlbum = (name: string | undefined) => Number(!!album && typeof name === "string" && norm(name) === album);
  const best = matches.sort(
    (a, b) =>
      sameAlbum(b.collectionName) - sameAlbum(a.collectionName) ||
      distance(a.trackTimeMillis) - distance(b.trackTimeMillis)
  )[0];
  if (!best) {
    await setJson(key, {}, DAY);
    return {};
  }

  const links: TrackLinks = {
    appleMusic: `https://music.apple.com/us/album/${best.collectionId}?i=${best.trackId}`,
  };
  const resolved = await fetch(`https://link.binimum.org/api/v1/resolve/apple_music/${best.trackId}`, {
    headers: { Accept: "application/json" },
    redirect: "error",
    signal: AbortSignal.timeout(4500),
  }).catch(() => null);
  if (!resolved || (!resolved.ok && resolved.status !== 404 && resolved.status !== 422)) {
    await setJson(key, links, HOUR);
    return links;
  }
  if (resolved.ok) {
    const mapping = (await resolved.json().catch(() => null)) as {
      spotify?: unknown;
      tidal?: unknown;
      youtube?: unknown;
    } | null;
    if (typeof mapping?.spotify === "string" && /^[a-zA-Z0-9]{22}$/.test(mapping.spotify))
      links.spotify = `https://open.spotify.com/track/${mapping.spotify}`;
    if (typeof mapping?.tidal === "string" && /^\d+$/.test(mapping.tidal))
      links.tidal = `https://tidal.com/track/${mapping.tidal}`;
    if (typeof mapping?.youtube === "string" && /^[a-zA-Z0-9_-]{11}$/.test(mapping.youtube))
      links.youtube = `https://www.youtube.com/watch?v=${mapping.youtube}`;
  }

  await setJson(key, links, 90 * DAY);
  return links;
}
