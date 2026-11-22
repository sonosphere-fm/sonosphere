import { requireItem } from "../catalog/service";
import { confirmed, need } from "../guards";
import { bad, fail, ipOf, limit, missing, Router, type Ctx } from "../http";
import { getJson, setJson } from "../kv";
import { store } from "../storage";
import { caps, spendRead } from "../storage/budget";
import { convert } from "./process";
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
async function storeImage(c: Ctx, userId: number): Promise<string> {
  await limit(`upload:${userId}`, 20, 3600, "Too many uploads. Wait a while and try again.");
  await limit(`upload-ip:${ipOf(c.req)}`, 40, 3600, "Too many uploads. Wait a while and try again.");
  const full = "You have used all the space for your pictures.";
  const used = await repo.bytesBy(userId);
  if (used >= caps.userBytes) fail(403, full);
  if (caps.siteBytes !== null && (await siteBytes()) >= caps.siteBytes) fail(503, "Picture uploads are paused for now.");
  const data = await readCapped(c.req, MAX_BYTES);
  if (!data.length) bad("Empty upload");
  const img = await convert(data);
  if (used + img.large.length + img.small.length > caps.userBytes) fail(403, full);
  return repo.saveImage(img, userId);
}

router.get("/api/image/:id", async c => {
  await limit(`image:${ipOf(c.req)}`, 1500, 60, "Too many requests");
  const id = c.params[0] ?? "";
  const found = /^[0-9a-f]{32}$/.test(id) ? await repo.findImage(id) : null;
  const img = found ?? missing("Image");
  if ("data" in img) return new Response(img.data, { headers: { "Content-Type": img.mime, ...IMMUTABLE } });
  if ("url" in img) {
    return new Response(null, { status: 302, headers: { Location: img.url, "Cache-Control": "public, max-age=86400" } });
  }
  const file = repo.fileOf(img.key, c.q.get("s") === "small" ? "small" : "large");
  const link = store.link(file);
  if (link) {
    if (!(await spendRead())) fail(503, "Pictures are unavailable for the rest of today");
    // the same link is handed out until `until`, so the browser may keep the redirect that long
    const age = Math.max(0, link.until - Math.floor(Date.now() / 1000) - 60);
    return new Response(null, { status: 302, headers: { Location: link.url, "Cache-Control": `private, max-age=${age}` } });
  }
  const bytes = (await store.get(file)) ?? missing("Image");
  return new Response(bytes, { headers: { "Content-Type": "image/webp", ...IMMUTABLE } });
});

router.post<ImageSaved>("/api/image", async c => {
  const u = confirmed(need(c));
  const type = c.q.get("type");
  if (type === "user" || type === "banner") {
    const image = await storeImage(c, u.id);
    if (type === "banner") await repo.setUserBanner(u.id, image);
    else await repo.setUserImage(u.id, image);
    return { image };
  }
  const item = await requireItem(type, c.q.get("id"), ["artist", "album"]);
  const image = await storeImage(c, u.id);
  await repo.setCatalogueImage(item.type, item.row.id, image);
  return { image };
});

router.delete<Ok>("/api/image", async c => {
  const u = need(c);
  const type = c.q.get("type") ?? "user";
  if (type === "banner") await repo.setUserBanner(u.id, null);
  else if (type === "user") await repo.setUserImage(u.id, null);
  else bad("type must be user or banner");
  return { ok: true };
});
