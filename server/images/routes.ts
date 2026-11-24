import { requireItem } from "../catalog/service";
import { adminOnly, confirmed, need, poster } from "../guards";
import { bad, fail, ipOf, limit, missing, Router, type Ctx } from "../http";
import { getJson, setJson } from "../kv";
import { store } from "../storage";
import { caps, spendRead } from "../storage/budget";
import { convert, sniff } from "./process";
import { stripGifMetadata } from "./metadata";
import { fetchRemote, sized, type Picture } from "./remote";
import * as gallery from "./gallery";
import * as repo from "./repo";
import type { Ok } from "../../shared/auth";
import type { GalleryList, ImageSaved } from "../../shared/images";

export const router = new Router();

const MAX_BYTES = 8_000_000;
const IMMUTABLE = { "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" };

async function readCapped(req: Request, max: number): Promise<Uint8Array> {
  if (Number(req.headers.get("content-length")) > max) bad("imagesMustUnder8Mb");
  const parts: Uint8Array[] = [];
  let n = 0;
  for await (const chunk of req.body ?? []) {
    n += chunk.length;
    if (n > max) bad("imagesMustUnder8Mb");
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

// Store converted WebP or animation-preserving GIF, always stripped of metadata.
async function storeImage(c: Ctx, userId: number, preserveGif = false): Promise<string> {
  await limit(`upload:${userId}`, 20, 3600, "tooManyUploadsWaitWhile");
  await limit(`upload-ip:${ipOf(c.req)}`, 40, 3600, "tooManyUploadsWaitWhile");
  const full = "pictureSpaceFull";
  const used = await repo.bytesBy(userId);
  if (used >= caps.userBytes) fail(403, full);
  if (caps.siteBytes !== null && (await siteBytes()) >= caps.siteBytes) fail(503, "pictureUploadsPausedNow");
  const data = await readCapped(c.req, MAX_BYTES);
  if (!data.length) bad("emptyUpload");
  const img = await convert(data);
  if (preserveGif && sniff(data) === "gif") {
    let stripped: Uint8Array;
    try {
      stripped = stripGifMetadata(data);
    } catch {
      return bad("gifCouldNotRead");
    }
    if (used + stripped.length > caps.userBytes) fail(403, full);
    return repo.saveGif(stripped, userId);
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
  if (!(await spendRead())) fail(503, "picturesUnavailableRestToday");
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

export async function picture(id: string, small: boolean): Promise<Picture | null> {
  const key = small ? `${id}-s` : id;
  const hit = recall(key);
  if (hit) return hit;
  const pic = await load(id, small);
  return pic && remember(key, pic);
}

router.get("/api/image/:id", async (c) => {
  await limit(`image:${ipOf(c.req)}`, 1500, 60, "tooManyRequests");
  const id = c.params[0] ?? "";
  if (!/^[0-9a-f]{32}$/.test(id)) missing("imageNotFound");
  const pic = (await picture(id, c.q.get("s") === "small")) ?? missing("imageNotFound");
  return new Response(pic.data, { headers: { "Content-Type": pic.mime, ...IMMUTABLE } });
});

// album art the player found on Spotify, given an address of ours like every other picture
router.post<ImageSaved>("/api/image/art", async (c) => {
  need(c);
  await limit(`art:${ipOf(c.req)}`, 300, 3600, "tooManyRequests");
  const url = String(c.body.url ?? "");
  if (!SPOTIFY_ART.test(url)) bad("unknownPicture");
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
  if (!(await gallery.hasRoom(item.type, item.row.id))) fail(403, "galleryFull");
  const image = await storeImage(c, u.id);
  await gallery.add(item.type, item.row.id, image, u.id);
  return { image };
});

router.get<GalleryList>("/api/gallery", async (c) => {
  await limit(`gallery:${ipOf(c.req)}`, 600, 60, "tooManyRequests");
  const item = await requireItem(c.q.get("type"), c.q.get("id"), ["artist", "album"]);
  return gallery.list(item.type, item.row.id, item.row.imageId, c.user?.id ?? null);
});

router.post<GalleryList>("/api/gallery/vote", async (c) => {
  const u = confirmed(poster(c));
  await limit(`gallery-vote:${u.id}`, 240, 3600, "tooManyVotes");
  const entryId = Number(c.body.entryId);
  if (!Number.isSafeInteger(entryId) || entryId <= 0) bad("imageNotFound");
  const raw = c.body.value;
  const value = raw === 1 || raw === -1 || raw === 0 ? raw : bad("invalidVote");
  const r = await gallery.vote(u.id, entryId, value);
  return gallery.list(r.kind, r.itemId, r.main, u.id);
});

router.delete<GalleryList>("/api/gallery/:id", async (c) => {
  const u = need(c);
  const entryId = Number(c.params[0]);
  if (!Number.isSafeInteger(entryId) || entryId <= 0) missing("imageNotFound");
  const r = await gallery.remove(u, c.actor ?? u, entryId);
  return gallery.list(r.kind, r.itemId, r.main, u.id);
});

router.delete<Ok>("/api/image", async (c) => {
  const u = need(c);
  const type = c.q.get("type") ?? "user";
  if (type === "banner") await repo.setUserBanner(u.id, null);
  else if (type === "user") await repo.setUserImage(u.id, null);
  else bad("typeMustUserBanner");
  return { ok: true };
});
