import { bump } from "../kv";
import { fail } from "../http";

const mb = (v: string | undefined, d: number | null) => {
  const n = Number(v);
  return v && n > 0 ? n * 1_000_000 : d;
};
const count = (v: string | undefined) => {
  const n = Number(v);
  return v && n > 0 ? Math.floor(n) : null;
};

export const caps = {
  siteBytes: mb(process.env.STORAGE_MAX_MB, null),
  userBytes: mb(process.env.STORAGE_USER_MB, 25_000_000)!,
  dailyWrites: count(process.env.STORAGE_DAILY_WRITES),
  dailyReads: count(process.env.STORAGE_DAILY_READS),
};

const today = () => new Date().toISOString().slice(0, 10);
// counters outlive their day a little, so a slow clock never reuses one
const DAY = 26 * 3600_000;

export async function spendWrites(n: number): Promise<void> {
  if (caps.dailyWrites === null) return;
  if ((await bump(`storage-a:${today()}`, n, DAY)) > caps.dailyWrites) {
    fail(503, "Picture uploads are paused for today. Try again tomorrow.");
  }
}

/** False when today's allowance of picture links has run out. */
export async function spendRead(): Promise<boolean> {
  if (caps.dailyReads === null) return true;
  return (await bump(`storage-b:${today()}`, 1, DAY)) <= caps.dailyReads;
}
