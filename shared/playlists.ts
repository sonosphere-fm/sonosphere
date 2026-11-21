// Types shared by the server and the browser for playlists.
/** A playlist in a user's list. `image` is the cover of its first track. */
export type PlaylistCard = { id: number; title: string; description: string; createdAt: number; trackCount: number; image: string | null };
export type UserPlaylists = { items: PlaylistCard[] };

/** A track on a playlist. `entryId` names this place on the list (a track can be on it twice); `loved` is 1 or 0 for the person looking. */
export type PlaylistTrack = { entryId: number; id: number; title: string; duration: number; artist: string; album: string | null; image: string | null; loved: number };
/** GET /api/playlist/:id. `owner` is a username; `mine` is true for the owner. */
export type PlaylistPage = { id: number; title: string; description: string; owner: string; createdAt: number; mine: boolean; tracks: PlaylistTrack[] };

export type PlaylistCreated = { id: number };
export type PlaylistOk = { ok: true };
