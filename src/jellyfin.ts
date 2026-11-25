import { pickJellyfin } from "../shared/jellyfin";
import type { JellyfinAuth } from "../shared/jellyfin";
import type { MusicMatch } from "../shared/music-match";

const asObject = (v: unknown): Record<string, unknown> | null =>
  typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null;

/** Asks the listener's own server for matches. Throws when the browser cannot reach it, null when it refuses. */
export async function directMatches(auth: JellyfinAuth, artist: string, track: string): Promise<MusicMatch[] | null> {
  const query = new URLSearchParams({
    userId: auth.userId,
    searchTerm: `${artist} ${track}`.slice(0, 500),
    includeItemTypes: "Audio",
    recursive: "true",
    limit: "20",
    fields: "AlbumId,Artists,RunTimeTicks",
    api_key: auth.token,
  });
  const response = await fetch(`${auth.base}/Items?${query}`, {
    mode: "cors",
    credentials: "omit",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return null;
  const body = asObject(await response.json().catch(() => null));
  return pickJellyfin(body?.Items, artist, track);
}

export function directStreamUrl(auth: JellyfinAuth, id: string): string {
  const query = new URLSearchParams({ static: "true", api_key: auth.token });
  return `${auth.base}/Audio/${encodeURIComponent(id)}/stream?${query}`;
}
