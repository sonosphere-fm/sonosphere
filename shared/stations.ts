// Types shared by the server and the browser for stations: endless queues the player draws tracks from.
export type StationTrack = { id: number; title: string; duration: number; artist: string; album: string | null; image: string | null; loved: number };
/** GET /api/station: the next batch of tracks. The player asks again when it is about to run out. */
export type Station = { title: string; tracks: StationTrack[] };
