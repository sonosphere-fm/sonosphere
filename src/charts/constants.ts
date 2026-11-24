import { t } from "../i18n";

/** Values mirrored from fmbot's FMBot.Core/Charts renderer and options. */
export const CHART = {
  DEFAULT_CHART_SIZE: 3,
  MAX_IMAGES: 225,
  BASE_CELL_SIZE: 300,
  MIN_CELL_SIZE: 200,
  MAX_CELL_SIZE: 640,
  MAX_CHART_SIZE: 3200,
  MAX_PIXEL_DIMENSION: 16000,
  MAX_CONCURRENT_COVER_LOADS: 4,
  RAINBOW_SATURATION_THRESHOLD: 0.15,
  FONT_SCALE: 1.11,
  FONT_FAMILY: '"Source Sans 3 Variable", "Helvetica Neue", Arial, sans-serif',
  CACHE_TTL_MS: 2 * 60 * 1000,
} as const;

export type PeriodKey = "weekly" | "monthly" | "quarterly" | "half" | "yearly" | "all";

export type PeriodInfo = {
  apiParameter: string;
  urlParameter: string;
};

/** Sonosphere uses the same period strings as the Last.fm API. */
export const PERIODS: Record<PeriodKey, PeriodInfo> = {
  weekly: { apiParameter: "7day", urlParameter: "date_preset=LAST_7_DAYS" },
  monthly: { apiParameter: "1month", urlParameter: "date_preset=LAST_30_DAYS" },
  quarterly: { apiParameter: "3month", urlParameter: "date_preset=LAST_90_DAYS" },
  half: { apiParameter: "6month", urlParameter: "date_preset=LAST_180_DAYS" },
  yearly: { apiParameter: "12month", urlParameter: "date_preset=LAST_365_DAYS" },
  all: { apiParameter: "overall", urlParameter: "date_preset=ALL" },
};

export const periodLabel = (key: PeriodKey) =>
  ({
    weekly: t("music.chartWeekly"),
    monthly: t("music.chartMonthly"),
    quarterly: t("music.chartQuarterly"),
    half: t("music.chartHalfYearly"),
    yearly: t("music.chartYearly"),
    all: t("music.chartOverall"),
  })[key];

export const titleOptions = (): [string, string][] => [
  ["titles", t("music.chartTitlesNames")],
  ["plays", t("music.chartTitlesPlays")],
  ["none", t("music.chartTitlesNone")],
];

export const periodOptions = (): [string, string][] =>
  (Object.keys(PERIODS) as PeriodKey[]).map((key) => [key, periodLabel(key)]);

export enum TitleSetting {
  Titles = 1,
  TitlesDisabled = 2,
  TitlesWithPlays = 3,
}
