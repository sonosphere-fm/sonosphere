import { RedisClient } from "bun";

const PREFIX = "spin:";
const url = process.env.VALKEY_URL || "";
// fail at once while disconnected instead of queueing, so an outage cannot stall requests
const options = { connectionTimeout: 2000, autoReconnect: true, enableOfflineQueue: false };
const hot = globalThis as { __spinKv?: (RedisClient | null)[] };
for (const c of hot.__spinKv ?? []) c?.close();
const client = url ? new RedisClient(url, options) : null;
hot.__spinKv = [client];
let warnedAt = 0;
let retriedAt = 0;
// no top-level await: this module sits inside import cycles, where one would stall loading
let ready: Promise<unknown> | null = null;
if (client) {
  const connecting = client.connect();
  connecting.catch((e) => warn(e));
  ready = Promise.race([connecting.catch(() => {}), Bun.sleep(2000)]).then(() => {
    ready = null;
  });
}

const memory = new Map<string, { v: string; until: number }>();
const memGet = (k: string) => {
  const e = memory.get(k);
  if (e && e.until <= Date.now()) {
    memory.delete(k);
    return null;
  }
  return e?.v ?? null;
};
const memWindows = new Map<string, number[]>();
const localListeners = new Map<string, Set<(msg: string) => void>>();

const g = globalThis as { __spinKvSweep?: ReturnType<typeof setInterval> };
clearInterval(g.__spinKvSweep);
g.__spinKvSweep = setInterval(() => {
  const t = Date.now();
  for (const [k, e] of memory) {
    if (e.until <= t) memory.delete(k);
  }
  for (const [k, v] of memWindows) {
    if (!v.length || v[v.length - 1]! < t - 3600_000) memWindows.delete(k);
  }
}, 600_000);

// sliding window as a sorted set of attempt times; an attempt over the limit is not counted
const WINDOW = `
local now, win, max = tonumber(ARGV[1]), tonumber(ARGV[2]), tonumber(ARGV[3])
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, now - win)
if redis.call('ZCARD', KEYS[1]) >= max then return 0 end
redis.call('ZADD', KEYS[1], now, ARGV[4])
redis.call('PEXPIRE', KEYS[1], win)
return 1`;

function attemptLocal(key: string, max: number, ms: number, t: number) {
  const recent = (memWindows.get(key) ?? []).filter((x) => x > t - ms);
  memWindows.set(key, recent);
  if (recent.length >= max) return false;
  recent.push(t);
  return true;
}

/** False once there have been `max` attempts within the last `ms`. Falls back to memory when Valkey is down. */
export async function attempt(key: string, max: number, ms: number): Promise<boolean> {
  const t = Date.now();
  if (!client) return attemptLocal(key, max, ms, t);
  if (ready) await ready;
  try {
    const args = [WINDOW, "1", PREFIX + "rl:" + key, String(t), String(ms), String(max), `${t}:${Math.random()}`];
    return Number(await client.send("EVAL", args)) === 1;
  } catch (e) {
    warn(e);
    return attemptLocal(key, max, ms, t);
  }
}

const memCounts = new Map<string, { n: number; until: number }>();

function bumpLocal(key: string, by: number, ttlMs: number) {
  const t = Date.now();
  const e = memCounts.get(key);
  const entry = e && e.until > t ? e : { n: 0, until: t + ttlMs };
  entry.n += by;
  memCounts.set(key, entry);
  if (memCounts.size > 10_000) {
    for (const [k, v] of memCounts) {
      if (v.until <= t) memCounts.delete(k);
    }
  }
  return entry.n;
}

/** Adds `by` to a counter that lasts `ttlMs` from first use; returns the new total. Falls back to memory when Valkey is down. */
export async function bump(key: string, by: number, ttlMs: number): Promise<number> {
  if (!client) return bumpLocal(key, by, ttlMs);
  if (ready) await ready;
  try {
    const n = Number(await client.send("INCRBY", [PREFIX + "n:" + key, String(by)]));
    if (n === by) await client.send("PEXPIRE", [PREFIX + "n:" + key, String(Math.ceil(ttlMs))]);
    return n;
  } catch (e) {
    warn(e);
    return bumpLocal(key, by, ttlMs);
  }
}

/** Fixed window. Returns 0 while within `max`, otherwise the seconds until the window resets. */
export async function hits(key: string, max: number, seconds: number): Promise<number> {
  const ms = seconds * 1000;
  const slot = Math.floor(Date.now() / ms);
  if ((await bump(`w:${key}:${seconds}:${slot}`, 1, ms + 1000)) <= max) return 0;
  return Math.max(1, Math.ceil(((slot + 1) * ms - Date.now()) / 1000));
}

export async function getJson<T>(key: string): Promise<T | null> {
  if (ready) await ready;
  try {
    const raw = client ? await client.get(PREFIX + key) : memGet(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch (e) {
    warn(e);
    return null;
  }
}

export async function setJson(key: string, value: unknown, ttlMs: number): Promise<void> {
  const raw = JSON.stringify(value);
  if (!client) {
    memory.set(key, { v: raw, until: Date.now() + ttlMs });
    return;
  }
  if (ready) await ready;
  try {
    await client.send("SET", [PREFIX + key, raw, "PX", String(Math.ceil(ttlMs))]);
  } catch (e) {
    warn(e);
  }
}

/** Reads and deletes in one step, so only one caller ever gets the value. */
export async function takeJson<T>(key: string): Promise<T | null> {
  if (!client) {
    const raw = memGet(key);
    memory.delete(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  }
  if (ready) await ready;
  try {
    const raw = (await client.send("GETDEL", [PREFIX + key])) as string | null;
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch (e) {
    warn(e);
    return null;
  }
}

const memSets = new Map<string, Set<string>>();

/** Members beyond `cap` are dropped. */
export async function setAdd(key: string, members: string[], cap: number): Promise<void> {
  if (!members.length) return;
  if (!client) {
    const set = memSets.get(key) ?? new Set();
    memSets.set(key, set);
    for (const m of members) {
      if (set.size < cap) set.add(m);
    }
    return;
  }
  if (ready) await ready;
  try {
    if (Number(await client.send("SCARD", [PREFIX + "s:" + key])) >= cap) return;
    await client.send("SADD", [PREFIX + "s:" + key, ...members]);
  } catch (e) {
    warn(e);
  }
}

export async function setTake(key: string, n: number): Promise<string[]> {
  if (!client) {
    const set = memSets.get(key);
    if (!set) return [];
    const out = [...set].slice(0, n);
    for (const m of out) set.delete(m);
    return out;
  }
  if (ready) await ready;
  try {
    const r = await client.send("SPOP", [PREFIX + "s:" + key, String(n)]);
    return Array.isArray(r) ? r.map(String) : [];
  } catch (e) {
    warn(e);
    return [];
  }
}

const RELEASE = `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end`;
const RENEW = `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('PEXPIRE', KEYS[1], ARGV[2]) else return 0 end`;

type Lock = { release: () => Promise<void>; renew: () => Promise<void> };

async function claim(name: string, ttlMs: number): Promise<Lock | null> {
  const key = "lock:" + name;
  const token = crypto.randomUUID();
  if (!client) {
    if (memGet(key) !== null) return null;
    memory.set(key, { v: token, until: Date.now() + ttlMs });
    return {
      release: async () => {
        if (memGet(key) === token) memory.delete(key);
      },
      renew: async () => {
        if (memGet(key) === token) memory.set(key, { v: token, until: Date.now() + ttlMs });
      },
    };
  }
  if (ready) await ready;
  try {
    const res = await client.send("SET", [PREFIX + key, token, "NX", "PX", String(Math.ceil(ttlMs))]);
    if (res !== "OK") return null;
  } catch (e) {
    warn(e);
    return null;
  }
  const run = async (args: string[]) => {
    try {
      await client.send("EVAL", args);
    } catch (e) {
      warn(e);
    }
  };
  return {
    release: () => run([RELEASE, "1", PREFIX + key, token]),
    renew: () => run([RENEW, "1", PREFIX + key, token, String(Math.ceil(ttlMs))]),
  };
}

const held = new Set<() => Promise<void>>();
let closing = false;

/**
 * Runs a job in one process at a time; returns null without running it if another process holds `name`.
 * The lock is renewed while the job runs, so `ttlMs` only bounds how long a dead process keeps it.
 */
export async function exclusive<T>(name: string, ttlMs: number, job: () => Promise<T>): Promise<T | null> {
  if (closing) return null;
  const lock = await claim(name, ttlMs);
  if (!lock) return null;
  held.add(lock.release);
  const renewing = setInterval(lock.renew, ttlMs / 3);
  try {
    return await job();
  } finally {
    clearInterval(renewing);
    held.delete(lock.release);
    await lock.release();
  }
}

export const releaseAll = () => {
  closing = true;
  return Promise.all([...held].map((r) => r())).then(() => {});
};

// subscriptions need their own connection and do not survive a reconnect, so they are remade on every connect
const remoteListeners = new Map<string, Set<(msg: string) => void>>();
let subscriber: RedisClient | null = null;

async function listen(channel: string) {
  if (!subscriber?.connected) return;
  // never two handlers for one channel
  try {
    await subscriber.unsubscribe(PREFIX + channel);
  } catch {}
  await subscriber.subscribe(PREFIX + channel, (msg: string) => {
    for (const f of remoteListeners.get(channel) ?? []) f(msg);
  });
}

export function subscribe(channel: string, fn: (msg: string) => void): void {
  const local = localListeners.get(channel) ?? new Set();
  local.add(fn);
  localListeners.set(channel, local);
  if (!client) return;
  const remote = remoteListeners.get(channel) ?? new Set();
  const isFirst = !remote.size;
  remote.add(fn);
  remoteListeners.set(channel, remote);
  if (!subscriber) {
    subscriber = new RedisClient(url, options);
    hot.__spinKv = [client, subscriber];
    subscriber.onconnect = () => {
      for (const ch of remoteListeners.keys()) listen(ch).catch((e) => warn(e));
    };
    subscriber.connect().catch((e) => warn(e));
  } else if (isFirst) {
    listen(channel).catch((e) => warn(e));
  }
}

/** When Valkey is down, only this process's subscribers get the message. */
export async function publish(channel: string, msg: string): Promise<void> {
  if (client) {
    if (ready) await ready;
    try {
      await client.publish(PREFIX + channel, msg);
      return;
    } catch (e) {
      warn(e);
    }
  }
  for (const f of localListeners.get(channel) ?? []) f(msg);
}

function warn(e: unknown) {
  // the client gives up reconnecting after a while; failed commands start it again
  if (client && Date.now() - retriedAt > 5000) {
    retriedAt = Date.now();
    if (!client.connected) client.connect().catch(() => {});
    if (subscriber && !subscriber.connected) subscriber.connect().catch(() => {});
  }
  if (Date.now() - warnedAt < 60_000) return;
  warnedAt = Date.now();
  console.error("Valkey unavailable, carrying on without it:", e instanceof Error ? e.message : e);
}
