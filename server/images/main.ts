export type MainCandidate = {
  entryId: number;
  imageId: string;
  score: number;
  createdAt: number;
};

/**
 * Highest net score wins. A tie keeps the current main picture. Without a usable current
 * picture, the earliest candidate among the leaders wins. Returns null for an empty gallery.
 */
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
