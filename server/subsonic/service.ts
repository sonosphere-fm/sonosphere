import { createHash } from "node:crypto";
import { asObject, clean, norm, now, rid } from "../util";
import { bad, fail, limit } from "../http";
import { seal, unseal } from "../seal";
import * as repo from "./repo";
import { checkHost, parseServerUrl } from "./url";
import {
  albumWebUrl,
  pickSongs,
  type SongMatch,
  type SubsonicAuth,
  type SubsonicConnectBody,
  type SubsonicSource,
  type SubsonicStatus,
} from "../../shared/subsonic";

const VERSION = "1.16.1";
const CLIENT = "Sonosphere";
const SEARCHES_PER_HOUR = 240;
const HOUR = 3600_000;
const FIVE_MINUTES = 300_000;
const MAX_MATCHES = 500;

type Credentials = { url: string; username: string; password: string };
type Attempt =
  | { kind: "ok"; body: Record<string, unknown> }
  | { kind: "auth" }
  | { kind: "missing" }
  | { kind: "failed" };

type Match = { songs: SongMatch[]; until: number };
const matches = new Map<string, Match>();
/** Whether the server accepts token auth, learned from the answers it has given. */
const authModes = new Map<number, boolean>();

function cached(key: string): SongMatch[] | null {
  const match = matches.get(key);
  if (!match) return null;
  if (match.until <= Date.now()) {
    matches.delete(key);
    return null;
  }
  return match.songs;
}

function remember(key: string, songs: SongMatch[]): void {
  if (matches.size >= MAX_MATCHES) {
    const oldest = matches.keys().next().value;
    if (oldest !== undefined) matches.delete(oldest);
  }
  matches.set(key, { songs, until: Date.now() + (songs.length ? HOUR : FIVE_MINUTES) });
}

function forget(userId: number): void {
  const prefix = `${userId}:`;
  for (const key of matches.keys()) {
    if (key.startsWith(prefix)) matches.delete(key);
  }
  authModes.delete(userId);
}

function credentialsOf(link: repo.Link): Credentials {
  const password = unseal(link.password);
  if (password === null) return fail(400, "subsonicAuthFailed");
  return { url: link.url, username: link.username, password };
}

function authQuery(credentials: Credentials, token: boolean): URLSearchParams {
  const query = new URLSearchParams({
    u: credentials.username,
    v: VERSION,
    c: CLIENT,
    f: "json",
  });
  if (token) {
    const salt = rid(6);
    query.set(
      "t",
      createHash("md5")
        .update(credentials.password + salt)
        .digest("hex")
    );
    query.set("s", salt);
  } else {
    query.set("p", `enc:${Buffer.from(credentials.password, "utf8").toString("hex")}`);
  }
  return query;
}

async function reachable(url: string): Promise<void> {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return fail(400, "invalidSubsonicUrl");
  }
  const state = await checkHost(host);
  if (state === "private") return fail(400, "subsonicPrivateAddress");
  if (state === "unreachable") return fail(502, "subsonicUnreachable");
}

async function attemptJson(
  credentials: Credentials,
  method: string,
  extra: Record<string, string>,
  token: boolean
): Promise<Attempt> {
  await reachable(credentials.url);
  const query = authQuery(credentials, token);
  for (const [key, value] of Object.entries(extra)) query.set(key, value);
  let response: Response;
  try {
    response = await fetch(`${credentials.url}/rest/${method}.view?${query}`, {
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return fail(502, "subsonicUnreachable");
  }
  const reply = asObject(asObject(await response.json().catch(() => null))?.["subsonic-response"]);
  if (!reply) {
    if (response.status === 401) return { kind: "auth" };
    return fail(502, "subsonicRequestFailed");
  }
  if (reply.status === "ok") return { kind: "ok", body: reply };
  const code = Number(asObject(reply.error)?.code) || 0;
  if (code === 40 || code === 41 || code === 42) return { kind: "auth" };
  if (code === 70) return { kind: "missing" };
  return fail(502, "subsonicRequestFailed");
}

async function jsonCall(
  credentials: Credentials,
  method: string,
  extra: Record<string, string> = {}
): Promise<{ body: Record<string, unknown>; token: boolean }> {
  const first = await attemptJson(credentials, method, extra, true);
  if (first.kind === "ok") return { body: first.body, token: true };
  if (first.kind === "auth") {
    const second = await attemptJson(credentials, method, extra, false);
    if (second.kind === "ok") return { body: second.body, token: false };
    if (second.kind === "auth") return fail(400, "subsonicAuthFailed");
  }
  if (first.kind === "missing") return { body: {}, token: true };
  return fail(502, "subsonicRequestFailed");
}

export async function verify(
  url: string,
  username: string,
  password: string
): Promise<{ name: string; version: string; openSubsonic: boolean; token: boolean }> {
  const { body, token } = await jsonCall({ url, username, password }, "ping");
  return {
    name: typeof body.type === "string" ? body.type : "",
    version:
      typeof body.serverVersion === "string"
        ? body.serverVersion
        : typeof body.version === "string"
          ? body.version
          : "",
    openSubsonic: body.openSubsonic === true,
    token,
  };
}

export async function connect(userId: number, input: SubsonicConnectBody): Promise<SubsonicStatus> {
  const server = parseServerUrl(input.url);
  if (!server.ok) return bad("invalidSubsonicUrl");
  const username = clean(input.username, 100);
  if (!username || !input.password) return bad("subsonicCredentialsRequired");
  const { token, ...info } = await verify(server.base, username, input.password);
  await repo.saveLink(userId, {
    url: server.base,
    username,
    password: seal(input.password),
    ...info,
    createdAt: now(),
  });
  forget(userId);
  authModes.set(userId, token);
  return status(userId);
}

export async function status(userId: number): Promise<SubsonicStatus> {
  const link = await repo.findLink(userId);
  if (!link) return { connected: false };
  return {
    connected: true,
    url: link.url,
    username: link.username,
    name: link.name,
    version: link.version,
    openSubsonic: link.openSubsonic,
  };
}

export async function disconnect(userId: number): Promise<void> {
  await repo.removeLink(userId);
  forget(userId);
}

/** Token and address for calls the browser makes itself. Kept in memory only. */
export async function auth(userId: number): Promise<SubsonicAuth> {
  const link = await repo.findLink(userId);
  if (!link) return fail(404, "subsonicNotConnected");
  const query = authQuery(credentialsOf(link), true);
  return {
    base: link.url,
    username: link.username,
    name: link.name,
    token: query.get("t") ?? "",
    salt: query.get("s") ?? "",
    direct: authModes.get(userId) !== false,
  };
}

async function search(link: repo.Link, artist: string, track: string): Promise<SongMatch[]> {
  const key = `${link.userId}:${norm(artist)}:${norm(track)}`;
  const hit = cached(key);
  if (hit) return hit;
  await limit(`subsonic-search:${link.userId}`, SEARCHES_PER_HOUR, 3600);
  const { body, token } = await jsonCall(credentialsOf(link), "search3", {
    query: `${artist} ${track}`.slice(0, 500),
    artistCount: "0",
    albumCount: "0",
    songCount: "20",
  });
  authModes.set(link.userId, token);
  const songs = pickSongs(asObject(body.searchResult3)?.song, artist, track);
  remember(key, songs);
  return songs;
}

/** What the player falls back to when the browser cannot reach the server. */
export async function source(userId: number, artist: string, track: string): Promise<SubsonicSource> {
  const link = await repo.findLink(userId);
  if (!link) return fail(404, "subsonicNotConnected");
  const [song] = await search(link, artist, track);
  if (!song) return fail(404, "subsonicNoMatch");
  return {
    proxy: `/api/subsonic/stream?${new URLSearchParams({ id: song.id })}`,
    albumUrl: albumWebUrl(link.url, link.name, song.albumId),
  };
}

async function streamRequest(
  credentials: Credentials,
  id: string,
  token: boolean,
  range: string | null
): Promise<{ kind: "audio"; response: Response } | { kind: "auth" | "missing" | "failed" }> {
  const query = authQuery(credentials, token);
  query.set("id", id);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  let response: Response;
  try {
    response = await fetch(`${credentials.url}/rest/stream.view?${query}`, {
      headers: range ? { Range: range } : {},
      redirect: "error",
      signal: controller.signal,
    });
  } catch {
    clearTimeout(timer);
    return { kind: "failed" };
  }
  clearTimeout(timer);
  if (response.status === 401) return { kind: "auth" };
  if (response.status === 404) return { kind: "missing" };
  const type = response.headers.get("content-type") || "";
  const error = type.includes("json") || type.includes("xml") || type.startsWith("text/");
  if (error) {
    const code = await errorCode(response);
    if (code === 40 || code === 41 || code === 42) return { kind: "auth" };
    if (code === 70) return { kind: "missing" };
    return { kind: "failed" };
  }
  if (!response.ok && response.status !== 416) return { kind: "failed" };
  return { kind: "audio", response };
}

async function errorCode(response: Response): Promise<number> {
  const type = response.headers.get("content-type") || "";
  if (type.includes("json")) {
    const body = await response.json().catch(() => null);
    return Number(asObject(asObject(asObject(body)?.["subsonic-response"])?.error)?.code) || 0;
  }
  const text = await response.text().catch(() => "");
  return Number(/<error[^>]*\bcode="(\d+)"/.exec(text)?.[1]) || 0;
}

async function streamIds(link: repo.Link, ids: string[], range: string | null): Promise<Response> {
  const credentials = credentialsOf(link);
  await reachable(credentials.url);
  let failed = false;
  for (const id of ids) {
    let authFailed = true;
    for (const token of [true, false]) {
      const result = await streamRequest(credentials, id, token, range);
      if (result.kind === "audio") {
        const headers = new Headers({
          "Accept-Ranges": "bytes",
          "Cache-Control": "private, no-store",
          "Content-Disposition": "inline",
        });
        for (const name of ["content-type", "content-length", "content-range", "etag", "last-modified"]) {
          const value = result.response.headers.get(name);
          if (value) headers.set(name, value);
        }
        return new Response(result.response.body, { status: result.response.status, headers });
      }
      if (result.kind !== "auth") {
        authFailed = false;
        failed ||= result.kind === "failed";
        break;
      }
    }
    if (authFailed) return fail(400, "subsonicAuthFailed");
  }
  return failed ? fail(502, "subsonicRequestFailed") : fail(404, "subsonicNoMatch");
}

export async function stream(userId: number, artist: string, track: string, range: string | null): Promise<Response> {
  const link = await repo.findLink(userId);
  if (!link) return fail(404, "subsonicNotConnected");
  const songs = await search(link, artist, track);
  if (!songs.length) return fail(404, "subsonicNoMatch");
  return streamIds(
    link,
    songs.map((song) => song.id),
    range
  );
}

export async function streamById(userId: number, id: string, range: string | null): Promise<Response> {
  const link = await repo.findLink(userId);
  if (!link) return fail(404, "subsonicNotConnected");
  return streamIds(link, [id], range);
}
