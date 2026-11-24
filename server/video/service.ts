import { norm, now } from "../util";
import * as repo from "./repo";

const TIMEOUT_MS = 8000;
const DAY = 86400;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

// Without YOUTUBE_API_KEY the public results page is scraped instead of using the search API.
async function findVideos(artist: string, track: string): Promise<string[]> {
  const query = `${artist} ${track}`;
  const key = process.env.YOUTUBE_API_KEY;
  if (key) {
    const url =
      "https://www.googleapis.com/youtube/v3/search?part=id&type=video&videoEmbeddable=true&maxResults=5" +
      `&q=${encodeURIComponent(query)}&key=${key}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!r.ok) throw new Error(`YouTube API ${r.status}`);
    const data: unknown = await r.json();
    if (!isRecord(data)) throw new Error("YouTube API sent no result");
    const items: unknown = data.items || [];
    if (!Array.isArray(items)) throw new Error("YouTube API sent no list");
    return items
      .map((i: unknown) => (isRecord(i) && isRecord(i.id) ? i.id.videoId : null))
      .filter((id): id is string => typeof id === "string" && id !== "");
  }
  const r = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, {
    headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "en", Cookie: "SOCS=CAI; CONSENT=YES+1" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!r.ok) throw new Error(`YouTube ${r.status}`);
  const ids: string[] = [];
  const html = await r.text();
  for (const m of html.matchAll(/"videoRenderer":\{"videoId":"([\w-]{11})"/g)) {
    if (m[1]) ids.push(m[1]);
  }
  return [...new Set(ids)].slice(0, 6);
}

// Several ids, best first, because the player falls through any that refuse to be embedded. Found videos are
// cached for good, an empty result for a day, and a failed lookup not at all.
export async function videosFor(artist: string, track: string, beforeFetch: () => Promise<void>): Promise<string[]> {
  const key = `${norm(artist)}\u001f${norm(track)}`;
  const hit = await repo.cached(key);
  if (hit?.videoId) return hit.videoId.split(",");
  if (hit && now() - hit.fetchedAt < DAY) return [];
  await beforeFetch();
  let ids: string[];
  try {
    ids = await findVideos(artist, track);
  } catch {
    return [];
  }
  await repo.remember(key, ids);
  return ids;
}
