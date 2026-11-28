export type ListeningPlay = {
  id: number;
  track: number;
  album: number | null;
  artist: number;
  title: string;
  artistName: string;
  albumTitle: string | null;
  at: number;
  source: string;
  duration: number | null;
};

export type ListeningPair = {
  current: ListeningPlay;
  previous: ListeningPlay;
  gap: number;
  minimum: number;
};

export type ListeningEvidence = {
  from: number;
  to: number;
  capturedAt: number;
  score: number;
  points: number;
  weight: number;
  count: number;
  pairs: ListeningPair[];
};

export type ListeningInvestigation = {
  captured: ListeningEvidence | null;
  from: number;
  to: number;
  pairs: ListeningPair[];
};
