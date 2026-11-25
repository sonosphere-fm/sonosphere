import { ipOf, paging, Router, throttle } from "../http";
import { norm } from "../util";
import * as repo from "./repo";
import * as mbdb from "../metadata/mbdb";
import { rankArtists, rankTitles } from "./rank";
import type { FoundAlbum, FoundArtist, FoundTrack, SearchResults } from "../../shared/search";
import { wantBare, wantCovers } from "../metadata/wanted";
import { esOn, findAll, type Hit } from "./es";

export const router = new Router();

router.get<SearchResults>("/api/search", async (c) => {
  const term = norm(c.q.get("q") || "");
  const type = c.q.get("type") || "all";
  const pg = paging(c.q, type === "all" ? 8 : 32, 50);
  if (!term) return { artists: [], albums: [], tracks: [], tags: [], users: [] };
  const who = c.user ? `u${c.user.id}` : ipOf(c.req);
  await throttle(`search:${who}`, 60, 60, "tooManySearchesWaitMoment");
  await throttle(`search-h:${who}`, 1000, 3600, "tooManySearchesTryAgain");
  const q = { term, limit: pg.limit, offset: pg.offset };
  const want = (t: string) => type === "all" || type === t;
  const viewer = c.user?.id ?? 0;
  const found = await lookUp(KINDS.filter(want), q);
  const ours = <T>(kind: Kind, byId: (ids: number[]) => Promise<T[]>, scan: (q: Query) => Promise<T[]>) => {
    const hits = found.get(`ours_${kind}`);
    if (!hits) return scan(q);
    return hits.length ? byId(hits.map((h) => Number(h.id))) : Promise.resolve([]);
  };
  const theirs = <T, D>(kind: Kind, hit: (d: D) => T, scan: () => Promise<T[]>): Promise<T[]> => {
    if (q.offset) return Promise.resolve([]);
    const hits = found.get(`mb_${kind}`);
    if (hits) return Promise.resolve(hits.map((h) => hit(h.doc as D)));
    return mbdb.mbdbOn ? inTime(scan) : Promise.resolve([]);
  };

  const artists = async () => {
    const [mine, mb] = await Promise.all([
      ours("artists", repo.artistsById, repo.searchArtists),
      theirs(
        "artists",
        (d: mbdb.IndexedArtist) => mbdb.artistHit(d, term),
        () => mbdb.searchArtists(term)
      ),
    ]);
    const kept = wantBare("artist", mine, (r) => r.id);
    return q.offset ? kept : rankArtists(kept, mb, term, q.limit);
  };
  const albums = async () => {
    const [mine, mb] = await Promise.all([
      ours("albums", repo.albumsById, repo.searchAlbums),
      theirs("albums", mbdb.titleHit, () => mbdb.searchAlbums(term)),
    ]);
    const kept = wantBare("album", mine, (r) => r.id);
    if (q.offset) return kept;
    return rankTitles(kept, mb, term, q.limit, (h) => ({
      id: 0,
      title: h.title,
      artist: h.artist,
      image: null,
      listeners: 0,
    }));
  };
  const tracks = async () => {
    const [mine, mb] = await Promise.all([
      ours(
        "tracks",
        (ids) => repo.tracksById(ids, viewer),
        (x) => repo.searchTracks(x, viewer)
      ),
      theirs("tracks", mbdb.titleHit, () => mbdb.searchTracks(term)),
    ]);
    const kept = wantCovers(mine, (r) => r.id);
    if (q.offset) return kept;
    return rankTitles(kept, mb, term, q.limit, (h) => ({
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
  };
  const none = () => Promise.resolve([]);
  const [a, l, t, tags, users] = await Promise.all([
    want("artists") ? artists() : none(),
    want("albums") ? albums() : none(),
    want("tracks") ? tracks() : none(),
    want("tags") ? repo.searchTags(q) : none(),
    want("users") ? repo.searchUsers(q) : none(),
  ]);
  return { artists: a, albums: l, tracks: t, tags, users, ...pg };
});

type Query = { term: string; limit: number; offset: number };
type Kind = "artists" | "albums" | "tracks";
const KINDS: Kind[] = ["artists", "albums", "tracks"];

// Ours and MusicBrainz's for every kind wanted, in one trip to the search index. The first page asks ours for more
// than it shows so the ranking against MusicBrainz has some to choose from. A missing entry means look elsewhere.
async function lookUp(kinds: Kind[], q: Query): Promise<Map<string, Hit<unknown>[]>> {
  if (!esOn) return new Map();
  const asks = kinds.flatMap((k) => [
    { index: `ours_${k}`, term: q.term, size: q.offset ? q.limit : Math.max(q.limit, 30), from: q.offset },
    ...(q.offset ? [] : [{ index: `mb_${k}`, term: q.term, size: 60 }]),
  ]);
  const got = await findAll(asks).catch((e) => {
    console.error(e);
    return [];
  });
  return new Map(asks.flatMap((a, i) => (got[i] ? [[a.index, got[i]] as const] : [])));
}

// MusicBrainz's own copy gets 800ms (a fresh connection through the tunnel takes most of that); past that the page
// shows ours alone.
const inTime = <T>(ask: () => Promise<T[]>): Promise<T[]> =>
  Promise.race([ask().catch(() => []), new Promise<T[]>((r) => setTimeout(() => r([]), 800))]);
