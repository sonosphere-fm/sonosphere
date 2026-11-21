// Spotify caps development-mode apps at a few users, so each listener links their own app with PKCE.
import { createHash } from "node:crypto";
import { scrobbleMany, setNowPlaying, type ScrobbleInput } from "../listening/service";
import { attempt, exclusive, getJson, setJson } from "../kv";
import { now, rid } from "../util";
import * as repo from "./repo";
import { clearNowPlaying } from "../listening/repo";
import { seal, unseal } from "./seal";
import type { SpotifyLink, SpotifyStatus } from "../../shared/spotify";

const ACCOUNTS = "https://accounts.spotify.com";
const API = "https://api.spotify.com/v1";
const SCOPES = "user-read-recently-played user-read-currently-playing";
// only asked for when the listener wants in-browser playback, since it needs Premium
const PLAY_SCOPES = "streaming user-read-email user-read-private user-modify-playback-state";
const RECENT_EVERY = 5 * 60;
const PLAYING_EVERY = 60;
const PENDING_FOR = 10 * 60;

const canPlay = (link: repo.Link) => !link.broken && link.scopes.split(" ").includes("streaming");

export const validClientId = (id: string) => /^[0-9a-f]{32}$/i.test(id);

/** Spotify said no for good (access revoked, app deleted): the link is marked broken and polling stops. */
class Revoked extends Error {}
class Slowed extends Error {}

// rate limits apply per Spotify app, so each listener's app is paused separately
const pauseKey = (clientId: string) => `spotify-pause:${clientId}`;
const restingUntil = (clientId: string) => getJson<number>(pauseKey(clientId));
const paused = async (clientId: string) => (await restingUntil(clientId)) !== null;
const strikeKey = (clientId: string) => `spotify-strikes:${clientId}`;

const MAX_REST = 3600;

/**
 * Rests the app for at least 30s, 1m, 2m ... for repeat 429s within the hour, and as long as Retry-After asks up to
 * an hour: Spotify sometimes asks development apps to wait most of a day while answering again within minutes.
 */
async function slowDown(clientId: string, retryAfter: string | null, path: string) {
  const strikes = ((await getJson<number>(strikeKey(clientId))) ?? 0) + 1;
  const asked = Number(retryAfter) || 0;
  const seconds = Math.min(MAX_REST, Math.max(asked, 30 * 2 ** (strikes - 1)));
  await setJson(strikeKey(clientId), strikes, MAX_REST * 1000);
  await setJson(pauseKey(clientId), now() + seconds, seconds * 1000);
  console.warn(
    `spotify: app ${clientId.slice(0, 6)} rate limited on ${path.split("?")[0]} (Retry-After ${retryAfter ?? "none"}), resting ${seconds}s, strike ${strikes}`,
  );
}

type Json = Record<string, unknown>;
const obj = (v: unknown): Json | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : null);
const str = (v: unknown) => (typeof v === "string" ? v : "");
const numOr = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

const b64url = (b: Buffer) => b.toString("base64url");

/** Null when this site has no address Spotify would accept. */
export function redirectFor(req: Request): string | null {
  if (process.env.SPOTIFY_REDIRECT_URI) return process.env.SPOTIFY_REDIRECT_URI;
  const u = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") || u.protocol.replace(":", "");
  const host = req.headers.get("host") || u.host;
  const name = host.replace(/:\d+$/, "");
  // Spotify refuses plain http, and "localhost" too
  if (proto !== "https" && name !== "127.0.0.1" && name !== "[::1]") return null;
  return `${proto}://${host}/api/spotify/callback`;
}

export async function connectUrl(userId: number, clientId: string, redirectUri: string, origin: string, playback = false): Promise<string> {
  const state = rid(16);
  const verifier = b64url(Buffer.from(crypto.getRandomValues(new Uint8Array(48))));
  await repo.savePending({ state, userId, clientId, verifier, redirectUri, origin, createdAt: now() });
  const q = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    state,
    scope: playback ? `${SCOPES} ${PLAY_SCOPES}` : SCOPES,
    code_challenge_method: "S256",
    code_challenge: b64url(createHash("sha256").update(verifier).digest()),
  });
  return `${ACCOUNTS}/authorize?${q}`;
}

type Tokens = { access: string; refresh: string; expiresIn: number; scope: string };

async function tokenRequest(clientId: string, params: Record<string, string>): Promise<Tokens> {
  const res = await fetch(`${ACCOUNTS}/api/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, ...params }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = obj(await res.json().catch(() => null));
  const error = str(data?.error);
  if (res.status === 400 && error === "invalid_grant") throw new Revoked("Spotify access was withdrawn. Connect again to resume.");
  if (error === "invalid_client") {
    throw new Revoked("Spotify no longer recognises your app's client ID. Check the app on Spotify's dashboard, then connect again.");
  }
  if (!res.ok || !data || !str(data.access_token)) throw new Error(`Spotify token request failed (${res.status})`);
  return {
    access: str(data.access_token),
    refresh: str(data.refresh_token),
    expiresIn: numOr(data.expires_in, 3600),
    scope: str(data.scope),
  };
}

type Outcome = "connected" | "denied" | "expired" | "failed" | "forbidden";

/**
 * A reply through a relay on another address arrives without the session cookie, so the browser is sent on,
 * once, to the callback on the address the listener started from. Null when it can finish here.
 */
export async function callbackHop(viewerId: number | null, q: URLSearchParams): Promise<string | null> {
  if (q.get("hop")) return null;
  const pending = await repo.findPending(q.get("state") || "");
  if (!pending || !pending.origin || pending.userId === viewerId) return null;
  const next = new URLSearchParams(q);
  next.set("hop", "1");
  return `${pending.origin}/api/spotify/callback?${next}`;
}

export async function finishConnect(viewerId: number | null, q: URLSearchParams): Promise<Outcome> {
  const pending = await repo.takePending(q.get("state") || "");
  if (!pending || pending.createdAt < now() - PENDING_FOR || pending.userId !== viewerId) return "expired";
  if (q.get("error")) return "denied";
  try {
    const t = await tokenRequest(pending.clientId, {
      grant_type: "authorization_code",
      code: q.get("code") || "",
      redirect_uri: pending.redirectUri,
      code_verifier: pending.verifier,
    });
    const res = await fetch(`${API}/me`, { headers: { Authorization: `Bearer ${t.access}` }, signal: AbortSignal.timeout(15_000) });
    // the Spotify account is not on the app's user list
    if (res.status === 403) return "forbidden";
    const me = obj(await res.json().catch(() => null));
    if (!res.ok || !me || !str(me.id)) return "failed";
    await repo.saveLink({
      userId: pending.userId,
      clientId: pending.clientId,
      spotifyId: str(me.id),
      displayName: str(me.display_name) || str(me.id),
      accessToken: seal(t.access),
      refreshToken: seal(t.refresh),
      expiresAt: now() + t.expiresIn,
      cursor: 0,
      recentAt: 0,
      playingAt: 0,
      importedAt: null,
      imported: 0,
      broken: null,
      scopes: t.scope,
      createdAt: now(),
    });
    const link = await repo.findLink(pending.userId);
    if (link) importRecent(link).catch(e => console.error("Spotify import:", e));
    return "connected";
  } catch (e) {
    console.error("Spotify sign-in:", e);
    return "failed";
  }
}

async function accessToken(link: repo.Link, force = false): Promise<string> {
  const current = unseal(link.accessToken);
  if (current && !force && link.expiresAt > now() + 60) return current;
  // Spotify rotates refresh tokens for PKCE sign-ins, so two refreshes at once would leave one holding a spent
  // token: one refresh per link at a time, each starting from the stored row in case another just refreshed it
  for (let tries = 0; tries < 30; tries++) {
    const token = await exclusive(`spotify-refresh:${link.userId}`, 20_000, async () => {
      const stored = await repo.findLink(link.userId);
      if (!stored) throw new Revoked("Connect Spotify again to resume importing.");
      const fresher = stored.expiresAt > link.expiresAt;
      Object.assign(link, stored);
      const cur = unseal(link.accessToken);
      if (cur && (!force || fresher) && link.expiresAt > now() + 60) return cur;
      const refresh = unseal(link.refreshToken);
      if (!refresh || !link.clientId) throw new Revoked("Connect Spotify again to resume importing.");
      const t = await tokenRequest(link.clientId, { grant_type: "refresh_token", refresh_token: refresh });
      link.accessToken = seal(t.access);
      link.expiresAt = now() + t.expiresIn;
      if (t.refresh) link.refreshToken = seal(t.refresh);
      if (t.scope) link.scopes = t.scope;
      await repo.updateLink(link.userId, {
        accessToken: link.accessToken,
        refreshToken: link.refreshToken,
        expiresAt: link.expiresAt,
        scopes: link.scopes,
      });
      return t.access;
    });
    if (token !== null) return token;
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Slowed();
}

const authorized = async (link: repo.Link, force = false) => ({
  headers: { Authorization: `Bearer ${await accessToken(link, force)}` },
  signal: AbortSignal.timeout(15_000),
});

/** Null for "nothing to report" (204). */
async function spotifyGet(link: repo.Link, path: string): Promise<Json | null> {
  let res = await fetch(API + path, await authorized(link));
  // the token went stale early: refresh once
  if (res.status === 401) res = await fetch(API + path, await authorized(link, true));
  if (res.status === 429) {
    await slowDown(link.clientId, res.headers.get("retry-after"), path);
    throw new Slowed();
  }
  if (res.status === 403) {
    throw new Revoked("Spotify refused access. Check that your Spotify account is listed under User Management in your app, then connect again.");
  }
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`Spotify ${path} answered ${res.status}`);
  return obj(await res.json().catch(() => null));
}

function trackInput(track: unknown): ScrobbleInput | null {
  const t = obj(track);
  // podcast episodes are not scrobbled
  if (!t || (t.type !== undefined && t.type !== "track")) return null;
  const artist = str(obj(list(t.artists)[0])?.name);
  const name = str(t.name);
  if (!artist || !name) return null;
  return { artist, track: name, album: str(obj(t.album)?.name), duration: Math.round(numOr(t.duration_ms) / 1000) };
}

/** Returns how many plays were added. */
async function importRecent(link: repo.Link): Promise<number> {
  // claimed first, so a slow or failing account does not block the queue
  await repo.updateLink(link.userId, { recentAt: now() });
  if (await paused(link.clientId)) return 0;
  try {
    const after = link.cursor ? `&after=${link.cursor}` : "";
    const reply = await spotifyGet(link, `/me/player/recently-played?limit=50${after}`);
    const plays: { at: number; input: ScrobbleInput }[] = [];
    for (const item of list(reply?.items)) {
      const it = obj(item);
      const input = trackInput(it?.track);
      const at = Date.parse(str(it?.played_at));
      if (!input || !Number.isFinite(at) || at <= link.cursor) continue;
      // Spotify stamps a play when it ends; scrobbles are stamped with the start
      plays.push({ at, input: { ...input, timestamp: Math.floor(at / 1000) - Number(input.duration || 0) } });
    }
    if (!plays.length) return 0;
    plays.sort((a, b) => a.at - b.at);
    const results = await scrobbleMany(link.userId, plays.map(p => p.input), "spotify");
    const added = results.filter(r => r.accepted).length;
    link.cursor = plays[plays.length - 1]!.at;
    await repo.updateLink(link.userId, { cursor: link.cursor, imported: link.imported + added, importedAt: now() });
    link.imported += added;
    return added;
  } catch (e) {
    return failed(link, e);
  }
}

async function mirrorPlaying(link: repo.Link) {
  await repo.updateLink(link.userId, { playingAt: now() });
  if (await paused(link.clientId)) return;
  try {
    const reply = await spotifyGet(link, "/me/player/currently-playing");
    if (!reply || reply.is_playing !== true || reply.currently_playing_type !== "track") {
      await clearNowPlaying(link.userId);
      return;
    }
    const input = trackInput(reply.item);
    if (input) await setNowPlaying(link.userId, input);
  } catch (e) {
    failed(link, e);
  }
}

function failed(link: repo.Link, e: unknown): number {
  if (e instanceof Revoked) {
    repo.updateLink(link.userId, { broken: e.message }).catch(err => console.error(err));
    return 0;
  }
  if (!(e instanceof Slowed)) console.error(`Spotify (user ${link.userId}):`, e);
  return 0;
}

/** No connected app could answer just now (all resting after a 429, or none connected): not the same as "not found". */
export class NoCapacity extends Error {}

/**
 * GET from the Web API catalogue with whichever connected listener's app is free: each app takes at most one
 * call every 400ms, and the one used longest ago goes first. Null only when Spotify answered "no such thing".
 */
export async function catalogueGet(path: string, spare = false): Promise<Json | null> {
  // background ("spare") lookups wait while visitors are looking things up, skip apps rate limited within the
  // hour, and use each app at most every two seconds
  if (spare && (await getJson<number>("spotify-busy"))) throw new NoCapacity();
  if (!spare) await setJson("spotify-busy", 1, 3000);
  const links = await repo.workingLinks();
  const used = await Promise.all(links.map(l => getJson<number>(`spotify-used:${l.clientId}`)));
  const order = links
    .map((l, i) => ({ l, at: used[i] ?? 0, r: Math.random() }))
    .sort((a, b) => a.at - b.at || a.r - b.r)
    .map(x => x.l);
  const until = Date.now() + 5000;
  const tried = new Set<number>();
  for (let i = 0; i < order.length; i++) {
    const link = order[i]!;
    if (tried.has(link.userId) || (await paused(link.clientId))) continue;
    if (spare && (await getJson<number>(strikeKey(link.clientId)))) continue;
    if (spare && !(await attempt(`spotify-spare:${link.clientId}`, 1, 2000))) continue;
    if (!(await attempt(`spotify-turn:${link.clientId}`, 1, 400))) {
      // every free app was just used: wait for the next turn (a few seconds at most)
      if (!spare && i === order.length - 1 && Date.now() < until) {
        await new Promise(r => setTimeout(r, 150));
        i = -1;
      }
      continue;
    }
    tried.add(link.userId);
    await setJson(`spotify-used:${link.clientId}`, Date.now(), 3600_000);
    try {
      let res = await fetch(API + path, await authorized(link));
      if (res.status === 401) res = await fetch(API + path, await authorized(link, true));
      if (res.status === 429) {
        await slowDown(link.clientId, res.headers.get("retry-after"), path);
        continue;
      }
      // this account can't; the importer marks a link that is really broken
      if (res.status === 401 || res.status === 403) continue;
      if (res.status === 404 || res.status === 400) return null;
      if (!res.ok) throw new Error(`Spotify ${path.split("?")[0]} answered ${res.status}`);
      return obj(await res.json().catch(() => null));
    } catch (e) {
      if (e instanceof Slowed || e instanceof Revoked) continue;
      throw e;
    }
  }
  throw new NoCapacity();
}

async function view(link: repo.Link): Promise<SpotifyLink> {
  return {
    restingUntil: await restingUntil(link.clientId),
    account: { id: link.spotifyId, name: link.displayName },
    clientId: link.clientId,
    connectedAt: link.createdAt,
    lastImport: link.importedAt,
    imported: link.imported,
    broken: link.broken,
    playback: canPlay(link),
  };
}

export async function status(userId: number, req: Request): Promise<SpotifyStatus> {
  const redirectUri = redirectFor(req);
  if (!redirectUri) return { enabled: false };
  const link = await repo.findLink(userId);
  return { enabled: true, redirectUri, link: link && (await view(link)) };
}

/** Imports now instead of waiting for the next round. */
export async function syncNow(userId: number): Promise<{ imported: number; link: SpotifyLink } | null> {
  const link = await repo.findLink(userId);
  if (!link) return null;
  const imported = link.broken ? 0 : await importRecent(link);
  return { imported, link: await view((await repo.findLink(userId)) ?? link) };
}

export const disconnect = (userId: number) => repo.dropLink(userId);

export async function playerToken(userId: number): Promise<{ token: string | null; expiresAt: number }> {
  const link = await repo.findLink(userId);
  if (!link || !canPlay(link)) return { token: null, expiresAt: 0 };
  try {
    const token = await accessToken(link);
    return { token, expiresAt: link.expiresAt };
  } catch (e) {
    failed(link, e);
    return { token: null, expiresAt: 0 };
  }
}

let busy = false;
async function tick() {
  if (busy) return;
  busy = true;
  try {
    // one process polls at a time; the lock is generous since a slow round must not overlap the next
    await exclusive("spotify", 5 * 60_000, async () => {
      for (const link of await repo.dueLinks(now() - RECENT_EVERY, 25)) await importRecent(link);
      for (const link of await repo.playingDue(now() - PLAYING_EVERY, 50)) await mirrorPlaying(link);
      await repo.dropStalePending(now() - PENDING_FOR);
    });
  } catch (e) {
    console.error("Spotify loop:", e);
  } finally {
    busy = false;
  }
}

export function startSpotify() {
  // kept on globalThis so a hot reload replaces the timer instead of adding one
  const g = globalThis as { __spinSpotify?: ReturnType<typeof setInterval> };
  clearInterval(g.__spinSpotify);
  g.__spinSpotify = setInterval(tick, 15_000);
}
