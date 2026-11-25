import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { recordingMbids } from "../db/schema";
import { bad, ipOf, oneOf, Router, throttle } from "../http";
import { getJson, setJson } from "../kv";
import { mbCredits } from "../metadata/sources";
import { requireAlbum, requireArtist, requireTrack } from "./service";
import type { Credits } from "../../shared/credits";

export const router = new Router();
const pending = new Map<string, Promise<Credits>>();
router.get<Credits>("/api/credits", async (c) => {
  const kind = oneOf(c.q.get("kind"), ["artist", "album", "track"]) ?? bad("invalidItemType");
  const name = c.q.get("artist");
  const title = c.q.get("title") ?? "";
  const item =
    kind === "artist"
      ? await requireArtist(name)
      : kind === "album"
        ? await requireAlbum(name, title)
        : await requireTrack(name, title);
  const key = `credits:v1:${kind}:${item.id}`;
  const cached = await getJson<Credits>(key);
  if (cached) return cached;
  await throttle(`credits:${c.user?.id ?? ipOf(c.req)}`, 20, 60);
  const existing = pending.get(key);
  if (existing) return existing;
  const job = (async () => {
    let mbid = "mbid" in item ? (item.mbid ?? "") : "";
    if (kind === "track") {
      const [recording] = await db.select().from(recordingMbids).where(eq(recordingMbids.trackId, item.id)).limit(1);
      mbid = recording?.mbid ?? "";
    }
    const credits = await mbCredits(
      kind,
      mbid,
      "name" in item ? item.name : item.artist,
      "title" in item ? item.title : ""
    );
    await setJson(key, credits, (credits.items.length ? 7 * 86400 : 3600) * 1000);
    return credits;
  })();
  pending.set(key, job);
  try {
    return await job;
  } finally {
    pending.delete(key);
  }
});
