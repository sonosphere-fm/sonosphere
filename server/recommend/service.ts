// Taste matching as the rest of the site uses it: similar artists and tracks, listening neighbours, compatibility
// between two people, and artist recommendations. Scores are kept up to date in the background (worker.ts);
// everything here reads what the worker stored, except `taste`, which is exact and worked out on request.
import type { TopTrack } from "../../shared/listening";
import type { Neighbour, Recommendation, SimilarArtist, Taste, TasteLabel } from "../../shared/recommend";
import { topTracks } from "../listening/repo";
import { topTags } from "../tags/repo";
import { now } from "../util";
import { scoresFor } from "./model";
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

// ---------- recommendations ----------
// Three sources each suggest artists: artists like the ones you play (similar artists), what your closest listening
// neighbours play, and the learned taste model (model.ts). Each is scaled to 0-1 and blended with a weight that grows
// with how much that source has to go on, so a small site leans on similar artists and tags and the others take over
// as listening builds up. The blend is then nudged away from the biggest names and spread out so it is not ten
// versions of one artist.

const DAY = 86_400;
const SEEDS = 50;               // a user's artists the suggestions grow from
const KNOWN = 3;                // played this often or more = already known, never suggested
const POOL = 150;               // best candidates that go on to the popularity and variety pass
const NEIGHBOURS_TRUSTED = 5;   // neighbours needed before their picks count in full
const VARIETY = 0.25;           // how strongly a pick is held back for resembling one already chosen
const LATELY = 0.5;             // share of the seeds that comes from recent listening rather than all-time

type Seed = { id: number; name: string; w: number };

/**
 * What a user's suggestions grow from: their top artists, part all-time and part lately (plays fade over about
 * six weeks), so a change in taste shows within days instead of waiting to overtake years of history.
 */
async function seedsFor(userId: number, mine: { id: number; name: string; c: number }[]): Promise<Seed[]> {
  const recent = await repo.recentWeights(userId, now() - 180 * DAY, 45 * DAY, 5000);
  const lately = recent.length ? LATELY : 0, maxAll = Math.log1p(mine[0]?.c ?? 1), maxRecent = Math.log1p(Math.max(...recent.map(r => r.w), 0));
  const w = new Map<number, number>();
  for (const r of mine.slice(0, 200)) w.set(r.id, (1 - lately) * Math.log1p(r.c) / maxAll);
  for (const r of recent) w.set(r.id, (w.get(r.id) ?? 0) + lately * Math.log1p(r.w) / (maxRecent || 1));
  const names = new Map(mine.map(r => [r.id, r.name]));
  return [...w.entries()].filter(([id]) => names.has(id)).sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, SEEDS)
    .map(([id, weight]) => ({ id, name: names.get(id) ?? "", w: weight }));
}

/** Divides every value by the largest, so sources on different scales can be blended. */
function scaled(m: Map<number, number>): Map<number, number> {
  let top = 0;
  for (const v of m.values()) if (v > top) top = v;
  if (top <= 0) return new Map();
  return new Map([...m].map(([k, v]) => [k, Math.max(0, v) / top]));
}

/** Big names resemble everything, so they would crowd every list: this lowers them gently (about half at a million listeners). */
const popularity = (listeners: number) => 1 / (1 + 0.15 * Math.log1p(listeners));

type Ranked = { recommendations: Recommendation[]; seeds: Seed[] };

async function rankArtists(userId: number, limit: number): Promise<Ranked> {
  const mine = await repo.library(userId);
  if (!mine.length) return { recommendations: [], seeds: [] };
  const known = new Map(mine.map(r => [r.id, r.c]));
  const fresh = (id: number) => (known.get(id) ?? 0) < KNOWN;
  const seeds = await seedsFor(userId, mine), seedById = new Map(seeds.map(s => [s.id, s]));

  // 1. Artists like yours.
  const item = new Map<number, number>(), because = new Map<number, Map<string, number>>();
  for (const m of await repo.similarFor(seeds.map(s => s.id))) {
    const seed = seedById.get(m.from);
    if (!seed || !fresh(m.id)) continue;
    const gain = seed.w * m.score;
    item.set(m.id, (item.get(m.id) ?? 0) + gain);
    let b = because.get(m.id);
    if (!b) because.set(m.id, (b = new Map()));
    b.set(seed.name, (b.get(seed.name) ?? 0) + gain);
  }
  // 2. Listeners like you.
  const [nbRows, nbCount] = await Promise.all([repo.neighbourArtists(userId, 30, 100), repo.neighbourCount(userId)]);
  const nb = new Map(nbRows.filter(r => fresh(r.id)).map(r => [r.id, r.w]));
  // 3. The learned model: its own top picks, and its view of everything the other two suggested.
  const als = new Map<number, number>(), learned = await scoresFor(userId);
  if (learned) {
    const { model, scores } = learned, order: number[] = [];
    for (let i = 0; i < scores.length; i++) if (fresh(model.ids[i]!)) order.push(i);
    order.sort((a, b) => scores[b]! - scores[a]!);
    for (const i of order.slice(0, POOL)) als.set(model.ids[i]!, scores[i]!);
    for (const id of [...item.keys(), ...nb.keys()]) { const i = model.index.get(id); if (i !== undefined) als.set(id, scores[i]!); }
  }

  const wItem = 1, wNb = 0.6 * Math.min(1, nbCount / NEIGHBOURS_TRUSTED), wAls = 0.8 * (learned?.model.quality ?? 0);
  const sItem = scaled(item), sNb = scaled(nb), sAls = scaled(als);
  const blend = new Map<number, { score: number; via: Recommendation["via"] }>();
  for (const id of new Set([...sItem.keys(), ...sNb.keys(), ...sAls.keys()])) {
    const parts: [Recommendation["via"], number][] = [["similar", wItem * (sItem.get(id) ?? 0)], ["neighbours", wNb * (sNb.get(id) ?? 0)], ["taste", wAls * (sAls.get(id) ?? 0)]];
    const score = parts.reduce((t, p) => t + p[1], 0);
    if (score > 0) blend.set(id, { score, via: parts.reduce((a, b) => (b[1] > a[1] ? b : a))[0] });
  }
  const pool = [...blend.entries()].sort((a, b) => b[1].score - a[1].score || a[0] - b[0]).slice(0, POOL);
  const cards = new Map((await repo.artistCards(pool.map(([id]) => id))).map(c => [c.id, c]));
  const rel = new Map(pool.filter(([id]) => cards.has(id)).map(([id, e]) => [id, e.score * popularity(cards.get(id)?.listeners ?? 0)]));
  const relScaled = scaled(rel);

  // Variety: pick greedily, holding back candidates close to ones already picked.
  const ids = [...relScaled.keys()], inPool = new Set(ids), close = new Map<string, number>();
  for (const s of await repo.similarFor(ids)) if (inPool.has(s.id)) close.set(`${s.from}:${s.id}`, s.score);
  const sim = (a: number, b: number) => Math.max(close.get(`${a}:${b}`) ?? 0, close.get(`${b}:${a}`) ?? 0);
  const topSeed = (id: number) => [...(because.get(id) ?? new Map<string, number>()).entries()].sort((x, y) => y[1] - x[1]).map(x => x[0]);
  const picked: number[] = [], left = new Set(ids);
  while (picked.length < limit && left.size) {
    let best = -1, bestScore = -Infinity;
    for (const id of left) {
      let nearest = 0;
      for (const p of picked) nearest = Math.max(nearest, sim(id, p));
      const s = (relScaled.get(id) ?? 0) - VARIETY * nearest;
      if (s > bestScore || (s === bestScore && id < best)) { best = id; bestScore = s; }
    }
    left.delete(best);
    picked.push(best);
  }

  const recommendations: Recommendation[] = [];
  for (const id of picked) {
    const card = cards.get(id);
    if (!card) continue;
    recommendations.push({ ...card, because: topSeed(id).slice(0, 2), tags: (await topTags("artist", id, 3)).map(t => t.name), via: blend.get(id)?.via ?? "similar" });
  }
  return { recommendations, seeds };
}

/** Artists a user has not really heard yet, best first. */
export async function recommendedArtists(userId: number, limit = 24): Promise<Recommendation[]> {
  return (await rankArtists(userId, limit)).recommendations;
}

/**
 * Tracks to try: the best-known tracks of the recommended artists, tracks your neighbours play that you never have,
 * and a few you have not heard by artists you already love. At most two per artist.
 */
export async function recommendations(userId: number, viewerId: number, artistLimit = 30, trackLimit = 30): Promise<{ artists: Recommendation[]; tracks: TopTrack[] }> {
  const { recommendations: artists, seeds } = await rankArtists(userId, artistLimit);
  if (!artists.length && !seeds.length) return { artists, tracks: [] };
  const score = new Map<number, number>(), artistOf = new Map<number, number>();
  const add = (id: number, artist: number, s: number) => { score.set(id, (score.get(id) ?? 0) + s); artistOf.set(id, artist); };
  const rankWeight = [1, 0.75, 0.55];
  const recIds = artists.slice(0, 20).map(a => a.id), recRank = new Map(recIds.map((id, i) => [id, 1 - i / Math.max(1, recIds.length)]));
  for (const t of await repo.unplayedTopTracks(recIds, userId, 3)) add(t.id, t.artist, (recRank.get(t.artist) ?? 0) * (rankWeight[t.r - 1] ?? 0.5));
  const [nbTracks, nbCount] = await Promise.all([repo.neighbourTracks(userId, 30, 50), repo.neighbourCount(userId)]);
  const nbTop = Math.max(0, ...nbTracks.map(t => t.w)), wNb = 0.9 * Math.min(1, nbCount / NEIGHBOURS_TRUSTED);
  for (const t of nbTracks) if (nbTop > 0) add(t.id, t.artist, wNb * t.w / nbTop);
  const favs = seeds.slice(0, 10), favW = new Map(favs.map(s => [s.id, s.w]));
  for (const t of await repo.unplayedTopTracks(favs.map(s => s.id), userId, 2)) add(t.id, t.artist, 0.35 * (favW.get(t.artist) ?? 0) * (rankWeight[t.r - 1] ?? 0.5));

  const perArtist = new Map<number, number>(), chosen: number[] = [];
  for (const [id] of [...score.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])) {
    const a = artistOf.get(id) ?? 0, n = perArtist.get(a) ?? 0;
    if (n >= 2) continue;
    perArtist.set(a, n + 1);
    chosen.push(id);
    if (chosen.length >= trackLimit) break;
  }
  const cards = new Map((await repo.trackCards(chosen, viewerId)).map(c => [c.id, c]));
  return { artists, tracks: chosen.map(id => cards.get(id)).filter((t): t is TopTrack => !!t) };
}
