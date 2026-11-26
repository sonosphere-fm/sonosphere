import { pickMatches, type MusicMatch } from "./music-match";

export type JellyfinAuth = {
  kind: "jellyfin";
  base: string;
  userId: string;
  token: string;
  deviceId: string;
  name: string;
};

export type JellyfinSource = { proxy: string; albumUrl: string };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

const text = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");

export function pickJellyfin(items: unknown, artist: string, track: string): MusicMatch[] {
  const list = Array.isArray(items) ? items : items ? [items] : [];
  const candidates = list.flatMap((item) => {
    if (!isObject(item)) return [];
    if (text(item.Type) && item.Type !== "Audio") return [];
    const id = text(item.Id);
    if (!id) return [];
    const artists = Array.isArray(item.Artists) ? item.Artists.map(text).filter(Boolean) : [];
    if (!artists.length && text(item.AlbumArtist)) artists.push(text(item.AlbumArtist));
    return [
      {
        id,
        albumId: text(item.AlbumId) || null,
        title: text(item.Name),
        artist: artists.join(", "),
      },
    ];
  });
  return pickMatches(candidates, artist, track);
}

export function jellyfinAlbumUrl(base: string, albumId: string | null): string {
  return albumId ? `${base}/web/index.html#!/details?id=${encodeURIComponent(albumId)}` : `${base}/web/index.html`;
}
