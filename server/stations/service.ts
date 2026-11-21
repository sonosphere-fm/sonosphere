import { recommendedArtists, similarArtists } from "../recommend/service";
import * as repo from "./repo";
import type { StationTrack } from "../../shared/stations";

const BATCH = 30;

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

const libraryPicks = async (userId: number, viewerId: number, n: number): Promise<StationTrack[]> =>
  shuffle(await repo.randomPlays(userId, viewerId, n * 5)).slice(0, n);

async function artistPicks(artistIds: number[], viewerId: number, per: number, pool = 6): Promise<StationTrack[]> {
  if (!artistIds.length) return [];
  const byArtist = new Map<number, StationTrack[]>();
  const popular = await repo.popularTracks(artistIds, viewerId, pool);
  for (const { artistId, ...track } of popular) {
    const list = byArtist.get(artistId) ?? [];
    list.push(track);
    byArtist.set(artistId, list);
  }
  return [...byArtist.values()].flatMap(list => shuffle(list).slice(0, per));
}

export const library = (userId: number, viewerId: number): Promise<StationTrack[]> =>
  libraryPicks(userId, viewerId, BATCH);

async function recommendedPicks(userId: number, viewerId: number): Promise<StationTrack[]> {
  const artists = await recommendedArtists(userId, 30);
  return shuffle(await artistPicks(artists.map(a => a.id), viewerId, 2));
}

export const recommended = async (userId: number, viewerId: number): Promise<StationTrack[]> =>
  (await recommendedPicks(userId, viewerId)).slice(0, BATCH);

// Alternates between the user's own library and their recommendations.
export async function mix(userId: number, viewerId: number): Promise<StationTrack[]> {
  const half = BATCH / 2;
  const fresh = (await recommendedPicks(userId, viewerId)).slice(0, half);
  const known = await libraryPicks(userId, viewerId, half);
  const out: StationTrack[] = [];
  for (let i = 0; i < half; i++) {
    const mine = known[i];
    const theirs = fresh[i];
    if (mine) out.push(mine);
    if (theirs) out.push(theirs);
  }
  return out;
}

// Opens with the artist, then wanders through the artists most like them.
export async function artistRadio(artistId: number, viewerId: number): Promise<StationTrack[]> {
  const similar = (await similarArtists(artistId, 20)).map(s => s.id);
  const own = await artistPicks([artistId], viewerId, 5, 12);
  const others = shuffle(await artistPicks(similar, viewerId, 2));
  return [...own.slice(0, 1), ...shuffle([...own.slice(1), ...others])].slice(0, BATCH);
}

export async function tagRadio(tagId: number, viewerId: number): Promise<StationTrack[]> {
  const artistIds = await repo.taggedArtists(tagId, 60);
  return shuffle(await artistPicks(artistIds, viewerId, 2)).slice(0, BATCH);
}
