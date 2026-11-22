import type { TrainResult } from "./als-worker";
import { exclusive } from "../kv";
import * as Sentry from "@sentry/bun";
import { stale } from "./model";
import * as repo from "./repo";

const MODEL_MARK = "taste_model_mark";

// these caps keep the work per artist or user constant however large the site grows
const FANS = 200;
const CANDIDATES = 400;
const KEEP = 40;
const MIN_SCORE = 0.12;
const SEED_ARTISTS = 100;
const SEED_LISTENERS = 200;
const SHORTLIST = 200;
const DEPTH = 1000;
const NEIGHBOURS = 50;
const MIN_NEIGHBOUR = 0.02;
const SEQ_SAMPLE = 2000;
// plays further apart than this are different sittings
const SEQ_GAP = 30 * 60;
const SEQ_TRUSTED = 30;
const FANS_TRUSTED = 20;

function jaccard<T>(a: Set<T>, b: Set<T>) {
  let shared = 0;
  for (const t of a) {
    if (b.has(t)) shared++;
  }
  return shared / (a.size + b.size - shared);
}

/**
 * Blends three 0-1 signals: shared listeners (cosine), listening order, and shared tags (Jaccard).
 * Tags carry an artist few people play and fade as listeners arrive; order counts in full once there is enough of it.
 */
async function refreshArtist(id: number) {
  const [{ own, fans, others }, seq] = await Promise.all([
    repo.artistOverlap(id, FANS, CANDIDATES),
    repo.sessionNeighbours(id, SEQ_SAMPLE, SEQ_GAP),
  ]);
  await repo.saveNorm("seq", id, seq.total);
  const dots = new Map(others.map((o) => [o.id, o.dot]));
  const order = new Map(seq.rows.map((r) => [r.id, r.w]));
  const topSequenced = seq.rows
    .sort((a, b) => b.w - a.w)
    .slice(0, CANDIDATES / 2)
    .map((r) => r.id);
  const ids = [...new Set([...dots.keys(), ...topSequenced])];
  if (!ids.length) {
    await repo.saveSimilar(id, []);
    return;
  }
  const [norms, seqNorms, tags] = await Promise.all([
    repo.norms("artist", ids),
    repo.storedNorms("seq", ids),
    repo.artistTagSets([id, ...ids]),
  ]);
  const mine = tags.get(id);
  const wOrder = 0.25 * Math.min(1, seq.total / SEQ_TRUSTED);
  const wTags = mine ? 0.3 * (1 - 0.75 * Math.min(1, fans / FANS_TRUSTED)) : 0;
  const wListen = 0.45;
  const sum = wListen + wOrder + wTags;

  // listening order comes out on a smaller scale (plays spread over many next artists), so it is measured against
  // this artist's strongest link
  const sequenceOf = (o: number) => {
    const w = order.get(o) ?? 0;
    if (!w || !seq.total) return 0;
    return Math.min(1, w / Math.sqrt(seq.total * (seqNorms.get(o) || seq.total)));
  };
  let strongest = 0;
  for (const o of ids) strongest = Math.max(strongest, sequenceOf(o));

  const scored: { id: number; score: number }[] = [];
  for (const o of ids) {
    const norm = norms.get(o);
    const dot = dots.get(o) ?? 0;
    const listen = norm && own ? Math.min(1, dot / (own * norm)) : 0;
    const sequence = strongest ? sequenceOf(o) / strongest : 0;
    const theirs = tags.get(o);
    const tag = mine && theirs ? jaccard(mine, theirs) : 0;
    const score = (wListen * listen + wOrder * sequence + wTags * tag) / sum;
    if (score > MIN_SCORE) scored.push({ id: o, score });
  }
  scored.sort((a, b) => b.score - a.score || a.id - b.id);
  await repo.saveSimilar(id, scored.slice(0, KEEP));
}

async function refreshUser(id: number) {
  const mine = await repo.topWeights(id, SEED_ARTISTS);
  // rough pass: who else listens most to what this user listens to most
  const rough = new Map<number, number>();
  for (const a of mine) {
    for (const l of await repo.topListeners(a.artist, SEED_LISTENERS)) {
      if (l.user !== id) rough.set(l.user, (rough.get(l.user) ?? 0) + a.w * l.w);
    }
  }
  const shortlist = [...rough.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, SHORTLIST)
    .map((e) => e[0]);
  if (!shortlist.length) {
    await repo.saveNeighbours(id, []);
    return;
  }
  const [dots, norms] = await Promise.all([
    repo.userOverlap(id, shortlist, DEPTH),
    repo.norms("user", [id, ...shortlist]),
  ]);
  const own = norms.get(id);
  const scored: { id: number; score: number }[] = [];
  for (const u of shortlist) {
    const dot = dots.get(u);
    const norm = norms.get(u);
    if (!dot || !norm || !own) continue;
    const score = Math.min(1, dot / (own * norm));
    if (score > MIN_NEIGHBOUR) scored.push({ id: u, score });
  }
  scored.sort((a, b) => b.score - a.score || a.id - b.id);
  await repo.saveNeighbours(id, scored.slice(0, NEIGHBOURS));
}

/** Works through the queue for at most `budgetMs`. Returns true when there is more left to do. */
export async function refreshTaste(budgetMs = 200): Promise<boolean> {
  await repo.queueChanged();
  const started = Date.now();
  for (;;) {
    const batch = await repo.due(50);
    if (!batch.length) return false;
    // norms first, so items in the batch are compared using each other's fresh figures
    await repo.refreshNorms(
      "artist",
      batch.filter((b) => b.kind === "artist").map((b) => b.id)
    );
    await repo.refreshNorms(
      "user",
      batch.filter((b) => b.kind === "user").map((b) => b.id)
    );
    for (const item of batch) {
      if (item.kind === "artist") await refreshArtist(item.id);
      else await refreshUser(item.id);
      await repo.done(item.kind, item.id);
      if (Date.now() - started > budgetMs) return true;
    }
  }
}

const RETRAIN_MIN = 30 * 60;
const RETRAIN_MAX = 6 * 60 * 60;
// retrain sooner once listening has grown by this share
const RETRAIN_GROWTH = 0.05;

let training: Promise<TrainResult | null> | null = null;

type WorkerReply = { ok: boolean; result?: TrainResult; error?: string };

function trainModel(): Promise<TrainResult | null> {
  training ??= (async () => {
    const mark = await repo.scrobbleMark();
    const worker = new Worker(new URL("./als-worker.ts", import.meta.url).href);
    try {
      const reply = await new Promise<WorkerReply>((resolve, reject) => {
        worker.onmessage = (ev) => resolve(ev.data);
        worker.onerror = (ev) => reject(ev);
        worker.postMessage({ url: repo.databaseUrl });
      });
      if (!reply.ok || !reply.result) {
        console.error("taste model:", reply.error);
        Sentry.captureException(new Error(reply.error || "taste model failed"));
        return null;
      }
      await repo.saveMeta(MODEL_MARK, String(mark));
      stale();
      return reply.result;
    } catch (e) {
      console.error("taste model:", e);
      Sentry.captureException(e);
      return null;
    } finally {
      worker.terminate();
      training = null;
    }
  })();
  return training;
}

async function modelDue(): Promise<boolean> {
  const info = await repo.modelInfo();
  const mark = await repo.scrobbleMark();
  if (!mark) return false;
  if (!info) return true;
  const last = Number(await repo.getMeta(MODEL_MARK)) || 0;
  const age = Math.floor(Date.now() / 1000) - info.at;
  if (mark <= last || age < RETRAIN_MIN) return false;
  return age > RETRAIN_MAX || mark - last >= Math.max(50, last * RETRAIN_GROWTH);
}

export function startTasteWorker() {
  const g = globalThis as { __spinTaste?: ReturnType<typeof setTimeout>; __spinModel?: ReturnType<typeof setInterval> };
  clearTimeout(g.__spinTaste);
  clearInterval(g.__spinModel);
  const tick = async () => {
    let more = false;
    try {
      more = (await exclusive("taste", 60_000, () => refreshTaste())) ?? false;
    } catch (e) {
      console.error(e);
      Sentry.captureException(e);
    }
    g.__spinTaste = setTimeout(tick, more ? 500 : 60_000);
  };
  g.__spinTaste = setTimeout(tick, 2000);
  // the lock outlasts the slowest training run; other processes pick the model up from the database
  const model = async () => {
    try {
      await exclusive("taste-model", 30 * 60_000, async () => {
        if (await modelDue()) await trainModel();
      });
    } catch (e) {
      console.error(e);
      Sentry.captureException(e);
    }
  };
  g.__spinModel = setInterval(model, 5 * 60_000);
  setTimeout(model, 20_000);
}
