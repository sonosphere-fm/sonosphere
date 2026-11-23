import { CHART, PERIODS, TitleSetting, type PeriodInfo, type PeriodKey } from "./constants";

export type ChartItem = {
  index: number;
  artistName: string;
  albumName?: string;
  coverUrl: string | null;
  userPlaycount: number;
  fallbackImageUrl?: string | null;
  nsfw?: boolean;
  censored?: boolean;
  metadata?: { releaseDate: string | null; coverUrl: string | null };
};

export type MakerOptions = {
  artistChart: boolean;
  width: number;
  height: number;
  timePeriod: PeriodKey;
  titles: boolean;
  plays: boolean;
  skip: boolean;
  rainbow: boolean;
  sfw: boolean;
  hideSingles: boolean;
  releaseFilter: string;
  filteredGenres: string[];
  filteredArtist: string;
};

export type TimeSettings = PeriodInfo & { period: PeriodKey };

/** Port of ChartSettings + ChartOptions from FMBot.Core/Charts. */
export class ChartSettings {
  albums: ChartItem[] = [];
  artists: ChartItem[] = [];
  artistChart = false;
  imagesNeeded = 0;
  timeSettings: TimeSettings = { period: "weekly", ...PERIODS.weekly };
  timespanString = "";
  timespanUrlString = "";
  titleSetting = TitleSetting.Titles;
  skipWithoutImage = false;
  skipNsfw = false;
  customOptionsEnabled = false;
  rainbowSortingEnabled = false;
  releaseYearFilter: number | null = null;
  releaseDecadeFilter: number | null = null;
  filterSingles = false;
  containsNsfw = false;
  censoredItems = 0;
  fileDescription = "";
  filteredArtist: string | null = null;
  filteredGenres: string[] = [];
  userPlaycount = 0;

  private _height = 0;
  private _width = 0;

  get width() {
    return this._width;
  }

  set width(value: number) {
    this._width = value;
    this.imagesNeeded = this._width * this._height;
  }

  get height() {
    return this._height;
  }

  set height(value: number) {
    this._height = value;
    this.imagesNeeded = this._width * this._height;
  }

  get hasGenreFilter() {
    return this.filteredGenres.length > 0;
  }

  /** Port of ChartRenderer.GetDimensions. */
  applySize(option: string): boolean {
    const match = /^([1-9][0-9]{0,2})x([1-9][0-9]{0,2})$/i.exec(option || "");
    if (!match) {
      if (this.width === 0) this.width = CHART.DEFAULT_CHART_SIZE;
      if (this.height === 0) this.height = CHART.DEFAULT_CHART_SIZE;
      return false;
    }
    const parse = (value: string) => {
      const parsed = Number.parseInt(value, 10);
      return Number.isFinite(parsed) ? parsed : CHART.DEFAULT_CHART_SIZE;
    };
    this.width = parse(match[1]);
    this.height = parse(match[2]);
    return true;
  }

  /** Port of ChartOptions.ParseReleaseFilter. */
  static parseReleaseFilter(releaseFilter: string): { year: number | null; decade: number | null } {
    const value = (releaseFilter || "").trim();
    if (!value) return { year: null, decade: null };

    if (/s$/i.test(value)) {
      const decade = Number.parseInt(value.replace(/s+$/i, ""), 10);
      if (Number.isFinite(decade) && decade >= 1900 && decade % 10 === 0) return { year: null, decade };
    }

    const year = Number.parseInt(value, 10);
    if (Number.isFinite(year) && year >= 1900 && year <= 2100) return { year, decade: null };
    return { year: null, decade: null };
  }

  /** Port of ChartOptions.FromEditOptions. */
  static fromOptions(options: MakerOptions): ChartSettings {
    const settings = new ChartSettings();
    settings.artistChart = options.artistChart;
    settings.filteredArtist = options.filteredArtist || null;
    settings.filteredGenres = options.filteredGenres;
    settings.applySize(`${options.width}x${options.height}`);

    settings.titleSetting = !options.titles
      ? TitleSetting.TitlesDisabled
      : options.plays
        ? TitleSetting.TitlesWithPlays
        : TitleSetting.Titles;
    settings.skipWithoutImage = options.skip || options.rainbow;
    settings.skipNsfw = options.sfw;
    settings.rainbowSortingEnabled = options.rainbow;
    settings.filterSingles = options.hideSingles && !settings.artistChart;

    const { year, decade } = ChartSettings.parseReleaseFilter(options.releaseFilter);
    settings.releaseYearFilter = year;
    settings.releaseDecadeFilter = decade;

    const hasFilters = Boolean(year || decade || settings.filteredArtist);
    const periodKey = hasFilters ? "all" : options.timePeriod;
    const period = PERIODS[periodKey] || PERIODS.weekly;
    settings.timeSettings = { period: periodKey, ...period };
    settings.timespanString = period.description;
    settings.timespanUrlString = period.urlParameter;
    settings.customOptionsEnabled =
      settings.titleSetting !== TitleSetting.Titles ||
      settings.skipWithoutImage ||
      settings.skipNsfw ||
      settings.rainbowSortingEnabled ||
      settings.filterSingles ||
      settings.filteredGenres.length > 0;

    return settings;
  }

  /** Port of ChartOptions.SettingsLines. */
  settingsLines(): string[] {
    const lines: string[] = [];
    const noun = this.artistChart ? "artists" : "albums";

    if (this.releaseYearFilter) lines.push(`Releases from ${this.releaseYearFilter} only.`);
    if (this.releaseDecadeFilter) lines.push(`Releases from the ${this.releaseDecadeFilter}s only.`);
    if (this.filterSingles) lines.push("Hiding singles.");
    if (this.skipWithoutImage) lines.push(`Skipping ${noun} without images.`);
    if (this.skipNsfw) lines.push(`Skipping NSFW ${noun}.`);
    if (this.titleSetting === TitleSetting.TitlesDisabled) {
      lines.push(`${this.artistChart ? "Artist" : "Album"} titles disabled.`);
    }
    if (this.filteredArtist && !this.artistChart) lines.push(`Only albums by ${this.filteredArtist}.`);
    if (this.hasGenreFilter) lines.push(`Genres: ${this.filteredGenres.join(", ")}.`);
    if (this.rainbowSortingEnabled) lines.push("Rainbow sorted.");
    return lines;
  }
}
