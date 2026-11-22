import { requireItem } from "../catalog/service";
import { adminOnly, confirmed, need } from "../guards";
import { bad, fail, ipOf, limit, missing, Router, type Ctx } from "../http";
import { getJson, setJson } from "../kv";
import { store } from "../storage";
import { caps, spendRead } from "../storage/budget";
import { convert, sniff } from "./process";
import { fetchRemote, sized, type Picture } from "./remote";
import * as repo from "./repo";
import type { Ok } from "../../shared/auth";
import type { ImageSaved } from "../../shared/images";

export const router = new Router();

const MAX_BYTES = 8_000_000;
const IMMUTABLE = { "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" };

async function readCapped(req: Request, max: number): Promise<Uint8Array> {
  if (Number(req.headers.get("content-length")) > max) bad("Images must be under 8 MB");
  const parts: Uint8Array[] = [];
  let n = 0;
  for await (const chunk of req.body ?? []) {
    n += chunk.length;
    if (n > max) bad("Images must be under 8 MB");
    parts.push(chunk);
  }
  return Buffer.concat(parts);
}

async function siteBytes(): Promise<number> {
  const hit = await getJson<number>("storage-total");
  if (hit !== null) return hit;
  const n = await repo.bytesTotal();
  await setJson("storage-total", n, 60_000);
  return n;
}

// the bytes as uploaded are never stored or served, only the converted WebP
async function storeImage(c: Ctx, userId: number, preserveGif = false): Promise<string> {
  await limit(`upload:${userId}`, 20, 3600, "Too many uploads. Wait a while and try again.");
  await limit(`upload-ip:${ipOf(c.req)}`, 40, 3600, "Too many uploads. Wait a while and try again.");
  const full = "You have used all the space for your pictures.";
  const used = await repo.bytesBy(userId);
  if (used >= caps.userBytes) fail(403, full);
  if (caps.siteBytes !== null && (await siteBytes()) >= caps.siteBytes)
    fail(503, "Picture uploads are paused for now.");
  const data = await readCapped(c.req, MAX_BYTES);
  if (!data.length) bad("Empty upload");
  const img = await convert(data);
  if (preserveGif && sniff(data) === "gif") {
    if (used + data.length > caps.userBytes) fail(403, full);
    return repo.saveGif(data, userId);
  }
  if (used + img.large.length + img.small.length > caps.userBytes) fail(403, full);
  return repo.saveImage(img, userId);
}

const CACHE_BYTES = 64_000_000;
const cache = new Map<string, Picture>();
let cached = 0;

function remember(key: string, pic: Picture): Picture {
  cache.set(key, pic);
  cached += pic.data.length;
  for (const [k, v] of cache) {
    if (cached <= CACHE_BYTES) break;
    cache.delete(k);
    cached -= v.data.length;
  }
  return pic;
}

function recall(key: string): Picture | null {
  const pic = cache.get(key);
  if (!pic) return null;
  cache.delete(key);
  cache.set(key, pic);
  return pic;
}

async function stored(key: string): Promise<Picture | null> {
  if (!(await spendRead())) fail(503, "Pictures are unavailable for the rest of today");
  const data = await store.get(key);
  return data && { mime: "image/webp", data };
}

const ART_LIFE = 90 * 86400_000;
const SPOTIFY_ART = /^https:\/\/i\.scdn\.co\/image\/[0-9a-f]{40}$/;
const artKey = (id: string) => `art:${id}`;

// every picture comes from this address, whatever its source, so pages never reveal where one is kept
async function load(id: string, small: boolean): Promise<Picture | null> {
  const get = (url: string) => fetchRemote(url).catch(() => null);
  // not every picture has every size, so the address as saved is the fallback
  const remote = async (url: string) => {
    const want = sized(url, small);
    return (await get(want)) ?? (want === url ? null : get(url));
  };
  const img = await repo.findImage(id);
  if (!img) {
    const art = await getJson<string>(artKey(id));
    return art ? remote(art) : null;
  }
  if ("data" in img) return img;
  if ("url" in img) return remote(img.url);
  return stored(repo.fileOf(img.key, small ? "small" : "large"));
}

router.get("/api/image/:id", async (c) => {
  await limit(`image:${ipOf(c.req)}`, 1500, 60, "Too many requests");
  const id = c.params[0] ?? "";
  if (!/^[0-9a-f]{32}$/.test(id)) missing("Image");
  const small = c.q.get("s") === "small";
  const key = small ? `${id}-s` : id;
  const pic = recall(key) ?? remember(key, (await load(id, small)) ?? missing("Image"));
  return new Response(pic.data, { headers: { "Content-Type": pic.mime, ...IMMUTABLE } });
});

// album art the player found on Spotify, given an address of ours like every other picture
router.post<ImageSaved>("/api/image/art", async (c) => {
  need(c);
  await limit(`art:${ipOf(c.req)}`, 300, 3600, "Too many requests");
  const url = String(c.body.url ?? "");
  if (!SPOTIFY_ART.test(url)) bad("Unknown picture");
  const image = new Bun.CryptoHasher("sha256").update(url).digest("hex").slice(0, 32);
  await setJson(artKey(image), url, ART_LIFE);
  return { image };
});

router.post<ImageSaved>("/api/image", async (c) => {
  const u = confirmed(need(c));
  const type = c.q.get("type");
  if (type === "about" || type === "changelog") {
    if (type === "changelog") adminOnly(c);
    return { image: await storeImage(c, u.id) };
  }
  if (type === "user" || type === "banner") {
    const image = await storeImage(c, u.id, true);
    if (type === "banner") await repo.setUserBanner(u.id, image);
    else await repo.setUserImage(u.id, image);
    return { image };
  }
  const item = await requireItem(type, c.q.get("id"), ["artist", "album"]);
  const image = await storeImage(c, u.id);
  await repo.setCatalogueImage(item.type, item.row.id, image);
  return { image };
});

router.delete<Ok>("/api/image", async (c) => {
  const u = need(c);
  const type = c.q.get("type") ?? "user";
  if (type === "banner") await repo.setUserBanner(u.id, null);
  else if (type === "user") await repo.setUserImage(u.id, null);
  else bad("type must be user or banner");
  return { ok: true };
});
