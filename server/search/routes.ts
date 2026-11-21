// Search across artists, albums, tracks, tags and people.
import { ipOf, paging, Router, throttle } from "../http";
import { norm } from "../util";
import * as repo from "./repo";
import type { SearchResults } from "../../shared/search";

export const router = new Router();

// `type` picks one list (artists, albums, tracks, tags or users); without it every list comes back, each shorter.
router.get<SearchResults>("/api/search", async c => {
  const term = norm(c.q.get("q") || ""), type = c.q.get("type") || "all", pg = paging(c.q, type === "all" ? 8 : 32, 50);
  if (!term) return { artists: [], albums: [], tracks: [], tags: [], users: [] };
  const who = c.user ? `u${c.user.id}` : ipOf(c.req);
  await throttle(`search:${who}`, 60, 60, "Too many searches. Wait a moment and try again.");
  await throttle(`search-h:${who}`, 1000, 3600, "Too many searches. Try again later.");
  const query = { term, limit: pg.limit, offset: pg.offset }, want = (t: string) => type === "all" || type === t;
  return {
    artists: want("artists") ? await repo.searchArtists(query) : [],
    albums: want("albums") ? await repo.searchAlbums(query) : [],
    tracks: want("tracks") ? await repo.searchTracks(query, c.user?.id ?? 0) : [],
    tags: want("tags") ? await repo.searchTags(query) : [],
    users: want("users") ? await repo.searchUsers(query) : [],
    ...pg,
  };
});
