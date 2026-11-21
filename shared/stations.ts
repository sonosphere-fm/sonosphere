export type StationTrack = { id: number; title: string; duration: number; artist: string; album: string | null; image: string | null; loved: number };
export type Station = { title: string; tracks: StationTrack[] };
