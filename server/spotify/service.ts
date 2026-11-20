// Scrobbling from Spotify. Spotify limits an app in development mode to a handful of users, so each listener
// brings their own: they create an app on Spotify's developer dashboard, give us its client ID, and link their
// account with the standard sign-in (authorization code + PKCE, which needs no client secret). A background loop
// then imports their recently played tracks (Spotify keeps the last 50) and mirrors what is playing right now.
// Plays go through the normal scrobble path, so duplicates are refused there.
//
// Spotify only accepts an https (or loopback) return address. SPOTIFY_REDIRECT_URI sets it, and can point at an
// https relay that forwards to /api/spotify/callback (see deploy/spotify-relay.js). Without it, the site's own
// address is used when that is https or localhost; otherwise Spotify shows as disabled.
import { createHash } from "node:crypto";
import { scrobbleMany, setNowPlaying, type ScrobbleInput } from "../listening/service";
import { now, rid } from "../util";
import * as repo from "./repo";
import { seal, unseal } from "./seal";
import type { SpotifyLink, SpotifyStatus } from "../../shared/spotify";

const ACCOUNTS = "https://accounts.spotify.com", API = "https://api.spotify.com/v1";
const SCOPES = "user-read-recently-played user-read-currently-playing";
const RECENT_EVERY = 5 * 60, PLAYING_EVERY = 60, PENDING_FOR = 10 * 60;

/** Spotify client IDs are 32 hex characters. */
export const validClientId = (id: string) => /^[0-9a-f]{32}$/i.test(id);

/** Spotify said no for good (access revoked, app deleted): the link is marked broken and polling stops. */
class Revoked extends Error {}
/** Rate limits apply per Spotify app, so each listener's app is paused separately. */
const pausedUntil = new Map<string, number>();
const paused = (clientId: string) => (pausedUntil.get(clientId) ?? 0) > now();

// ---------- small JSON readers (Spotify's replies are untrusted input) ----------
type Json = Record<string, unknown>;
const obj = (v: unknown): Json | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : null); // checked just above
const str = (v: unknown) => (typeof v === "string" ? v : "");
const numOr = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

// ---------- signing in ----------
const b64url = (b: Buffer) => b.toString("base64url");

/** Where Spotify sends the browser back to, or null when this site has no address Spotify would accept. */
export function redirectFor(req: Request): string | null {
  if (process.env.SPOTIFY_REDIRECT_URI) return process.env.SPOTIFY_REDIRECT_URI;
  const u = new URL(req.url), proto = req.headers.get("x-forwarded-proto") || u.protocol.replace(":", "");
  const host = req.headers.get("host") || u.host, name = host.replace(/:\d+$/, "");
  if (proto !== "https" && name !== "127.0.0.1" && name !== "[::1]") return null; // Spotify refuses plain http (and "localhost")
  return `${proto}://${host}/api/spotify/callback`;
}

/** The Spotify page that asks the listener to approve access for their app. */
export async function connectUrl(userId: number, clientId: string, redirectUri: string, origin: string): Promise<string> {
  const state = rid(16), verifier = b64url(Buffer.from(crypto.getRandomValues(new Uint8Array(48))));
  await repo.savePending({ state, userId, clientId, verifier, redirectUri, origin, createdAt: now() });
  const q = new URLSearchParams({
    client_id: clientId, response_type: "code", redirect_uri: redirectUri, state, scope: SCOPES,
    code_challenge_method: "S256", code_challenge: b64url(createHash("sha256").update(verifier).digest()),
  });
  return `${ACCOUNTS}/authorize?${q}`;
}

type Tokens = { access: string; refresh: string; expiresIn: number };

async function tokenRequest(clientId: string, params: Record<string, string>): Promise<Tokens> {
  const res = await fetch(`${ACCOUNTS}/api/token`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, ...params }), signal: AbortSignal.timeout(15_000),
  });
  const data = obj(await res.json().catch(() => null));
  const error = str(data?.error);
  if (res.status === 400 && error === "invalid_grant") throw new Revoked("Spotify access was withdrawn. Connect again to resume.");
  if (error === "invalid_client") throw new Revoked("Spotify no longer recognises your app's client ID. Check the app on Spotify's dashboard, then connect again.");
  if (!res.ok || !data || !str(data.access_token)) throw new Error(`Spotify token request failed (${res.status})`);
  return { access: str(data.access_token), refresh: str(data.refresh_token), expiresIn: numOr(data.expires_in, 3600) };
}

export type Outcome = "connected" | "denied" | "expired" | "failed" | "forbidden";

/**
 * When Spotify returns through a relay on another address (SPOTIFY_REDIRECT_URI), the browser's session cookie
 * belongs to the address the listener started from, so the reply arrives signed out. Then the browser is sent on
 * to that address's callback, once, to finish there with the session. Null when it can finish here.
 */
export async function callbackHop(viewerId: number | null, q: URLSearchParams): Promise<string | null> {
  if (q.get("hop")) return null;
  const pending = await repo.findPending(q.get("state") || "");
  if (!pending || !pending.origin || pending.userId === viewerId) return null;
  const next = new URLSearchParams(q);
  next.set("hop", "1");
  return `${pending.origin}/api/spotify/callback?${next}`;
}

/** Finishes a sign-in: swaps the one-time code for tokens and links the account. */
export async function finishConnect(viewerId: number | null, q: URLSearchParams): Promise<Outcome> {
  const pending = await repo.takePending(q.get("state") || "");
  if (!pending || pending.createdAt < now() - PENDING_FOR || pending.userId !== viewerId) return "expired";
  if (q.get("error")) return "denied";
  try {
    const t = await tokenRequest(pending.clientId, { grant_type: "authorization_code", code: q.get("code") || "", redirect_uri: pending.redirectUri, code_verifier: pending.verifier });
    const res = await fetch(`${API}/me`, { headers: { Authorization: `Bearer ${t.access}` }, signal: AbortSignal.timeout(15_000) });
    if (res.status === 403) return "forbidden"; // the Spotify account is not on the app's user list
    const me = obj(await res.json().catch(() => null));
    if (!res.ok || !me || !str(me.id)) return "failed";
    await repo.saveLink({
      userId: pending.userId, clientId: pending.clientId, spotifyId: str(me.id), displayName: str(me.display_name) || str(me.id),
      accessToken: seal(t.access), refreshToken: seal(t.refresh), expiresAt: now() + t.expiresIn,
      cursor: 0, recentAt: 0, playingAt: 0, importedAt: null, imported: 0, broken: null, createdAt: now(),
    });
    const link = await repo.findLink(pending.userId);
    if (link) importRecent(link).catch(e => console.error("Spotify import:", e)); // the last 50 plays, right away
    return "connected";
  } catch (e) {
    console.error("Spotify sign-in:", e);
    return "failed";
  }
}

// ---------- calling Spotify ----------
async function accessToken(link: repo.Link, force = false): Promise<string> {
  const current = unseal(link.accessToken);
  if (current && !force && link.expiresAt > now() + 60) return current;
  const refresh = unseal(link.refreshToken);
  if (!refresh || !link.clientId) throw new Revoked("Connect Spotify again to resume importing.");
  const t = await tokenRequest(link.clientId, { grant_type: "refresh_token", refresh_token: refresh });
  link.accessToken = seal(t.access); link.expiresAt = now() + t.expiresIn;
  if (t.refresh) link.refreshToken = seal(t.refresh); // Spotify rotates refresh tokens for PKCE sign-ins
  await repo.updateLink(link.userId, { accessToken: link.accessToken, refreshToken: link.refreshToken, expiresAt: link.expiresAt });
  return t.access;
}

class Slowed extends Error {}

/** GET from the Web API as the listener. Null for "nothing to report" (204). */
async function spotifyGet(link: repo.Link, path: string): Promise<Json | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(API + path, { headers: { Authorization: `Bearer ${await accessToken(link, attempt > 0)}` }, signal: AbortSignal.timeout(15_000) });
    if (res.status === 401 && attempt === 0) continue; // token went stale early: refresh once
    if (res.status === 429) { pausedUntil.set(link.clientId, now() + Math.max(5, Number(res.headers.get("retry-after")) || 30)); throw new Slowed(); }
    if (res.status === 403) throw new Revoked("Spotify refused access. Check that your Spotify account is listed under User Management in your app, then connect again.");
    if (res.status === 204) return null;
    if (!res.ok) throw new Error(`Spotify ${path} answered ${res.status}`);
    return obj(await res.json().catch(() => null));
  }
  throw new Revoked("Connect Spotify again to resume importing.");
}

/** A track object from the Web API, as a play we can file. */
function trackInput(track: unknown): ScrobbleInput | null {
  const t = obj(track);
  if (!t || (t.type !== undefined && t.type !== "track")) return null; // podcast episodes are not scrobbled
  const artist = str(obj(list(t.artists)[0])?.name), name = str(t.name);
  if (!artist || !name) return null;
  return { artist, track: name, album: str(obj(t.album)?.name), duration: Math.round(numOr(t.duration_ms) / 1000) };
}

/** Imports plays since the last import. Returns how many were added. */
async function importRecent(link: repo.Link): Promise<number> {
  await repo.updateLink(link.userId, { recentAt: now() }); // claimed, so a slow or failing account does not block the queue
  if (paused(link.clientId)) return 0;
  try {
    const reply = await spotifyGet(link, `/me/player/recently-played?limit=50${link.cursor ? `&after=${link.cursor}` : ""}`);
    const plays: { at: number; input: ScrobbleInput }[] = [];
    for (const item of list(reply?.items)) {
      const it = obj(item), input = trackInput(it?.track), at = Date.parse(str(it?.played_at));
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
  } catch (e) { return failed(link, e); }
}

async function mirrorPlaying(link: repo.Link) {
  await repo.updateLink(link.userId, { playingAt: now() });
  if (paused(link.clientId)) return;
  try {
    const reply = await spotifyGet(link, "/me/player/currently-playing");
    if (!reply || reply.is_playing !== true || reply.currently_playing_type !== "track") return;
    const input = trackInput(reply.item);
    if (input) await setNowPlaying(link.userId, input);
  } catch (e) { failed(link, e); }
}

function failed(link: repo.Link, e: unknown): number {
  if (e instanceof Revoked) { repo.updateLink(link.userId, { broken: e.message }).catch(err => console.error(err)); return 0; }
  if (!(e instanceof Slowed)) console.error(`Spotify (user ${link.userId}):`, e);
  return 0;
}

// ---------- for the routes ----------
function view(link: repo.Link): SpotifyLink {
  return { account: { id: link.spotifyId, name: link.displayName }, clientId: link.clientId, connectedAt: link.createdAt, lastImport: link.importedAt, imported: link.imported, broken: link.broken };
}

export async function status(userId: number, req: Request): Promise<SpotifyStatus> {
  const redirectUri = redirectFor(req);
  if (!redirectUri) return { enabled: false };
  const link = await repo.findLink(userId);
  return { enabled: true, redirectUri, link: link && view(link) };
}

/** Imports now instead of waiting for the next round. */
export async function syncNow(userId: number): Promise<{ imported: number; link: SpotifyLink } | null> {
  const link = await repo.findLink(userId);
  if (!link) return null;
  const imported = link.broken ? 0 : await importRecent(link);
  return { imported, link: view((await repo.findLink(userId)) ?? link) };
}

export const disconnect = (userId: number) => repo.dropLink(userId);

// ---------- background loop ----------
let busy = false;
async function tick() {
  if (busy) return;
  busy = true;
  try {
    for (const link of await repo.dueLinks(now() - RECENT_EVERY, 25)) await importRecent(link);
    for (const link of await repo.playingDue(now() - PLAYING_EVERY, 50)) await mirrorPlaying(link);
    await repo.dropStalePending(now() - PENDING_FOR);
  } catch (e) { console.error("Spotify loop:", e); }
  finally { busy = false; }
}

/** Started once at boot (server/index.ts). Idle while nobody has linked Spotify. */
export function startSpotify() {
  const g = globalThis as { __spinSpotify?: ReturnType<typeof setInterval> }; // survives hot reloads in development
  clearInterval(g.__spinSpotify);
  g.__spinSpotify = setInterval(tick, 15_000);
}
