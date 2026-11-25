import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { limit } from "../http";
import { convert } from "../images/process";
import { readCapped } from "../images/remote";
import { getJson, setJson } from "../kv";
import type { User } from "../users/repo";
import { digest } from "../util";
import * as groups from "./groups";
import * as dm from "./service";
import type { DmLink, DmLinkPreview } from "../../shared/dm";

const MAX_URL = 2048;
const MAX_HTML = 2_000_000;
const MAX_HOPS = 4;
const HOUR = 3600_000;
const SITE = process.env.SITE_URL;
const AGENT = `Mozilla/5.0 (compatible; SonosphereBot/1.0${SITE ? `; +${SITE}` : ""})`;

const octets = (ip: string) => ip.split(".").map(Number) as [number, number, number, number];

function publicV4(ip: string): boolean {
  const [a, b, c] = octets(ip);
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b < 128) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b < 32) return false;
  if (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)))) return false;
  if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return false;
  return !(a === 203 && b === 0 && c === 113);
}

// global unicast only, minus the ranges that tunnel to IPv4 or are reserved for documentation
function publicV6(ip: string): boolean {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) return publicV4(mapped[1]!);
  if (ip.startsWith("::")) return false;
  const head = parseInt(ip.split(":")[0]!, 16);
  if (head < 0x2000 || head > 0x3fff || head === 0x2002) return false;
  return !/^2001:(0{0,4}|db8):/i.test(ip);
}

// Checked on every hop. Only default ports, so nothing reachable from inside the network answers even if a name
// resolves differently by the time it is fetched.
async function reachable(u: URL): Promise<boolean> {
  if ((u.protocol !== "https:" && u.protocol !== "http:") || u.username || u.password || u.port) return false;
  const host = u.hostname.replace(/^\[|\]$/g, "");
  const family = isIP(host);
  let addrs = [{ address: host, family }];
  if (!family) addrs = host.includes(".") ? await lookup(host, { all: true }).catch(() => []) : [];
  return addrs.length > 0 && addrs.every((a) => (a.family === 4 ? publicV4(a.address) : publicV6(a.address)));
}

async function get(url: string, accept: string): Promise<{ res: Response; at: URL } | null> {
  let at = new URL(url);
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    if (!(await reachable(at))) return null;
    const res = await fetch(at, {
      redirect: "manual",
      headers: { "User-Agent": AGENT, Accept: accept, "Accept-Language": "en" },
      signal: AbortSignal.timeout(8000),
    });
    const next = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && next) {
      await res.body?.cancel();
      at = new URL(next, at);
      continue;
    }
    if (res.ok && res.body) return { res, at };
    await res.body?.cancel();
    return null;
  }
  return null;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, e: string) => {
    if (e[0] !== "#") return ENTITIES[e.toLowerCase()] ?? whole;
    const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1));
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : whole;
  });
}

const tidy = (s: string | undefined, max: number) =>
  decode(s ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

function charsetOf(type: string): string {
  const named = /charset=["']?([\w-]+)/i.exec(type)?.[1];
  try {
    return new TextDecoder(named).encoding;
  } catch {
    return "utf-8";
  }
}

// metadata lives in the head, so a long page only needs its start
async function start(body: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const parts: Uint8Array[] = [];
  let n = 0;
  for await (const chunk of body) {
    parts.push(chunk);
    n += chunk.length;
    if (n >= MAX_HTML) break;
  }
  return Buffer.concat(parts).subarray(0, MAX_HTML);
}

type Found = Omit<DmLinkPreview, "url" | "image"> & { picture: string | null };

async function scrape(url: string): Promise<Found | null> {
  const got = await get(url, "text/html,application/xhtml+xml");
  if (!got) return null;
  const type = got.res.headers.get("content-type") ?? "";
  if (!/^(text\/html|application\/xhtml\+xml)/i.test(type)) {
    await got.res.body!.cancel();
    return null;
  }
  const bytes = await start(got.res.body!);
  const meta = new Map<string, string>();
  let titles = 0;
  let title = "";
  await new HTMLRewriter()
    .on("meta", {
      element(e) {
        const key = (e.getAttribute("property") ?? e.getAttribute("name") ?? "").toLowerCase();
        const content = e.getAttribute("content");
        if (key && content?.trim() && !meta.has(key)) meta.set(key, content);
      },
    })
    .on("title", {
      element() {
        titles++;
      },
      text(t) {
        if (titles === 1) title += t.text;
      },
    })
    .transform(new Response(new TextDecoder(charsetOf(type)).decode(bytes)))
    .text();
  const pick = (...keys: string[]) => keys.map((k) => meta.get(k)).find(Boolean);
  const name = tidy(pick("og:title", "twitter:title") ?? title, 200);
  if (!name) return null;
  const image = pick("og:image:secure_url", "og:image", "og:image:url", "twitter:image", "twitter:image:src");
  let picture: string | null = null;
  if (image) {
    const u = URL.parse(decode(image).trim(), got.at);
    if (u && (u.protocol === "https:" || u.protocol === "http:")) picture = u.href;
  }
  return {
    title: name,
    description: tidy(pick("og:description", "twitter:description", "description"), 300) || null,
    site: tidy(pick("og:site_name"), 80) || got.at.hostname.replace(/^www\./, ""),
    picture,
  };
}

const pictureKey = (id: string) => `dmlink-pic:${id}`;
const pending = new Map<string, Promise<DmLinkPreview | null>>();

async function preview(me: User, url: string): Promise<DmLinkPreview | null> {
  const key = `dmlink:${digest(url)}`;
  const hit = await getJson<{ p: DmLinkPreview | null }>(key);
  if (hit) return hit.p;
  const running = pending.get(key);
  if (running) return running;
  await limit(`dmlink:${me.id}`, 60, 3600, "tooManyRequests");
  const job = (async () => {
    const found = await scrape(url).catch(() => null);
    let p: DmLinkPreview | null = null;
    if (found) {
      const { picture, ...rest } = found;
      const image = picture && digest(picture).slice(0, 32);
      if (picture && image) await setJson(pictureKey(image), { url: picture }, 7 * 24 * HOUR);
      p = { url, ...rest, image };
    }
    await setJson(key, { p }, p ? 24 * HOUR : HOUR);
    return p;
  })().finally(() => pending.delete(key));
  pending.set(key, job);
  return job;
}

export async function linkFor(me: User, q: URLSearchParams): Promise<DmLink> {
  const url = q.get("url") ?? "";
  const parsed = url.length <= MAX_URL ? URL.parse(url) : null;
  if (!parsed || (parsed.protocol !== "https:" && parsed.protocol !== "http:")) return { preview: null };
  const group = q.get("group");
  const shared = group ? await groups.sharesLink(me, group, url) : await dm.sharesLink(me, q.get("thread"), url);
  return { preview: shared ? await preview(me, url) : null };
}

// Re-encoded here, so the picture's site never sees who is looking and nothing but a plain image reaches the page.
export async function linkPicture(id: string): Promise<Uint8Array<ArrayBuffer> | null> {
  const cacheKey = `dmlink-thumb:${id}`;
  const cached = await getJson<{ b: string }>(cacheKey);
  if (cached) return new Uint8Array(Buffer.from(cached.b, "base64"));
  const source = await getJson<{ url: string }>(pictureKey(id));
  if (!source) return null;
  const got = await get(source.url, "image/*").catch(() => null);
  const data = got && (await readCapped(got.res.body!));
  if (!data) return null;
  const small = await convert(data)
    .then((c) => new Uint8Array(c.small))
    .catch(() => null);
  if (!small) return null;
  await setJson(cacheKey, { b: Buffer.from(small).toString("base64") }, 7 * 24 * HOUR);
  return small;
}
