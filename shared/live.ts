export type ListeningEvent = { t: "listening"; userId: number; name: string; change: "scrobbles" | "nowplaying" };
export type ListenMessage = { t: "listen"; names: string[] };
