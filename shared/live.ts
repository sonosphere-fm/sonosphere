export type ListeningEvent = { t: "listening"; userId: number; name: string; change: "scrobbles" | "nowplaying" };
export type ListenMessage = { t: "listen"; names: string[] };

export type PublicNowPlaying = {
  t: "nowplaying";
  user: { username: string };
  nowPlaying: {
    trackId: number;
    title: string;
    artist: string;
    album: string | null;
    duration: number;
    startedAt: number;
    imageUrl: string | null;
  } | null;
};
