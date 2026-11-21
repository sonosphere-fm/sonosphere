// Types shared by the server and the browser for scrobbling from Spotify.

/** The linked Spotify account as the owner sees it in settings. */
export type SpotifyLink = {
  account: { id: string; name: string };
  /** The listener's own Spotify app that the link goes through. */
  clientId: string;
  connectedAt: number;
  /** When plays were last imported, and how many in total. */
  lastImport: number | null;
  imported: number;
  /** Why importing stopped (access was revoked on Spotify's side), or null while it is working. */
  broken: string | null;
  /** Whether the link allows playing music here through Spotify (the listener asked for it; it needs Premium). */
  playback: boolean;
};

/** GET /api/spotify: `enabled` is false when this site does not offer Spotify. `redirectUri` goes in the listener's Spotify app. */
export type SpotifyStatus = { enabled: false } | { enabled: true; redirectUri: string; link: SpotifyLink | null };
/** POST /api/spotify/connect with the client ID of the listener's own Spotify app. */
export type SpotifyConnectBody = { clientId: string; playback?: boolean };
/** POST /api/spotify/connect: where to send the browser to approve access. */
export type SpotifyConnect = { url: string };
/** POST /api/spotify/sync: plays added by an immediate import. */
/** GET /api/spotify/token: a short-lived token for the browser player, or null when the link can't play. */
export type SpotifyPlayerToken = { token: string | null; expiresAt: number };
export type SpotifySynced = { imported: number; link: SpotifyLink };
