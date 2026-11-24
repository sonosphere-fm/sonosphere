import { api } from "./lib";
import type { ImageSaved } from "../shared/images";
import type { SpotifyPlayerToken } from "../shared/spotify";

export type SdkTrack = {
  id: string | null;
  uri: string;
  type: "track" | "episode" | "ad";
  name: string;
  artists: { name: string }[];
  album: { name: string; images: { url: string }[] };
  linked_from?: { uri: string | null };
};
export type SdkState = {
  paused: boolean;
  position: number;
  duration: number;
  track_window: { current_track: SdkTrack | null; previous_tracks: SdkTrack[] };
};
type SdkPlayer = {
  connect(): Promise<boolean>;
  disconnect(): void;
  pause(): Promise<void>;
  togglePlay(): Promise<void>;
  seek(ms: number): Promise<void>;
  getCurrentState(): Promise<SdkState | null>;
  activateElement(): Promise<void>;
  addListener(ev: "ready" | "not_ready", cb: (e: { device_id: string }) => void): boolean;
  addListener(ev: "player_state_changed", cb: (s: SdkState | null) => void): boolean;
  addListener(
    ev: "initialization_error" | "authentication_error" | "account_error" | "playback_error",
    cb: (e: { message: string }) => void
  ): boolean;
};
type SdkPlayerOptions = { name: string; getOAuthToken: (cb: (t: string) => void) => void; volume?: number };
type Sdk = { Player: new (o: SdkPlayerOptions) => SdkPlayer };
declare global {
  interface Window {
    Spotify?: Sdk;
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

let token: { value: string; until: number } | null = null;
async function getToken(): Promise<string | null> {
  if (token && token.until > Date.now() / 1000 + 60) return token.value;
  const r = await api<SpotifyPlayerToken>("/spotify/token").catch(() => null);
  token = r?.token ? { value: r.token, until: r.expiresAt } : null;
  return token?.value ?? null;
}

let sdk: Promise<Sdk> | null = null;
const loadSdk = () =>
  (sdk ??= new Promise((resolve) => {
    if (window.Spotify) return resolve(window.Spotify);
    window.onSpotifyWebPlaybackSDKReady = () => {
      if (window.Spotify) resolve(window.Spotify);
    };
    const s = document.createElement("script");
    s.src = "https://sdk.scdn.co/spotify-player.js";
    document.head.appendChild(s);
  }));
const within = <T>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);

type Found = { uri: string; id: string; art: string | null };
export type SpotifyOut = {
  find(artist: string, title: string): Promise<Found | null>;
  play(uri: string, fromMs?: number): Promise<boolean>;
  pause(): void;
  toggle(): void;
  seek(ms: number): void;
  state(): Promise<SdkState | null>;
  close(): void;
};
/** Whether a player state is about the track we started (Spotify may swap in a regional copy of it). */
export const isTrack = (t: SdkTrack | null | undefined, uri: string) =>
  !!t && (t.uri === uri || t.linked_from?.uri === uri);

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s*[([].*?[)\]]\s*/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
// the art is shown from our own address, never Spotify's
export const artId = (url: string) =>
  api<ImageSaved>("/image/art", { body: { url } }).then(
    (r) => r.image,
    () => null
  );
type SearchItem = {
  id: string;
  uri: string;
  name: string;
  artists: { name: string }[];
  album?: { images?: { url: string }[] };
};

/** Null when the listener's link can't play (no playback access, no Premium...). */
export async function openSpotify(on: {
  state: (s: SdkState) => void;
  lost: () => void;
  failed: () => void;
}): Promise<SpotifyOut | null> {
  if (!(await getToken())) return null;
  const S = await within(loadSdk(), 10_000);
  if (!S) return null;
  const getOAuthToken = (cb: (t: string) => void) => {
    getToken().then((t) => {
      if (t) cb(t);
    });
  };
  const player = new S.Player({ name: "Sonosphere", getOAuthToken, volume: 0.8 });
  let device = "";
  const ready = new Promise<boolean>((resolve) => {
    player.addListener("ready", (e) => {
      device = e.device_id;
      resolve(true);
    });
    // account_error means no Premium. Any of these after start-up means falling back to videos.
    for (const ev of ["initialization_error", "authentication_error", "account_error"] as const) {
      player.addListener(ev, () => {
        resolve(false);
        on.lost();
      });
    }
    setTimeout(() => resolve(false), 10_000);
  });
  player.addListener("not_ready", () => {
    device = "";
  });
  player.addListener("playback_error", () => on.failed());
  player.addListener("player_state_changed", (s) => {
    if (s) on.state(s);
  });
  const connected = await player.connect().catch(() => false);
  if (!connected || !(await ready)) {
    player.disconnect();
    return null;
  }
  // lets mobile browsers play audio started outside a tap
  player.activateElement().catch(() => {});

  const web = async (path: string, init: RequestInit = {}) => {
    const t = await getToken();
    if (!t) return null;
    const headers = { Authorization: `Bearer ${t}`, ...(init.body ? { "Content-Type": "application/json" } : {}) };
    return fetch("https://api.spotify.com/v1" + path, { ...init, headers }).catch(() => null);
  };
  return {
    async find(artist, title) {
      const q = `track:"${title.replace(/"/g, "")}" artist:"${artist.replace(/"/g, "")}"`;
      const r = await web(`/search?${new URLSearchParams({ q, type: "track", limit: "10" })}`);
      const data = r?.ok ? ((await r.json().catch(() => null)) as { tracks?: { items?: SearchItem[] } } | null) : null;
      const items = (data?.tracks?.items ?? []).filter(
        (i) => i && i.artists?.some((a) => norm(a.name) === norm(artist))
      );
      const hit = items.find((i) => norm(i.name) === norm(title)) ?? items[0];
      if (!hit) return null;
      const art = hit.album?.images?.[0]?.url;
      return { uri: hit.uri, id: hit.id, art: art ? await artId(art) : null };
    },
    async play(uri, fromMs = 0) {
      if (!device) return false;
      const body = JSON.stringify({ uris: [uri], position_ms: Math.max(0, Math.round(fromMs)) });
      const r = await web(`/me/player/play?device_id=${encodeURIComponent(device)}`, { method: "PUT", body });
      return !!r?.ok;
    },
    pause: () => {
      player.pause().catch(() => {});
    },
    toggle: () => {
      player.togglePlay().catch(() => {});
    },
    seek: (ms) => {
      player.seek(Math.max(0, Math.round(ms))).catch(() => {});
    },
    state: () => player.getCurrentState().catch(() => null),
    close: () => player.disconnect(),
  };
}
