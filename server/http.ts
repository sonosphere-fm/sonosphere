import type { users } from "./db/schema";
import { impersonating, viewerOf } from "./auth/session";
export { tokenOf } from "./auth/session";
import { cacheAnonymousAtEdge } from "./edge-cache";
import { attempt, hits } from "./kv";
import { isStaff } from "./site/roles";
import { audit } from "./site/audit";
import { requestLocale, tr, type ErrorKey } from "./i18n";
import type { Params } from "../shared/i18n/core";

/** The message is a key in the errors catalog, shown in the language of whoever made the request. */
export class HttpError extends Error {
  constructor(
    public status: number,
    public key: ErrorKey,
    public retryAfter = 0,
    public params?: Params
  ) {
    super(tr("en", `errors.${key}`, params));
  }
}
export const fail = (status: number, key: ErrorKey, params?: Params): never => {
  throw new HttpError(status, key, 0, params);
};
export const bad = (key: ErrorKey, params?: Params): never => fail(400, key, params);
export const missing = (key: ErrorKey): never => fail(404, key);

export type Viewer = typeof users.$inferSelect;
/** A JSON request body before validation: handlers must check each field they read. */
export type Body = Record<string, unknown>;
export type Ctx = {
  req: Request;
  url: URL;
  q: URLSearchParams;
  user: Viewer | null;
  actor: Viewer | null;
  body: Body;
  params: string[];
  headers: Headers;
};
type Handler<R = unknown> = (c: Ctx) => R | Response | Promise<R | Response>;
type Method = "GET" | "POST" | "PATCH" | "DELETE";
type Options = {
  prefix?: string;
  /** Refuse writes whose body is not JSON. */
  jsonOnly?: boolean;
};

export class Router {
  private routes: { method: Method; re: RegExp; fn: Handler; jsonOnly: boolean; edgeMaxAge?: number }[] = [];
  constructor(private opts: Options = {}) {}

  /** `:name` segments in the path arrive in order as c.params. */
  on<R>(method: Method, path: string, fn: Handler<R>, options?: { edgeMaxAge?: number }) {
    const pattern = (this.opts.prefix ?? "") + path.replace(/:\w+/g, "([^/]+)");
    this.routes.push({ method, re: new RegExp(`^${pattern}$`), fn, jsonOnly: !!this.opts.jsonOnly, ...options });
  }
  include(...others: Router[]) {
    for (const o of others) this.routes.push(...o.routes);
    return this;
  }
  get<R>(path: string, fn: Handler<R>, options?: { edgeMaxAge?: number }) {
    this.on("GET", path, fn, options);
  }
  post<R>(path: string, fn: Handler<R>) {
    this.on("POST", path, fn);
  }
  patch<R>(path: string, fn: Handler<R>) {
    this.on("PATCH", path, fn);
  }
  delete<R>(path: string, fn: Handler<R>) {
    this.on("DELETE", path, fn);
  }

  handle = async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const headers = new Headers({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    try {
      if (req.method !== "GET" && crossSite(req, url)) fail(403, "crossSiteRefused");
      const { user, actor } = await viewerOf(req);
      await budget(req, url, user);
      for (const r of this.routes) {
        if (r.method !== req.method) continue;
        const m = r.re.exec(url.pathname);
        if (!m) continue;
        // the body and query are left out: they can carry passwords and tokens
        if (req.method !== "GET" && url.pathname !== "/api/me/stop-impersonating" && impersonating(user, actor)) {
          await audit(actor!, {
            action: "user.impersonate.request",
            targetType: "user",
            targetId: user!.id,
            label: user!.username,
            subjectId: user!.id,
            note: `${req.method} ${url.pathname}`,
          });
        }
        const body = await readBody(req, r.jsonOnly);
        const c: Ctx = {
          req,
          url,
          q: url.searchParams,
          user,
          actor,
          body,
          params: m.slice(1).map(decodeURIComponent),
          headers,
        };
        const out = await r.fn(c);
        if (out instanceof Response) return out;
        const json = JSON.stringify(out);
        if (r.edgeMaxAge) {
          headers.set("Vary", "Cookie, Authorization");
          if (!user && !actor) cacheAnonymousAtEdge(req, headers, r.edgeMaxAge);
        }
        return new Response(json, { headers });
      }
      return fail(404, "notFound");
    } catch (e) {
      // NaN or an out-of-range number reaches Postgres as a bad value: the input was wrong
      const pgCode = (e as { cause?: { code?: string } })?.cause?.code;
      if (pgCode === "22P02" || pgCode === "22003") e = new HttpError(400, "invalidNumber");
      const status = e instanceof HttpError ? e.status : 500;
      if (status === 500) console.error(e);
      if (e instanceof HttpError && e.retryAfter) headers.set("Retry-After", String(e.retryAfter));
      const locale = requestLocale(req);
      const error =
        e instanceof HttpError ? tr(locale, `errors.${e.key}`, e.params) : tr(locale, "errors.somethingWentWrong");
      return new Response(JSON.stringify({ error }), { status, headers });
    }
  };
}

export const ipOf = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";

/** Sliding window, at most an hour long. */
export async function limit(
  key: string,
  max: number,
  seconds: number,
  msg: ErrorKey = "tooManyAttempts"
): Promise<void> {
  if (!(await attempt(key, max, seconds * 1000))) fail(429, msg);
}

/** Fixed window: cheaper than limit(), and `seconds` may be any length. */
export async function throttle(
  key: string,
  max: number,
  seconds: number,
  msg: ErrorKey = "goingABitFast"
): Promise<void> {
  const wait = await hits(key, max, seconds);
  if (wait) throw new HttpError(429, msg, wait);
}

// Site-wide request budget against scraping. Pictures have their own limit (images/routes.ts).
const READS = {
  visitor: [
    [120, 60],
    [2000, 3600],
    [10_000, 86_400],
  ],
  member: [
    [300, 60],
    [6000, 3600],
    [40_000, 86_400],
  ],
} as const;
const WRITES = [
  [60, 60],
  [600, 3600],
  [3000, 86_400],
] as const;
const PER_ADDRESS = [
  [600, 60],
  [12_000, 3600],
] as const;
const SLOW = "goingTooFast";

async function budget(req: Request, url: URL, user: Viewer | null): Promise<void> {
  if (user && isStaff(user)) return;
  const isRead = req.method === "GET";
  if (isRead && url.pathname.startsWith("/api/image/")) return;
  const ip = ipOf(req);
  const who = user ? `u${user.id}` : `ip${ip}`;
  let rules: readonly (readonly [number, number])[];
  if (isRead) rules = READS[user ? "member" : "visitor"];
  // imports upload in big chunks and have their own limits (listening/imports.ts)
  else if (user && url.pathname.startsWith("/api/import")) rules = [];
  else rules = WRITES;
  const kind = isRead ? "r" : "w";
  const waits = await Promise.all([
    ...rules.map(([max, secs]) => hits(`api-${kind}:${who}`, max, secs)),
    ...PER_ADDRESS.map(([max, secs]) => hits(`api-ip:${ip}`, max, secs)),
  ]);
  const wait = Math.max(...waits);
  if (wait) throw new HttpError(429, SLOW, wait);
}

function hostOf(origin: string) {
  try {
    return new URL(origin.includes("://") ? origin : `https://${origin}`).host;
  } catch {
    return origin;
  }
}

const trustedHosts = new Set(
  (process.env.TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(hostOf)
);

function crossSite(req: Request, url: URL) {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    const host = new URL(origin).host;
    return host !== url.host && !trustedHosts.has(host);
  } catch {
    return true;
  }
}

/** Stops reading once the body passes `max`, so an oversized or chunked body is never held in full. */
export async function readCapped(req: Request, max: number): Promise<Uint8Array<ArrayBuffer> | null> {
  if (Number(req.headers.get("content-length")) > max) return null;
  const parts: Uint8Array[] = [];
  let n = 0;
  for await (const chunk of req.body ?? []) {
    n += chunk.length;
    if (n > max) return null;
    parts.push(chunk);
  }
  return new Uint8Array(Bun.concatArrayBuffers(parts));
}

async function readBody(req: Request, jsonOnly: boolean): Promise<Body> {
  if (req.method === "GET") return {};
  const isJson = (req.headers.get("content-type") || "").includes("application/json");
  if (!isJson) {
    if (jsonOnly && req.method === "POST") fail(415, "sendJson");
    return {};
  }
  let body: unknown;
  try {
    body = (await req.json()) ?? {};
  } catch {
    return bad("invalidJsonBody");
  }
  if (typeof body !== "object" || Array.isArray(body)) return bad("invalidJsonBody");
  return body as Body;
}

export function paging(q: URLSearchParams, def = 50, max = 200) {
  // floored: a fractional value would fail in SQL
  const limit = Math.min(max, Math.max(1, Math.floor(Number(q.get("limit"))) || def));
  const page = Math.max(1, Math.floor(Number(q.get("page"))) || 1);
  return { limit, page, offset: (page - 1) * limit };
}

export const int = (v: unknown): number | null => {
  let n = NaN;
  if (typeof v === "number") n = v;
  else if (typeof v === "string" && v.trim() !== "") n = Number(v);
  return Number.isInteger(n) ? n : null;
};

export const oneOf = <T extends string>(v: unknown, allowed: readonly T[]): T | null =>
  typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : null;
