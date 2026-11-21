// Types shared by the server and the browser for the music catalogue.
import type { TopList, TopTrack } from "./listening";
import type { SimilarArtist } from "./recommend";
import type { TagCount } from "./tags";
import type { PublicUser } from "./users";
import type { WikiVersion } from "./wiki";

/** The kinds of thing a tag, wiki, shout or report can be attached to. */
export type ItemType = "artist" | "album" | "track" | "tag" | "user" | "event" | "journal";

// ---------- artist, album and track pages ----------
// `image` fields are image ids. `loved` on a track row is 1 when the person looking has loved it, otherwise 0.

/** One page of a list, with the paging that produced it. */
export type Paged<T> = TopList<T> & { limit: number; page: number; offset: number };
/** Plays in one week of a page's listening trend. `start` is the Monday the week begins, in Unix seconds. */
export type TrendPoint = { start: number; count: number };
/** Someone who plays an item, with how often. */
export type Listener = PublicUser & { playcount: number };

/** A concert or festival as shown in a list. `status` is the viewer's own answer, if they gave one. */
export type EventSummary = {
  id: number; title: string; venue: string; city: string; country: string; startsAt: number; description: string; url: string;
  creator: string | null; going: number; interested: number; status: string | null;
  artists: { name: string; image: string | null }[];
};

/** An album in an artist's discography. `releaseDate` is "YYYY", "YYYY-MM" or "YYYY-MM-DD" when known. */
export type ArtistAlbum = { id: number; title: string; image: string | null; releaseDate: string | null; artist: string; listeners: number; trackCount: number };
export type ArtistAlbumWithPlays = { id: number; title: string; image: string | null; releaseDate: string | null; artist: string; playcount: number; listeners: number; trackCount: number };
export type LatestAlbum = { id: number; title: string; image: string | null; releaseDate: string | null; artist: string };

/** GET /api/artist */
export type ArtistPage = {
  id: number; name: string; mbid: string; image: string | null; listeners: number; playcount: number; userPlaycount: number;
  tags: TagCount[]; myTags: string[]; wiki: WikiVersion | null;
  similar: SimilarArtist[]; topTracks: TopTrack[]; topAlbums: ArtistAlbum[]; latestAlbum: LatestAlbum | null; weekTrack: TopTrack | null;
  albumCount: number; trackCount: number;
  trend: TrendPoint[]; topListeners: Listener[]; events: EventSummary[]; shoutCount: number;
};
/** GET /api/artist/tracks */
export type ArtistTracks = Paged<TopTrack>;
/** GET /api/artist/albums */
export type ArtistAlbums = Paged<ArtistAlbumWithPlays>;
/** GET /api/artist/similar: each match with the names of its strongest tags. */
export type ArtistSimilar = { items: (SimilarArtist & { tags: string[] })[] };
/** GET /api/artist/listeners */
export type ArtistListeners = { items: Listener[] };

/** A track in an album's track list. */
export type AlbumTrack = {
  position: number; id: number; title: string; duration: number; artist: string; album: string; image: string | null;
  playcount: number; listeners: number; loved: number;
};
export type OtherAlbum = { id: number; title: string; image: string | null; artist: string; listeners: number };

/** GET /api/album. `duration` is the length of the whole track list in seconds. */
export type AlbumPage = {
  id: number; title: string; artist: string; mbid: string; image: string | null; releaseDate: string | null; artistImage: string | null;
  listeners: number; playcount: number; userPlaycount: number;
  tags: TagCount[]; myTags: string[]; wiki: WikiVersion | null;
  tracks: AlbumTrack[]; duration: number; otherAlbums: OtherAlbum[];
  trend: TrendPoint[]; topListeners: Listener[]; shoutCount: number;
};

/** An album a track appears on. */
export type TrackAlbum = { id: number; title: string; image: string | null; artist: string };

/** GET /api/track. `album` and `image` come from the track's main album; `loves` counts everyone who loved it. */
export type TrackPage = {
  id: number; title: string; artist: string; duration: number; album: string | null; image: string | null; artistImage: string | null;
  listeners: number; playcount: number; userPlaycount: number; loved: boolean; loves: number;
  tags: TagCount[]; myTags: string[]; wiki: WikiVersion | null;
  albums: TrackAlbum[]; similar: TopTrack[];
  trend: TrendPoint[]; topListeners: Listener[]; shoutCount: number;
};
