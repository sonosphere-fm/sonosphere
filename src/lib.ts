import { createContext, useContext, useDeferredValue, useEffect, useReducer, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import type { DmClientMessage, DmEvent } from "../shared/dm";
import type { Me } from "../shared/auth";
import type { ListenMessage, ListeningEvent } from "../shared/live";
export type { Ok, Me } from "../shared/auth";

type ApiOptions = { method?: string; body?: unknown; raw?: BodyInit; headers?: Record<string, string> };

/** `T` is the reply type from shared/; use `Ok` for plain acknowledgements. */
export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const hasJson = opts.body !== undefined;
  const res = await fetch("/api" + path, {
    method: opts.method || (hasJson || opts.raw ? "POST" : "GET"),
    headers: hasJson ? { "Content-Type": "application/json", ...opts.headers } : opts.headers,
    body: hasJson ? JSON.stringify(opts.body) : opts.raw,
    credentials: "same-origin",
  });
  const data: unknown = await res.json().catch(() => ({ error: "Unexpected response from server" }));
  if (!res.ok) {
    const hasMessage = data && typeof data === "object" && "error" in data && typeof data.error === "string";
    const message = hasMessage ? data.error as string : "Request failed";
    throw Object.assign(new Error(message), { status: res.status });
  }
  return data as T;
}

export const qs = (o: Record<string, string | number | boolean | null | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) {
    if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  }
  const s = p.toString();
  return s ? "?" + s : "";
};

// Every GET is cached by path. React keeps the old tree while the next one suspends, so views never drop
// to a loading state.
export type ApiError = Error & { status?: number };
type Entry = { data?: unknown; error?: ApiError; promise?: Promise<void>; dirty?: boolean; at: number; subs: Set<() => void> };
const cache = new Map<string, Entry>();

// Preloads the pictures a prefetched reply refers to, so the page arrives with its artwork.
const seen = new Set<string>();
function pictures(data: unknown, budget = { left: 24 }) {
  if (!data || typeof data !== "object") return;
  for (const [k, v] of Object.entries(data)) {
    if (budget.left <= 0) return;
    if (typeof v === "string" && /image$/i.test(k) && /^[0-9a-f]{32}$/.test(v)) {
      if (seen.has(v)) continue;
      seen.add(v);
      budget.left--;
      new Image().src = imageUrl(v, "small");
    } else if (v && typeof v === "object") {
      pictures(v, budget);
    }
  }
}

function load(path: string): Entry {
  let entry = cache.get(path);
  if (!entry) {
    entry = { at: 0, subs: new Set() };
    cache.set(path, entry);
  }
  const e = entry;
  if (e.promise) return e;
  const onData = (data: unknown) => {
    e.data = data;
    e.error = undefined;
    if (!e.subs.size) pictures(data);
  };
  // a failed refresh keeps what is on screen
  const onError = (error: ApiError) => {
    if (e.data === undefined) e.error = error;
  };
  const p: Promise<void> = api<unknown>(path).then(onData, onError).then(() => {
    e.at = Date.now();
    if (e.promise === p) e.promise = undefined;
    e.subs.forEach(f => f());
    if (e.dirty) {
      e.dirty = false;
      load(path);
    }
  });
  e.promise = p;
  return e;
}

export const prefetch = (path: string) => {
  const e = cache.get(path);
  if (!e || (!e.promise && Date.now() - e.at > 30000)) load(path);
};

/** The viewer changed: refresh what is on screen, forget the rest. */
export function invalidateAll() {
  for (const [path, e] of cache) {
    if (e.subs.size) {
      e.at = 0;
      e.promise = undefined;
      load(path);
    } else {
      cache.delete(path);
    }
  }
}

/** Read a cached GET. `T` is the reply type from shared/. */
export function useApi<T>(path: string | null) {
  const shown = useDeferredValue(path);
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const entry = shown ? cache.get(shown) : undefined;
  if (shown && (!entry || (entry.data === undefined && entry.error === undefined))) throw load(shown).promise;
  useEffect(() => {
    if (!shown) return;
    const e = cache.get(shown)!;
    e.subs.add(bump);
    scheduleSubscriptions();
    // Revisits show the cached copy at once, then refresh quietly unless it was just fetched on hover.
    if (!e.promise && Date.now() - e.at > 10000) load(shown);
    return () => { e.subs.delete(bump); scheduleSubscriptions(); };
  }, [shown]);

  const reload = () => {
    if (!shown) return;
    const e = cache.get(shown);
    if (e) e.promise = undefined;
    load(shown);
  };
  const setData = (data: T) => {
    if (!entry) return;
    entry.data = data;
    entry.subs.forEach(f => f());
  };
  return {
    data: (entry?.data ?? null) as T | null,
    error: entry?.data === undefined ? entry?.error ?? null : null,
    loading: shown !== path,
    reload,
    setData,
  };
}

type Auth = { me: Me | null; setMe: (m: Me | null) => void; refresh: () => void };
export const AuthContext = createContext<Auth>({ me: null, setMe: () => {}, refresh: () => {} });
export const useAuth = () => useContext(AuthContext);

export const enc = (s: string) => encodeURIComponent(s.replace(/[%+]/g, c => encodeURIComponent(c))).replace(/%20/g, "+");
export const dec = (s: string | undefined) => {
  const t = (s || "").replace(/\+/g, " ");
  try {
    return decodeURIComponent(t);
  } catch {
    return t;
  }
};
export const artistUrl = (artist: string) => `/music/${enc(artist)}`;
export const albumUrl = (artist: string, album: string) => `/music/${enc(artist)}/${enc(album)}`;
export const trackUrl = (artist: string, track: string) => `/music/${enc(artist)}/_/${enc(track)}`;
export const userUrl = (name: string) => `/user/${encodeURIComponent(name)}`;
export const tagUrl = (tag: string) => `/tag/${enc(tag)}`;
export const imageUrl = (id: string, size: "large" | "small" = "large") => `/api/image/${id}${size === "small" ? "?s=small" : ""}`;

// The clipboard API only exists on https pages, so plain http falls back to a selected text field.
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall back below
  }
  const t = document.createElement("textarea");
  t.value = text;
  t.setAttribute("readonly", "");
  t.style.position = "fixed";
  t.style.opacity = "0";
  document.body.appendChild(t);
  t.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    t.remove();
  }
}

export const num = (n: number | undefined | null) => (n ?? 0).toLocaleString("en-US");
const shortFmt = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
export const short = (n: number | undefined | null) => shortFmt.format(n ?? 0);
export const plural = (n: number, word: string) => `${num(n)} ${word}${n === 1 ? "" : "s"}`;
export const dur = (sec: number) => {
  if (sec <= 0) return "";
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
};
export function ago(ts: number) {
  const d = Date.now() / 1000 - ts;
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)} minute${d < 120 ? "" : "s"} ago`;
  if (d < 86400) return `${Math.floor(d / 3600)} hour${d < 7200 ? "" : "s"} ago`;
  if (d < 86400 * 7) return `${Math.floor(d / 86400)} day${d < 172800 ? "" : "s"} ago`;
  return dateTime(ts);
}
const DATE_OPTS: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
export const date = (ts: number, opts = DATE_OPTS) => new Date(ts * 1000).toLocaleDateString("en-GB", opts);
export const dateTime = (ts: number) => new Date(ts * 1000).toLocaleString("en-GB", { ...DATE_OPTS, hour: "2-digit", minute: "2-digit" });

export const PERIODS: [string, string][] = [
  ["7day", "Last 7 days"],
  ["1month", "Last 30 days"],
  ["3month", "Last 90 days"],
  ["6month", "Last 180 days"],
  ["12month", "Last 365 days"],
  ["overall", "All time"],
];

export function useParam(name: string, def = ""): [string, (v: string) => void] {
  const [sp, setSp] = useSearchParams();
  const set = (v: string) => setSp(prev => {
    const n = new URLSearchParams(prev);
    if (v && v !== def) n.set(name, v);
    else n.delete(name);
    if (name !== "page") n.delete("page");
    return n;
  }, { preventScrollReset: true });
  return [sp.get(name) || def, set];
}

export function useTitle(title: string | null | undefined) {
  useEffect(() => { if (title) document.title = `${title} | Sonosphere`; }, [title]);
}

// One WebSocket per tab while signed in or viewing listening data.
export type LiveEvent = DmEvent | ListeningEvent | { t: "open"; again: boolean };
type Outgoing = DmClientMessage | ListenMessage | { t: "ping" };
const liveListeners = new Set<(e: LiveEvent) => void>();
let sock: WebSocket | null = null;
let liveWanted = false;
let liveTries = 0;
let liveTimer: ReturnType<typeof setTimeout> | undefined;
let livePing: ReturnType<typeof setInterval> | undefined;
let subscriptionTimer: ReturnType<typeof setTimeout> | undefined;
let listeningNames: string[] = [];
const listeningPaths = /^\/user(?:\/recent|\/top|\/report|\/library\/artist)?$/;

function scheduleSubscriptions() {
  clearTimeout(subscriptionTimer);
  subscriptionTimer = setTimeout(() => {
    const names = new Set<string>();
    for (const [path, entry] of cache) {
      if (!entry.subs.size) continue;
      const url = new URL(path, location.origin);
      const name = url.searchParams.get("name");
      if (name && listeningPaths.test(url.pathname)) names.add(name.toLowerCase());
    }
    const next = [...names].sort().slice(0, 8);
    if (JSON.stringify(next) === JSON.stringify(listeningNames)) return;
    listeningNames = next;
    liveSend({ t: "listen", names: listeningNames });
    reconcileLive();
  }, 0);
}

const pendingListening = new Map<string, ListeningEvent["change"]>();
let listeningTimer: ReturnType<typeof setTimeout> | undefined;
export function refreshListening(name: string, change: ListeningEvent["change"] = "scrobbles") {
  const key = name.toLowerCase();
  if (pendingListening.get(key) !== "scrobbles") pendingListening.set(key, change);
  if (listeningTimer) return;
  listeningTimer = setTimeout(() => {
    listeningTimer = undefined;
    const changes = new Map(pendingListening);
    pendingListening.clear();
    for (const [path, entry] of cache) {
      const url = new URL(path, location.origin);
      const change = changes.get((url.searchParams.get("name") ?? "").toLowerCase());
      if (!change || !listeningPaths.test(url.pathname)) continue;
      if (change === "nowplaying" && !["/user", "/user/recent"].includes(url.pathname)) continue;
      if (!entry.subs.size) cache.delete(path);
      else if (entry.promise) entry.dirty = true;
      else load(path);
    }
  }, 150);
}

function reconcileLive() {
  clearInterval(livePing);
  if (liveWanted || listeningNames.length) {
    liveOpen();
    livePing = setInterval(() => liveSend({ t: "ping" }), 50_000);
  } else {
    clearTimeout(liveTimer);
    const previous = sock;
    sock = null;
    previous?.close();
    liveTries = 0;
  }
}

const liveEmit = (e: LiveEvent) => {
  for (const l of [...liveListeners]) {
    try {
      l(e);
    } catch (err) {
      console.error(err);
    }
  }
};

function liveOpen() {
  clearTimeout(liveTimer);
  if ((!liveWanted && !listeningNames.length) || sock) return;
  const s = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/ws`);
  sock = s;
  s.onopen = () => {
    if (sock !== s) return;
    const again = liveTries > 0;
    liveTries = 0;
    liveSend({ t: "listen", names: listeningNames });
    liveEmit({ t: "open", again });
  };
  s.onmessage = ev => {
    if (sock !== s) return;
    let m: unknown;
    try {
      m = JSON.parse(String(ev.data));
    } catch {
      return;
    }
    if (m && typeof m === "object" && "t" in m && typeof m.t === "string") {
      if (m.t === "listening" && "name" in m && typeof m.name === "string" && "change" in m && (m.change === "scrobbles" || m.change === "nowplaying")) refreshListening(m.name, m.change);
      liveEmit(m as LiveEvent);
    }
  };
  s.onclose = () => {
    if (sock !== s) return;
    sock = null;
    if (!liveWanted && !listeningNames.length) return;
    const backoff = Math.min(60_000, 1000 * 2 ** liveTries++) + Math.random() * 500;
    liveTimer = setTimeout(liveOpen, backoff);
  };
}

export function liveConnect(on: boolean) {
  if (on !== liveWanted) {
    const previous = sock;
    sock = null;
    previous?.close();
  }
  liveWanted = on;
  reconcileLive();
}

export const liveSend = (m: Outgoing) => {
  if (sock?.readyState === WebSocket.OPEN) sock.send(JSON.stringify(m));
};

export function useLive(fn: (e: LiveEvent) => void) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const l = (e: LiveEvent) => ref.current(e);
    liveListeners.add(l);
    return () => { liveListeners.delete(l); };
  }, []);
}

/** Change a cached API reply in place. Does nothing when that reply isn't cached. */
export function mutate<T>(path: string, fn: (data: T) => T) {
  const e = cache.get(path);
  if (!e || e.data === undefined) return;
  e.data = fn(e.data as T);
  e.at = Date.now();
  e.subs.forEach(f => f());
}
