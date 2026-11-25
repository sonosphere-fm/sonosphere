import { SUBSONIC_CLIENT, SUBSONIC_VERSION, pickSongs, type SongMatch, type SubsonicAuth } from "../shared/subsonic";

const asObject = (v: unknown): Record<string, unknown> | null =>
  typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null;

/** Asks the listener's own server for matches. Throws when the browser cannot reach it, null when it refuses. */
export async function directMatches(auth: SubsonicAuth, artist: string, track: string): Promise<SongMatch[] | null> {
  const query = new URLSearchParams({
    u: auth.username,
    v: SUBSONIC_VERSION,
    c: SUBSONIC_CLIENT,
    f: "json",
    t: auth.token,
    s: auth.salt,
    query: `${artist} ${track}`.slice(0, 500),
    artistCount: "0",
    albumCount: "0",
    songCount: "20",
  });
  const response = await fetch(`${auth.base}/rest/search3.view?${query}`, {
    mode: "cors",
    credentials: "omit",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return null;
  const body = asObject(asObject(await response.json().catch(() => null))?.["subsonic-response"]);
  if (body?.status !== "ok") return null;
  return pickSongs(asObject(body.searchResult3)?.song, artist, track);
}

export function directStreamUrl(auth: SubsonicAuth, id: string): string {
  const query = new URLSearchParams({
    u: auth.username,
    v: SUBSONIC_VERSION,
    c: SUBSONIC_CLIENT,
    f: "json",
    t: auth.token,
    s: auth.salt,
    id,
  });
  return `${auth.base}/rest/stream.view?${query}`;
}
