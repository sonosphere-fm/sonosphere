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
  description: string;
  apiParameter: string;
  urlParameter: string;
};

/** Sonosphere uses the same period strings as the Last.fm API. */
export const PERIODS: Record<PeriodKey, PeriodInfo> = {
  weekly: { description: "Weekly", apiParameter: "7day", urlParameter: "date_preset=LAST_7_DAYS" },
  monthly: { description: "Monthly", apiParameter: "1month", urlParameter: "date_preset=LAST_30_DAYS" },
  quarterly: { description: "Quarterly", apiParameter: "3month", urlParameter: "date_preset=LAST_90_DAYS" },
  half: { description: "Half-yearly", apiParameter: "6month", urlParameter: "date_preset=LAST_180_DAYS" },
  yearly: { description: "Yearly", apiParameter: "12month", urlParameter: "date_preset=LAST_365_DAYS" },
  all: { description: "Overall", apiParameter: "overall", urlParameter: "date_preset=ALL" },
};

export const TITLE_OPTIONS: [string, string][] = [
  ["titles", "Names"],
  ["plays", "Names + play counts"],
  ["none", "No titles"],
];

export const PERIOD_OPTIONS: [string, string][] = [
  ["weekly", "Weekly"],
  ["monthly", "Monthly"],
  ["quarterly", "Quarterly"],
  ["half", "Half-yearly"],
  ["yearly", "Yearly"],
  ["all", "Overall"],
];

export enum TitleSetting {
  Titles = 1,
  TitlesDisabled = 2,
  TitlesWithPlays = 3,
}
