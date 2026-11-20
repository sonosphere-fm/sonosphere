// Builds stations. A station is an endless queue: the player asks for another batch whenever it is about to run
// out, and every batch is drawn at random, so no two are the same.
import { recommendedArtists, similarArtists } from "../recommend/service";
import * as repo from "./repo";
import type { StationTrack } from "../../shared/stations";

/** How many tracks a batch holds. */
const BATCH = 30;

/** Shuffles a list in place and returns it. */
function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)), x = a[i], y = a[j];
    if (x !== undefined && y !== undefined) { a[i] = y; a[j] = x; }
  }
  return a;
}

/** Random picks from someone's scrobbles, so what they play most comes up most. */
const libraryPicks = async (userId: number, viewerId: number, n: number): Promise<StationTrack[]> =>
  shuffle(await repo.randomPlays(userId, viewerId, n * 5)).slice(0, n);

/** `per` random tracks from each artist's `pool` most popular. */
async function artistPicks(artistIds: number[], viewerId: number, per: number, pool = 6): Promise<StationTrack[]> {
  if (!artistIds.length) return [];
  const byArtist = new Map<number, StationTrack[]>();
  for (const { artistId, ...track } of await repo.popularTracks(artistIds, viewerId, pool)) {
    const list = byArtist.get(artistId) ?? [];
    list.push(track); byArtist.set(artistId, list);
  }
  return [...byArtist.values()].flatMap(list => shuffle(list).slice(0, per));
}

/** Tracks from someone's own listening history. */
export const library = (userId: number, viewerId: number): Promise<StationTrack[]> => libraryPicks(userId, viewerId, BATCH);

/** Tracks by the artists recommended to a user, in random order. */
const recommendedPicks = async (userId: number, viewerId: number): Promise<StationTrack[]> =>
  shuffle(await artistPicks((await recommendedArtists(userId, 30)).map(a => a.id), viewerId, 2));

export const recommended = async (userId: number, viewerId: number): Promise<StationTrack[]> => (await recommendedPicks(userId, viewerId)).slice(0, BATCH);

/** Alternates between a user's own library and their recommendations. */
export async function mix(userId: number, viewerId: number): Promise<StationTrack[]> {
  const half = BATCH / 2, fresh = (await recommendedPicks(userId, viewerId)).slice(0, half), known = await libraryPicks(userId, viewerId, half);
  const out: StationTrack[] = [];
  for (let i = 0; i < half; i++) {
    const mine = known[i], theirs = fresh[i];
    if (mine) out.push(mine);
    if (theirs) out.push(theirs);
  }
  return out;
}

/** Opens with the artist, then wanders through the artists most like them. */
export async function artistRadio(artistId: number, viewerId: number): Promise<StationTrack[]> {
  const similar = (await similarArtists(artistId, 20)).map(s => s.id);
  const own = await artistPicks([artistId], viewerId, 5, 12), others = shuffle(await artistPicks(similar, viewerId, 2));
  return [...own.slice(0, 1), ...shuffle([...own.slice(1), ...others])].slice(0, BATCH);
}

/** Tracks by the artists a tag applies to most. */
export const tagRadio = async (tagId: number, viewerId: number): Promise<StationTrack[]> =>
  shuffle(await artistPicks(await repo.taggedArtists(tagId, 60), viewerId, 2)).slice(0, BATCH);
