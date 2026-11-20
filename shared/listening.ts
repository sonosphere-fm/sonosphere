// Types shared by the server and the browser for scrobbles and the statistics drawn from them.
// `image` fields are image ids; `loved` is 1 when the person looking has loved the track, otherwise 0.
export type TopArtist = { id: number; name: string; image: number | null; playcount: number; listeners: number };
export type TopAlbum = { id: number; title: string; image: number | null; artist: string; playcount: number; listeners: number };
export type TopTrack = { id: number; title: string; duration: number; artist: string; album: string | null; image: number | null; playcount: number; listeners: number; loved: number };
/** One page of a ranking, with the size of the whole ranking. */
export type TopList<T> = { items: T[]; total: number };

export type RecentTrack = {
  id: number; playedAt: number; trackId: number; title: string; duration: number; artist: string; album: string | null; image: number | null;
  user: string; userImage: number | null; loved: number;
};
export type NowPlaying = { trackId: number; title: string; duration: number; artist: string; album: string | null; image: number | null; startedAt: number; loved: number };
export type Counts = { playcount: number; listeners: number; artists: number; albums: number; tracks: number };
/** One bar of a chart: `k` is the bucket (an hour, a week number, "YYYY-MM-DD" or "YYYY-MM") and `c` its plays. */
export type SeriesPoint = { k: string | number; c: number };

/** A listening report for one week or one year. */
export type Report = {
  type: "week" | "year"; offset: number; start: number; end: number;
  totals: Counts; previous: Counts; listeningSeconds: number;
  buckets: { key: string; label: string; count: number }[];
  clock: { hour: number; count: number }[];
  topArtists: TopArtist[]; topAlbums: TopAlbum[]; topTracks: TopTrack[];
  newArtists: { count: number; items: { name: string; image: number | null; playcount: number }[] };
  tags: { name: string; weight: number }[];
};

/** What became of one submitted play. */
export type ScrobbleResult =
  | { accepted: false; reason: string }
  | { accepted: true; id: number; artistId: number; trackId: number; albumId: number | null };

// ---------- scrobbling and loving tracks ----------
/** POST /api/scrobble: `details` explains the first 20 plays that were not taken, echoing what was sent. */
export type ScrobbleResponse = { accepted: number; ignored: number; details: { artist?: unknown; track?: unknown; reason: string }[] };
/** Which plays an edit covers: only the one, or every play of yours sharing its track, album or artist. */
export type EditScope = "track" | "album" | "artist";
/** GET /api/scrobble/:id/scope: how many of your plays each scope would change. */
export type ScopeCounts = { track: number; album: number; artist: number };
/** PATCH /api/scrobble/:id */
export type ScrobbleEdited = { ok: true; changed: number };
/** POST /api/scrobbles/delete */
export type ScrobblesDeleted = { deleted: number };
/** POST /api/love/import */
export type LovedImported = { accepted: number; ignored: number };
/** POST /api/love */
export type Loved = { loved: boolean };
/** One line of a scrobble or loved-track export (GET /api/me/export). */
export type ExportRow = { artist: string; album: string | null; track: string; timestamp: number };
