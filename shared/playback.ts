export const PLAYBACK_SOURCES = ["youtube", "music", "spotify"] as const;
export type PlaybackSource = (typeof PLAYBACK_SOURCES)[number];

export const isPlaybackSource = (v: unknown): v is PlaybackSource =>
  typeof v === "string" && (PLAYBACK_SOURCES as readonly string[]).includes(v);
