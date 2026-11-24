export type PlaylistCard = {
  id: number;
  title: string;
  description: string;
  createdAt: number;
  trackCount: number;
  image: string | null;
};
export type UserPlaylists = { items: PlaylistCard[] };

export type PlaylistTrack = {
  entryId: number;
  id: number;
  title: string;
  duration: number;
  artist: string;
  album: string | null;
  image: string | null;
  loved: number;
};
export type PlaylistPage = {
  id: number;
  title: string;
  description: string;
  owner: string;
  createdAt: number;
  mine: boolean;
  tracks: PlaylistTrack[];
};

export const TEMPLATE_IDS = ["repeat", "month", "favourites", "forgotten", "fresh", "yearAgo", "loved"] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export type PlaylistCreated = { id: number };
export type PlaylistOk = { ok: true };
