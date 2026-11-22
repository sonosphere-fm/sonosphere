import type { TopAlbum, TopTrack } from "./listening";
import type { WikiVersion } from "./wiki";

export type TagCount = { name: string; count: number };

export type TaggedArtist = {
  id: number;
  name: string;
  image: string | null;
  tagCount: number;
  listeners: number;
  playcount: number;
};
export type TagPage = {
  id: number;
  name: string;
  wiki: WikiVersion | null;
  taggings: number;
  taggers: number;
  artists: TaggedArtist[];
  albums: TopAlbum[];
  tracks: TopTrack[];
  related: TagCount[];
};
export type TagSuggestions = { items: TagCount[] };
export type ItemTags = { tags: TagCount[]; myTags: string[] };
