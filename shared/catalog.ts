import type { TopList, TopTrack } from "./listening";
import type { SimilarArtist } from "./recommend";
import type { TagCount } from "./tags";
import type { PublicUser } from "./users";
import type { WikiVersion } from "./wiki";

export type ItemType = "artist" | "album" | "track" | "tag" | "user" | "event" | "journal";

export type Paged<T> = TopList<T> & { limit: number; page: number; offset: number };
export type TrendPoint = { start: number; count: number };
export type Listener = PublicUser & { playcount: number };

export type EventSummary = {
  id: number;
  title: string;
  venue: string;
  city: string;
  country: string;
  startsAt: number;
  description: string;
  url: string;
  creator: string | null;
  source: string;
  going: number;
  interested: number;
  status: string | null;
  artists: { name: string; image: string | null }[];
};

export type ArtistAlbum = {
  id: number;
  title: string;
  image: string | null;
  releaseDate: string | null;
  artist: string;
  listeners: number;
  trackCount: number;
};
export type ArtistAlbumWithPlays = {
  id: number;
  title: string;
  image: string | null;
  releaseDate: string | null;
  artist: string;
  playcount: number;
  listeners: number;
  trackCount: number;
};
export type LatestAlbum = {
  id: number;
  title: string;
  image: string | null;
  releaseDate: string | null;
  artist: string;
};

export type ArtistPage = {
  id: number;
  name: string;
  mbid: string;
  spotifyId: string;
  image: string | null;
  listeners: number;
  playcount: number;
  userPlaycount: number;
  tags: TagCount[];
  myTags: string[];
  wiki: WikiVersion | null;
  similar: SimilarArtist[];
  topTracks: TopTrack[];
  topAlbums: ArtistAlbum[];
  topSingles: ArtistAlbum[];
  latestAlbum: LatestAlbum | null;
  weekTrack: TopTrack | null;
  albumCount: number;
  trackCount: number;
  imageCount: number;
  trend: TrendPoint[];
  topListeners: Listener[];
  events: EventSummary[];
  shoutCount: number;
};
export type ArtistTracks = Paged<TopTrack>;
export type ArtistAlbums = Paged<ArtistAlbumWithPlays>;
export type ArtistSimilar = { items: (SimilarArtist & { tags: string[] })[] };
export type ArtistListeners = { items: Listener[] };

type AlbumTrack = {
  position: number;
  id: number;
  title: string;
  duration: number;
  artist: string;
  album: string;
  image: string | null;
  playcount: number;
  listeners: number;
  loved: number;
};
export type OtherAlbum = { id: number; title: string; image: string | null; artist: string; listeners: number };

export type AlbumPage = {
  id: number;
  title: string;
  artist: string;
  mbid: string;
  image: string | null;
  releaseDate: string | null;
  artistImage: string | null;
  imageCount: number;
  listeners: number;
  playcount: number;
  userPlaycount: number;
  tags: TagCount[];
  myTags: string[];
  wiki: WikiVersion | null;
  tracks: AlbumTrack[];
  duration: number;
  otherAlbums: OtherAlbum[];
  trend: TrendPoint[];
  topListeners: Listener[];
  shoutCount: number;
};

export type TrackAlbum = { id: number; title: string; image: string | null; artist: string };

export type TrackPage = {
  id: number;
  title: string;
  artist: string;
  duration: number;
  album: string | null;
  image: string | null;
  artistImage: string | null;
  listeners: number;
  playcount: number;
  userPlaycount: number;
  loved: boolean;
  loves: number;
  tags: TagCount[];
  myTags: string[];
  wiki: WikiVersion | null;
  albums: TrackAlbum[];
  similar: TopTrack[];
  trend: TrendPoint[];
  topListeners: Listener[];
  shoutCount: number;
};

export type TrackLinks = {
  appleMusic?: string;
  spotify?: string;
  tidal?: string;
  youtube?: string;
};
