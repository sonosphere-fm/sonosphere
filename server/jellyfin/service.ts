import { asObject, clean, now, rid } from "../util";
import { bad, fail, limit } from "../http";
import { seal, unseal } from "../seal";
import * as repo from "./repo";
import { parseServerUrl } from "../music/url";
import { requireReachable } from "../music/reach";
import { cachedMatches, forgetMatches, rememberMatches } from "../music/matches";
import { jellyfinAlbumUrl, pickJellyfin } from "../../shared/jellyfin";
import type { JellyfinAuth, JellyfinSource } from "../../shared/jellyfin";
import type { MusicMatch } from "../../shared/music-match";

const VERSION = "1.0.0";
const SEARCHES_PER_HOUR = 240;
const tokens = new Map<number, string>();

const deviceHeader = (deviceId: string) =>
  `MediaBrowser Client="Sonosphere", Device="Web", DeviceId="${deviceId}", Version="${VERSION}"`;

async function login(
  url: string,
  username: string,
  password: string,
  deviceId: string
): Promise<{ token: string; userId: string }> {
  let response: Response;
  try {
    response = await fetch(`${url}/Users/AuthenticateByName`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: deviceHeader(deviceId) },
      body: JSON.stringify({ Username: username, Pw: password }),
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return fail(502, "musicServerUnreachable");
  }
  if (response.status === 401 || response.status === 403) return fail(400, "musicServerAuthFailed");
  if (!response.ok) return fail(502, "musicServerRequestFailed");
  const body = asObject(await response.json().catch(() => null));
  const token = typeof body?.AccessToken === "string" ? body.AccessToken : "";
  const userId = typeof body?.User === "object" && body.User !== null ? asObject(body.User)?.Id : "";
  if (!token || typeof userId !== "string" || !userId) return fail(502, "musicServerRequestFailed");
  return { token, userId };
}

async function publicInfo(url: string): Promise<{ name: string; version: string }> {
  try {
    const response = await fetch(`${url}/System/Info/Public`, {
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });
    const body = asObject(await response.json().catch(() => null));
    return {
      name: typeof body?.ServerName === "string" && body.ServerName ? body.ServerName : "Jellyfin",
      version: typeof body?.Version === "string" ? body.Version : "",
    };
  } catch {
    return { name: "Jellyfin", version: "" };
  }
}

export async function connect(
  userId: number,
  input: { url: string; username: string; password: string }
): Promise<void> {
  const server = parseServerUrl(input.url);
  if (!server.ok) return bad("invalidMusicServerUrl");
  const username = clean(input.username, 100);
  if (!username || !input.password) return bad("musicServerCredentialsRequired");
  await requireReachable(server.base);
  const deviceId = rid(8);
  const { token, userId: jellyfinUserId } = await login(server.base, username, input.password, deviceId);
  const info = await publicInfo(server.base);
  await repo.saveLink(userId, {
    url: server.base,
    username,
    password: seal(input.password),
    jellyfinUserId,
    deviceId,
    ...info,
    createdAt: now(),
  });
  forgetMatches("jellyfin", userId);
  tokens.set(userId, token);
}

export async function disconnect(userId: number): Promise<void> {
  await repo.removeLink(userId);
  forgetMatches("jellyfin", userId);
  tokens.delete(userId);
}

async function tokenFor(link: repo.Link, force = false): Promise<string> {
  if (!force) {
    const cached = tokens.get(link.userId);
    if (cached) return cached;
  }
  const password = unseal(link.password);
  if (password === null) return fail(400, "musicServerAuthFailed");
  const { token } = await login(link.url, link.username, password, link.deviceId);
  tokens.set(link.userId, token);
  return token;
}

async function request(link: repo.Link, path: string): Promise<Response> {
  await requireReachable(link.url);
  const attempt = async (token: string) => {
    try {
      return await fetch(`${link.url}${path}`, {
        headers: { "X-Emby-Token": token },
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      return fail(502, "musicServerUnreachable");
    }
  };
  let response = await attempt(await tokenFor(link));
  if (response.status === 401) {
    tokens.delete(link.userId);
    response = await attempt(await tokenFor(link, true));
  }
  return response;
}

export async function auth(userId: number): Promise<JellyfinAuth> {
  const link = await repo.findLink(userId);
  if (!link) return fail(404, "musicServerNotConnected");
  await requireReachable(link.url);
  return {
    kind: "jellyfin",
    base: link.url,
    userId: link.jellyfinUserId,
    token: await tokenFor(link),
    deviceId: link.deviceId,
    name: link.name || "Jellyfin",
  };
}

async function search(link: repo.Link, artist: string, track: string): Promise<MusicMatch[]> {
  const hit = cachedMatches("jellyfin", link.userId, artist, track);
  if (hit) return hit;
  await limit(`music-search:${link.userId}`, SEARCHES_PER_HOUR, 3600);
  const query = new URLSearchParams({
    userId: link.jellyfinUserId,
    searchTerm: `${artist} ${track}`.slice(0, 500),
    includeItemTypes: "Audio",
    recursive: "true",
    limit: "20",
    fields: "AlbumId,Artists,RunTimeTicks",
  });
  const response = await request(link, `/Items?${query}`);
  if (!response.ok) return fail(502, "musicServerRequestFailed");
  const body = asObject(await response.json().catch(() => null));
  const matches = pickJellyfin(body?.Items, artist, track);
  rememberMatches("jellyfin", link.userId, artist, track, matches);
  return matches;
}

/** What the player falls back to when the browser cannot reach the server. */
export async function source(userId: number, artist: string, track: string): Promise<JellyfinSource> {
  const link = await repo.findLink(userId);
  if (!link) return fail(404, "musicServerNotConnected");
  const [match] = await search(link, artist, track);
  if (!match) return fail(404, "musicServerNoMatch");
  return {
    proxy: `/api/music/stream?${new URLSearchParams({ id: match.id })}`,
    albumUrl: jellyfinAlbumUrl(link.url, match.albumId),
  };
}

export async function streamById(userId: number, id: string, range: string | null): Promise<Response> {
  const link = await repo.findLink(userId);
  if (!link) return fail(404, "musicServerNotConnected");
  await requireReachable(link.url);
  const play = async (token: string) => {
    const query = new URLSearchParams({ static: "true", api_key: token });
    try {
      return await fetch(`${link.url}/Audio/${encodeURIComponent(id)}/stream?${query}`, {
        headers: range ? { Range: range } : {},
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      return fail(502, "musicServerUnreachable");
    }
  };
  let response = await play(await tokenFor(link));
  if (response.status === 401) {
    tokens.delete(userId);
    response = await play(await tokenFor(link, true));
  }
  if (response.status === 404) return fail(404, "musicServerNoMatch");
  if (!response.ok && response.status !== 416) return fail(502, "musicServerRequestFailed");
  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
    "Content-Disposition": "inline",
  });
  for (const name of ["content-type", "content-length", "content-range", "etag", "last-modified"]) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(response.body, { status: response.status, headers });
}
