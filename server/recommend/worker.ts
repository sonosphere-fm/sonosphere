// Keeps similar artists and neighbours up to date in the background. Nothing here is recomputed wholesale: new
// scrobbles put the artists and users they touch on a queue, and each run works through a slice of that queue.
import * as repo from "./repo";

// How much is read per artist or user. These caps are what keep the work per item constant.
const FANS = 200;          // an artist is compared through its 200 keenest listeners
const CANDIDATES = 400;    // artists considered as matches for one artist
const KEEP = 40;           // matches stored per artist
const MIN_SCORE = 0.12;
const SEED_ARTISTS = 100;  // a user's neighbours are looked for among listeners of their top 100 artists
const SEED_LISTENERS = 200;
const SHORTLIST = 200;     // candidate neighbours scored exactly
const DEPTH = 1000;        // artists per user used for that exact score
const NEIGHBOURS = 50;
const MIN_NEIGHBOUR = 0.02;

/** Half listening overlap (cosine), half shared tags (Jaccard). */
async function refreshArtist(id: number) {
  const { own, others } = await repo.artistOverlap(id, FANS, CANDIDATES);
  if (!others.length || !own) return repo.saveSimilar(id, []);
  const [norms, tags] = await Promise.all([repo.norms("artist", others.map(o => o.id)), repo.artistTagSets([id, ...others.map(o => o.id)])]);
  const mine = tags.get(id);
  const scored: { id: number; score: number }[] = [];
  for (const o of others) {
    const norm = norms.get(o.id);
    let score = norm ? Math.min(1, o.dot / (own * norm)) * 0.5 : 0;
    const theirs = tags.get(o.id);
    if (mine && theirs) { let shared = 0; for (const t of mine) if (theirs.has(t)) shared++; score += 0.5 * shared / (mine.size + theirs.size - shared); }
    if (score > MIN_SCORE) scored.push({ id: o.id, score });
  }
  scored.sort((a, b) => b.score - a.score || a.id - b.id);
  repo.saveSimilar(id, scored.slice(0, KEEP));
}

async function refreshUser(id: number) {
  const mine = await repo.topWeights(id, SEED_ARTISTS);
  // Rough pass: who else listens most to the things this user listens to most.
  const rough = new Map<number, number>();
  for (const a of mine) for (const l of await repo.topListeners(a.artist, SEED_LISTENERS)) if (l.user !== id) rough.set(l.user, (rough.get(l.user) ?? 0) + a.w * l.w);
  const shortlist = [...rough.entries()].sort((a, b) => b[1] - a[1]).slice(0, SHORTLIST).map(e => e[0]);
  if (!shortlist.length) return repo.saveNeighbours(id, []);
  // Exact pass over the shortlist.
  const [dots, norms] = await Promise.all([repo.userOverlap(id, shortlist, DEPTH), repo.norms("user", [id, ...shortlist])]);
  const own = norms.get(id);
  const scored: { id: number; score: number }[] = [];
  for (const u of shortlist) {
    const dot = dots.get(u), norm = norms.get(u);
    if (!dot || !norm || !own) continue;
    const score = Math.min(1, dot / (own * norm));
    if (score > MIN_NEIGHBOUR) scored.push({ id: u, score });
  }
  scored.sort((a, b) => b.score - a.score || a.id - b.id);
  repo.saveNeighbours(id, scored.slice(0, NEIGHBOURS));
}

/**
 * Works through the queue for at most `budgetMs`, so a busy period never holds up requests for long.
 * Returns true when there is more left to do.
 */
export async function refreshTaste(budgetMs = 200): Promise<boolean> {
  repo.queueChanged();
  const started = Date.now();
  for (;;) {
    const batch = await repo.due(50);
    if (!batch.length) return false;
    // Lengths first, for the whole batch, so items in it are compared using each other's fresh figures.
    await repo.refreshNorms("artist", batch.filter(b => b.kind === "artist").map(b => b.id));
    await repo.refreshNorms("user", batch.filter(b => b.kind === "user").map(b => b.id));
    for (const item of batch) {
      if (item.kind === "artist") await refreshArtist(item.id); else await refreshUser(item.id);
      await repo.done(item.kind, item.id);
      if (Date.now() - started > budgetMs) return true;
    }
  }
}

/** Runs the refresh now and then for as long as the server is up: often while there is a backlog, lazily otherwise. */
export function startTasteWorker() {
  const g = globalThis as { __spinTaste?: ReturnType<typeof setTimeout> };
  clearTimeout(g.__spinTaste);
  const tick = async () => {
    let more = false;
    try { more = await refreshTaste(); } catch (e) { console.error(e); }
    g.__spinTaste = setTimeout(tick, more ? 500 : 60_000);
  };
  g.__spinTaste = setTimeout(tick, 2000);
}
