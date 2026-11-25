import { pickMatches, type MusicMatch } from "./music-match";

export const SUBSONIC_VERSION = "1.16.1";
export const SUBSONIC_CLIENT = "Sonosphere";

export type SubsonicStatus =
  | { connected: false }
  | {
      connected: true;
      url: string;
      username: string;
      name: string;
      version: string;
      openSubsonic: boolean;
    };

export type SubsonicConnectBody = { url: string; username: string; password: string };

/** What the browser needs to call the listener's server itself, until the page closes. */
export type SubsonicAuth = {
  kind: "subsonic";
  base: string;
  username: string;
  name: string;
  token: string;
  salt: string;
  direct: boolean;
};

/** The proxy route for a resolved song, used when the browser cannot reach the server. */
export type SubsonicSource = { proxy: string; albumUrl: string };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** The best few songs for an artist and title, so playback can fall through ones the server won't stream. */
export function pickSongs(songs: unknown, artist: string, track: string): MusicMatch[] {
  const list = Array.isArray(songs) ? songs : songs ? [songs] : [];
  const candidates = list.flatMap((song) => {
    if (!isObject(song) || song.isVideo === true) return [];
    if (typeof song.type === "string" && song.type !== "music" && song.type !== "song") return [];
    const id = typeof song.id === "string" ? song.id : typeof song.id === "number" ? String(song.id) : "";
    if (!id) return [];
    const albumId =
      typeof song.albumId === "string" ? song.albumId : typeof song.albumId === "number" ? String(song.albumId) : null;
    return [{ id, albumId, title: String(song.title ?? ""), artist: String(song.artist ?? "") }];
  });
  return pickMatches(candidates, artist, track);
}

/** Where the album lives in the server's own web interface. Only Navidrome's route is standard enough to link to. */
export function albumWebUrl(base: string, serverName: string, albumId: string | null): string {
  if (albumId && serverName.toLowerCase() === "navidrome")
    return `${base}/app/#/album/${encodeURIComponent(albumId)}/show`;
  return base;
}
