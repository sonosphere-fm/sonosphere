// Keeps similar artists and neighbours up to date in the background. Nothing here is recomputed wholesale: new
// scrobbles put the artists and users they touch on a queue, and each run works through a slice of that queue.
import type { TrainResult } from "./als-worker";
import { stale } from "./model";
import * as repo from "./repo";

const MODEL_MARK = "taste_model_mark";

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
const SEQ_SAMPLE = 2000;   // latest plays of an artist read for what came right before and after
const SEQ_GAP = 30 * 60;   // plays further apart than this are different sittings
const SEQ_TRUSTED = 30;    // listening-order evidence needed before it counts in full
const FANS_TRUSTED = 20;   // listeners needed before shared listening outweighs tags

/**
 * Three signals, each 0-1: the same people play both (cosine over plays), people play them one after the other
 * (listening order), and they share tags (Jaccard). Their weights shift to what is known: tags carry an artist few
 * people play and fade as listeners arrive (they are broad: a genre, not a sound), and listening order only counts
 * in full once there is enough of it.
 */
async function refreshArtist(id: number) {
  const [{ own, fans, others }, seq] = await Promise.all([repo.artistOverlap(id, FANS, CANDIDATES), repo.sessionNeighbours(id, SEQ_SAMPLE, SEQ_GAP)]);
  await repo.saveNorm("seq", id, seq.total);
  const dots = new Map(others.map(o => [o.id, o.dot])), order = new Map(seq.rows.map(r => [r.id, r.w]));
  const ids = [...new Set([...dots.keys(), ...seq.rows.sort((a, b) => b.w - a.w).slice(0, CANDIDATES / 2).map(r => r.id)])];
  if (!ids.length) return repo.saveSimilar(id, []);
  const [norms, seqNorms, tags] = await Promise.all([repo.norms("artist", ids), repo.storedNorms("seq", ids), repo.artistTagSets([id, ...ids])]);
  const mine = tags.get(id);
  const wOrder = 0.25 * Math.min(1, seq.total / SEQ_TRUSTED), wTags = mine ? 0.3 * (1 - 0.75 * Math.min(1, fans / FANS_TRUSTED)) : 0;
  const wListen = 0.45, sum = wListen + wOrder + wTags;
  // Listening order comes out on a smaller scale than the other two (plays spread over many next artists), so it is
  // measured against this artist's strongest link.
  let strongest = 0;
  const sequenceOf = (o: number) => { const w = order.get(o) ?? 0; return w && seq.total ? Math.min(1, w / Math.sqrt(seq.total * (seqNorms.get(o) || seq.total))) : 0; };
  for (const o of ids) strongest = Math.max(strongest, sequenceOf(o));
  const scored: { id: number; score: number }[] = [];
  for (const o of ids) {
    const norm = norms.get(o), dot = dots.get(o) ?? 0;
    const listen = norm && own ? Math.min(1, dot / (own * norm)) : 0;
    const sequence = strongest ? sequenceOf(o) / strongest : 0;
    let tag = 0;
    const theirs = tags.get(o);
    if (mine && theirs) { let shared = 0; for (const t of mine) if (theirs.has(t)) shared++; tag = shared / (mine.size + theirs.size - shared); }
    const score = (wListen * listen + wOrder * sequence + wTags * tag) / sum;
    if (score > MIN_SCORE) scored.push({ id: o, score });
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

// ---------- the learned model (als.ts), trained on its own thread ----------
const RETRAIN_MIN = 30 * 60;       // never more often than this
const RETRAIN_MAX = 6 * 60 * 60;   // and at least this often while anything has been scrobbled
const RETRAIN_GROWTH = 0.05;       // or sooner, once listening has grown by this share

let training: Promise<TrainResult | null> | null = null;

/** Trains a new model in a worker thread and stores it. Resolves with how it went, or null if it failed. */
export function trainModel(): Promise<TrainResult | null> {
  training ??= (async () => {
    const mark = await repo.scrobbleMark();
    const worker = new Worker(new URL("./als-worker.ts", import.meta.url).href);
    try {
      const reply = await new Promise<{ ok: boolean; result?: TrainResult; error?: string }>((resolve, reject) => {
        worker.onmessage = ev => resolve(ev.data);
        worker.onerror = ev => reject(ev);
        worker.postMessage({ path: repo.dbPath });
      });
      if (!reply.ok || !reply.result) { console.error("taste model:", reply.error); return null; }
      await repo.saveMeta(MODEL_MARK, String(mark));
      stale();
      return reply.result;
    } catch (e) { console.error("taste model:", e); return null; }
    finally { worker.terminate(); training = null; }
  })();
  return training;
}

/** Whether there is enough new listening since the last model to be worth training another. */
async function modelDue(): Promise<boolean> {
  const info = await repo.modelInfo(), mark = await repo.scrobbleMark();
  if (!mark) return false;
  if (!info) return true;
  const last = Number(await repo.getMeta(MODEL_MARK)) || 0, age = Math.floor(Date.now() / 1000) - info.at;
  if (mark <= last || age < RETRAIN_MIN) return false;
  return age > RETRAIN_MAX || mark - last >= Math.max(50, last * RETRAIN_GROWTH);
}

/** Runs the refresh now and then for as long as the server is up: often while there is a backlog, lazily otherwise. */
export function startTasteWorker() {
  const g = globalThis as { __spinTaste?: ReturnType<typeof setTimeout>; __spinModel?: ReturnType<typeof setInterval> };
  clearTimeout(g.__spinTaste);
  clearInterval(g.__spinModel);
  const tick = async () => {
    let more = false;
    try { more = await refreshTaste(); } catch (e) { console.error(e); }
    g.__spinTaste = setTimeout(tick, more ? 500 : 60_000);
  };
  g.__spinTaste = setTimeout(tick, 2000);
  const model = async () => { try { if (await modelDue()) await trainModel(); } catch (e) { console.error(e); } };
  g.__spinModel = setInterval(model, 5 * 60_000);
  setTimeout(model, 20_000);
}
