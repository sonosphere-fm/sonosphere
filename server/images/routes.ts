// HTTP routes for pictures: serving one, and uploading a profile picture, artist picture or album cover.
// An upload is the raw file as the request body, with its type in Content-Type.
import { requireItem } from "../catalog/service";
import { need } from "../guards";
import { bad, int, missing, Router, type Ctx } from "../http";
import * as repo from "./repo";
import type { Ok } from "../../shared/auth";
import type { ImageSaved } from "../../shared/images";

export const router = new Router();

const TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_BYTES = 2_000_000;

/** Checks and stores the picture in the request body, and returns its id. */
async function storeImage(c: Ctx, userId: number): Promise<number> {
  const mime = (c.req.headers.get("content-type") || "").split(";")[0] ?? "";
  if (!TYPES.includes(mime)) bad("Upload a PNG, JPEG, WebP or GIF image");
  const data = new Uint8Array(await c.req.arrayBuffer());
  if (!data.length) bad("Empty upload");
  if (data.length > MAX_BYTES) bad("Images must be under 2 MB");
  return repo.saveImage(mime, data, userId);
}

router.get("/api/image/:id", async c => {
  const id = int(c.params[0]);
  const img = (id === null ? null : await repo.findImage(id)) ?? missing("Image");
  // a picture never changes once stored, so browsers may keep it for good
  return new Response(img.data, { headers: { "Content-Type": img.mime, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
});

router.post<ImageSaved>("/api/image", async c => {
  const u = need(c), type = c.q.get("type");
  if (type === "user") {
    const image = await storeImage(c, u.id);
    await repo.setUserImage(u.id, image);
    return { image };
  }
  const item = await requireItem(type, c.q.get("id"), ["artist", "album"]);
  const image = await storeImage(c, u.id);
  await repo.setCatalogueImage(item.type, item.row.id, image);
  return { image };
});

router.delete<Ok>("/api/image", async c => {
  await repo.setUserImage(need(c).id, null);
  return { ok: true };
});
