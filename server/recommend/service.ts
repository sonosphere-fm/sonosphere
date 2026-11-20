// Taste matching as the rest of the site uses it: similar artists and tracks, listening neighbours, compatibility
// between two people, and artist recommendations. Scores are kept up to date in the background (worker.ts);
// everything here reads what the worker stored, except `taste`, which is exact and worked out on request.
import type { TopTrack } from "../../shared/listening";
import type { Neighbour, Recommendation, SimilarArtist, Taste, TasteLabel } from "../../shared/recommend";
import { topTracks } from "../listening/repo";
import { topTags } from "../tags/repo";
import * as repo from "./repo";

export const similarArtists = (artistId: number, limit = 12): Promise<SimilarArtist[]> => repo.similarArtistRows(artistId, limit);

/** Tracks to play next to one track: more by the same artist, then the top tracks of the artists closest to them. */
export async function similarTracks(trackId: number, artistId: number, viewerId = 0, limit = 10): Promise<TopTrack[]> {
  const close = await repo.similarIds(artistId, 6);
  const sources: [number, number][] = [[artistId, 4], ...close.map((s): [number, number] => [s.id, 2])];
  const out: TopTrack[] = [];
  for (const [id, take] of sources) {
    const { items } = await topTracks({ artistId: id, viewerId, global: true }, take + 1);
    out.push(...items.filter(t => t.id !== trackId).slice(0, take));
  }
  return out.slice(0, limit);
}

export async function neighbours(userId: number, limit = 20): Promise<Neighbour[]> {
  const rows = await repo.neighbourRows(userId, limit);
  return Promise.all(rows.map(async r => ({ ...r, shared: await repo.sharedArtists(userId, r.id, 3) })));
}

const label = (score: number): TasteLabel =>
  score > 0.85 ? "Super" : score > 0.7 ? "Very High" : score > 0.5 ? "High" : score > 0.3 ? "Medium" : score > 0.12 ? "Low" : "Very Low";

export async function taste(a: number, b: number): Promise<Taste> {
  const score = await repo.userSimilarity(a, b);
  return { score, label: label(score), artists: await repo.sharedArtists(a, b, 5) };
}

/** Artists a user has not really heard yet, ranked by how close they sit to what the user plays most. */
export async function recommendedArtists(userId: number, limit = 24): Promise<Recommendation[]> {
  const mine = await repo.library(userId);
  const known = new Map(mine.map(r => [r.id, r.c]));
  const seeds = mine.slice(0, 40), seedById = new Map(seeds.map(s => [s.id, s]));
  const matches = await repo.similarFor(seeds.map(s => s.id));
  const scores = new Map<number, { score: number; because: Map<string, number> }>();
  for (const m of matches) {
    const seed = seedById.get(m.from);
    if (!seed || (known.get(m.id) ?? 0) >= 3) continue;
    const gain = Math.log(1 + seed.c) * m.score, e = scores.get(m.id) ?? { score: 0, because: new Map<string, number>() };
    e.score += gain; e.because.set(seed.name, gain); scores.set(m.id, e);
  }
  const ranked = [...scores.entries()].sort((x, y) => y[1].score - x[1].score || x[0] - y[0]).slice(0, limit);
  const cards = new Map((await repo.artistCards(ranked.map(([id]) => id))).map(c => [c.id, c]));
  const out: Recommendation[] = [];
  for (const [id, e] of ranked) {
    const card = cards.get(id);
    if (!card) continue;
    const because = [...e.because.entries()].sort((x, y) => y[1] - x[1]).slice(0, 2).map(x => x[0]);
    out.push({ ...card, because, tags: (await topTags("artist", id, 3)).map(t => t.name) });
  }
  return out;
}
