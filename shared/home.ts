// Types shared by the server and the browser for the site charts, the home page and the recommendations page.
import type { EventSummary } from "./events";
import type { NowPlaying, RecentTrack, TopAlbum, TopArtist, TopTrack } from "./listening";
import type { Recommendation } from "./recommend";
import type { TagCount } from "./tags";
import type { Paging, PublicUser } from "./users";

/** A tag in the site chart: how often it was applied and by how many people. */
export type ChartTag = { name: string; count: number; taggers: number };
/** GET /api/charts: one page of the ranking asked for with `kind`. `T` follows the `kind` asked for. */
export type Charts<T extends TopArtist | TopAlbum | TopTrack | ChartTag = TopArtist | TopAlbum | TopTrack | ChartTag> = { items: T[]; total: number } & Paging;

/** What someone you follow is playing now, or played last. */
export type FriendActivity = { user: PublicUser; track: NowPlaying | RecentTrack; nowPlaying: boolean };
/** A track loved by someone you follow. `user` is their username. */
export type FriendLove = {
  id: number; title: string; duration: number; artist: string; album: string | null; image: string | null;
  lovedAt: number; user: string; userImage: string | null; loved: number;
};
export type SiteTotals = { scrobbles: number; users: number; artists: number; tracks: number };
/**
 * GET /api/home. The trending lists cover the last week when enough people have been listening, otherwise all
 * time (`trendingPeriod` says which). The last four fields are only sent to signed-in visitors.
 */
export type Home = {
  trendingPeriod: "week" | "overall";
  trendingArtists: TopArtist[]; trendingTracks: TopTrack[]; trendingAlbums: TopAlbum[];
  tags: TagCount[]; events: EventSummary[]; stats: SiteTotals;
  friends?: FriendActivity[]; friendLoves?: FriendLove[]; recommended?: Recommendation[];
  /** The viewer's plays in the last seven days and in the seven before. */
  week?: { now: number; before: number };
};
/** GET /api/recommended */
export type Recommended = { artists: Recommendation[]; tracks: TopTrack[]; albums: TopAlbum[]; events: EventSummary[] };
