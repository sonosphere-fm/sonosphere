// The HTTP layer shared by every domain: a small router, the request context handlers receive, and the errors
// they throw. Route files (server/<domain>/routes.ts) register handlers here; they parse input, check who is
// asking, call their domain's service or repo, and return a plain object that is sent as JSON.
import type { users } from "./db/schema";
import { sessionUser } from "./auth/session";
import { attempt, hits } from "./kv";
import { isStaff } from "./site/roles";

export class HttpError extends Error { constructor(public status: number, message: string, public retryAfter = 0) { super(message); } }
export const fail = (status: number, msg: string): never => { throw new HttpError(status, msg); };
export const bad = (msg: string): never => fail(400, msg);
export const missing = (what: string): never => fail(404, `${what} not found`);

/** The signed-in account, as stored. */
export type Viewer = typeof users.$inferSelect;
/** A JSON request body before validation: handlers must check each field they read. */
export type Body = Record<string, unknown>;
export type Ctx = { req: Request; url: URL; q: URLSearchParams; user: Viewer | null; body: Body; params: string[]; headers: Headers };
export type Handler<R = unknown> = (c: Ctx) => R | Response | Promise<R | Response>;
type Method = "GET" | "POST" | "PATCH" | "DELETE";
type Options = {
  /** Path prefix added to every route. */
  prefix?: string;
  /** Refuse writes whose body is not JSON (the admin API). */
  jsonOnly?: boolean;
};

export class Router {
  private routes: { method: Method; re: RegExp; fn: Handler; jsonOnly: boolean }[] = [];
  constructor(private opts: Options = {}) {}

  /** Registers a handler. `:name` segments in the path arrive in order as c.params. */
  on<R>(method: Method, path: string, fn: Handler<R>) {
    this.routes.push({ method, re: new RegExp("^" + (this.opts.prefix ?? "") + path.replace(/:\w+/g, "([^/]+)") + "$"), fn, jsonOnly: !!this.opts.jsonOnly });
  }
  /** Adds every route of other routers to this one, in order. Each keeps the options it was registered with. */
  include(...others: Router[]) { for (const o of others) this.routes.push(...o.routes); return this; }
  get<R>(path: string, fn: Handler<R>) { this.on("GET", path, fn); }
  post<R>(path: string, fn: Handler<R>) { this.on("POST", path, fn); }
  patch<R>(path: string, fn: Handler<R>) { this.on("PATCH", path, fn); }
  delete<R>(path: string, fn: Handler<R>) { this.on("DELETE", path, fn); }

  handle = async (req: Request): Promise<Response> => {
    const url = new URL(req.url), headers = new Headers({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    try {
      // Writes must come from this site: a browser always sends Origin on a cross-site write.
      if (req.method !== "GET" && crossSite(req, url)) fail(403, "Cross-site request refused");
      const user = await sessionUser(tokenOf(req));
      await budget(req, url, user);
      for (const r of this.routes) {
        if (r.method !== req.method) continue;
        const m = r.re.exec(url.pathname);
        if (!m) continue;
        const c: Ctx = { req, url, q: url.searchParams, user, body: await readBody(req, r.jsonOnly), params: m.slice(1).map(decodeURIComponent), headers };
        const out = await r.fn(c);
        return out instanceof Response ? out : new Response(JSON.stringify(out), { headers });
      }
      return fail(404, "Not found");
    } catch (e) {
      // a number that is not one (NaN) or does not fit the column reaches Postgres as a bad value: the input was wrong
      const pgCode = (e as { cause?: { code?: string } })?.cause?.code;
      if (pgCode === "22P02" || pgCode === "22003") e = new HttpError(400, "Invalid number");
      const status = e instanceof HttpError ? e.status : 500;
      if (status === 500) console.error(e);
      if (e instanceof HttpError && e.retryAfter) headers.set("Retry-After", String(e.retryAfter));
      return new Response(JSON.stringify({ error: e instanceof HttpError ? e.message : "Something went wrong" }), { status, headers });
    }
  };
}

/** The session token in a request's cookie, or "". */
export const tokenOf = (req: Request) => /(?:^|;\s*)sid=([a-f0-9]+)/.exec(req.headers.get("cookie") || "")?.[1] || "";

/** The visitor's address. In production nginx sets X-Forwarded-For to the address Cloudflare reports (deploy/spin.nginx). */
export const ipOf = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";

/**
 * Counts an attempt under `key` and refuses with 429 once there have been `max` within `seconds` (at most an hour).
 * The count is shared by every site process (server/kv.ts).
 */
export async function limit(key: string, max: number, seconds: number, msg = "Too many attempts. Wait a few minutes and try again."): Promise<void> {
  if (!(await attempt(key, max, seconds * 1000))) fail(429, msg);
}

/**
 * Like limit(), with a fixed window instead of a sliding one: cheaper, so it suits busy routes and day-long caps
 * (`seconds` may be anything). Refuses with 429 and a Retry-After saying when the window resets.
 */
export async function throttle(key: string, max: number, seconds: number, msg = "You are going a bit fast. Wait a moment and try again."): Promise<void> {
  const wait = await hits(key, max, seconds);
  if (wait) throw new HttpError(429, msg, wait);
}

// ---------- the site-wide budget ----------
// Every API request counts against its sender, so nobody can walk the whole catalogue or every profile page by page.
// A person browsing makes a handful of requests per page, which stays far inside these; a scraper does not.
// Signed-in people are counted by account and get more room; everyone is also counted by address, which caps what
// many throwaway accounts on one machine can do together. Staff are not counted (the portal makes many requests).
// Pictures have their own, larger limit (images/routes.ts).
const READS = { visitor: [[120, 60], [2000, 3600], [10_000, 86_400]], member: [[300, 60], [6000, 3600], [40_000, 86_400]] } as const;
const WRITES = [[60, 60], [600, 3600], [3000, 86_400]] as const;
const PER_ADDRESS = [[600, 60], [12_000, 3600]] as const;
const SLOW = "You are going too fast. Wait a little and try again.";

async function budget(req: Request, url: URL, user: Viewer | null): Promise<void> {
  if (user && isStaff(user)) return;
  if (req.method === "GET" && url.pathname.startsWith("/api/image/")) return;
  const ip = ipOf(req), who = user ? `u${user.id}` : `ip${ip}`;
  // imports upload in big chunks and have their own limits (server/listening/imports.ts), so a huge one isn't cut off
  const rules = req.method === "GET" ? READS[user ? "member" : "visitor"] : user && url.pathname.startsWith("/api/import") ? [] : WRITES;
  const kind = req.method === "GET" ? "r" : "w";
  const waits = await Promise.all([
    ...rules.map(([max, secs]) => hits(`api-${kind}:${who}`, max, secs)),
    ...PER_ADDRESS.map(([max, secs]) => hits(`api-ip:${ip}`, max, secs)),
  ]);
  const wait = Math.max(...waits);
  if (wait) throw new HttpError(429, SLOW, wait);
}

/** Other addresses the site is served from, such as a proxy in front of it (TRUSTED_ORIGINS, comma separated). */
const trustedHosts = new Set((process.env.TRUSTED_ORIGINS ?? "").split(",").map(s => s.trim()).filter(Boolean).map(s => {
  try { return new URL(s.includes("://") ? s : `https://${s}`).host; } catch { return s; }
}));

function crossSite(req: Request, url: URL) {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try { const host = new URL(origin).host; return host !== url.host && !trustedHosts.has(host); } catch { return true; }
}

async function readBody(req: Request, jsonOnly: boolean): Promise<Body> {
  if (req.method === "GET") return {};
  const isJson = (req.headers.get("content-type") || "").includes("application/json");
  if (!isJson) { if (jsonOnly && req.method === "POST") fail(415, "Send JSON"); return {}; }
  let body: unknown;
  try { body = (await req.json()) ?? {}; } catch { return bad("Invalid JSON body"); }
  if (typeof body !== "object" || Array.isArray(body)) return bad("Invalid JSON body");
  return body as Body;
}

// ---------- reading input ----------
/** Page and page size from the query string. */
export function paging(q: URLSearchParams, def = 50, max = 200) {
  // floored: a fractional limit or page ("2.5") would otherwise reach SQL and fail
  const limit = Math.min(max, Math.max(1, Math.floor(Number(q.get("limit"))) || def)), page = Math.max(1, Math.floor(Number(q.get("page"))) || 1);
  return { limit, page, offset: (page - 1) * limit };
}
/** A whole number from untrusted input, or null. */
export const int = (v: unknown): number | null => { const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN; return Number.isInteger(n) ? n : null; };
/** One of a fixed set of strings from untrusted input, or null. */
export const oneOf = <T extends string>(v: unknown, allowed: readonly T[]): T | null => (typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : null);
