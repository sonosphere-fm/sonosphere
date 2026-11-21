export type SpotifyLink = {
  account: { id: string; name: string };
  clientId: string;
  connectedAt: number;
  lastImport: number | null;
  imported: number;
  broken: string | null;
  playback: boolean;
};

export type SpotifyStatus = { enabled: false } | { enabled: true; redirectUri: string; link: SpotifyLink | null };
export type SpotifyConnectBody = { clientId: string; playback?: boolean };
export type SpotifyConnect = { url: string };
export type SpotifyPlayerToken = { token: string | null; expiresAt: number };
export type SpotifySynced = { imported: number; link: SpotifyLink };
