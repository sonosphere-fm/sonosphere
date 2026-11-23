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

export const TEMPLATES = {
  repeat: { title: "On repeat", blurb: "Your most played tracks of the last 7 days" },
  month: { title: "Top of the month", blurb: "Your most played tracks of the last 30 days" },
  favourites: { title: "All-time favourites", blurb: "Your 50 most played tracks ever" },
  forgotten: { title: "Forgotten favourites", blurb: "Tracks you played a lot but not in the last 3 months" },
  fresh: { title: "Fresh finds", blurb: "Tracks you first played in the last 30 days" },
  yearAgo: { title: "A year ago", blurb: "What you played most around this time last year" },
  loved: { title: "Loved tracks", blurb: "Your 50 most recently loved tracks" },
} as const;
export type TemplateId = keyof typeof TEMPLATES;
export const TEMPLATE_IDS = Object.keys(TEMPLATES) as TemplateId[];

export type PlaylistCreated = { id: number };
export type PlaylistOk = { ok: true };
