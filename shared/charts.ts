export const CHART_MAX_SIDE = 15;

export const CHART_PERIODS = {
  weekly: "7day",
  monthly: "1month",
  quarterly: "3month",
  half: "6month",
  yearly: "12month",
  all: "overall",
} as const;
export type ChartPeriod = keyof typeof CHART_PERIODS;

export type ChartTitles = "titles" | "plays" | "none";

export type ChartRequest = {
  username: string;
  kind: "albums" | "artists";
  period: ChartPeriod;
  /** Unix seconds; either one set replaces `period`. */
  from: number | null;
  to: number | null;
  width: number;
  height: number;
  titles: ChartTitles;
  skip: boolean;
  rainbow: boolean;
  sfw: boolean;
  hideSingles: boolean;
  releaseFilter: string;
  artist: string;
  genres: string[];
  censorArtists: string;
  censorAlbums: string;
};

type ChartShortage = "Hidden" | "NotEnough" | "NotEnoughReleaseYear" | "NotEnoughReleaseDecade" | "NotEnoughNonSingles";

export type ChartReply =
  | {
      status: "Ok";
      image: string;
      width: number;
      height: number;
      drawn: number;
      names: { artist: string; album: string | null }[];
    }
  | { status: ChartShortage; amount: number; extra: number };

/** A year like 1994, or a decade like 1990s. */
export function parseReleaseFilter(value: string): { year: number | null; decade: number | null } {
  const text = value.trim();
  if (/^\d{4}s$/i.test(text)) {
    const decade = Number.parseInt(text, 10);
    if (decade >= 1900 && decade % 10 === 0) return { year: null, decade };
  }
  if (/^\d{4}$/.test(text)) {
    const year = Number(text);
    if (year >= 1900 && year <= 2100) return { year, decade: null };
  }
  return { year: null, decade: null };
}
