// Spotify doesn't publish its limits and changes them without notice, so they are learned from every connected app at
// once: a 429 lowers the shared ceiling for that window to below where the app was refused, and apps working up against
// a ceiling for a while without one raise it again.
import { bump, getJson, setJson } from "../kv";
import { now } from "../util";

export type Group = "player" | "catalogue";
type Window = "burst" | "day";
type Ceiling = { limit: number | null; strikeAt: number; raisedAt: number };
type Model = Record<Group, Record<Window, Ceiling>>;

const MODEL = "spotify-quota";
const KEEP = 180 * 86400_000;
const WINDOWS = ["burst", "day"] as const;
const LENGTH: Record<Window, number> = { burst: 30, day: 86400 };
// a ceiling has to hold this long before it is tried higher
const PROVEN: Record<Window, number> = { burst: 3600, day: 86400 };
const FLOOR: Record<Window, number> = { burst: 3, day: 300 };
// a refusal asking for a longer wait than this is the daily quota rather than the 30-second window
const QUOTA_WAIT = 1800;
const HEADROOM = 0.9;
const BELOW = 0.8;
const RAISE = 1.25;
const MAX_PACE = 15;

export const groupOf = (path: string): Group => (path.startsWith("/me/player") ? "player" : "catalogue");

const blank = (): Ceiling => ({ limit: null, strikeAt: 0, raisedAt: 0 });
const model = async (): Promise<Model> =>
  (await getJson<Model>(MODEL)) ?? { player: { burst: blank(), day: blank() }, catalogue: { burst: blank(), day: blank() } };

const count = (clientId: string, group: Group, w: Window, by: number) =>
  bump(`spotify-q:${group}:${w}:${clientId}:${Math.floor(now() / LENGTH[w])}`, by, (LENGTH[w] + 60) * 1000);

const cap = (c: Ceiling) => (c.limit === null ? Infinity : Math.floor(c.limit * HEADROOM));

/** False while this app is close to a learned ceiling. */
export async function allowed(clientId: string, group: Group): Promise<boolean> {
  const m = (await model())[group];
  for (const w of WINDOWS) {
    if (m[w].limit !== null && (await count(clientId, group, w, 0)) >= cap(m[w])) return false;
  }
  return true;
}

/** Counts a request Spotify answered, and tries a ceiling higher once it has held for a while. */
export async function spent(clientId: string, group: Group): Promise<void> {
  const used = { burst: await count(clientId, group, "burst", 1), day: await count(clientId, group, "day", 1) };
  const m = await model();
  let changed = false;
  for (const w of WINDOWS) {
    const c = m[group][w];
    if (c.limit === null || used[w] < cap(c) || now() - Math.max(c.strikeAt, c.raisedAt) < PROVEN[w]) continue;
    c.limit = Math.ceil(c.limit * RAISE);
    c.raisedAt = now();
    changed = true;
    console.warn(`spotify: ${group} ${w} ceiling held, trying ${c.limit}`);
  }
  if (changed) await setJson(MODEL, m, KEEP);
}

/** Learns from a 429: the ceiling for the window it hit drops below where this app was refused. */
export async function refused(clientId: string, group: Group, retryAfter: number, reason: string): Promise<void> {
  const w: Window = reason === "QUOTA_EXCEEDED" || retryAfter > QUOTA_WAIT ? "day" : "burst";
  const reached = await count(clientId, group, w, 1);
  const m = await model();
  const c = m[group][w];
  const below = Math.max(FLOOR[w], Math.floor(reached * BELOW));
  if (c.limit === null || below < c.limit) {
    c.limit = below;
    console.warn(`spotify: ${group} ${w} ceiling now ${below} (refused at ${reached})`);
  }
  c.strikeAt = now();
  await setJson(MODEL, m, KEEP);
}

/** How much longer than usual to wait between polls, so this app's day lasts until its allowance renews. */
export async function pace(clientId: string, group: Group): Promise<number> {
  const day = (await model())[group].day;
  if (day.limit === null) return 1;
  const used = await count(clientId, group, "day", 0);
  const left = cap(day) - used;
  if (left <= 0) return MAX_PACE;
  const elapsed = Math.max(60, now() % LENGTH.day);
  const remaining = LENGTH.day - (now() % LENGTH.day);
  return Math.min(MAX_PACE, Math.max(1, (used / elapsed) * remaining / left));
}
