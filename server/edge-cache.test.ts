import { afterEach, beforeEach, expect, test } from "bun:test";
import { cacheAnonymousAtEdge } from "./edge-cache";

const setting = "CLOUDFLARE_CACHE_PUBLIC";
const original = process.env[setting];
const cacheHeader = "Cloudflare-CDN-Cache-Control";

beforeEach(() => {
  process.env[setting] = "1";
});

afterEach(() => {
  if (original === undefined) delete process.env[setting];
  else process.env[setting] = original;
});

test("offers Cloudflare a separate TTL for an anonymous GET with analytics cookies", () => {
  const req = new Request("https://sonosphere.fm/", { headers: { Cookie: "__cf_bm=bot; analytics=123" } });
  const headers = new Headers({ "Cache-Control": "private, no-cache" });
  cacheAnonymousAtEdge(req, headers, 60);
  expect(headers.get(cacheHeader)).toBe("public, max-age=60");
  expect(headers.get("Cache-Control")).toBe("private, no-cache");
});

const privateRequests: RequestInit[] = [
  { headers: { Cookie: "foo=1; sid=stale" } },
  { headers: { Cookie: "act_as=123" } },
  { headers: { Authorization: "Bearer private" } },
  { method: "POST" },
];

test.each(privateRequests)("excludes requests that might carry session state (%j)", (init) => {
  const headers = new Headers();
  cacheAnonymousAtEdge(new Request("https://sonosphere.fm/", init), headers, 60);
  expect(headers.has(cacheHeader)).toBe(false);
});

test("a response setting a cookie stays private", () => {
  const headers = new Headers({ "Set-Cookie": "sid=new" });
  cacheAnonymousAtEdge(new Request("https://sonosphere.fm/"), headers, 60);
  expect(headers.has(cacheHeader)).toBe(false);
});

test("edge caching defaults to off", () => {
  delete process.env[setting];
  const headers = new Headers();
  cacheAnonymousAtEdge(new Request("https://sonosphere.fm/"), headers, 60);
  expect(headers.has(cacheHeader)).toBe(false);
});
