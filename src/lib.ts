import { createContext, useContext, useDeferredValue, useEffect, useReducer, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import type { DmClientMessage, DmEvent } from "../shared/dm";
export type { Ok } from "../shared/auth";

// ---------- API ----------
/** Call the JSON API. `T` is the reply type from shared/ - always name it (use `Ok` for plain acknowledgements). */
export async function api<T>(path: string, opts: { method?: string; body?: unknown; raw?: BodyInit; headers?: Record<string, string> } = {}): Promise<T> {
  const res = await fetch("/api" + path, {
    method: opts.method || (opts.body !== undefined || opts.raw ? "POST" : "GET"),
    headers: opts.body !== undefined ? { "Content-Type": "application/json", ...opts.headers } : opts.headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : opts.raw,
    credentials: "same-origin",
  });
  const data: unknown = await res.json().catch(() => ({ error: "Unexpected response from server" }));
  if (!res.ok) {
    const message = data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : "Request failed";
    throw Object.assign(new Error(message), { status: res.status });
  }
  return data as T; // the server is the source of these types (shared/), so the reply is trusted to match
}
export const qs = (o: Record<string, string | number | boolean | null | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? "?" + s : "";
};

// Every GET is cached by path. A view never drops to a loading state: the screen you are on stays put until the
// next one has its data (React keeps the old tree while the new one is suspended), then swaps in one paint.
/** An API failure: the server's message plus the HTTP status. */
export type ApiError = Error & { status?: number };
type Entry = { data?: unknown; error?: ApiError; promise?: Promise<void>; at: number; subs: Set<() => void> };
const cache = new Map<string, Entry>();
/** Start downloading the pictures a reply refers to, so a page fetched ahead of the click arrives with its artwork. */
const seen = new Set<number>();
function pictures(data: unknown, budget = { left: 24 }) {
  if (!data || typeof data !== "object") return;
  for (const [k, v] of Object.entries(data)) {
    if (budget.left <= 0) return;
    if (typeof v === "number" && v > 0 && /image$/i.test(k)) { if (!seen.has(v)) { seen.add(v); budget.left--; new Image().src = imageUrl(v); } }
    else if (v && typeof v === "object") pictures(v, budget);
  }
}
function load(path: string): Entry {
  let e = cache.get(path);
  if (!e) cache.set(path, (e = { at: 0, subs: new Set() }));
  const entry = e;
  if (!entry.promise) {
    const p: Promise<void> = api<unknown>(path).then(
      data => { entry.data = data; entry.error = undefined; if (!entry.subs.size) pictures(data); },
      (error: ApiError) => { if (entry.data === undefined) entry.error = error; }, // a failed refresh keeps what is on screen
    ).then(() => { entry.at = Date.now(); if (entry.promise === p) entry.promise = undefined; entry.subs.forEach(f => f()); });
    entry.promise = p;
  }
  return entry;
}
/** Warm the cache (used on link hover) so the click itself has nothing to wait for. */
export const prefetch = (path: string) => { const e = cache.get(path); if (!e || (!e.promise && Date.now() - e.at > 30000)) load(path); };
/** The viewer changed (log in / out): everything cached may differ. Refresh what is on screen, forget the rest. */
export function invalidateAll() {
  for (const [path, e] of cache) { if (e.subs.size) { e.at = 0; e.promise = undefined; load(path); } else cache.delete(path); }
}

/** Read a cached GET. `T` is the reply type from shared/. */
export function useApi<T>(path: string | null) {
  const shown = useDeferredValue(path); // while the next path loads, keep rendering the current one
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const entry = shown ? cache.get(shown) : undefined;
  if (shown && (!entry || (entry.data === undefined && entry.error === undefined))) throw load(shown).promise;
  useEffect(() => {
    if (!shown) return;
    const e = cache.get(shown)!;
    e.subs.add(bump);
    if (!e.promise && Date.now() - e.at > 10000) load(shown); // revisits show the cached copy at once, then refresh quietly (not if it was fetched moments ago, on hover)
    return () => { e.subs.delete(bump); };
  }, [shown]);
  return {
    data: (entry?.data ?? null) as T | null, // cached under this path, so it is the reply this caller asked for
    error: entry?.data === undefined ? entry?.error ?? null : null, loading: shown !== path,
    reload: () => { if (shown) { const e = cache.get(shown); if (e) e.promise = undefined; load(shown); } },
    setData: (data: T) => { if (entry) { entry.data = data; entry.subs.forEach(f => f()); } },
  };
}

// ---------- auth ----------
export type { Me } from "../shared/auth";
import type { Me } from "../shared/auth";
export const AuthContext = createContext<{ me: Me | null; setMe: (m: Me | null) => void; refresh: () => void }>({ me: null, setMe: () => {}, refresh: () => {} });
export const useAuth = () => useContext(AuthContext);

// ---------- URLs (Last.fm-style: /music/Artist+Name/Album/…) ----------
export const enc = (s: string) => encodeURIComponent(s.replace(/[%+]/g, c => encodeURIComponent(c))).replace(/%20/g, "+");
export const dec = (s: string | undefined) => { const t = (s || "").replace(/\+/g, " "); try { return decodeURIComponent(t); } catch { return t; } };
export const artistUrl = (artist: string) => `/music/${enc(artist)}`;
export const albumUrl = (artist: string, album: string) => `/music/${enc(artist)}/${enc(album)}`;
export const trackUrl = (artist: string, track: string) => `/music/${enc(artist)}/_/${enc(track)}`;
export const userUrl = (name: string) => `/user/${encodeURIComponent(name)}`;
export const tagUrl = (tag: string) => `/tag/${enc(tag)}`;
export const imageUrl = (id: number) => `/api/image/${id}`;

// ---------- formatting ----------
/** Copies text. The clipboard API only exists on https pages, so plain http falls back to a selected text field. */
export async function copyText(text: string): Promise<boolean> {
  try { if (navigator.clipboard) { await navigator.clipboard.writeText(text); return true; } } catch { /* fall back below */ }
  const t = document.createElement("textarea");
  t.value = text; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0";
  document.body.appendChild(t); t.select();
  try { return document.execCommand("copy"); } catch { return false; } finally { t.remove(); }
}

export const num = (n: number | undefined | null) => (n ?? 0).toLocaleString("en-US");
/** 6.6M, 394K - for headline stats; the exact figure belongs in a title. */
const shortFmt = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
export const short = (n: number | undefined | null) => shortFmt.format(n ?? 0);
export const plural = (n: number, word: string) => `${num(n)} ${word}${n === 1 ? "" : "s"}`;
export const dur = (sec: number) => (sec > 0 ? `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}` : "");
export function ago(ts: number) {
  const d = Date.now() / 1000 - ts;
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)} minute${d < 120 ? "" : "s"} ago`;
  if (d < 86400) return `${Math.floor(d / 3600)} hour${d < 7200 ? "" : "s"} ago`;
  if (d < 86400 * 7) return `${Math.floor(d / 86400)} day${d < 172800 ? "" : "s"} ago`;
  return dateTime(ts);
}
export const date = (ts: number, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) => new Date(ts * 1000).toLocaleDateString("en-GB", opts);
export const dateTime = (ts: number) => new Date(ts * 1000).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

// ---------- search-param helpers ----------
export const PERIODS: [string, string][] = [["7day", "Last 7 days"], ["1month", "Last 30 days"], ["3month", "Last 90 days"], ["6month", "Last 180 days"], ["12month", "Last 365 days"], ["overall", "All time"]];
export function useParam(name: string, def = ""): [string, (v: string) => void] {
  const [sp, setSp] = useSearchParams();
  return [sp.get(name) || def, v => setSp(prev => { const n = new URLSearchParams(prev); if (v && v !== def) n.set(name, v); else n.delete(name); if (name !== "page") n.delete("page"); return n; }, { preventScrollReset: true })];
}
export function useTitle(title: string | null | undefined) {
  useEffect(() => { if (title) document.title = `${title} | Sonosphere`; }, [title]);
}

// ---------- live updates ----------
// One WebSocket per tab while signed in (same host and port as the site). The server pushes events; pages listen with useLive.
/** What the socket delivers: server events, plus "open" when (re)connected. */
export type LiveEvent = DmEvent | { t: "open"; again: boolean };
type Outgoing = DmClientMessage | { t: "ping" };
const liveListeners = new Set<(e: LiveEvent) => void>();
let sock: WebSocket | null = null, liveWanted = false, liveTries = 0, liveTimer: ReturnType<typeof setTimeout> | undefined, livePing: ReturnType<typeof setInterval> | undefined;
const liveEmit = (e: LiveEvent) => { for (const l of [...liveListeners]) { try { l(e); } catch (err) { console.error(err); } } };
function liveOpen() {
  clearTimeout(liveTimer);
  if (!liveWanted || sock) return;
  const s = (sock = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/api/ws`));
  s.onopen = () => { const again = liveTries > 0; liveTries = 0; liveEmit({ t: "open", again }); };
  s.onmessage = ev => {
    let m: unknown;
    try { m = JSON.parse(String(ev.data)); } catch { return; }
    if (m && typeof m === "object" && "t" in m && typeof m.t === "string") liveEmit(m as LiveEvent); // only this site's server talks on this socket
  };
  s.onclose = () => {
    if (sock === s) sock = null;
    if (liveWanted) liveTimer = setTimeout(liveOpen, Math.min(60_000, 1000 * 2 ** liveTries++) + Math.random() * 500); // back off, with jitter
  };
}
/** Called when the viewer signs in or out. */
export function liveConnect(on: boolean) {
  liveWanted = on; clearInterval(livePing);
  if (on) { liveOpen(); livePing = setInterval(() => liveSend({ t: "ping" }), 50_000); }
  else { clearTimeout(liveTimer); liveTries = 0; sock?.close(); sock = null; }
}
export const liveSend = (m: Outgoing) => { if (sock?.readyState === WebSocket.OPEN) sock.send(JSON.stringify(m)); };
export function useLive(fn: (e: LiveEvent) => void) {
  const ref = useRef(fn); ref.current = fn;
  useEffect(() => { const l = (e: LiveEvent) => ref.current(e); liveListeners.add(l); return () => { liveListeners.delete(l); }; }, []);
}
/** Change a cached API reply in place (used by live updates). Does nothing when that reply isn't cached. */
export function mutate<T>(path: string, fn: (data: T) => T) {
  const e = cache.get(path);
  if (!e || e.data === undefined) return;
  e.data = fn(e.data as T); e.at = Date.now(); e.subs.forEach(f => f());
}
