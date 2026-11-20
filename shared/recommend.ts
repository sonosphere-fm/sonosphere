// Shapes for taste matching sent to the browser.
import type { PublicUser } from "./users";

export type SimilarArtist = { id: number; name: string; image: number | null; match: number; listeners: number };
export type SharedArtist = { name: string; image: number | null; weight: number };
export type Neighbour = PublicUser & { match: number; shared: SharedArtist[] };
export type TasteLabel = "Super" | "Very High" | "High" | "Medium" | "Low" | "Very Low";
export type Taste = { score: number; label: TasteLabel; artists: SharedArtist[] };
/** An artist suggested to a user, with the artists of theirs it resembles. */
/** `via` says which signal put it first: artists like yours, listeners like you, or the learned taste model. */
export type Recommendation = { id: number; name: string; image: number | null; listeners: number; because: string[]; tags: string[]; via: "similar" | "neighbours" | "taste" };
