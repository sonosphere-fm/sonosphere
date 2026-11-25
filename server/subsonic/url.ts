import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { clean, isObject, norm } from "../util";

const MAX_URL = 500;

export type ParsedServer = { ok: true; base: string; host: string } | { ok: false };
export type HostCheck = "ok" | "unreachable" | "private";

export function parseServerUrl(raw: unknown): ParsedServer {
  const input = clean(raw, MAX_URL);
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { ok: false };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { ok: false };
  if (url.username || url.password || url.search || url.hash) return { ok: false };
  const path = url.pathname.replace(/\/+$/, "").replace(/\/rest(?:\/.*)?$/, "");
  return { ok: true, base: url.origin + path, host: url.hostname };
}

export async function checkHost(host: string): Promise<HostCheck> {
  const bare = host.replace(/^\[|\]$/g, "");
  let addresses: string[];
  if (isIP(bare)) {
    addresses = [bare];
  } else {
    try {
      addresses = (await lookup(bare, { all: true, verbatim: true })).map((a) => a.address);
    } catch {
      return "unreachable";
    }
  }
  if (!addresses.length) return "unreachable";
  const metadata = addresses.some((a) => a === "169.254.169.254" || a.toLowerCase() === "fd00:ec2::254");
  if (metadata) return "private";
  if (process.env.SUBSONIC_ALLOW_PRIVATE === "1") return "ok";
  return addresses.some(isPrivateAddress) ? "private" : "ok";
}

export function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const [a = 0, b = 0] = address.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (version === 6) {
    const value = address.toLowerCase();
    if (value === "::" || value === "::1") return true;
    const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(value);
    if (mapped) return isPrivateAddress(mapped[1]!);
    const pair = /^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(value);
    if (pair) return isPrivateAddress(v4(pair[1]!, pair[2]!));
    // deprecated IPv4-compatible addresses, which some stacks still route to IPv4
    if (/^::[0-9a-f]{1,4}:[0-9a-f]{1,4}$/.test(value)) return true;
    const six = /^2002:([0-9a-f]{1,4}):([0-9a-f]{1,4})/.exec(value);
    if (six) return isPrivateAddress(v4(six[1]!, six[2]!));
    // unique local, link local, site local and multicast
    return value.startsWith("f");
  }
  return false;
}

function v4(high: string, low: string): string {
  const h = parseInt(high, 16);
  const l = parseInt(low, 16);
  return `${h >> 8}.${h & 255}.${l >> 8}.${l & 255}`;
}

const loose = (s: string) =>
  norm(s.normalize("NFKD").replace(/[\u0300-\u036f]/g, ""))
    .replace(/\s*[([].*?[)\]]\s*/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const score = (want: string, got: string) => {
  if (!want || !got) return 0;
  if (want === got) return 2;
  return got.includes(want) || want.includes(got) ? 1 : 0;
};

/** The best few song ids for an artist and title, so the player can fall through ones the server won't stream. */
export function pickSongs(songs: unknown, artist: string, track: string): string[] {
  const list = Array.isArray(songs) ? songs : songs ? [songs] : [];
  const wantArtist = loose(artist);
  const wantTitle = loose(track);
  const found = list
    .map((song, index) => {
      if (!isObject(song) || song.isVideo === true) return null;
      if (typeof song.type === "string" && song.type !== "music" && song.type !== "song") return null;
      const id = typeof song.id === "string" ? song.id : typeof song.id === "number" ? String(song.id) : "";
      if (!id) return null;
      const title = loose(String(song.title ?? ""));
      const by = loose(String(song.artist ?? ""));
      return { id, index, score: score(wantArtist, by) + score(wantTitle, title) };
    })
    .filter((song): song is { id: string; index: number; score: number } => !!song && song.score >= 2);
  found.sort((a, b) => b.score - a.score || a.index - b.index);
  const ids: string[] = [];
  for (const song of found) {
    if (ids.includes(song.id)) continue;
    ids.push(song.id);
    if (ids.length === 3) break;
  }
  return ids;
}
