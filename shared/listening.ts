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

export type Report = {
  type: "week" | "year";
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
