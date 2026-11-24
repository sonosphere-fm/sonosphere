import { agent } from "../metadata/sources";
import { sniff } from "./process";

export type Picture = { mime: string; data: Uint8Array<ArrayBuffer> };

const MAX_BYTES = 5_000_000;
const MAX_REDIRECTS = 3;
const MIME = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" } as const;

// Spotify names each size of a picture by a prefix: album covers 1500px or 300px, artist photos 640px or 320px
const SPOTIFY_SIZES: Record<string, { large: string; small: string }> = {
  ab67616d0000b273: { large: "ab67616d000082c1", small: "ab67616d00001e02" },
  ab6761610000e5eb: { large: "ab6761610000e5eb", small: "ab67616100005174" },
};
const SPOTIFY = /^https:\/\/i\.scdn\.co\/image\/([0-9a-f]{16})([0-9a-f]{24})$/;
const LASTFM = /^(https:\/\/lastfm(?:-img)?\.freetls\.fastly\.net\/i\/u\/)(?:[^/]+\/)?([0-9a-f]{32})\.\w+$/;
const WIKIMEDIA_WIDTH = /^(https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\/[^?]+)\?width=\d+$/;

/** The address of the size wanted, for the sources that serve several; others as they are. */
export function sized(url: string, small: boolean): string {
  const lf = LASTFM.exec(url);
  if (lf) return `${lf[1]}${small ? "300x300" : "_"}/${lf[2]}.webp`;
  const wm = WIKIMEDIA_WIDTH.exec(url);
  if (wm) return `${wm[1]}?width=${small ? 300 : 1200}`;
  const sp = SPOTIFY.exec(url);
  const sizes = sp && SPOTIFY_SIZES[sp[1]!];
  if (sizes) return `https://i.scdn.co/image/${small ? sizes.small : sizes.large}${sp[2]}`;
  return url;
}

// Where server/metadata/sources.ts finds pictures: Spotify, Last.fm, and Wikimedia Commons (which redirects to its
// upload host). Checked on every hop, so a redirect can't point the fetch inside the network.
const HOSTS = [
  "i.scdn.co",
  "image-cdn-ak.spotifycdn.com",
  "image-cdn-fa.spotifycdn.com",
  "lastfm.freetls.fastly.net",
  "lastfm-img.freetls.fastly.net",
  "lastfm-img2.akamaized.net",
  "commons.wikimedia.org",
  "upload.wikimedia.org",
];
const allowed = (u: URL) => u.protocol === "https:" && u.port === "" && HOSTS.includes(u.hostname);

async function readCapped(body: ReadableStream<Uint8Array>): Promise<Uint8Array<ArrayBuffer> | null> {
  const parts: Uint8Array[] = [];
  let n = 0;
  for await (const chunk of body) {
    n += chunk.length;
    if (n > MAX_BYTES) return null;
    parts.push(chunk);
  }
  return new Uint8Array(Buffer.concat(parts));
}

/** Fetched here so the browser only ever sees our own address for it. */
export async function fetchRemote(url: string): Promise<Picture | null> {
  let at = new URL(url);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!allowed(at)) return null;
    const r = await fetch(at, {
      redirect: "manual",
      headers: { "User-Agent": agent() },
      signal: AbortSignal.timeout(10_000),
    });
    const next = r.headers.get("location");
    if (r.status >= 300 && r.status < 400 && next) {
      at = new URL(next, at);
      continue;
    }
    if (!r.ok || !r.body) return null;
    const data = await readCapped(r.body);
    const kind = data && sniff(data);
    return kind ? { mime: MIME[kind], data } : null;
  }
  return null;
}
