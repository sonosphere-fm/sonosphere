// Logs plays from the "Listening to" status of members of the Sonosphere Discord who opted in. It catches what
// players without a scrobbler send to Discord, such as YouTube Music through PreMiD.
import * as Sentry from "@sentry/bun";
import { clearNowPlaying } from "../listening/repo";
import { scrobbleMany, setNowPlaying } from "../listening/service";
import { exclusive, getJson, setJson } from "../kv";
import * as repo from "./repo";
import { watch, type Activity, type Presence } from "./gateway";
import type { DiscordStatus } from "../../shared/discord";

export const GUILD_ID = "1573635846580736042";
export const TOKEN = process.env.DISCORD_BOT_TOKEN || "";
const OWN_APP = process.env.DISCORD_CLIENT_ID || "";
export const API = "https://discord.com/api/v10";
const LISTENING = 2;
const REFRESH_EVERY = 60_000;
const MEMBER_FOR = 5 * 60_000;
// Other scrobblers usually send the same play around when it ends, so plays are filed a little later and dropped if
// one already arrived.
const SETTLE_MS = 90_000;
const SAME_PLAY_WITHIN = 4 * 60;

type Heard = {
  key: string;
  app: string;
  artist: string;
  track: string;
  album: string;
  start: number | null;
  duration: number;
  timed: boolean;
};
type Listen = Heard & { startedAt: number; played: number; lastAt: number; paused: boolean; nowPlaying: number | null };

const loose = (s: string) => s.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();

// Spotify lists every artist split by "; ", and some Apple Music helpers write "by Artist".
function artistOf(app: string, state: string): string {
  const first = app === "Spotify" ? state.split("; ")[0]! : state;
  return first.replace(/^by /, "").trim();
}

function heard(activities: Activity[], spotify: boolean): Heard | null {
  for (const a of activities) {
    if (a.type !== LISTENING || !a.details?.trim() || !a.state?.trim()) continue;
    if (spotify && a.name === "Spotify") continue;
    // our own rich presence would otherwise be logged back into the listener's history
    if (OWN_APP && a.application_id === OWN_APP) continue;
    const artist = artistOf(a.name, a.state);
    const track = a.details.trim();
    if (!artist) continue;
    const { start, end } = a.timestamps ?? {};
    return {
      key: loose(`${a.name}|${artist}|${track}`),
      app: a.name,
      artist,
      track,
      album: a.assets?.large_text?.trim() ?? "",
      start: start ?? null,
      duration: start && end && end > start ? Math.round((end - start) / 1000) : 0,
      timed: !!(start || end),
    };
  }
  return null;
}

let members = new Map<string, repo.Watched>();
const listening = new Map<number, Listen>();

async function refresh() {
  members = new Map((await repo.watched()).map((w) => [w.discordId, w]));
}

function begin(userId: number, h: Heard, t: number) {
  const l: Listen = {
    ...h,
    startedAt: Math.floor((h.start ?? t) / 1000),
    played: h.start ? Math.max(0, t - h.start) : 0,
    lastAt: t,
    paused: false,
    nowPlaying: null,
  };
  listening.set(userId, l);
  setNowPlaying(userId, { artist: l.artist, track: l.track, album: l.album, duration: l.duration })
    .then((ref) => {
      if (ref) l.nowPlaying = ref.trackId;
    })
    .catch((e) => console.error("Discord now playing:", e));
}

// Last.fm's rule: half the track or four minutes, whichever comes first, and nothing under 30 seconds.
const enough = (l: Listen) =>
  (l.duration === 0 || l.duration > 30) && l.played >= Math.min(240, (l.duration || 480) / 2) * 1000;

async function file(userId: number, l: Listen) {
  const sent = await repo.sentAround(userId, l.startedAt, SAME_PLAY_WITHIN);
  if (sent.some((s) => s.track && loose(s.track) === loose(l.track))) return;
  const [r] = await scrobbleMany(
    userId,
    [{ artist: l.artist, track: l.track, album: l.album, duration: l.duration, timestamp: l.startedAt }],
    "discord"
  );
  if (r?.accepted) await repo.counted(userId);
}

function finish(userId: number, l: Listen) {
  listening.delete(userId);
  if (l.nowPlaying) clearNowPlaying(userId, l.nowPlaying).catch((e) => console.error("Discord now playing:", e));
  if (!enough(l)) return;
  setTimeout(() => {
    file(userId, l).catch((e) => {
      console.error("Discord play:", e);
      Sentry.captureException(e);
    });
  }, SETTLE_MS);
}

// A player that dated the track and then stops dating it has paused, so that stretch does not count as listening.
function seen(p: Presence) {
  const member = members.get(p.userId);
  if (!member) return;
  const t = Date.now();
  const h = heard(p.activities, member.spotify);
  const l = listening.get(member.userId);
  if (l) {
    if (!l.paused) l.played += t - l.lastAt;
    l.lastAt = t;
    if (h?.key === l.key) {
      l.paused = l.timed && !h.timed;
      l.timed ||= h.timed;
      l.duration ||= h.duration;
      return;
    }
    finish(member.userId, l);
  }
  if (h) begin(member.userId, h, t);
}

// After a fresh connection Discord lists everyone online; anyone missing went quiet while the bot was away.
function everyone(all: Presence[]) {
  const present = new Set(all.map((p) => members.get(p.userId)?.userId));
  for (const [userId, l] of listening) if (!present.has(userId)) finish(userId, l);
  all.forEach(seen);
}

export async function status(userId: number): Promise<DiscordStatus> {
  if (!TOKEN) return { enabled: false };
  const [discordId, optin] = await Promise.all([repo.discordIdOf(userId), repo.findOptin(userId)]);
  return {
    enabled: true,
    linked: !!discordId,
    inServer: !!discordId && (await inServer(discordId)),
    on: !!optin,
    lastPlayAt: optin?.lastPlayAt ?? null,
  };
}

async function inServer(discordId: string): Promise<boolean> {
  const key = `discord-member:${discordId}`;
  const cached = await getJson<{ in: boolean }>(key);
  if (cached) return cached.in;
  const res = await fetch(`${API}/guilds/${GUILD_ID}/members/${discordId}`, {
    headers: { Authorization: `Bot ${TOKEN}` },
    signal: AbortSignal.timeout(8000),
  });
  await res.body?.cancel();
  if (!res.ok && res.status !== 404) throw new Error(`Discord member lookup answered ${res.status}`);
  // only a yes is kept, so someone who just joined can check again straight away
  if (res.ok) await setJson(key, { in: true }, MEMBER_FOR);
  return res.ok;
}

export async function toggle(userId: number, on: boolean): Promise<DiscordStatus> {
  await repo.setOptin(userId, on);
  await refresh();
  return status(userId);
}

let running = false;
async function hold() {
  if (running) return;
  running = true;
  try {
    // only one process may hold the connection, or every play would be logged twice
    await exclusive("discord-presence", 60_000, async () => {
      await refresh();
      const refreshing = setInterval(() => refresh().catch((e) => console.error("Discord members:", e)), REFRESH_EVERY);
      try {
        await watch(TOKEN, GUILD_ID, { presence: seen, everyone });
      } finally {
        clearInterval(refreshing);
      }
    });
  } catch (e) {
    console.error("Discord bot:", e);
    Sentry.captureException(e);
  } finally {
    running = false;
  }
}

export function startDiscord() {
  if (!TOKEN) return;
  hold();
  setInterval(hold, 30_000);
}
