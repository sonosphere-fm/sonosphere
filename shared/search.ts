import type { TagCount } from "./tags";
import type { Paging, PublicUser } from "./users";

export type FoundArtist = { id: number; name: string; image: string | null; listeners: number };
export type FoundAlbum = { id: number; title: string; image: string | null; artist: string; listeners: number };
export type FoundTrack = {
  id: number; title: string; duration: number; artist: string; album: string | null; image: string | null;
  listeners: number; playcount: number; loved: number;
};
export type FoundUser = PublicUser & { playcount: number };
export type SearchResults = { artists: FoundArtist[]; albums: FoundAlbum[]; tracks: FoundTrack[]; tags: TagCount[]; users: FoundUser[] } & Partial<Paging>;
