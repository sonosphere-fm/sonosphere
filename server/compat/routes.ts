// The scrobbler-compatible web service at /2.0/. It does not speak the site's own JSON API: parameters come from
// the query string or a form (or JSON) body, replies are XML unless format=json is asked for, and failures carry
// the service's own error numbers. So it reads requests and writes responses itself instead of using Router.
import { ApiError, call, type Params, type Reply } from "./service";

export { COMPAT_METHODS } from "./service";

/** Query parameters, with the fields of a POSTed form or JSON body on top. A body that cannot be read is ignored. */
async function params(req: Request, url: URL): Promise<Params> {
  const p: Params = Object.fromEntries(url.searchParams);
  if (req.method !== "POST") return p;
  const type = req.headers.get("content-type") || "";
  try {
    if (type.includes("json")) { const body: unknown = await req.json(); Object.assign(p, body); }
    else for (const [k, v] of new URLSearchParams(await req.text())) p[k] = v;
  } catch { /* fall through with query params */ }
  return p;
}

// ---------- XML ----------
const esc = (s: unknown) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fields = (v: object): [string, unknown][] => Object.entries(v);
/** One element. Arrays repeat it, "@attr" holds its attributes and "#text" its own text. */
function toXml(name: string, v: unknown): string {
  if (Array.isArray(v)) return v.map(x => toXml(name, x)).join("");
  if (v === null || typeof v !== "object") return `<${name}>${esc(v ?? "")}</${name}>`;
  let attrs = "", inner = "";
  for (const [k, x] of fields(v)) {
    if (k === "@attr") { if (x && typeof x === "object") for (const [ak, av] of fields(x)) attrs += ` ${ak}="${esc(av)}"`; }
    else if (k === "#text") inner += esc(x);
    else inner += toXml(k, x);
  }
  return `<${name}${attrs}>${inner}</${name}>`;
}
const XML = `<?xml version="1.0" encoding="UTF-8"?>\n`;

// ---------- responses ----------
const headers = (json: boolean) => ({ "Content-Type": json ? "application/json; charset=utf-8" : "text/xml; charset=utf-8", "Access-Control-Allow-Origin": "*" });
const ok = (json: boolean, body: Reply) =>
  new Response(json ? JSON.stringify(body) : `${XML}<lfm status="ok">${fields(body).map(([k, v]) => toXml(k, v)).join("")}</lfm>`, { headers: headers(json) });
const failed = (json: boolean, error: number, message: string, status: number) =>
  new Response(json ? JSON.stringify({ error, message }) : `${XML}<lfm status="failed"><error code="${error}">${message.replace(/[<&]/g, "")}</error></lfm>`, { status, headers: headers(json) });
/** Failures that mean "you may not", as opposed to "that request makes no sense". */
const FORBIDDEN = [10, 9, 4, 13];

export async function handleCompat(req: Request): Promise<Response> {
  const url = new URL(req.url), p = await params(req, url), json = p.format === "json";
  try {
    return ok(json, await call(p, url.origin));
  } catch (e) {
    if (e instanceof ApiError) return failed(json, e.code, e.message, FORBIDDEN.includes(e.code) ? 403 : 400);
    console.error(e);
    return failed(json, 16, "There was a temporary error processing your request. Please try again", 500);
  }
}
