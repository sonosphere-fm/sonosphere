export type MainCandidate = {
  entryId: number;
  imageId: string;
  score: number;
  createdAt: number;
};

export function pickMain(candidates: readonly MainCandidate[], current: string | null): MainCandidate | null {
  if (!candidates.length) return null;
  let top = -Infinity;
  for (const c of candidates) if (c.score > top) top = c.score;
  if (current) {
    const held = candidates.find((c) => c.imageId === current && c.score === top);
    if (held) return held;
  }
  let best: MainCandidate | null = null;
  for (const c of candidates) {
    if (c.score !== top) continue;
    if (!best || c.createdAt < best.createdAt || (c.createdAt === best.createdAt && c.entryId < best.entryId)) {
      best = c;
    }
  }
  return best;
}
