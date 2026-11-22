import type { EventSummary } from "./events";
import type { NowPlaying, RecentTrack, TopAlbum, TopArtist, TopTrack } from "./listening";
import type { Recommendation } from "./recommend";
import type { TagCount } from "./tags";
import type { Paging, PublicUser } from "./users";

export type ChartTag = { name: string; count: number; taggers: number };
export type Charts<T extends TopArtist | TopAlbum | TopTrack | ChartTag = TopArtist | TopAlbum | TopTrack | ChartTag> =
  { items: T[]; total: number } & Paging;

export type FriendActivity = { user: PublicUser; track: NowPlaying | RecentTrack; nowPlaying: boolean };
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
