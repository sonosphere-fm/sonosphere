// Finds the YouTube videos that match a track. Sonosphere hosts no audio: the player embeds the matching video.
// With YOUTUBE_API_KEY set the official search API is used; without it, the public results page is read instead.
import { norm, now } from "../util";
import * as repo from "./repo";

const TIMEOUT_MS = 8000;
const DAY = 86400;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** Asks YouTube. Several candidates come back, best match first; throws when YouTube cannot be reached or refuses. */
async function findVideos(artist: string, track: string): Promise<string[]> {
  const query = `${artist} ${track}`;
  const key = process.env.YOUTUBE_API_KEY;
  if (key) {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/search?part=id&type=video&videoEmbeddable=true&maxResults=5&q=${encodeURIComponent(query)}&key=${key}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!r.ok) throw new Error(`YouTube API ${r.status}`);
    const data: unknown = await r.json();
    if (!isRecord(data)) throw new Error("YouTube API sent no result");
    const items: unknown = data.items || [];
    if (!Array.isArray(items)) throw new Error("YouTube API sent no list");
    return items.map((i: unknown) => (isRecord(i) && isRecord(i.id) ? i.id.videoId : null)).filter((id): id is string => typeof id === "string" && id !== "");
  }
  const r = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, {
    headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "en", Cookie: "SOCS=CAI; CONSENT=YES+1" }, signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!r.ok) throw new Error(`YouTube ${r.status}`);
  const ids: string[] = [];
  for (const m of (await r.text()).matchAll(/"videoRenderer":\{"videoId":"([\w-]{11})"/g)) if (m[1]) ids.push(m[1]);
  return [...new Set(ids)].slice(0, 6);
}

/**
 * Video ids for a track, best match first: the player falls through any that refuse to be embedded.
 * A lookup that found videos is cached for good; one that found nothing is tried again after a day.
 * A failed lookup is not cached and comes back empty.
 */
export async function videosFor(artist: string, track: string): Promise<string[]> {
  const key = `${norm(artist)}\u0000${norm(track)}`;
  const hit = await repo.cached(key);
  if (hit && (hit.videoId || now() - hit.fetchedAt < DAY)) return hit.videoId ? hit.videoId.split(",") : [];
  let ids: string[];
  try { ids = await findVideos(artist, track); } catch { return []; }
  await repo.remember(key, ids);
  return ids;
}
