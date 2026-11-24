import type { TopTrack } from "../../shared/listening";
import type { Neighbour, Recommendation, SimilarArtist, Taste, TasteLabel } from "../../shared/recommend";
import { topTracks } from "../listening/repo";
import { topTags } from "../tags/repo";
import { getJson, setJson } from "../kv";
import { now } from "../util";
import { dislikeWeight } from "./dislikes";
import { scoresFor } from "./model";
import * as repo from "./repo";
import { wantBare, wantCovers } from "../metadata/wanted";

export const similarArtists = async (artistId: number, limit = 12): Promise<SimilarArtist[]> =>
  wantBare("artist", await repo.similarArtistRows(artistId, limit), (r) => r.id);

/** More by the same artist, then the top tracks of the closest artists. */
export async function similarTracks(trackId: number, artistId: number, viewerId = 0, limit = 10): Promise<TopTrack[]> {
  const close = await repo.similarIds(artistId, 6);
  const sources: [number, number][] = [[artistId, 4], ...close.map((s): [number, number] => [s.id, 2])];
  const out: TopTrack[] = [];
  for (const [id, take] of sources) {
    const { items } = await topTracks({ artistId: id, viewerId, global: true }, take + 1);
    out.push(...items.filter((t) => t.id !== trackId).slice(0, take));
  }
  return wantCovers(out.slice(0, limit), (t) => t.id);
}

export async function neighbours(userId: number, limit = 20): Promise<Neighbour[]> {
  const rows = await repo.neighbourRows(userId, limit);
  return Promise.all(rows.map(async (r) => ({ ...r, shared: await repo.sharedArtists(userId, r.id, 3) })));
}

function label(score: number): TasteLabel {
  if (score > 0.85) return "Super";
  if (score > 0.7) return "Very High";
  if (score > 0.5) return "High";
  if (score > 0.3) return "Medium";
  if (score > 0.12) return "Low";
  return "Very Low";
}

export async function taste(a: number, b: number): Promise<Taste> {
  const score = await repo.userSimilarity(a, b);
  return { score, label: label(score), artists: await repo.sharedArtists(a, b, 5) };
}

// Recommendations blend three sources (similar artists, neighbours' listening, the learned model), each weighted by
// how much it has to go on, so a small site leans on similar artists and the others take over as listening builds up.

const DAY = 86_400;
const SEEDS = 50;
// played this often or more = already known, never suggested
const KNOWN = 3;
const POOL = 150;
const NEIGHBOURS_TRUSTED = 5;
// how strongly a pick is held back for resembling one already chosen
const VARIETY = 0.25;
// share of the seeds that comes from recent listening rather than all-time
const LATELY = 0.5;

type Seed = { id: number; name: string; w: number };

// part all-time, part recent (plays fade over about six weeks), so a change in taste shows within days
function seedsFor(mine: { id: number; name: string; c: number }[], recent: { id: number; w: number }[]): Seed[] {
  const lately = recent.length ? LATELY : 0;
  const maxAll = Math.log1p(mine[0]?.c ?? 1);
  const maxRecent = Math.log1p(Math.max(...recent.map((r) => r.w), 0));
  const w = new Map<number, number>();
  for (const r of mine.slice(0, 200)) w.set(r.id, ((1 - lately) * Math.log1p(r.c)) / maxAll);
  for (const r of recent) w.set(r.id, (w.get(r.id) ?? 0) + (lately * Math.log1p(r.w)) / (maxRecent || 1));
  const names = new Map(mine.map((r) => [r.id, r.name]));
  return [...w.entries()]
    .filter(([id]) => names.has(id))
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, SEEDS)
    .map(([id, weight]) => ({ id, name: names.get(id)!, w: weight }));
}

/** Divides every value by the largest, so sources on different scales can be blended. */
function scaled(m: Map<number, number>): Map<number, number> {
  let top = 0;
  for (const v of m.values()) {
    if (v > top) top = v;
  }
  if (top <= 0) return new Map();
  return new Map([...m].map(([k, v]) => [k, Math.max(0, v) / top]));
}

// big names resemble everything; this halves them at about a million listeners
const popularity = (listeners: number) => 1 / (1 + 0.15 * Math.log1p(listeners));

type Ranked = { recommendations: Recommendation[]; seeds: Seed[] };

// "not interested": the item never comes back, and its artist is held back by the summed weight of everything
// dismissed by them (an artist dismissed outright, or enough of their songs, is gone altogether)
export type Feedback = {
  stamp: string;
  tracks: Set<number>;
  albums: Set<number>;
  gone: Set<number>;
  weight: Map<number, number>;
};

export async function feedback(userId: number): Promise<Feedback> {
  const rows = await repo.dislikes(userId);
  const at = now();
  const weight = new Map<number, number>();
  const gone = new Set<number>();
  const tracks = new Set<number>();
  const albums = new Set<number>();
  let latest = 0;
  for (const r of rows) {
    weight.set(r.artist, (weight.get(r.artist) ?? 0) + dislikeWeight(r.kind, r.at, at));
    if (r.kind === "artist") gone.add(r.artist);
    else if (r.kind === "album") albums.add(r.id);
    else tracks.add(r.id);
    latest = Math.max(latest, r.at);
  }
  for (const [id, w] of weight) {
    if (w >= 1) gone.add(id);
  }
  return { stamp: `${rows.length}.${latest}`, tracks, albums, gone, weight };
}

const heldBack = (fb: Feedback, artistId: number) => Math.max(0, 1 - (fb.weight.get(artistId) ?? 0));

// artists close to a dismissed one lose up to this share, scaled by how close and how firmly dismissed
const SPREAD = 0.5;
type Via = Recommendation["via"];

// cheap enough to redo every few minutes, too slow to redo on every page view
const RANKED_FOR = 10 * 60_000;

async function rankArtists(userId: number, limit: number, fb: Feedback): Promise<Ranked> {
  const key = `recs:${userId}:${limit}:${fb.stamp}`;
  const cached = await getJson<Ranked>(key);
  if (cached) return cached;
  const ranked = await rankFresh(userId, limit, fb);
  await setJson(key, ranked, RANKED_FOR);
  return ranked;
}

async function rankFresh(userId: number, limit: number, fb: Feedback): Promise<Ranked> {
  const [mine, recent] = await Promise.all([
    repo.library(userId),
    repo.recentWeights(userId, now() - 180 * DAY, 45 * DAY, 5000),
  ]);
  if (!mine.length) return { recommendations: [], seeds: [] };
  const known = new Map(mine.map((r) => [r.id, r.c]));
  const fresh = (id: number) => (known.get(id) ?? 0) < KNOWN && !fb.gone.has(id);
  const seeds = seedsFor(mine, recent);
  const seedById = new Map(seeds.map((s) => [s.id, s]));
  const [similar, nbRows, nbCount, learned, nearDisliked] = await Promise.all([
    repo.similarFor(seeds.map((s) => s.id)),
    repo.neighbourArtists(userId, 30, 100),
    repo.neighbourCount(userId),
    scoresFor(userId),
    repo.similarFor([...fb.weight.keys()]),
  ]);
  const hold = new Map<number, number>();
  for (const m of nearDisliked) {
    const firm = Math.min(1, fb.weight.get(m.from) ?? 0);
    hold.set(m.id, (hold.get(m.id) ?? 1) * (1 - SPREAD * firm * m.score));
  }

  // artists like yours
  const item = new Map<number, number>();
  const because = new Map<number, Map<string, number>>();
  for (const m of similar) {
    const seed = seedById.get(m.from);
    if (!seed || !fresh(m.id)) continue;
    const gain = seed.w * m.score;
    item.set(m.id, (item.get(m.id) ?? 0) + gain);
    let b = because.get(m.id);
    if (!b) {
      b = new Map();
      because.set(m.id, b);
    }
    b.set(seed.name, (b.get(seed.name) ?? 0) + gain);
  }

  // listeners like you
  const nb = new Map(nbRows.filter((r) => fresh(r.id)).map((r) => [r.id, r.w]));

  // the learned model: its own top picks, and its view of everything the other two suggested
  const als = new Map<number, number>();
  if (learned) {
    const { model, scores } = learned;
    const order: number[] = [];
    for (let i = 0; i < scores.length; i++) {
      if (fresh(model.ids[i]!)) order.push(i);
    }
    order.sort((a, b) => scores[b]! - scores[a]!);
    for (const i of order.slice(0, POOL)) als.set(model.ids[i]!, scores[i]!);
    for (const id of [...item.keys(), ...nb.keys()]) {
      const i = model.index.get(id);
      if (i !== undefined) als.set(id, scores[i]!);
    }
  }

  const wItem = 1;
  const wNb = 0.6 * Math.min(1, nbCount / NEIGHBOURS_TRUSTED);
  const wAls = 0.8 * (learned?.model.quality ?? 0);
  const sItem = scaled(item);
  const sNb = scaled(nb);
  const sAls = scaled(als);
  const blend = new Map<number, { score: number; via: Via }>();
  for (const id of new Set([...sItem.keys(), ...sNb.keys(), ...sAls.keys()])) {
    const parts: [Via, number][] = [
      ["similar", wItem * (sItem.get(id) ?? 0)],
      ["neighbours", wNb * (sNb.get(id) ?? 0)],
      ["taste", wAls * (sAls.get(id) ?? 0)],
    ];
    const score = parts.reduce((t, p) => t + p[1], 0);
    if (score <= 0) continue;
    const strongest = parts.reduce((a, b) => (b[1] > a[1] ? b : a));
    blend.set(id, { score, via: strongest[0] });
  }
  const pool = [...blend.entries()].sort((a, b) => b[1].score - a[1].score || a[0] - b[0]).slice(0, POOL);
  const cards = new Map((await repo.artistCards(pool.map(([id]) => id))).map((c) => [c.id, c]));
  const rel = new Map(
    pool
      .filter(([id]) => cards.has(id))
      .map(([id, e]) => [id, e.score * popularity(cards.get(id)!.listeners) * heldBack(fb, id) * (hold.get(id) ?? 1)])
  );
  const relScaled = scaled(rel);

  // variety: pick greedily, holding back candidates close to ones already picked
  const ids = [...relScaled.keys()];
  const inPool = new Set(ids);
  const close = new Map<string, number>();
  for (const s of await repo.similarFor(ids)) {
    if (inPool.has(s.id)) close.set(`${s.from}:${s.id}`, s.score);
  }
  const sim = (a: number, b: number) => Math.max(close.get(`${a}:${b}`) ?? 0, close.get(`${b}:${a}`) ?? 0);
  const topSeeds = (id: number) => {
    const reasons = [...(because.get(id) ?? new Map<string, number>()).entries()];
    return reasons.sort((x, y) => y[1] - x[1]).map((x) => x[0]);
  };
  const picked: number[] = [];
  const left = new Set(ids);
  while (picked.length < limit && left.size) {
    let best = -1;
    let bestScore = -Infinity;
    for (const id of left) {
      let nearest = 0;
      for (const p of picked) nearest = Math.max(nearest, sim(id, p));
      const s = relScaled.get(id)! - VARIETY * nearest;
      if (s > bestScore || (s === bestScore && id < best)) {
        best = id;
        bestScore = s;
      }
    }
    left.delete(best);
    picked.push(best);
  }

  const recommendations = await Promise.all(
    picked.map(async (id): Promise<Recommendation> => {
      const tags = (await topTags("artist", id, 3)).map((t) => t.name);
      return { ...cards.get(id)!, because: topSeeds(id).slice(0, 2), tags, via: blend.get(id)!.via };
    })
  );
  return { recommendations, seeds };
}

export async function recommendedArtists(userId: number, limit = 24): Promise<Recommendation[]> {
  return wantBare("artist", (await rankArtists(userId, limit, await feedback(userId))).recommendations, (r) => r.id);
}

/**
 * Top tracks of the recommended artists, tracks neighbours play that you never have, and a few unheard ones by
 * artists you already love. At most two per artist.
 */
export async function recommendations(
  userId: number,
  viewerId: number,
  artistLimit = 30,
  trackLimit = 30,
  fb?: Feedback
): Promise<{ artists: Recommendation[]; tracks: TopTrack[] }> {
  fb ??= await feedback(userId);
  const { recommendations: artists, seeds } = await rankArtists(userId, artistLimit, fb);
  if (!artists.length && !seeds.length) return { artists: [], tracks: [] };
  const score = new Map<number, number>();
  const artistOf = new Map<number, number>();
  const add = (id: number, artist: number, s: number) => {
    if (fb.tracks.has(id) || fb.gone.has(artist)) return;
    score.set(id, (score.get(id) ?? 0) + s * heldBack(fb, artist));
    artistOf.set(id, artist);
  };
  const rankWeight = [1, 0.75, 0.55];
  const byRank = (r: number) => rankWeight[r - 1] ?? 0.5;

  const recIds = artists.slice(0, 20).map((a) => a.id);
  const recRank = new Map(recIds.map((id, i) => [id, 1 - i / Math.max(1, recIds.length)]));
  const favs = seeds.slice(0, 10);
  const [recTop, nbTracks, nbCount, favTop] = await Promise.all([
    repo.unplayedTopTracks(recIds, userId, 3),
    repo.neighbourTracks(userId, 30, 50),
    repo.neighbourCount(userId),
    repo.unplayedTopTracks(
      favs.map((s) => s.id),
      userId,
      2
    ),
  ]);
  for (const t of recTop) {
    add(t.id, t.artist, (recRank.get(t.artist) ?? 0) * byRank(t.r));
  }

  const nbTop = Math.max(0, ...nbTracks.map((t) => t.w));
  const wNb = 0.9 * Math.min(1, nbCount / NEIGHBOURS_TRUSTED);
  if (nbTop > 0) {
    for (const t of nbTracks) add(t.id, t.artist, (wNb * t.w) / nbTop);
  }

  const favW = new Map(favs.map((s) => [s.id, s.w]));
  for (const t of favTop) {
    add(t.id, t.artist, 0.35 * (favW.get(t.artist) ?? 0) * byRank(t.r));
  }

  const perArtist = new Map<number, number>();
  const chosen: number[] = [];
  const ranked = [...score.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  for (const [id] of ranked) {
    const a = artistOf.get(id)!;
    const n = perArtist.get(a) ?? 0;
    if (n >= 2) continue;
    perArtist.set(a, n + 1);
    chosen.push(id);
    if (chosen.length >= trackLimit) break;
  }
  const cards = new Map((await repo.trackCards(chosen, viewerId)).map((c) => [c.id, c]));
  const tracks = chosen.map((id) => cards.get(id)).filter((t): t is TopTrack => !!t);
  return { artists: wantBare("artist", artists, (a) => a.id), tracks: wantCovers(tracks, (t) => t.id) };
}
