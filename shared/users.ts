import type { Counts, NowPlaying, RecentTrack, TopAlbum, TopArtist, TopList, TopTrack } from "./listening";
import type { Obsession } from "./obsessions";
import type { Neighbour, Taste } from "./recommend";
import type { TagCount } from "./tags";

export type PublicUser = { id: number; username: string; realname: string; country: string; image: string | null };

export type Paging = { limit: number; page: number; offset: number };

export type Profile = PublicUser & {
  banner: string | null;
  about: string;
  pronouns: string;
  website: string;
  registeredAt: number;
  hidden: boolean;
  locked: boolean;
  shoutsEnabled: boolean;
  playcount: number;
  artistCount: number;
  albumCount: number;
  trackCount: number;
  lovedCount: number;
  followers: number;
  following: number;
  isFollowing: boolean;
  followsYou: boolean;
  nowPlaying: NowPlaying | null;
  taste: Taste | null;
  obsession: Obsession | null;
  shoutCount: number;
  journalCount: number;
  blocked: boolean;
  suspended: boolean;
  banned: boolean;
};

export type UserRecent = TopList<RecentTrack> & Paging & ({ hidden: true } | { nowPlaying: NowPlaying | null });
export type UserTop<T extends TopArtist | TopAlbum | TopTrack = TopArtist | TopAlbum | TopTrack> = TopList<T> &
  Paging & { counts?: Counts; hidden?: true };
export type UserArtistLibrary = {
  artist: { id: number; name: string; image: string | null };
  counts: Counts;
  first: number | null;
  tracks: TopTrack[];
  albums: TopAlbum[];
  trend: WeekCount[];
};
export type WeekCount = { start: number; count: number };

export type LovedTrack = {
  id: number;
  title: string;
  duration: number;
  artist: string;
  album: string | null;
  image: string | null;
  lovedAt: number;
  loved: number;
};
export type UserLoved = TopList<LovedTrack> & Paging & { hidden?: true };

export type Person = PublicUser & {
  playcount?: number;
  isFollowing: boolean;
  lastTrack: { title: string; artist: string; playedAt: number } | null;
};
export type People = { items: Person[] };
export type Neighbours = { items: Neighbour[]; hidden?: true };

export type TaggedItem = { type: string; id: number; name: string | null; artist: string | null };
export type UserTags = { items: TagCount[] | TaggedItem[] };

export type FollowResult = { isFollowing: boolean };
