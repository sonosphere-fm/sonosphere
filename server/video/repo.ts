// Data access for the cache of video lookups: one row per artist and track, kept for good once videos were found.
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { videoCache } from "../db/schema";
import { first, now } from "../util";

/** A stored lookup: the ids found, comma separated (null when the search found nothing), and when it ran. */
export type CachedLookup = { videoId: string | null; fetchedAt: number };

export const cached = (key: string): Promise<CachedLookup | null> =>
  first(db.select({ videoId: videoCache.videoId, fetchedAt: videoCache.fetchedAt }).from(videoCache).where(eq(videoCache.key, key)).limit(1));

/** Stores the result of a lookup, replacing any earlier one. */
export async function remember(key: string, videoIds: string[]): Promise<void> {
  const row = { videoId: videoIds.join(",") || null, fetchedAt: now() };
  await db.insert(videoCache).values({ key, ...row }).onConflictDoUpdate({ target: videoCache.key, set: row });
}
