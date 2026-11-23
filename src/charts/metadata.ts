import type { SonoChartsClient } from "./data";
import type { ChartItem } from "./options";

export type AlbumMetadata = { releaseDate: string | null; coverUrl: string | null };
export type CensorResult = "safe" | "nsfw" | "notsafe";

export function normalizeName(value: string | null | undefined): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

/** GenreService.ResolveGenres normalises by dropping spaces and hyphens. */
export function normalizeGenre(value: string | null | undefined): string {
  return normalizeName(value).replace(/[\s-]/g, "");
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

/** Browser-side substitutes for the lookups fmbot performs against its own database. */
export class MetadataClient {
  private genres = new Map<string, string[]>();
  private albums = new Map<string, AlbumMetadata>();
  private singles = new Map<string, Set<string>>();
  private censorArtists = new Map<string, boolean>();
  private censorAlbums = new Map<string, boolean>();

  constructor(private sono: SonoChartsClient) {}

  setCensorList(artistText: string, albumText: string): void {
    const parse = (entry: string) => ({
      nsfw: /^nsfw\s*:/i.test(entry),
      value: entry.replace(/^nsfw\s*:\s*/i, ""),
    });
    this.censorArtists = new Map(
      splitList(artistText).map((entry) => {
        const parsed = parse(entry);
        return [normalizeName(parsed.value), parsed.nsfw];
      })
    );
    this.censorAlbums = new Map(
      splitList(albumText).map((entry) => {
        const parsed = parse(entry);
        const key = parsed.value
          .replace(/\s+[—–-]\s+/, "\u0000")
          .split("\u0000")
          .map(normalizeName)
          .join("\u0000");
        return [key, parsed.nsfw];
      })
    );
  }

  censorFor(item: ChartItem, isArtistChart: boolean): CensorResult {
    const artist = normalizeName(item.artistName);
    if (this.censorArtists.has(artist)) return this.censorArtists.get(artist) ? "nsfw" : "notsafe";
    if (!isArtistChart && item.albumName) {
      const key = `${artist}\u0000${normalizeName(item.albumName)}`;
      if (this.censorAlbums.has(key)) return this.censorAlbums.get(key) ? "nsfw" : "notsafe";
    }
    return "safe";
  }

  async getArtistGenres(artistName: string): Promise<string[]> {
    const key = normalizeName(artistName);
    if (!key) return [];
    let cached = this.genres.get(key);
    if (!cached) {
      try {
        cached = (await this.sono.artist(artistName)).tags;
      } catch {
        cached = [];
      }
      this.genres.set(key, cached);
    }
    return cached;
  }

  /** Rough equivalent of GenreService.GetTopGenresForTopArtistsString. */
  async getTopGenresForArtists(artistNames: string[], limit = 30): Promise<string[]> {
    const counts = new Map<string, { name: string; count: number }>();
    const lists = await mapWithConcurrency(artistNames, 4, (name) => this.getArtistGenres(name));
    for (const tags of lists) {
      for (const tag of tags) {
        const normalized = normalizeGenre(tag);
        if (!normalized) continue;
        const existing = counts.get(normalized) || { name: tag, count: 0 };
        existing.count += 1;
        counts.set(normalized, existing);
      }
    }
    return [...counts.values()]
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, limit)
      .map((entry) => entry.name);
  }

  /** Equivalent of GenreService.GetArtistsInGenres. */
  async getArtistsInGenres(artistNames: string[], selectedGenres: string[]): Promise<Set<string>> {
    const targets = selectedGenres.map(normalizeGenre).filter(Boolean);
    if (!targets.length) return new Set();
    const matched = new Set<string>();
    const tagLists = await mapWithConcurrency(artistNames, 4, (name) => this.getArtistGenres(name));
    artistNames.forEach((artistName, index) => {
      const tags = (tagLists[index] || []).map(normalizeGenre);
      if (tags.some((tag) => targets.some((target) => tag === target || tag.includes(target)))) {
        matched.add(artistName);
      }
    });
    return matched;
  }

  async enrichAlbum(item: ChartItem): Promise<AlbumMetadata> {
    const key = `${normalizeName(item.artistName)}\u0000${normalizeName(item.albumName)}`;
    const cached = this.albums.get(key);
    if (cached) return cached;
    let result: AlbumMetadata = { releaseDate: null, coverUrl: item.coverUrl };
    try {
      const page = await this.sono.album(item.artistName, item.albumName || "");
      result = { releaseDate: page.releaseDate, coverUrl: page.coverUrl || result.coverUrl };
    } catch {
      // The record may not be in the catalogue yet; keep the cover from the top list.
    }
    this.albums.set(key, result);
    return result;
  }

  enrichAlbums(items: ChartItem[], onProgress?: (done: number, total: number) => void): Promise<AlbumMetadata[]> {
    return mapWithConcurrency(items, 4, async (item, index) => {
      const metadata = await this.enrichAlbum(item);
      if (onProgress) onProgress(index + 1, items.length);
      return metadata;
    });
  }

  async getSingles(artistNames: string[]): Promise<Set<string>> {
    const keys = new Set<string>();
    for (const artistName of artistNames) {
      let titles = this.singles.get(artistName);
      if (!titles) {
        try {
          titles = await this.sono.singles(artistName);
        } catch {
          titles = new Set();
        }
        this.singles.set(artistName, titles);
      }
      for (const title of titles) keys.add(`${normalizeName(artistName)}\u0000${normalizeName(title)}`);
    }
    return keys;
  }

  static matchesRelease(metadata: AlbumMetadata, year: number | null, decade: number | null): boolean {
    const match = String(metadata.releaseDate || "").match(/^(\d{4})/);
    if (!match) return false;
    const parsed = Number(match[1]);
    if (year) return parsed === year;
    if (decade) return parsed >= decade && parsed < decade + 10;
    return false;
  }
}
