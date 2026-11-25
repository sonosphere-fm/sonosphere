export type TopArtist = { id: number; name: string; image: string | null; playcount: number; listeners: number };
export type TopAlbum = {
  id: number;
  title: string;
  image: string | null;
  artist: string;
  playcount: number;
  listeners: number;
};
export type TopTrack = {
  id: number;
  title: string;
  duration: number;
  artist: string;
  album: string | null;
  image: string | null;
  playcount: number;
  listeners: number;
  loved: number;
};
export type TopList<T> = { items: T[]; total: number };

export type RecentTrack = {
  id: number;
  playedAt: number;
  trackId: number;
  title: string;
  duration: number;
  artist: string;
  album: string | null;
  image: string | null;
  user: string;
  userImage: string | null;
  loved: number;
};
export type NowPlaying = {
  trackId: number;
  title: string;
  duration: number;
  artist: string;
  album: string | null;
  image: string | null;
  startedAt: number;
  loved: number;
};
export type Counts = { playcount: number; listeners: number; artists: number; albums: number; tracks: number };
// `k` is the bucket (hour, week number, "YYYY-MM-DD" or "YYYY-MM"), `c` its play count.
export type SeriesPoint = { k: string | number; c: number };

export type ReportType = "week" | "month" | "year" | "all";
export const reportType = (s: string | null | undefined): ReportType =>
  s === "month" || s === "year" || s === "all" ? s : "week";
// Weekly and monthly reports open on the last finished one, yearly on this year.
export const reportStart = (type: ReportType) => (type === "year" || type === "all" ? 0 : 1);

export type Report = {
  type: ReportType;
  offset: number;
  start: number;
  end: number;
  totals: Counts;
  previous: Counts;
  listeningSeconds: number;
  buckets: { key: string; label: string; count: number }[];
  clock: { hour: number; count: number }[];
  topArtists: TopArtist[];
  topAlbums: TopAlbum[];
  topTracks: TopTrack[];
  newArtists: { count: number; items: { name: string; image: string | null; playcount: number }[] };
  tags: { name: string; weight: number }[];
};

export type Throwback = {
  year: number;
  from: string;
  to: string;
  playcount: number;
  topArtists: TopArtist[];
  topTracks: TopTrack[];
};
export type Blasts = { date: string; years: Throwback[] };

export type DayCount = { date: string; count: number };
export type ListeningStats = {
  year: number;
  firstYear: number;
  today: string;
  days: DayCount[];
  activeDays: number;
  longestStreak: Streak;
  currentStreak: number;
  topShare: number;
};
export type Streak = { days: number; end: string | null };
export type Milestone = { n: number; track: RecentTrack };
export type FirstPlay = { plays: number; track: RecentTrack };
export type Milestones = { total: number; items: Milestone[]; next: number | null; firsts: FirstPlay[] };

export const MILESTONES = [1, 1000, 5000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000];

const dayNumber = (date: string) => Date.parse(date) / 86400000;

/** `dates` are "YYYY-MM-DD" in ascending order. `last` is the length of the run that ends on the final date. */
export function streaks(dates: string[]): { longest: Streak; last: number } {
  let longest: Streak = { days: 0, end: null };
  let run = 0;
  let prev = Number.NaN;
  for (const d of dates) {
    const n = dayNumber(d);
    run = n === prev + 1 ? run + 1 : 1;
    prev = n;
    if (run > longest.days) longest = { days: run, end: d };
  }
  return { longest, last: run };
}

export const daysBetween = (from: string, to: string) => dayNumber(to) - dayNumber(from);

export type ScrobbleResult =
  | { accepted: false; reason: string }
  | { accepted: true; id: number; artistId: number; trackId: number; albumId: number | null };

export type ScrobbleResponse = {
  accepted: number;
  ignored: number;
  details: { artist?: unknown; track?: unknown; reason: string }[];
};
export type EditScope = "track" | "album" | "artist";
export type ScopeCounts = { track: number; album: number; artist: number };
export type ScrobbleEdited = { ok: true; changed: number };
export type ScrobblesDeleted = { deleted: number };
export type LovedImported = { accepted: number; ignored: number };
export type Loved = { loved: boolean };
export type ExportRow = { artist: string; album: string | null; track: string; timestamp: number };
