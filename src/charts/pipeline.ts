import type { SonoChartsClient } from "./data";
import { t } from "../i18n";
import { CHART } from "./constants";
import { MetadataClient, normalizeName } from "./metadata";
import type { ChartItem, ChartSettings } from "./options";

export type ChartDataStatus =
  | "Ok"
  | "TooManyImages"
  | "Hidden"
  | "NotEnough"
  | "NotEnoughReleaseYear"
  | "NotEnoughReleaseDecade"
  | "NotEnoughNonSingles";

export type ChartDataResult = { status: ChartDataStatus; amount: number; extra: number };
export type PipelineContext = { sono: SonoChartsClient; metadata: MetadataClient; username: string };

/** Port of ChartDataService.GetAlbumsAsync / GetArtistsAsync to Sonosphere data. */
export async function buildChartData(
  settings: ChartSettings,
  context: PipelineContext,
  onProgress?: (stage: string, detail?: string) => void
): Promise<ChartDataResult> {
  const { sono, metadata, username } = context;
  const report = (stage: string, detail?: string) => onProgress?.(stage, detail);

  if (settings.imagesNeeded > CHART.MAX_IMAGES) return { status: "TooManyImages", amount: 0, extra: 0 };

  let extra = 0;
  if (settings.skipWithoutImage) extra = settings.height * 2 + (settings.height > 5 ? 8 : 2);
  if (settings.skipNsfw) extra += settings.height;

  const hasFilters = Boolean(
    settings.releaseYearFilter ||
      settings.releaseDecadeFilter ||
      settings.filteredArtist ||
      settings.filterSingles ||
      settings.hasGenreFilter
  );
  const count = hasFilters ? 1000 : 250;
  const kind = settings.artistChart ? "artists" : "albums";

  // fmbot asks its indexed library for an artist's top albums only at all-time;
  // /api/user/top has the same server-side `artist` scope.
  const serverArtistFilter =
    !settings.artistChart && settings.filteredArtist && settings.timeSettings.period === "all"
      ? settings.filteredArtist
      : null;

  report(t("music.chartFetching"));
  const result = await sono.top(username, kind, settings.timeSettings.period, count, serverArtistFilter);
  if (result.hidden) return { status: "Hidden", amount: 0, extra };
  settings.userPlaycount = result.counts?.playcount || 0;

  let items: ChartItem[] = result.items.map((item) => ({ ...item }));
  if (items.length < settings.imagesNeeded) return { status: "NotEnough", amount: items.length, extra };

  if (!settings.artistChart && settings.filteredArtist && !serverArtistFilter) {
    const artist = normalizeName(settings.filteredArtist);
    items = items.filter((item) => normalizeName(item.artistName) === artist);
  }

  if (settings.hasGenreFilter) {
    report(t("music.chartMatchingGenres"));
    const artistNames = [...new Set(items.map((item) => item.artistName).filter(Boolean))];
    const matched = await metadata.getArtistsInGenres(artistNames, settings.filteredGenres);
    items = items.filter((item) => matched.has(item.artistName));
  }

  if (items.length < settings.imagesNeeded) return { status: "NotEnough", amount: items.length, extra };

  let shortage: ChartDataStatus | null = null;
  if (!settings.artistChart && (settings.releaseYearFilter || settings.releaseDecadeFilter || settings.filterSingles)) {
    if (settings.releaseYearFilter || settings.releaseDecadeFilter) {
      report(t("music.chartReleaseDates"));
      const enriched = await metadata.enrichAlbums(items, (done, total) =>
        report(t("music.chartReleaseDates"), `${done}/${total}`)
      );
      items.forEach((item, index) => {
        item.metadata = enriched[index];
      });
      items = items.filter((item) =>
        MetadataClient.matchesRelease(
          item.metadata || { releaseDate: null, coverUrl: item.coverUrl },
          settings.releaseYearFilter,
          settings.releaseDecadeFilter
        )
      );
      if (items.length < settings.imagesNeeded) {
        shortage = settings.releaseDecadeFilter ? "NotEnoughReleaseDecade" : "NotEnoughReleaseYear";
      }
    }

    if (!shortage && settings.filterSingles) {
      report(t("music.chartSingles"));
      const artistNames = [...new Set(items.map((item) => item.artistName).filter(Boolean))];
      const singles = await metadata.getSingles(artistNames);
      items = items.filter(
        (item) => !singles.has(`${normalizeName(item.artistName)}\u0000${normalizeName(item.albumName)}`)
      );
      if (items.length < settings.imagesNeeded) shortage = "NotEnoughNonSingles";
    }
  }

  if (items.length < settings.imagesNeeded) {
    return { status: shortage || "NotEnough", amount: items.length, extra };
  }

  const taken = items.slice(0, settings.imagesNeeded + extra);

  // fmbot asks the image fallback for up to three items that have no cover.
  const withoutImage = taken.filter((item) => !item.coverUrl && !item.fallbackImageUrl);
  const fallbackCount = Math.min(3, withoutImage.length);
  if (fallbackCount > 0) {
    report(t("music.chartFallbackArt"));
    for (let i = 0; i < fallbackCount; i += 1) {
      const item = withoutImage[i];
      try {
        item.fallbackImageUrl = item.metadata?.coverUrl || (await sono.artist(item.artistName)).imageUrl || null;
      } catch {
        item.fallbackImageUrl = null;
      }
    }
  }

  // MusicCensorService substitute: the local list, with an optional nsfw: prefix.
  for (const item of taken) {
    const censor = metadata.censorFor(item, settings.artistChart);
    item.censored = censor === "notsafe";
    item.nsfw = censor === "nsfw";
  }

  if (settings.artistChart) settings.artists = taken;
  else settings.albums = taken;

  settings.fileDescription = taken
    .map((item, index) =>
      settings.artistChart
        ? t("music.chartDescArtist", { rank: index + 1, artist: item.artistName })
        : t("music.chartDescAlbum", { rank: index + 1, album: item.albumName ?? "", artist: item.artistName })
    )
    .join("");

  return { status: "Ok", amount: taken.length, extra };
}
