// Types shared by the server and the browser for obsessions: tracks a user has pinned to their profile.
/** `loved` is 1 when the person looking has loved the track, otherwise 0. */
export type Obsession = {
  id: number; comment: string; createdAt: number; trackId: number; title: string; duration: number; artist: string;
  album: string | null; image: string | null; loved: number;
};
export type Obsessions = { items: Obsession[] };
export type ObsessionCreated = { id: number };
export type ObsessionRemoved = { ok: true };
