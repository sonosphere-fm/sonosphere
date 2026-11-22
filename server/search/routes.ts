import { ipOf, paging, Router, throttle } from "../http";
import { norm } from "../util";
import * as repo from "./repo";
import * as mbdb from "../metadata/mbdb";
import { rankArtists, rankTitles } from "./rank";
import type { FoundAlbum, FoundArtist, FoundTrack, SearchResults } from "../../shared/search";
import { wantBare, wantCovers } from "../metadata/wanted";

export const router = new Router();

router.get<SearchResults>("/api/search", async c => {
  const term = norm(c.q.get("q") || "");
  const type = c.q.get("type") || "all";
  const pg = paging(c.q, type === "all" ? 8 : 32, 50);
  if (!term) return { artists: [], albums: [], tracks: [], tags: [], users: [] };
  const who = c.user ? `u${c.user.id}` : ipOf(c.req);
  await throttle(`search:${who}`, 60, 60, "Too many searches. Wait a moment and try again.");
  await throttle(`search-h:${who}`, 1000, 3600, "Too many searches. Try again later.");
  const query = { term, limit: pg.limit, offset: pg.offset };
  const want = (t: string) => type === "all" || type === t;
  const ours = {
    artists: async () => wantBare("artist", await repo.searchArtists(query), r => r.id),
    albums: async () => wantBare("album", await repo.searchAlbums(query), r => r.id),
    tracks: async () => wantCovers(await repo.searchTracks(query, c.user?.id ?? 0), r => r.id),
  };
  return {
    artists: want("artists") ? await withMusicBrainz(await ours.artists(), term, pg.limit, pg.offset) : [],
    albums: want("albums") ? await albumsToo(await ours.albums(), term, pg.limit, pg.offset) : [],
    tracks: want("tracks") ? await tracksToo(await ours.tracks(), term, pg.limit, pg.offset) : [],
    tags: want("tags") ? await repo.searchTags(query) : [],
    users: want("users") ? await repo.searchUsers(query) : [],
    ...pg,
  };
});

// MusicBrainz gets 800ms (a fresh connection through the tunnel takes most of that); past that the page shows ours alone.
const inTime = <T>(ask: () => Promise<T[]>): Promise<T[]> =>
  Promise.race([ask().catch(() => []), new Promise<T[]>(r => setTimeout(() => r([]), 800))]);
const askable = (offset: number) => mbdb.mbdbOn && offset === 0;

async function withMusicBrainz(found: FoundArtist[], term: string, limit: number, offset: number): Promise<FoundArtist[]> {
  if (!askable(offset)) return found;
  return rankArtists(found, await inTime(() => mbdb.searchArtists(term)), term, limit);
}

async function albumsToo(found: FoundAlbum[], term: string, limit: number, offset: number): Promise<FoundAlbum[]> {
  if (!askable(offset)) return found;
  const theirs = await inTime(() => mbdb.searchAlbums(term));
  return rankTitles(found, theirs, term, limit, h => ({ id: 0, title: h.title, artist: h.artist, image: null, listeners: 0 }));
}

async function tracksToo(found: FoundTrack[], term: string, limit: number, offset: number): Promise<FoundTrack[]> {
  if (!askable(offset)) return found;
  const theirs = await inTime(() => mbdb.searchTracks(term));
  return rankTitles(found, theirs, term, limit, h => ({
    id: 0, title: h.title, artist: h.artist, album: null, image: null, duration: h.seconds, listeners: 0, playcount: 0, loved: 0,
  }));
}
