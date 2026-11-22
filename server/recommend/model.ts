import * as repo from "./repo";

type Loaded = { at: number; k: number; quality: number; ids: number[]; vecs: Float32Array; index: Map<number, number> };
let loaded: Loaded | null = null;
let checkedAt = 0;
let loading: Promise<Loaded | null> | null = null;

async function load(): Promise<Loaded | null> {
  const info = await repo.modelInfo();
  if (!info) return (loaded = null);
  if (loaded?.at === info.at) return loaded;
  const rows = await repo.artistVectors();
  const k = info.k;
  const vecs = new Float32Array(rows.length * k);
  rows.forEach((r, i) => vecs.set(r.vec.subarray(0, k), i * k));
  loaded = {
    at: info.at,
    k,
    quality: info.quality,
    ids: rows.map((r) => r.id),
    vecs,
    index: new Map(rows.map((r, i) => [r.id, i])),
  };
  return loaded;
}

async function current(): Promise<Loaded | null> {
  if (Date.now() - checkedAt < 60_000 && !loading) return loaded;
  checkedAt = Date.now();
  loading ??= load().finally(() => {
    loading = null;
  });
  return loading;
}

export function stale() {
  checkedAt = 0;
}

/** The user's predicted liking for every artist in the model, in the order of `ids`. */
export async function scoresFor(userId: number): Promise<{ model: Loaded; scores: Float32Array } | null> {
  const model = await current();
  if (!model || model.quality <= 0) return null;
  const u = await repo.userVector(userId);
  if (!u || u.length !== model.k) return null;
  const k = model.k;
  const n = model.ids.length;
  const scores = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    const at = i * k;
    for (let p = 0; p < k; p++) s += u[p]! * model.vecs[at + p]!;
    scores[i] = s;
  }
  return { model, scores };
}
