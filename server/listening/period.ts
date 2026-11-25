import { now } from "../util";

/** An end time this far out means "no end". */
export const FOREVER = 4102444800;
const PERIODS: Record<string, number> = { "7day": 7, "1month": 30, "3month": 90, "6month": 180, "12month": 365 };

/** [from, to] in Unix seconds: explicit `from`/`to` win, otherwise `period` (default all time). */
export function range(q: URLSearchParams): [number, number] {
  const from = Number(q.get("from"));
  const to = Number(q.get("to"));
  if (from || to) return [from || 0, to || FOREVER];
  const days = PERIODS[q.get("period") || "overall"];
  return [days ? now() - days * 86400 : 0, FOREVER];
}

// For listeners who hide recent plays, so stacking narrow windows can't rebuild their history.
export function coarse([from, to]: [number, number]): [number, number] {
  return [from - (from % 3600), to === FOREVER ? to : to - (to % 3600)];
}
