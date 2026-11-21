import { Ico } from "./icons";
import { createContext, useContext, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { Button } from "./kit";
import { Link, useNavigate } from "react-router-dom";
import { api, artistUrl, qs, trackUrl, useAuth } from "./lib";
import { errorText } from "./ui/base";
import { Mark } from "./ui/brand";
import type { Ok } from "../shared/auth";
import type { ScrobbleResponse } from "../shared/listening";
import type { Station as StationReply } from "../shared/stations";
import type { VideoLookup } from "../shared/video";
import { isTrack, openSpotify, type SdkState, type SpotifyOut } from "./spotify";

export type PTrack = { title: string; artist: string; album?: string | null; image?: string | null; duration?: number };
/** "saved": restored after a reload, waiting for a press of play (browsers don't let pages autoplay). */
type Status = "finding" | "ready" | "missing" | "saved";
/** Whether play/pause acts on the current track rather than starting it afresh. */
const live = (s: Status) => s === "ready" || s === "saved";
/** `path` is the API request that returns the next batch of tracks. */
type Station = { path: string; title: string };
type State = {
  queue: PTrack[];
  index: number;
  playing: boolean;
  status: Status;
  videoId: string | null;
  spotify: { id: string; art: string | null } | null;
  position: number;
  length: number;
  scrobbled: boolean;
  station: Station | null;
};
const empty: State = {
  queue: [],
  index: -1,
  playing: false,
  status: "finding",
  videoId: null,
  spotify: null,
  position: 0,
  length: 0,
  scrobbled: false,
  station: null,
};

const SAVE_KEY = "spin:player";
type Saved = { queue: PTrack[]; index: number; station: Station | null; position: number; length: number; art?: string | null };
/** Spotify's cover from before the reload, shown while the status is "saved". */
let savedArt: string | null = null;

function loadSaved(): State {
  try {
    const v = JSON.parse(localStorage.getItem(SAVE_KEY) || "null") as Saved | null;
    if (!v || !Array.isArray(v.queue) || !v.queue[v.index]) return empty;
    savedArt = typeof v.art === "string" ? v.art : null;
    return {
      ...empty,
      queue: v.queue,
      index: v.index,
      station: v.station,
      status: "saved",
      position: Number(v.position) || 0,
      length: Number(v.length) || 0,
    };
  } catch {
    return empty;
  }
}

function save(s: State) {
  try {
    if (s.index < 0 || !s.queue[s.index]) return localStorage.removeItem(SAVE_KEY);
    const from = Math.max(0, s.index - 20);
    const v: Saved = {
      queue: s.queue.slice(from, s.index + 80),
      index: s.index - from,
      station: s.station,
      position: s.position,
      length: s.length,
      art: s.spotify?.art ?? (s.status === "saved" ? savedArt : null),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(v));
  } catch {}
}

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

type Player = {
  state: State;
  play: (q: PTrack[], i?: number) => void;
  playStation: (path: string) => Promise<void>;
  toggle: () => void;
  seek: (sec: number) => void;
  isCurrent: (t: PTrack) => boolean;
};
const Ctx = createContext<Player | null>(null);
export const usePlayer = () => {
  const p = useContext(Ctx);
  if (!p) throw new Error("The player is used outside <PlayerProvider>");
  return p;
};
const same = (a?: PTrack, b?: PTrack) => !!a && !!b && a.title === b.title && a.artist === b.artist;

// The parts of the YouTube IFrame API used here (no @types package is installed).
type YTPlayer = {
  loadVideoById(id: string, startSeconds?: number): void;
  stopVideo(): void;
  destroy(): void;
  pauseVideo(): void;
  playVideo(): void;
  seekTo(sec: number, allowSeekAhead: boolean): void;
  getDuration(): number;
  getCurrentTime(): number;
  getPlayerState(): number;
};
type YTOptions = {
  videoId: string;
  width: string;
  height: string;
  host: string;
  playerVars: Record<string, number>;
  events: { onStateChange: (e: { data: number }) => void; onError: () => void };
};
type YTApi = {
  Player: new (el: HTMLElement, opts: YTOptions) => YTPlayer;
  PlayerState: { ENDED: number; PLAYING: number; PAUSED: number };
};
declare global {
  interface Window { YT?: YTApi; onYouTubeIframeAPIReady?: () => void }
}

let apiReady: Promise<YTApi> | null = null;
function loadYouTube(): Promise<YTApi> {
  return apiReady ??= new Promise(resolve => {
    const w = window;
    if (w.YT?.Player) return resolve(w.YT);
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      prev?.();
      if (w.YT) resolve(w.YT);
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  });
}

type SpotifyLink = {
  out: SpotifyOut | null;
  opening: Promise<SpotifyOut | null> | null;
  off: boolean;
  uri: string;
  moved: boolean;
};

const trackKey = (t: PTrack) => `${t.artist}\n${t.title}`.toLowerCase();

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { me } = useAuth();
  const [state, setState] = useState<State>(loadSaved);
  const ref = useRef(state);
  ref.current = state;
  const meRef = useRef(me);
  meRef.current = me;
  const yt = useRef<YTPlayer | null>(null);
  const mount = useRef<HTMLDivElement>(null);
  const run = useRef({ token: 0, listened: 0, startedAt: 0 });
  // videos still to try for this track: some can't be embedded
  const cands = useRef<string[]>([]);
  const station = useRef<(Station & { loading: boolean }) | null>(state.station && { ...state.station, loading: false });
  // where to start the track when resuming after a reload
  const from = useRef(0);

  // Connected on the first play, and given up on for the session if the link can't play.
  const sp = useRef<SpotifyLink>({ out: null, opening: null, off: false, uri: "", moved: false });

  const onSpotify = (st: SdkState) => {
    const s = sp.current;
    if (!ref.current.spotify || !s.uri) return;
    const mine = isTrack(st.track_window.current_track, s.uri);
    if (mine && st.position > 0) s.moved = true;
    // Only one track is queued, so Spotify stops at its end: back at 0, paused, with our track current or just gone.
    const justGone = st.track_window.previous_tracks.some(t => isTrack(t, s.uri));
    if (st.paused && st.position === 0 && s.moved && (mine || justGone)) {
      s.uri = "";
      next();
      return;
    }
    if (mine) {
      setState(v => (v.spotify ? { ...v, playing: !st.paused, position: st.position / 1000, length: st.duration / 1000 } : v));
    }
  };

  const spotify = (): Promise<SpotifyOut | null> => {
    const s = sp.current;
    if (s.off || !meRef.current) return Promise.resolve(null);
    if (s.out) return Promise.resolve(s.out);
    const lost = () => {
      s.off = true;
      s.out?.close();
      s.out = null;
    };
    return s.opening ??= openSpotify({ state: onSpotify, lost })
      .catch(() => null)
      .then(out => {
        s.opening = null;
        s.out = out;
        if (!out) s.off = true;
        return out;
      });
  };
  // a different account means a different link
  useEffect(() => () => {
    const s = sp.current;
    s.out?.close();
    s.out = null;
    s.off = false;
  }, [me?.id]);

  // A station tops itself up before it runs dry, skipping tracks heard in the last couple of batches.
  const refill = () => {
    const st = station.current;
    if (!st || st.loading) return;
    st.loading = true;
    api<StationReply>(st.path)
      .then(r => {
        if (station.current !== st) return;
        setState(s => {
          const recent = new Set(s.queue.slice(-60).map(trackKey));
          return { ...s, queue: [...s.queue, ...r.tracks.filter(t => !recent.has(trackKey(t)))] };
        });
      })
      .catch(() => {})
      .finally(() => { st.loading = false; });
  };

  const start = (queue: PTrack[], index: number, at = 0) => {
    const t = queue[index];
    const token = ++run.current.token;
    const stale = () => run.current.token !== token;
    from.current = at;
    run.current.listened = 0;
    run.current.startedAt = Math.floor(Date.now() / 1000);
    try { yt.current?.stopVideo?.(); } catch {}
    sp.current.uri = "";
    sp.current.out?.pause();

    if (!t) {
      station.current = null;
      setState(empty);
      if (meRef.current) api<Ok>("/nowplaying", { body: { stop: true } }).catch(() => {});
      return;
    }
    const st = station.current;
    setState({ ...empty, queue, index, playing: true, station: st && { path: st.path, title: st.title } });
    if (st && index >= queue.length - 3) refill();

    const playVideo = async () => {
      const ids = await api<VideoLookup>(`/video${qs({ artist: t.artist, track: t.title })}`)
        .then(r => r.videoIds || [], (): string[] => []);
      if (stale()) return;
      cands.current = ids;
      const videoId = ids[0] || null;
      setState(s => ({ ...s, videoId, status: videoId ? "ready" : "missing", playing: !!videoId }));
      if (videoId && meRef.current) {
        const body = { artist: t.artist, track: t.title, album: t.album || "", duration: t.duration || 0 };
        api<Ok>("/nowplaying", { body }).catch(() => {});
      }
    };
    const playSpotify = async () => {
      const out = await spotify();
      if (!out || stale()) return null;
      const hit = await out.find(t.artist, t.title);
      if (!hit || stale()) return null;
      sp.current.uri = hit.uri;
      sp.current.moved = false;
      return (await out.play(hit.uri, at * 1000)) ? hit : null;
    };
    playSpotify().catch(() => null).then(hit => {
      if (stale()) return;
      if (!hit) {
        sp.current.uri = "";
        playVideo();
        return;
      }
      setState(s => ({ ...s, spotify: { id: hit.id, art: hit.art }, status: "ready", playing: true }));
    });
  };
  const next = () => start(ref.current.queue, ref.current.index + 1);

  // Create the embedded player once, then just swap videos in it.
  useEffect(() => {
    const id = state.videoId;
    if (!id) return;
    if (yt.current?.loadVideoById) {
      yt.current.loadVideoById(id, from.current);
      return;
    }
    let dead = false;
    loadYouTube().then(YT => {
      if (dead || !mount.current || yt.current) return;
      const el = document.createElement("div");
      mount.current.appendChild(el);
      const onStateChange = (e: { data: number }) => {
        if (e.data === YT.PlayerState.ENDED) next();
        else if (e.data === YT.PlayerState.PLAYING) setState(s => ({ ...s, playing: true }));
        else if (e.data === YT.PlayerState.PAUSED) setState(s => ({ ...s, playing: false }));
      };
      // removed, private or not embeddable: try the next candidate
      const onError = () => {
        const rest = cands.current.slice(1);
        cands.current = rest;
        setState(s => rest[0] ? { ...s, videoId: rest[0] } : { ...s, status: "missing", playing: false });
      };
      yt.current = new YT.Player(el, {
        videoId: id,
        width: "100%",
        height: "100%",
        host: "https://www.youtube-nocookie.com",
        playerVars: { autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1, start: Math.floor(from.current) },
        events: { onStateChange, onError },
      });
    });
    return () => { dead = true; };
  }, [state.videoId, state.index]);

  // Once a second while playing: move the progress line and count listening time towards a scrobble.
  useEffect(() => {
    if (!state.playing || state.status !== "ready") return;
    const tickSpotify = async () => {
      const st = await sp.current.out?.state();
      if (!st || !isTrack(st.track_window.current_track, sp.current.uri)) return;
      setState(v => (v.spotify ? { ...v, position: st.position / 1000, length: st.duration / 1000 } : v));
    };
    const tick = () => {
      const s = ref.current;
      const t = s.queue[s.index];
      const p = yt.current;
      if (s.spotify) {
        tickSpotify();
        return;
      }
      if (!t || !p?.getDuration) return;
      const length = p.getDuration() || 0;
      const position = p.getCurrentTime() || 0;
      run.current.listened++;
      let scrobbled = s.scrobbled;
      if (!scrobbled && meRef.current && length > 30 && run.current.listened >= Math.min(length / 2, 240)) {
        scrobbled = true;
        const body = {
          artist: t.artist,
          track: t.title,
          album: t.album || "",
          timestamp: run.current.startedAt,
          duration: Math.round(length),
          source: "player",
        };
        api<ScrobbleResponse>("/scrobble", { body })
          .then(() => window.dispatchEvent(new Event("spin:scrobble")))
          .catch(() => {});
      }
      setState(v => ({ ...v, position, length, scrobbled }));
    };
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [state.playing, state.status, state.index]);

  // saved on every change of track, and every few seconds of progress
  useEffect(() => { save(ref.current); }, [state.queue, state.index, state.station, Math.floor(state.position / 5)]);

  const seek = (sec: number) => {
    const s = ref.current;
    if (!live(s.status)) return;
    sec = Math.max(0, Math.min(sec, s.length || sec));
    if (s.status === "ready") {
      if (s.spotify) sp.current.out?.seek(sec * 1000);
      else try { yt.current?.seekTo?.(sec, true); } catch {}
    }
    setState(v => ({ ...v, position: sec }));
  };
  const toggle = () => {
    const s = ref.current;
    if (s.status === "saved") return start(s.queue, s.index, s.position);
    if (s.spotify) return sp.current.out?.toggle();
    const p = yt.current;
    if (!p?.getPlayerState) return;
    if (s.playing) p.pauseVideo();
    else p.playVideo();
  };
  const prev = () => {
    const s = ref.current;
    if (s.position > 3 || s.index === 0) seek(0);
    else start(s.queue, s.index - 1);
  };
  const close = () => {
    start([], 0);
    sp.current.out?.pause();
    try { yt.current?.destroy?.(); } catch {}
    yt.current = null;
  };
  const value = {
    state,
    play: (q: PTrack[], i = 0) => {
      station.current = null;
      start(q, i);
    },
    playStation: async (path: string) => {
      const r = await api<StationReply>(path);
      station.current = { path, title: r.title, loading: false };
      start(r.tracks, 0);
    },
    toggle,
    seek,
    isCurrent: (t: PTrack) => same(state.queue[state.index], t),
  };

  const t = state.queue[state.index];
  const hasNext = state.index < state.queue.length - 1;
  const showCover = (state.status === "ready" && state.spotify) || state.status === "saved";
  const coverSrc = state.spotify?.art || (state.status === "saved" ? savedArt : null) || t?.image || null;
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className={t ? "vplayer" : "vplayer off"} role="region" aria-label="Player" aria-hidden={!t}>
        <button type="button" className="vplayer-x" aria-label="Close player" onClick={close}><Ico.X /></button>
        <div className="vplayer-screen">
          <div className="vplayer-video" ref={mount} style={{ visibility: state.status === "ready" && !state.spotify ? "visible" : "hidden" }} />
          {showCover && <Cover key={`${state.index}:${state.status}`} src={coverSrc} />}
          {!showCover && state.status !== "ready" && <div className="vplayer-blank"><Mark /></div>}
        </div>
        <SeekBar position={state.position} length={live(state.status) ? state.length : 0} onSeek={seek} />
        {t && (
          <div className="vplayer-bar">
            <div className="vplayer-meta">
              {state.station && <small><Ico.Scrobble /> {state.station.title}</small>}
              <TrackMeta track={t} status={state.status} spotify={!!state.spotify} scrobbled={!!me && state.scrobbled} />
            </div>
            <button type="button" aria-label="Previous track" disabled={!live(state.status)} onClick={prev}><Ico.Prev /></button>
            <button type="button" aria-label={state.playing ? "Pause" : "Play"} disabled={!live(state.status)} onClick={toggle}>
              {state.playing ? <Ico.Pause /> : <Ico.Play />}
            </button>
            <button type="button" aria-label="Next track" disabled={!hasNext} onClick={next}><Ico.Next /></button>
            <ExternalLink track={t} spotifyId={state.spotify?.id} videoId={state.videoId} />
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}

function TrackMeta({ track, status, spotify, scrobbled }: { track: PTrack; status: Status; spotify: boolean; scrobbled: boolean }) {
  if (status === "missing") return <span>Track unavailable.</span>;
  if (status === "finding") return <span>Finding “{track.title}”…</span>;
  return (
    <>
      <Link to={trackUrl(track.artist, track.title)} className="strong">{track.title}</Link>
      <span>
        <Link to={artistUrl(track.artist)}>{track.artist}</Link>
        {spotify ? <em> · on Spotify</em> : scrobbled && <em> · <Ico.Check /> Scrobbled</em>}
      </span>
    </>
  );
}

function ExternalLink({ track, spotifyId, videoId }: { track: PTrack; spotifyId?: string; videoId: string | null }) {
  if (spotifyId) return (
    <a href={`https://open.spotify.com/track/${spotifyId}`} target="_blank" rel="noreferrer" aria-label="Open in Spotify" title="Open in Spotify">
      <SpotifyMark />
    </a>
  );
  if (videoId) return (
    <a href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noreferrer" aria-label="Watch on YouTube" title="Watch on YouTube">
      <VideoMark />
    </a>
  );
  const search = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${track.artist} ${track.title}`)}`;
  return (
    <a href={search} target="_blank" rel="noreferrer" aria-label="Search on YouTube" title="Search on YouTube">
      <VideoMark />
    </a>
  );
}

const VideoMark = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <rect x="2" y="5" width="20" height="14" rx="4" fill="currentColor" />
    <path d="M10 9l5 3-5 3z" fill="#222" />
  </svg>
);

const SpotifyMark = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <circle cx="12" cy="12" r="10" fill="currentColor" />
    <path d="M7 9.5c3.5-1 7.5-.6 10.5 1M7.5 12.7c3-.8 6.2-.4 8.7 1M8 15.7c2.4-.6 4.8-.3 6.8.8" stroke="#222" strokeWidth="1.6" strokeLinecap="round" fill="none" />
  </svg>
);

/** The track's cover, or the logo when there is none or it fails to load. */
function Cover({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <div className="vplayer-blank"><Mark /></div>;
  return <img className="vplayer-art" src={src} alt="" onError={() => setFailed(true)} />;
}

function SeekBar({ position, length, onSeek }: { position: number; length: number; onSeek: (sec: number) => void }) {
  const [drag, setDrag] = useState<number | null>(null);
  const at = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  };
  const shown = drag ?? (length ? position / length : 0);
  const shownTime = `${clock(drag !== null ? drag * length : position)} / ${clock(length)}`;

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!length) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag(at(e));
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (drag === null) return;
    onSeek(at(e) * length);
    setDrag(null);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (!length) return;
    if (e.key === "ArrowRight") onSeek(position + 5);
    else if (e.key === "ArrowLeft") onSeek(position - 5);
  };

  return (
    <div
      className={length ? "vplayer-progress seekable" : "vplayer-progress"}
      role="slider"
      aria-label="Seek"
      tabIndex={length ? 0 : -1}
      aria-valuemin={0}
      aria-valuemax={Math.round(length)}
      aria-valuenow={Math.round(position)}
      aria-valuetext={`${clock(position)} of ${clock(length)}`}
      title={length ? shownTime : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={e => { if (drag !== null) setDrag(at(e)); }}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setDrag(null)}
      onKeyDown={onKeyDown}
    >
      <div style={{ width: `${Math.min(100, shown * 100)}%` }} />
      {length > 0 && <span className="vplayer-time">{shownTime}</span>}
    </div>
  );
}

export function PlayButton({ queue, index = 0, label }: { queue: PTrack[]; index?: number; label?: string }) {
  const p = usePlayer();
  const t = queue[index];
  if (!t) return null;
  const current = p.isCurrent(t);
  const active = current && p.state.playing;
  const click = () => (current && live(p.state.status) ? p.toggle() : p.play(queue, index));
  if (label) return (
    <Button kind="btn" onClick={click}>
      {active ? <><Ico.Pause /> Pause</> : <><Ico.Play /> {label}</>}
    </Button>
  );
  return (
    <Button kind={"play-btn" + (current ? " on" : "")} aria-label={active ? "Pause" : `Play ${t.title}`} onClick={click}>
      {active ? <Ico.Pause /> : <Ico.Play />}
    </Button>
  );
}

type StationType = "library" | "recommended" | "mix" | "artist" | "tag";

export function StationButton({ type, name, label, ghost }: { type: StationType; name?: string; label: string; ghost?: boolean }) {
  const p = usePlayer();
  const { me } = useAuth();
  const nav = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const path = `/station${qs({ type, name })}`;
  const on = p.state.station?.path === path;
  const active = on && p.state.playing;
  const click = () => {
    if (on && live(p.state.status)) return p.toggle();
    if (!me && !name) return nav("/login");
    setBusy(true);
    setError("");
    p.playStation(path).catch(e => setError(errorText(e))).finally(() => setBusy(false));
  };
  return (
    <>
      <Button kind={ghost ? "btn ghost" : "btn"} type="button" loading={busy} onClick={click}>
        {active ? <><Ico.Pause /> Pause</> : <><Ico.Scrobble /> {label}</>}
      </Button>
      {error && <span className="form-error station-error" role="alert">{error}</span>}
    </>
  );
}

export function StationRow({ type, label }: { type: "library" | "recommended" | "mix"; label: string }) {
  const p = usePlayer();
  const [error, setError] = useState("");
  const path = `/station${qs({ type })}`;
  const on = p.state.station?.path === path;
  const active = on && p.state.playing;
  const click = () => {
    if (on && live(p.state.status)) return p.toggle();
    setError("");
    p.playStation(path).catch(e => setError(errorText(e)));
  };
  return (
    <li>
      <Button kind={"play-btn" + (on ? " on" : "")} type="button" aria-label={active ? "Pause" : label} onClick={click}>
        {active ? <Ico.Pause /> : <Ico.Play />}
      </Button>
      <span>{label}{error && <small className="form-error" role="alert"> {error}</small>}</span>
    </li>
  );
}
