import type { PublicUser } from "./users";

export type SimilarArtist = { id: number; name: string; image: string | null; match: number; listeners: number };
type SharedArtist = { name: string; image: string | null; weight: number };
export type Neighbour = PublicUser & { match: number; shared: SharedArtist[] };
export type TasteLabel = "Super" | "Very High" | "High" | "Medium" | "Low" | "Very Low";
export type Taste = { score: number; label: TasteLabel; artists: SharedArtist[] };
export type Recommendation = {
  id: number;
  name: string;
  image: string | null;
  listeners: number;
  because: string[];
  tags: string[];
  via: "similar" | "neighbours" | "taste";
};

export type DislikeKind = "artist" | "album" | "track";
