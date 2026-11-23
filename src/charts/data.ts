import { api } from "../lib";
import type { AlbumPage, ArtistAlbums, ArtistPage } from "../../shared/catalog";
import type { Counts, TopAlbum, TopArtist } from "../../shared/listening";
import type { UserTop } from "../../shared/users";
import { CHART, PERIODS, type PeriodKey } from "./constants";
import type { ChartItem } from "./options";

type CacheEntry = { time: number; value: unknown };
const cache = new Map<string, CacheEntry>();

async function cached<T>(key: string, load: () => Promise<T>, ttl = CHART.CACHE_TTL_MS): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.time < ttl) return hit.value as T;
  const value = await load();
  cache.set(key, { time: Date.now(), value });
  return value;
}

export function imageUrl(id: string | null | undefined): string | null {
  return id && /^[0-9a-f]{32}$/.test(id) ? `/api/image/${id}` : null;
}

export type TopResult = {
  total: number;
  hidden: boolean;
  counts: Counts | null;
  items: ChartItem[];
};

/** Reads the same public /api endpoints the rest of Sonosphere uses. */
export class SonoChartsClient {
  /** Mirrors fmbot's top-list fetch: 250 items normally, 1000 with filters. */
  async top(
    username: string,
    kind: "albums" | "artists",
    periodKey: PeriodKey,
    count: number,
    artistFilter: string | null = null
  ): Promise<TopResult> {
    const limit = 200; // /api/user/top caps limit at 200
    const period = PERIODS[periodKey].apiParameter;
    const items: ChartItem[] = [];
    let total = 0;
    let hidden = false;
    let counts: Counts | null = null;

    for (let page = 1; items.length < count; page += 1) {
      const query = new URLSearchParams({
        name: username,
        kind,
        period,
        limit: String(limit),
        page: String(page),
      });
      if (artistFilter) query.set("artist", artistFilter);
      const path = `/user/top?${query.toString()}`;
      const body = await cached(path, () => api<UserTop<TopAlbum | TopArtist>>(path));

      if (page === 1) {
        total = Number(body.total) || 0;
        hidden = body.hidden === true;
        counts = body.counts || null;
      }
      const pageItems = Array.isArray(body.items) ? body.items : [];
      for (const item of pageItems) {
        if (kind === "albums") {
          const album = item as TopAlbum;
          items.push({
            index: items.length,
            albumName: album.title,
            artistName: album.artist,
            coverUrl: imageUrl(album.image),
            userPlaycount: Number(album.playcount) || 0,
          });
        } else {
          const artist = item as TopArtist;
          items.push({
            index: items.length,
            artistName: artist.name,
            coverUrl: imageUrl(artist.image),
            userPlaycount: Number(artist.playcount) || 0,
          });
        }
      }
      if (pageItems.length < limit || items.length >= total || total === 0) break;
    }

    return { total, hidden, counts, items };
  }

  async artist(name: string): Promise<{ tags: string[]; imageUrl: string | null }> {
    const query = new URLSearchParams({ name });
    const path = `/artist?${query.toString()}`;
    const page = await cached(path, () => api<ArtistPage>(path));
    return {
      tags: (page.tags || []).map((tag) => tag.name),
      imageUrl: imageUrl(page.image),
    };
  }

  async album(artist: string, title: string): Promise<{ releaseDate: string | null; coverUrl: string | null }> {
    const query = new URLSearchParams({ artist, album: title });
    const path = `/album?${query.toString()}`;
    const page = await cached(path, () => api<AlbumPage>(path));
    return { releaseDate: page.releaseDate || null, coverUrl: imageUrl(page.image) };
  }

  /** Sonosphere exposes releaseType through the discography singles filter. */
  async singles(artist: string): Promise<Set<string>> {
    const query = new URLSearchParams({ name: artist, type: "singles", limit: "48", page: "1" });
    const path = `/artist/albums?${query.toString()}`;
    const page = await cached(path, () => api<ArtistAlbums>(path));
    return new Set((page.items || []).map((album) => album.title.toLowerCase()));
  }
}
