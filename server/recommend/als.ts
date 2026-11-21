// Implicit-feedback ALS (Hu, Koren & Volinsky 2008): the dot product of a user and an artist vector reads as
// "how much would they like it", including artists only connected through a chain of other listeners.

// compressed rows in both directions: row u holds items uIdx[uPtr[u]..uPtr[u+1]), plays in uVal
type Matrix = {
  users: number;
  items: number;
  uPtr: Int32Array;
  uIdx: Int32Array;
  uVal: Float32Array;
  iPtr: Int32Array;
  iIdx: Int32Array;
  iVal: Float32Array;
};

// users × k and items × k, row-major
type Model = { k: number; x: Float32Array; y: Float32Array };

type Options = { k: number; iterations: number; lambda: number; alpha: number; seed: number };

/** Users and items are 0-based indexes. */
export function buildMatrix(users: number, items: number, u: Int32Array, i: Int32Array, plays: Float32Array): Matrix {
  const n = u.length;
  const index = (rows: number, row: Int32Array, col: Int32Array) => {
    const ptr = new Int32Array(rows + 1);
    const idx = new Int32Array(n);
    const val = new Float32Array(n);
    for (let e = 0; e < n; e++) ptr[row[e]! + 1]!++;
    for (let r = 0; r < rows; r++) ptr[r + 1]! += ptr[r]!;
    const fill = ptr.slice(0, rows);
    for (let e = 0; e < n; e++) {
      const at = fill[row[e]!]!++;
      idx[at] = col[e]!;
      val[at] = plays[e]!;
    }
    return { ptr, idx, val };
  };
  const a = index(users, u, i);
  const b = index(items, i, u);
  return { users, items, uPtr: a.ptr, uIdx: a.idx, uVal: a.val, iPtr: b.ptr, iIdx: b.idx, iVal: b.val };
}

/** Seeded, so a retrain on the same data gives the same model. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const confidence = (plays: number, alpha: number) => 1 + alpha * Math.log1p(plays);

/** Solves A·x = b in place for a symmetric positive-definite k×k A (Cholesky). Writes x into `out`. */
function solve(a: Float64Array, b: Float64Array, k: number, out: Float32Array, at: number) {
  for (let j = 0; j < k; j++) {
    let d = a[j * k + j]!;
    for (let p = 0; p < j; p++) d -= a[j * k + p]! * a[j * k + p]!;
    d = Math.sqrt(Math.max(d, 1e-12));
    a[j * k + j] = d;
    for (let r = j + 1; r < k; r++) {
      let s = a[r * k + j]!;
      for (let p = 0; p < j; p++) s -= a[r * k + p]! * a[j * k + p]!;
      a[r * k + j] = s / d;
    }
  }
  for (let r = 0; r < k; r++) {
    let s = b[r]!;
    for (let p = 0; p < r; p++) s -= a[r * k + p]! * b[p]!;
    b[r] = s / a[r * k + r]!;
  }
  for (let r = k - 1; r >= 0; r--) {
    let s = b[r]!;
    for (let p = r + 1; p < k; p++) s -= a[p * k + r]! * b[p]!;
    b[r] = s / a[r * k + r]!;
  }
  for (let r = 0; r < k; r++) out[at + r] = b[r]!;
}

/** Fixes `fixed` (fixedRows × k) and solves every row of `free` against it. */
function halfStep(rows: number, ptr: Int32Array, idx: Int32Array, val: Float32Array, fixed: Float32Array, fixedRows: number, free: Float32Array, o: Options) {
  const k = o.k;
  const gram = new Float64Array(k * k);
  const a = new Float64Array(k * k);
  const b = new Float64Array(k);
  for (let r = 0; r < fixedRows; r++) {
    const f = r * k;
    for (let p = 0; p < k; p++) {
      const v = fixed[f + p]!;
      if (!v) continue;
      for (let q = 0; q <= p; q++) gram[p * k + q]! += v * fixed[f + q]!;
    }
  }
  for (let r = 0; r < rows; r++) {
    a.set(gram);
    b.fill(0);
    for (let e = ptr[r]!; e < ptr[r + 1]!; e++) {
      const f = idx[e]! * k;
      const c = confidence(val[e]!, o.alpha);
      for (let p = 0; p < k; p++) {
        const v = fixed[f + p]!;
        const cv = (c - 1) * v;
        b[p]! += c * v;
        for (let q = 0; q <= p; q++) a[p * k + q]! += cv * fixed[f + q]!;
      }
    }
    for (let p = 0; p < k; p++) {
      a[p * k + p]! += o.lambda;
      for (let q = 0; q < p; q++) a[q * k + p] = a[p * k + q]!;
    }
    solve(a, b, k, free, r * k);
  }
}

export function train(m: Matrix, o: Options): Model {
  const rand = rng(o.seed);
  const k = o.k;
  const scale = 0.1 / Math.sqrt(k);
  const x = new Float32Array(m.users * k);
  const y = new Float32Array(m.items * k);
  for (let j = 0; j < y.length; j++) y[j] = (rand() - 0.5) * scale;
  for (let it = 0; it < o.iterations; it++) {
    halfStep(m.users, m.uPtr, m.uIdx, m.uVal, y, m.items, x, o);
    halfStep(m.items, m.iPtr, m.iIdx, m.iVal, x, m.users, y, o);
  }
  return { k, x, y };
}

function dot(ma: Float32Array, a: number, mb: Float32Array, b: number, k: number): number {
  let s = 0;
  const i = a * k;
  const j = b * k;
  for (let p = 0; p < k; p++) s += ma[i + p]! * mb[j + p]!;
  return s;
}

/**
 * For each held-out (user, item) pair: is the item in the user's top `n` among items they had not played?
 * Returns the hit rate next to that of simply suggesting the most popular artists, the bar to clear.
 */
export function evaluate(m: Matrix, model: Model, held: { user: number; item: number }[], n: number) {
  if (!held.length) return { model: 0, popular: 0, users: 0 };
  const pop = new Float64Array(m.items);
  for (let i = 0; i < m.items; i++) pop[i] = m.iPtr[i + 1]! - m.iPtr[i]!;
  const scores = new Float64Array(m.items);
  const seen = new Uint8Array(m.items);
  const rank = (score: Float64Array, target: number) => {
    const t = score[target]!;
    let above = 0;
    for (let i = 0; i < m.items; i++) {
      if (!seen[i] && i !== target && score[i]! > t) above++;
    }
    return above;
  };
  let hitModel = 0;
  let hitPop = 0;
  for (const h of held) {
    for (let e = m.uPtr[h.user]!; e < m.uPtr[h.user + 1]!; e++) seen[m.uIdx[e]!] = 1;
    for (let i = 0; i < m.items; i++) scores[i] = dot(model.x, h.user, model.y, i, model.k);
    if (rank(scores, h.item) < n) hitModel++;
    if (rank(pop, h.item) < n) hitPop++;
    for (let e = m.uPtr[h.user]!; e < m.uPtr[h.user + 1]!; e++) seen[m.uIdx[e]!] = 0;
  }
  return { model: hitModel / held.length, popular: hitPop / held.length, users: held.length };
}
