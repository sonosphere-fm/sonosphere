import { t } from "../i18n";
import { parseReleaseFilter, type ChartRequest } from "../../shared/charts";

export function settingsLines(req: ChartRequest): string[] {
  const lines: string[] = [];
  const artists = req.kind === "artists";
  const { year, decade } = artists ? { year: null, decade: null } : parseReleaseFilter(req.releaseFilter);
  const artist = artists ? "" : req.artist.trim();

  if (year) lines.push(t("music.chartLineYear", { year }));
  if (decade) lines.push(t("music.chartLineDecade", { decade }));
  if (req.hideSingles && !artists) lines.push(t("music.chartLineHidingSingles"));
  if (req.skip || req.rainbow) {
    lines.push(artists ? t("music.chartLineSkipArtistsNoImage") : t("music.chartLineSkipAlbumsNoImage"));
  }
  if (req.sfw) lines.push(artists ? t("music.chartLineSkipArtistsNsfw") : t("music.chartLineSkipAlbumsNsfw"));
  if (req.titles === "none") {
    lines.push(artists ? t("music.chartLineArtistTitlesOff") : t("music.chartLineAlbumTitlesOff"));
  }
  if (artist) lines.push(t("music.chartLineOnlyBy", { artist }));
  if (req.genres.length) lines.push(t("music.chartLineGenres", { genres: req.genres.join(", ") }));
  if (req.rainbow) lines.push(t("music.chartLineRainbow"));
  return lines;
}
