// Types shared by the server and the browser for accounts.
import type { Counts, NowPlaying, RecentTrack, TopAlbum, TopArtist, TopList, TopTrack } from "./listening";
import type { Obsession } from "./obsessions";
import type { Neighbour, Taste } from "./recommend";
import type { TagCount } from "./tags";

/** What anyone may see of an account. `image` is an image id. */
export type PublicUser = { id: number; username: string; realname: string; country: string; image: number | null };

/** Which page of a list a response holds: echoed back on every paged response. */
export type Paging = { limit: number; page: number; offset: number };

/**
 * A profile page (GET /api/user). `hidden` means the owner keeps their recent listening private from the person
 * looking; `isFollowing`, `followsYou`, `blocked` and `taste` are about the person looking and the profile's owner.
 */
export type Profile = PublicUser & {
  about: string; website: string; registeredAt: number; hidden: boolean; shoutsEnabled: boolean;
  playcount: number; artistCount: number; albumCount: number; trackCount: number;
  lovedCount: number; followers: number; following: number; isFollowing: boolean; followsYou: boolean;
  nowPlaying: NowPlaying | null;
  /** How alike the viewer's listening is to this user's. Null when signed out or looking at yourself. */
  taste: Taste | null;
  /** Their current obsession, if they have ever set one. */
  obsession: Obsession | null;
  shoutCount: number; journalCount: number; blocked: boolean; suspended: boolean; banned: boolean;
};

/** GET /api/user/recent. A private listener's page comes back empty with `hidden` set. */
export type UserRecent = TopList<RecentTrack> & Paging & ({ hidden: true } | { nowPlaying: NowPlaying | null });
/** GET /api/user/top. `counts` comes with the first page only. `T` follows the `kind` asked for. */
export type UserTop<T extends TopArtist | TopAlbum | TopTrack = TopArtist | TopAlbum | TopTrack> = TopList<T> & Paging & { counts?: Counts };
/** GET /api/user/library/artist: one listener's history with one artist. `first` is when they first played them. */
export type UserArtistLibrary = {
  artist: { id: number; name: string; image: number | null }; counts: Counts; first: number | null;
  tracks: TopTrack[]; albums: TopAlbum[]; trend: WeekCount[];
};
/** Plays in the week that began at `start` (a Monday, Unix seconds). */
export type WeekCount = { start: number; count: number };

export type LovedTrack = { id: number; title: string; duration: number; artist: string; album: string | null; image: number | null; lovedAt: number; loved: number };
export type UserLoved = TopList<LovedTrack> & Paging;

/** Someone in a following or followers list. `lastTrack` is null for people who keep their listening private. */
export type Person = PublicUser & { playcount: number; isFollowing: boolean; lastTrack: { title: string; artist: string; playedAt: number } | null };
export type People = { items: Person[] };
export type Neighbours = { items: Neighbour[] };

/** Something a user tagged. `artist` is null when the item is itself an artist. */
export type TaggedItem = { type: string; id: number; name: string | null; artist: string | null };
/** GET /api/user/tags: the tags a user has used, or with `tag` given, the things they put that tag on. */
export type UserTags = { items: TagCount[] | TaggedItem[] };

export type FollowResult = { isFollowing: boolean };
