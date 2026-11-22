import { agent } from "../metadata/sources";
import { sniff } from "./process";

export type Picture = { mime: string; data: Uint8Array<ArrayBuffer> };

const MAX_BYTES = 5_000_000;
const MAX_REDIRECTS = 3;
const MIME = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" } as const;

// a named https host, never an address, so a redirect can't point the fetch inside the network
const publicHttps = (u: URL) => u.protocol === "https:" && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(u.hostname);

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
    if (!publicHttps(at)) return null;
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
