// Limits on how much the site stores and how often it calls the storage service, so a runaway client (or someone
// who found a way round the per-person limits) cannot run up the bill. Paid object stores charge for space and per
// request: writes and deletes (R2's "class A") cost more than reads ("class B"). All optional except the per-person ones:
//   STORAGE_MAX_MB         total space for the whole site; uploads stop when it is reached
//   STORAGE_USER_MB        space per person (default 25); what they uploaded and is still in use counts
//   STORAGE_DAILY_WRITES   writes and deletes per day across the site (class A)
//   STORAGE_DAILY_READS    picture links handed out per day across the site, each roughly one read (class B)
// Day counts are shared by every site process (server/kv.ts) and reset at midnight UTC.
import { bump } from "../kv";
import { fail } from "../http";

const mb = (v: string | undefined, d: number | null) => { const n = Number(v); return v && n > 0 ? n * 1_000_000 : d; };
const count = (v: string | undefined) => { const n = Number(v); return v && n > 0 ? Math.floor(n) : null; };

export const caps = {
  siteBytes: mb(process.env.STORAGE_MAX_MB, null),
  userBytes: mb(process.env.STORAGE_USER_MB, 25_000_000)!,
  dailyWrites: count(process.env.STORAGE_DAILY_WRITES),
  dailyReads: count(process.env.STORAGE_DAILY_READS),
};

const today = () => new Date().toISOString().slice(0, 10);
const DAY = 26 * 3600_000; // counters outlive their day a little, so a slow clock never reuses one

/** Books `n` writes or deletes against today's allowance, or refuses with 503 when it has run out. */
export async function spendWrites(n: number): Promise<void> {
  if (caps.dailyWrites === null) return;
  if ((await bump(`storage-a:${today()}`, n, DAY)) > caps.dailyWrites) {
    fail(503, "Picture uploads are paused for today. Try again tomorrow.");
  }
}

/** Books one picture link against today's allowance. False when it has run out. */
export async function spendRead(): Promise<boolean> {
  if (caps.dailyReads === null) return true;
  return (await bump(`storage-b:${today()}`, 1, DAY)) <= caps.dailyReads;
}
