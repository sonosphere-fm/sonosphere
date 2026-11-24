import { ApiError, call, type Params, type Reply } from "./service";
import { HttpError, ipOf, limit } from "../http";
import { hits } from "../kv";
import * as Sentry from "@sentry/bun";

// A body that cannot be read is ignored.
async function params(req: Request, url: URL): Promise<Params> {
  return paramsOf(url, req.method === "POST" ? await req.text().catch(() => "") : "", req.headers.get("content-type"));
}

export function paramsOf(url: URL, body: string, type: string | null): Params {
  const p: Params = Object.fromEntries(url.searchParams);
  if (!body) return p;
  try {
    if (type?.includes("json")) Object.assign(p, JSON.parse(body));
    else for (const [k, v] of new URLSearchParams(body)) p[k] = v;
  } catch {}
  return p;
}

const esc = (s: unknown) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fields = (v: object): [string, unknown][] => Object.entries(v);

// Arrays repeat the element, "@attr" holds its attributes and "#text" its own text.
function toXml(name: string, v: unknown): string {
  if (Array.isArray(v)) return v.map((x) => toXml(name, x)).join("");
  if (v === null || typeof v !== "object") return `<${name}>${esc(v ?? "")}</${name}>`;
  let attrs = "";
  let inner = "";
  for (const [k, x] of fields(v)) {
    if (k === "@attr") {
      if (x && typeof x === "object") {
        for (const [ak, av] of fields(x)) attrs += ` ${ak}="${esc(av)}"`;
      }
    } else if (k === "#text") {
      inner += esc(x);
    } else {
      inner += toXml(k, x);
    }
  }
  return `<${name}${attrs}>${inner}</${name}>`;
}

const XML = `<?xml version="1.0" encoding="UTF-8"?>\n`;

const headers = (json: boolean) => ({
  "Content-Type": json ? "application/json; charset=utf-8" : "text/xml; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
});

function ok(json: boolean, body: Reply): Response {
  if (json) return new Response(JSON.stringify(body), { headers: headers(json) });
  const inner = fields(body)
    .map(([k, v]) => toXml(k, v))
    .join("");
  return new Response(`${XML}<lfm status="ok">${inner}</lfm>`, { headers: headers(json) });
}

export function failed(json: boolean, error: number, message: string, status: number): Response {
  const body = json
    ? JSON.stringify({ error, message })
    : `${XML}<lfm status="failed"><error code="${error}">${message.replace(/[<&]/g, "")}</error></lfm>`;
  return new Response(body, { status, headers: headers(json) });
}

// About five calls a second, like Last.fm. Error 29 is what scrobbler apps back off on.
export async function throttled(key: string, json: boolean): Promise<Response | null> {
  const waits = await Promise.all([hits(key, 300, 60), hits(key, 6000, 3600), hits(key, 50_000, 86_400)]);
  const wait = Math.max(...waits);
  if (!wait) return null;
  const r = failed(json, 29, "Rate limit exceeded", 429);
  r.headers.set("Retry-After", String(wait));
  return r;
}

const FORBIDDEN = [10, 9, 4, 13];

export async function handleCompat(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const p = await params(req, url);
  const json = p.format === "json";
  const ip = ipOf(req);
  const slow = await throttled(`compat:${ip}`, json);
  if (slow) return slow;
  // password sign-ins share the site log-in form's per-address limit
  if (String(p.method ?? "").toLowerCase() === "auth.getmobilesession") {
    try {
      await limit(`login:${ip}`, 10, 300);
    } catch {
      return failed(json, 29, "Rate limit exceeded", 429);
    }
  }
  try {
    return ok(json, await call(p, url.origin));
  } catch (e) {
    if (e instanceof ApiError) return failed(json, e.code, e.message, FORBIDDEN.includes(e.code) ? 403 : 400);
    // rules shared with the website, such as its rate limits and who may tag
    if (e instanceof HttpError) {
      const r = failed(json, e.status === 429 ? 29 : 6, e.message, e.status);
      if (e.retryAfter) r.headers.set("Retry-After", String(e.retryAfter));
      return r;
    }
    console.error(e);
    Sentry.captureException(e);
    return failed(json, 16, "There was a temporary error processing your request. Please try again", 500);
  }
}
