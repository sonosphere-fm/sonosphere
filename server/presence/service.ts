// Shows the listener's now-playing on their Discord profile through headless sessions.
// Ported from BrookenRecord/studio-activity (plugin/src/PresenceManager/createPresenceManager.luau).
import * as Sentry from "@sentry/bun";
import { SITE_URL } from "../mail";
import { nowPlaying } from "../listening/repo";
import { onListeningChange } from "../realtime";
import { exclusive, getJson, publish, setJson, subscribe, takeJson } from "../kv";
import { digest, now, rid } from "../util";
import { seal, unseal } from "../seal";
import { discordIdOf } from "../discord/repo";
import { bad } from "../http";
import * as api from "./api";
import * as repo from "./repo";
import type { NowPlaying } from "../../shared/listening";
import type {
  PresencePreferences,
  PresencePreferencesPatch,
  PresenceStatus,
  PresenceToggle,
} from "../../shared/discord";
import { artistUrl, trackUrl } from "../../shared/paths";

export const enabled = () => !!api.CLIENT_ID && !!process.env.DISCORD_CLIENT_SECRET;
export const linkedDiscord = async (userId: number): Promise<boolean> => !!(await discordIdOf(userId));

const REDIRECT_URI = `${SITE_URL}/api/discord/presence/callback`;
const STATE_LIFE = 10 * 60;
// Discord drops a headless session after 20 minutes without an update
const SESSION_LIFE = 20 * 60_000;
const HEARTBEAT_EVERY = 15 * 60_000;
const SYNC_DEBOUNCE = 1500;
const MAX_RETRIES = 3;
const REFRESH_BUFFER = 3600;
const APP_NAME = "Sonosphere";
const ASSET_NAME = "sonosphere";
const LOGO_URL = `${SITE_URL}/pwa/icon-512.png`;
const TEXT_LIMIT = 128;

const sessionKey = (userId: number) => `presence-session:${userId}`;
type Session = { token: string; trackId: number; startedAt: number; activityHash: string };

let active = false;
let cooldownUntil = 0;
let logo: Promise<string> | undefined;
const timers = new Map<number, ReturnType<typeof setTimeout>>();
const chains = new Map<number, Promise<void>>();

function notify(userId: number) {
  publish("presence", JSON.stringify({ userId })).catch((e) => console.error("Discord presence notify:", e));
}

subscribe("presence", (raw) => {
  if (!active) return;
  try {
    const m = JSON.parse(raw) as { userId?: unknown };
    if (typeof m.userId === "number") schedule(m.userId);
  } catch {}
});
onListeningChange((userId) => {
  if (active) schedule(userId);
});

function schedule(userId: number) {
  clearTimeout(timers.get(userId));
  timers.set(
    userId,
    setTimeout(() => {
      timers.delete(userId);
      enqueue(userId, () => sync(userId));
    }, SYNC_DEBOUNCE)
  );
}

// one API conversation per listener at a time, so a heartbeat cannot overwrite a fresher sync
function enqueue(userId: number, job: () => Promise<void>) {
  const prev = chains.get(userId) ?? Promise.resolve();
  const next = prev.then(job, job);
  chains.set(userId, next);
  const done = () => {
    if (chains.get(userId) === next) chains.delete(userId);
  };
  next.then(done, done);
}

async function retry<T>(fn: () => Promise<api.Result<T>>): Promise<api.Result<T>> {
  let backoff = 1000;
  for (let attempt = 1; ; attempt++) {
    const wait = cooldownUntil - Date.now();
    if (wait > 0) await Bun.sleep(wait);
    const r = await fn();
    if (r.ok || r.error.type === "unauthorized" || attempt === MAX_RETRIES) return r;
    if (r.error.type === "rate_limited") {
      cooldownUntil = Math.max(cooldownUntil, Date.now() + r.error.retryAfter * 1000);
      continue;
    }
    const asked = r.error.type === "application_not_cached" ? r.error.retryAfter * 1000 : 0;
    await Bun.sleep(Math.max(asked, backoff));
    backoff *= 2;
  }
}

async function accessToken(link: repo.Link): Promise<string> {
  const current = unseal(link.accessToken);
  if (current && link.expiresAt > now() + REFRESH_BUFFER) return current;
  const refresh = unseal(link.refreshToken);
  if (!refresh) throw new api.Revoked("no refresh token stored");
  const t = await api.refresh(refresh);
  link.accessToken = seal(t.access);
  link.expiresAt = now() + t.expiresIn;
  if (t.refresh) link.refreshToken = seal(t.refresh);
  await repo.updateLink(link.userId, {
    accessToken: link.accessToken,
    refreshToken: link.refreshToken,
    expiresAt: link.expiresAt,
  });
  return t.access;
}

async function markBroken(userId: number) {
  await repo.updateLink(userId, { broken: true });
  console.warn(`Discord presence: user ${userId} needs to connect again`);
}

function logoImage(): Promise<string> {
  return (logo ??= api.assets().then(
    (assets) => assets.find((a) => a.name === ASSET_NAME)?.id ?? LOGO_URL,
    () => LOGO_URL
  ));
}

const activityText = (s: string, max = TEXT_LIMIT) => s.slice(0, max).toWellFormed();

async function activityOf(p: NowPlaying, startedAt: number, prefs: PresencePreferences): Promise<api.Activity> {
  const a: api.Activity = {
    type: 2,
    name: APP_NAME,
    application_id: api.CLIENT_ID,
    platform: "desktop",
    timestamps: {
      start: String(startedAt * 1000),
      end: p.duration > 0 ? String((startedAt + p.duration) * 1000) : undefined,
    },
  };

  if (prefs.details === "artist") a.details = activityText(p.artist);
  else if (prefs.details === "track") a.details = activityText(p.title);
  else if (prefs.layout === "inline") {
    const separator = " · ";
    const room = TEXT_LIMIT - separator.length;
    const artist = activityText(p.artist, Math.max(Math.floor(room / 2), room - p.title.length));
    a.details = `${activityText(p.title, room - artist.length)}${separator}${artist}`;
  } else {
    a.details = activityText(p.title);
    a.state = activityText(p.artist);
  }

  const cover = prefs.image === "album" && p.image ? `${SITE_URL}/api/image/${p.image}` : undefined;
  const icon = prefs.branding || prefs.image === "logo" ? await logoImage() : undefined;
  if (cover) {
    a.assets = {
      large_image: cover,
      large_text: prefs.details === "trackArtist" && p.album ? activityText(p.album) : undefined,
      small_image: icon,
      small_text: icon ? APP_NAME : undefined,
    };
  } else if (icon) a.assets = { large_image: icon, large_text: APP_NAME };

  if (prefs.branding) {
    const artistOnly = prefs.details === "artist";
    const url = `${SITE_URL}${artistOnly ? artistUrl(p.artist) : trackUrl(p.artist, p.title)}`;
    const fallback = artistOnly ? SITE_URL : `${SITE_URL}/api/short/t/${p.trackId.toString(36)}`;
    a.buttons = [{ label: APP_NAME, url: url.length <= 512 ? url : fallback }];
  }
  return a;
}

async function dropSession(userId: number, link: repo.Link | null, session: Session) {
  await takeJson(sessionKey(userId));
  // without a working grant there is no way to delete; the session expires on its own
  if (!link || link.broken) return;
  try {
    const access = await accessToken(link);
    await retry(() => api.deleteSession(access, session.token));
  } catch (e) {
    if (!(e instanceof api.Revoked)) console.error("Discord presence:", e);
  }
}

/** Reconciles the headless session with what is playing now. `keepAlive` also refreshes an unchanged track. */
async function sync(userId: number, keepAlive = false) {
  const link = await repo.findLink(userId);
  const session = await getJson<Session>(sessionKey(userId));
  if (!link || !link.on || link.broken || link.banned) {
    if (session) await dropSession(userId, link, session);
    return;
  }
  const playing = await nowPlaying(userId);
  if (!playing) {
    if (session) await dropSession(userId, link, session);
    return;
  }
  // now-playing rows are rewritten while the same track keeps playing: anchor the timer to when it first appeared
  const sameTrack = !!session && session.trackId === playing.trackId;
  const startedAt = sameTrack ? session.startedAt : playing.startedAt;
  const activity = await activityOf(playing, startedAt, link);
  const next = { trackId: playing.trackId, startedAt, activityHash: digest(JSON.stringify(activity)) };
  if (sameTrack && session.activityHash === next.activityHash && !keepAlive) return;

  let access: string;
  try {
    access = await accessToken(link);
  } catch (e) {
    if (e instanceof api.Revoked) {
      await takeJson(sessionKey(userId));
      await markBroken(userId);
    } else console.error("Discord presence:", e);
    return;
  }
  if (session) {
    const r = await retry(() => api.updateSession(access, session.token, activity));
    if (r.ok) {
      await setJson(sessionKey(userId), { ...next, token: r.value.token }, SESSION_LIFE);
      return;
    }
    await takeJson(sessionKey(userId));
    if (r.error.type === "unauthorized") {
      await markBroken(userId);
      return;
    }
    // the session went stale: start a new one below
  }
  const r = await retry(() => api.createSession(access, activity));
  if (r.ok) await setJson(sessionKey(userId), { ...next, token: r.value.token }, SESSION_LIFE);
  else if (r.error.type === "unauthorized") await markBroken(userId);
}

export async function connectUrl(userId: number): Promise<string> {
  const state = rid(16);
  await setJson(`presence-state:${state}`, { userId }, STATE_LIFE * 1000);
  const q = new URLSearchParams({
    client_id: api.CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: api.SCOPE,
    state,
  });
  return `https://discord.com/oauth2/authorize?${q}`;
}

export type Outcome = "connected" | "denied" | "expired" | "failed" | "mismatch";

export async function finishConnect(viewerId: number | null, q: URLSearchParams): Promise<Outcome> {
  const pending = await takeJson<{ userId: number }>(`presence-state:${q.get("state") || ""}`);
  if (!pending || pending.userId !== viewerId) return "expired";
  if (q.get("error") || !q.get("code")) return "denied";
  try {
    const t = await api.exchangeCode(q.get("code")!, REDIRECT_URI);
    const who = await api.me(t.access);
    if ((await discordIdOf(pending.userId)) !== who.id) return "mismatch";
    await repo.saveLink({
      userId: pending.userId,
      discordId: who.id,
      name: who.globalName || who.username,
      accessToken: seal(t.access),
      refreshToken: seal(t.refresh),
      expiresAt: now() + t.expiresIn,
      on: true,
      broken: false,
      createdAt: now(),
    });
    notify(pending.userId);
    return "connected";
  } catch (e) {
    console.error("Discord presence connect:", e);
    Sentry.captureException(e);
    return "failed";
  }
}

export async function status(userId: number): Promise<PresenceStatus> {
  if (!enabled()) return { enabled: false };
  const [discordId, link] = await Promise.all([discordIdOf(userId), repo.findLink(userId)]);
  return {
    enabled: true,
    linked: !!discordId,
    link: link
      ? {
          name: link.name,
          on: link.on,
          broken: link.broken,
          since: link.createdAt,
          image: link.image === "logo" ? "logo" : "album",
          details: link.details,
          layout: link.layout,
          branding: link.branding,
        }
      : null,
  };
}

export async function updateSettings(
  userId: number,
  patch: PresencePreferencesPatch | PresenceToggle
): Promise<PresenceStatus> {
  if (!(await repo.updateLink(userId, patch))) bad("isntConnected");
  notify(userId);
  return status(userId);
}

export async function disconnect(userId: number): Promise<void> {
  const link = await repo.findLink(userId);
  const session = await takeJson<Session>(sessionKey(userId));
  await repo.dropLink(userId);
  notify(userId);
  if (!link) return;
  if (session) await dropSession(userId, link, session);
  const access = unseal(link.accessToken);
  const refresh = unseal(link.refreshToken);
  if (access) await api.revoke(access).catch(() => {});
  if (refresh) await api.revoke(refresh).catch(() => {});
}

const g = globalThis as {
  __spinPresence?: ReturnType<typeof setInterval>;
  __spinPresenceRun?: object;
};

let running = false;
async function hold() {
  if (running || !enabled()) return;
  running = true;
  const run = g.__spinPresenceRun;
  try {
    // only one process may hold presence, or every session would be written twice
    await exclusive("discord-rich-presence", 60_000, async () => {
      if (g.__spinPresenceRun !== run) return;
      active = true;
      const sweep = (keepAlive: boolean) =>
        repo.workingLinks().then(
          (links) => {
            for (const l of links) enqueue(l.userId, () => sync(l.userId, keepAlive));
          },
          (e) => console.error("Discord presence sweep:", e)
        );
      const beat = setInterval(() => sweep(true), HEARTBEAT_EVERY);
      // resume whatever is playing right away, without waiting for the next play event
      await sweep(false);
      while (g.__spinPresenceRun === run) await Bun.sleep(1000);
      active = false;
      clearInterval(beat);
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    });
  } catch (e) {
    console.error("Discord presence:", e);
    Sentry.captureException(e);
  } finally {
    running = false;
  }
}

export function startPresence() {
  if (!enabled()) return;
  clearInterval(g.__spinPresence);
  // a new run token winds down the previous hold, including one left by a hot reload
  g.__spinPresenceRun = {};
  hold();
  g.__spinPresence = setInterval(hold, 15_000);
}
