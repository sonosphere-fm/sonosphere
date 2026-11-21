// The slow lane of the metadata filler (service.ts): entries shown somewhere as a card with no picture yet. Lists call
// want() as they're served; the background loop drains the queue with capacity page lookups don't need.
// Its own module, needing only kv, so any list in the site can call it without import cycles.
import { setAdd } from "../kv";

export const WANTED = "meta-wanted";
export type Wanted = "artist" | "album" | "track";

/** Queues entries for filling. Cheap: the queue holds each once, and ones already done are skipped when it's drained. */
export function want(kind: Wanted, ids: (number | null | undefined)[]): void {
  const members = [...new Set(ids.filter((i): i is number => !!i))].map(i => `${kind}:${i}`);
  setAdd(WANTED, members, 20_000).catch(() => {});
}

/** Queues the cards in a list that have no picture, and hands the list back. */
export function wantBare<T extends { image: string | null }>(kind: Wanted, rows: T[], id: (r: T) => number): T[] {
  want(kind, rows.filter(r => !r.image).map(id));
  return rows;
}
