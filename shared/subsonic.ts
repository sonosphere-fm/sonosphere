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
  base: string;
  username: string;
  name: string;
  token: string;
  salt: string;
  direct: boolean;
};

/** The proxy route for a resolved song, used when the browser cannot reach the server. */
export type SubsonicSource = { proxy: string; albumUrl: string };

export type SongMatch = { id: string; albumId: string | null };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

const loose = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s*[([].*?[)\]]\s*/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const score = (want: string, got: string) => {
  if (!want || !got) return 0;
  if (want === got) return 2;
  return got.includes(want) || want.includes(got) ? 1 : 0;
};

/** The best few songs for an artist and title, so playback can fall through ones the server won't stream. */
export function pickSongs(songs: unknown, artist: string, track: string): SongMatch[] {
  const list = Array.isArray(songs) ? songs : songs ? [songs] : [];
  const wantArtist = loose(artist);
  const wantTitle = loose(track);
  const found = list
    .map((song, index) => {
      if (!isObject(song) || song.isVideo === true) return null;
      if (typeof song.type === "string" && song.type !== "music" && song.type !== "song") return null;
      const id = typeof song.id === "string" ? song.id : typeof song.id === "number" ? String(song.id) : "";
      if (!id) return null;
      const albumId =
        typeof song.albumId === "string"
          ? song.albumId
          : typeof song.albumId === "number"
            ? String(song.albumId)
            : null;
      const title = loose(String(song.title ?? ""));
      const by = loose(String(song.artist ?? ""));
      return { id, albumId, index, score: score(wantArtist, by) + score(wantTitle, title) };
    })
    .filter(
      (song): song is { id: string; albumId: string | null; index: number; score: number } => !!song && song.score >= 2
    );
  found.sort((a, b) => b.score - a.score || a.index - b.index);
  const picked: SongMatch[] = [];
  const seen = new Set<string>();
  for (const song of found) {
    if (seen.has(song.id)) continue;
    seen.add(song.id);
    picked.push({ id: song.id, albumId: song.albumId });
    if (picked.length === 3) break;
  }
  return picked;
}

/** Where the album lives in the server's own web interface. Only Navidrome's route is standard enough to link to. */
export function albumWebUrl(base: string, serverName: string, albumId: string | null): string {
  if (albumId && serverName.toLowerCase() === "navidrome")
    return `${base}/app/#/album/${encodeURIComponent(albumId)}/show`;
  return base;
}
