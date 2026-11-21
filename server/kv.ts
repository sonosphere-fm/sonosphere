// State shared by every site process: Valkey (a Redis fork, VALKEY_URL) holds rate-limit counters, the site chart
// cache, job locks and the live-update fan-out, so any number of processes can serve the site side by side.
// Without VALKEY_URL (a single development process) the same calls work from this process's memory.
// If Valkey stops answering, the site keeps serving: rate limits let requests through, caches recompute, live
// updates reach only this process's sockets and jobs wait until a lock can be taken again.
import { RedisClient } from "bun";

const PREFIX = "spin:";
const url = process.env.VALKEY_URL || "";
// commands fail at once while disconnected instead of queueing, so a Valkey outage cannot stall requests
const options = { connectionTimeout: 2000, autoReconnect: true, enableOfflineQueue: false };
// a hot reload in development re-runs this file: the old connections are closed rather than left open
const hot = globalThis as { __spinKv?: (RedisClient | null)[] };
for (const c of hot.__spinKv ?? []) c?.close();
const client = url ? new RedisClient(url, options) : null;
hot.__spinKv = [client];
let warnedAt = 0, retriedAt = 0; // see warn() at the end
// connect before the first request (commands do not wait for a connection); if Valkey is down now, warn() retries later
// (no top-level await here: this module sits inside import cycles, where one would stall loading)
let ready: Promise<unknown> | null = null;
if (client) {
  const connecting = client.connect();
  connecting.catch(e => warn(e)); // it keeps retrying in the background; the first commands wait two seconds at most
  ready = Promise.race([connecting.catch(() => {}), Bun.sleep(2000)]).then(() => { ready = null; });
}

// ---------- the in-memory stand-in ----------
const memory = new Map<string, { v: string; until: number }>();
const memGet = (k: string) => { const e = memory.get(k); if (e && e.until <= Date.now()) { memory.delete(k); return null; } return e?.v ?? null; };
const memWindows = new Map<string, number[]>();
const localListeners = new Map<string, Set<(msg: string) => void>>();

const g = globalThis as { __spinKvSweep?: ReturnType<typeof setInterval> };
clearInterval(g.__spinKvSweep);
g.__spinKvSweep = setInterval(() => {
  const t = Date.now();
  for (const [k, e] of memory) if (e.until <= t) memory.delete(k);
  for (const [k, v] of memWindows) if (!v.length || v[v.length - 1]! < t - 3600_000) memWindows.delete(k);
}, 600_000);

// ---------- rate limits ----------
// A sliding window kept as a sorted set of attempt times; an attempt over the limit is not counted.
const WINDOW = `
local now, win, max = tonumber(ARGV[1]), tonumber(ARGV[2]), tonumber(ARGV[3])
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, now - win)
if redis.call('ZCARD', KEYS[1]) >= max then return 0 end
redis.call('ZADD', KEYS[1], now, ARGV[4])
redis.call('PEXPIRE', KEYS[1], win)
return 1`;

/** Counts an attempt under `key`. False once there have been `max` within the last `ms`. */
export async function attempt(key: string, max: number, ms: number): Promise<boolean> {
  const t = Date.now();
  if (!client) {
    const recent = (memWindows.get(key) ?? []).filter(x => x > t - ms);
    if (recent.length >= max) { memWindows.set(key, recent); return false; }
    recent.push(t); memWindows.set(key, recent);
    return true;
  }
  if (ready) await ready;
  try { return Number(await client.send("EVAL", [WINDOW, "1", PREFIX + "rl:" + key, String(t), String(ms), String(max), `${t}:${Math.random()}`])) === 1; }
  catch (e) { warn(e); return true; }
}

// ---------- counters ----------
const memCounts = new Map<string, { n: number; until: number }>();
/**
 * Adds `by` to the counter `key` (which starts at 0 and lasts `ttlMs` from its first use) and returns the new total.
 * While Valkey is unreachable the count carries on in this process's memory, so limits built on it still hold.
 */
export async function bump(key: string, by: number, ttlMs: number): Promise<number> {
  const local = () => {
    const t = Date.now(), e = memCounts.get(key);
    const entry = e && e.until > t ? e : { n: 0, until: t + ttlMs };
    entry.n += by; memCounts.set(key, entry);
    if (memCounts.size > 10_000) for (const [k, v] of memCounts) if (v.until <= t) memCounts.delete(k);
    return entry.n;
  };
  if (!client) return local();
  if (ready) await ready;
  try {
    const n = Number(await client.send("INCRBY", [PREFIX + "n:" + key, String(by)]));
    if (n === by) await client.send("PEXPIRE", [PREFIX + "n:" + key, String(Math.ceil(ttlMs))]);
    return n;
  } catch (e) { warn(e); return local(); }
}

/**
 * Counts one request under `key` in the current fixed window of `seconds` (one counter per window, so it is cheap
 * enough to run on every request). Returns 0 while within `max`, otherwise the seconds until the window resets.
 */
export async function hits(key: string, max: number, seconds: number): Promise<number> {
  const ms = seconds * 1000, slot = Math.floor(Date.now() / ms);
  if ((await bump(`w:${key}:${seconds}:${slot}`, 1, ms + 1000)) <= max) return 0;
  return Math.max(1, Math.ceil(((slot + 1) * ms - Date.now()) / 1000));
}

// ---------- values ----------
export async function getJson<T>(key: string): Promise<T | null> {
  if (ready) await ready;
  try {
    const raw = client ? await client.get(PREFIX + key) : memGet(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch (e) { warn(e); return null; }
}

export async function setJson(key: string, value: unknown, ttlMs: number): Promise<void> {
  const raw = JSON.stringify(value);
  if (!client) { memory.set(key, { v: raw, until: Date.now() + ttlMs }); return; }
  if (ready) await ready;
  try { await client.send("SET", [PREFIX + key, raw, "PX", String(Math.ceil(ttlMs))]); } catch (e) { warn(e); }
}

// ---------- sets (a work queue in no particular order) ----------
const memSets = new Map<string, Set<string>>();
/** Adds members to a set that holds at most `cap` (members over it are dropped). */
export async function setAdd(key: string, members: string[], cap: number): Promise<void> {
  if (!members.length) return;
  if (!client) { const set = memSets.get(key) ?? new Set(); memSets.set(key, set); for (const m of members) if (set.size < cap) set.add(m); return; }
  if (ready) await ready;
  try {
    if (Number(await client.send("SCARD", [PREFIX + "s:" + key])) >= cap) return;
    await client.send("SADD", [PREFIX + "s:" + key, ...members]);
  } catch (e) { warn(e); }
}
/** Takes up to `n` members out of a set. */
export async function setTake(key: string, n: number): Promise<string[]> {
  if (!client) { const set = memSets.get(key); const out = set ? [...set].slice(0, n) : []; for (const m of out) set!.delete(m); return out; }
  if (ready) await ready;
  try { const r = await client.send("SPOP", [PREFIX + "s:" + key, String(n)]); return Array.isArray(r) ? r.map(String) : []; }
  catch (e) { warn(e); return []; }
}

// ---------- locks ----------
const RELEASE = `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end`;

/** Takes `name` for up to `ttlMs` if no process holds it. Returns a function that gives it back, or null. */
export async function claim(name: string, ttlMs: number): Promise<(() => Promise<void>) | null> {
  const key = "lock:" + name, token = crypto.randomUUID();
  if (!client) {
    if (memGet(key) !== null) return null;
    memory.set(key, { v: token, until: Date.now() + ttlMs });
    return async () => { if (memGet(key) === token) memory.delete(key); };
  }
  if (ready) await ready;
  try {
    if ((await client.send("SET", [PREFIX + key, token, "NX", "PX", String(Math.ceil(ttlMs))])) !== "OK") return null;
  } catch (e) { warn(e); return null; }
  return async () => { try { await client.send("EVAL", [RELEASE, "1", PREFIX + key, token]); } catch (e) { warn(e); } };
}

/**
 * Runs a job in one process at a time: if another process holds `name`, this returns null without running it.
 * `ttlMs` must outlast the job; a process that dies holding the lock frees it when the time runs out.
 */
export async function exclusive<T>(name: string, ttlMs: number, job: () => Promise<T>): Promise<T | null> {
  if (closing) return null;
  const release = await claim(name, ttlMs);
  if (!release) return null;
  held.add(release);
  try { return await job(); } finally { held.delete(release); await release(); }
}
const held = new Set<() => Promise<void>>();
/** Frees the locks of jobs still running, for a process about to exit (a deploy), so the next one can start them at once. */
export const releaseAll = () => { closing = true; return Promise.all([...held].map(r => r())).then(() => {}); };
let closing = false; // no new jobs start once the process is on its way out

// ---------- fan-out between processes ----------
// Subscribing takes a connection of its own. Subscriptions do not survive a reconnect, so they are made again on
// every connect.
const remoteListeners = new Map<string, Set<(msg: string) => void>>();
let subscriber: RedisClient | null = null;

async function listen(channel: string) {
  if (!subscriber?.connected) return; // made when it connects
  try { await subscriber.unsubscribe(PREFIX + channel); } catch { /* not subscribed yet */ } // never two handlers for one channel
  await subscriber.subscribe(PREFIX + channel, (msg: string) => { for (const f of remoteListeners.get(channel) ?? []) f(msg); });
}

/** Calls `fn` with every message published on `channel` by any process, this one included. */
export function subscribe(channel: string, fn: (msg: string) => void): void {
  const local = localListeners.get(channel) ?? new Set();
  local.add(fn); localListeners.set(channel, local);
  if (!client) return;
  const remote = remoteListeners.get(channel) ?? new Set();
  const first = !remote.size;
  remote.add(fn); remoteListeners.set(channel, remote);
  if (!subscriber) {
    subscriber = new RedisClient(url, options);
    hot.__spinKv = [client, subscriber];
    subscriber.onconnect = () => { for (const ch of remoteListeners.keys()) listen(ch).catch(e => warn(e)); };
    subscriber.connect().catch(e => warn(e));
  } else if (first) listen(channel).catch(e => warn(e));
}

/** Sends `msg` to every process's subscribers. When Valkey is down, only this process's subscribers get it. */
export async function publish(channel: string, msg: string): Promise<void> {
  if (client) {
    if (ready) await ready;
    try { await client.publish(PREFIX + channel, msg); return; } catch (e) { warn(e); }
  }
  for (const f of localListeners.get(channel) ?? []) f(msg);
}

/** Whether shared state lives in Valkey (true) or in this process alone. */
export const shared = !!client;

// one line per minute at most while Valkey is unreachable, not one per request
function warn(e: unknown) {
  // the client stops retrying by itself after a while; failed commands start it again
  if (client && Date.now() - retriedAt > 5000) {
    retriedAt = Date.now();
    if (!client.connected) client.connect().catch(() => {});
    if (subscriber && !subscriber.connected) subscriber.connect().catch(() => {});
  }
  if (Date.now() - warnedAt < 60_000) return;
  warnedAt = Date.now();
  console.error("Valkey unavailable, carrying on without it:", e instanceof Error ? e.message : e);
}
