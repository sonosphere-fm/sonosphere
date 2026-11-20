// Types shared by the server and the browser for tags.
import type { TopAlbum, TopTrack } from "./listening";
import type { WikiVersion } from "./wiki";

/** A tag on an item and how strongly it applies (the sum of everyone's votes). */
export type TagCount = { name: string; count: number };

/** An artist carrying a tag: `tagCount` is how strongly the tag applies to them. */
export type TaggedArtist = { id: number; name: string; image: number | null; tagCount: number; listeners: number; playcount: number };
/** GET /api/tag. `taggings` is how often the tag was applied and `taggers` by how many people; `related` are tags found on the same items. */
export type TagPage = {
  id: number; name: string; wiki: WikiVersion | null; taggings: number; taggers: number;
  artists: TaggedArtist[]; albums: TopAlbum[]; tracks: TopTrack[]; related: TagCount[];
};
/** GET /api/tags/suggest: tags to offer while typing, each with how often it is used. */
export type TagSuggestions = { items: TagCount[] };
/** POST /api/tags and /api/tags/remove: the item's tags afterwards and the ones the person themselves applied. */
export type ItemTags = { tags: TagCount[]; myTags: string[] };
