import { ipOf, paging, Router, throttle } from "../http";
import { norm } from "../util";
import * as repo from "./repo";
import * as mbdb from "../metadata/mbdb";
import { rankArtists, rankTitles } from "./rank";
import type { FoundAlbum, FoundArtist, FoundTrack, SearchResults } from "../../shared/search";
import { wantBare, wantCovers } from "../metadata/wanted";
import { esOn, find } from "./es";

export const router = new Router();

router.get<SearchResults>("/api/search", async (c) => {
  const term = norm(c.q.get("q") || "");
  const type = c.q.get("type") || "all";
  const pg = paging(c.q, type === "all" ? 8 : 32, 50);
  if (!term) return { artists: [], albums: [], tracks: [], tags: [], users: [] };
  const who = c.user ? `u${c.user.id}` : ipOf(c.req);
  await throttle(`search:${who}`, 60, 60, "tooManySearchesWaitMoment");
  await throttle(`search-h:${who}`, 1000, 3600, "tooManySearchesTryAgain");
  const query = { term, limit: pg.limit, offset: pg.offset };
  const want = (t: string) => type === "all" || type === t;
  const viewer = c.user?.id ?? 0;
  const ours = {
    artists: async () =>
      wantBare("artist", await indexed("artists", query, repo.artistsById, repo.searchArtists), (r) => r.id),
    albums: async () =>
      wantBare("album", await indexed("albums", query, repo.albumsById, repo.searchAlbums), (r) => r.id),
    tracks: async () =>
      wantCovers(
        await indexed(
          "tracks",
          query,
          (ids) => repo.tracksById(ids, viewer),
          (q) => repo.searchTracks(q, viewer)
        ),
        (r) => r.id
      ),
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

type Query = { term: string; limit: number; offset: number };

// the search index when it answers, else a LIKE over the names
async function indexed<T>(
  kind: "artists" | "albums" | "tracks",
  q: Query,
  byId: (ids: number[]) => Promise<T[]>,
  scan: (q: Query) => Promise<T[]>
): Promise<T[]> {
  if (!esOn) return scan(q);
  let ids: number[];
  try {
    ids = (await find(`ours_${kind}`, q.term, q.limit, q.offset)).map((h) => Number(h.id));
  } catch (e) {
    console.error(e);
    return scan(q);
  }
  return ids.length ? byId(ids) : [];
}

const theirs = <T>(index: () => Promise<T[]>, scan: () => Promise<T[]>) =>
  esOn ? index().catch(() => (mbdb.mbdbOn ? scan() : [])) : scan();

// MusicBrainz gets 800ms (a fresh connection through the tunnel takes most of that); past that the page shows ours alone.
const inTime = <T>(ask: () => Promise<T[]>): Promise<T[]> =>
  Promise.race([ask().catch(() => []), new Promise<T[]>((r) => setTimeout(() => r([]), 800))]);
const askable = (offset: number) => (mbdb.mbdbOn || esOn) && offset === 0;

const titles = async (index: string, term: string) =>
  (await find<mbdb.IndexedTitle>(index, term, 60)).map((h) => mbdb.titleHit(h.doc));

async function withMusicBrainz(
  found: FoundArtist[],
  term: string,
  limit: number,
  offset: number
): Promise<FoundArtist[]> {
  if (!askable(offset)) return found;
  return rankArtists(
    found,
    await inTime(() =>
      theirs(
        () => find<mbdb.IndexedArtist>("mb_artists", term, 60).then((hs) => hs.map((h) => mbdb.artistHit(h.doc, term))),
        () => mbdb.searchArtists(term)
      )
    ),
    term,
    limit
  );
}

async function albumsToo(found: FoundAlbum[], term: string, limit: number, offset: number): Promise<FoundAlbum[]> {
  if (!askable(offset)) return found;
  const hits = await inTime(() =>
    theirs(
      () => titles("mb_albums", term),
      () => mbdb.searchAlbums(term)
    )
  );
  return rankTitles(found, hits, term, limit, (h) => ({
    id: 0,
    title: h.title,
    artist: h.artist,
    image: null,
    listeners: 0,
  }));
}

async function tracksToo(found: FoundTrack[], term: string, limit: number, offset: number): Promise<FoundTrack[]> {
  if (!askable(offset)) return found;
  const hits = await inTime(() =>
    theirs(
      () => titles("mb_tracks", term),
      () => mbdb.searchTracks(term)
    )
  );
  return rankTitles(found, hits, term, limit, (h) => ({
    id: 0,
    title: h.title,
    artist: h.artist,
    album: null,
    image: null,
    duration: h.seconds,
    listeners: 0,
    playcount: 0,
    loved: 0,
  }));
}
