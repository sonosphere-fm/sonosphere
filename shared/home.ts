import type { EventSummary } from "./events";
import type { NowPlaying, RecentTrack, TopAlbum, TopArtist, TopTrack } from "./listening";
import type { Recommendation } from "./recommend";
import type { TagCount } from "./tags";
import type { Paging, PublicUser } from "./users";

export type ChartTag = { name: string; count: number; taggers: number };
export type Charts<T extends TopArtist | TopAlbum | TopTrack | ChartTag = TopArtist | TopAlbum | TopTrack | ChartTag> =
  { items: T[]; total: number } & Paging;

export type FriendActivity = { user: PublicUser; track: NowPlaying | RecentTrack; nowPlaying: boolean };
export type Friends = { items: FriendActivity[] };
export type FriendLove = {
  id: number;
  title: string;
  duration: number;
  artist: string;
  album: string | null;
  image: string | null;
  lovedAt: number;
  user: string;
  userImage: string | null;
  loved: number;
};
export type SiteTotals = { scrobbles: number; users: number; artists: number; tracks: number };
export type Home = {
  trendingPeriod: "week" | "overall";
  trendingArtists: TopArtist[];
  trendingTracks: TopTrack[];
  trendingAlbums: TopAlbum[];
  tags: TagCount[];
  events: EventSummary[];
  stats: SiteTotals;
  friends?: FriendActivity[];
  friendLoves?: FriendLove[];
  week?: { now: number; before: number };
};
export type Recommended = { artists: Recommendation[]; tracks: TopTrack[]; albums: TopAlbum[]; events: EventSummary[] };

export const LEADER_PERIODS = ["7day", "1month", "12month", "overall"] as const;
export type LeaderPeriod = (typeof LEADER_PERIODS)[number];
export type Leader = PublicUser & { value: number };
export type Devotee = Leader & { artist: string };
export type Leaderboard = {
  period: LeaderPeriod;
  totals: { seconds: number; plays: number; listeners: number };
  seconds: Leader[];
  plays: Leader[];
  artists: Leader[];
  loves: Leader[];
  devoted: Devotee[];
};

export const LEADER_BOARDS = ["hours", "scrobbles", "artists", "fans", "loves"] as const;
export type LeaderBoard = (typeof LEADER_BOARDS)[number];
export type ListenerEntry = Leader & { seconds: number; plays: number; artists: number };
export type FanEntry = Devotee & { share: number };
export type LeaderPage = { period: LeaderPeriod; total: number } & Paging &
  (
    | { board: "hours" | "scrobbles" | "artists"; items: ListenerEntry[] }
    | { board: "fans"; items: FanEntry[] }
    | { board: "loves"; items: Leader[] }
  );
