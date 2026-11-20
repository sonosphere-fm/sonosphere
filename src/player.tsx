// The player embeds the matching YouTube video (Spin hosts no audio). It reports "now playing" and
// scrobbles by the usual rule: track longer than 30s, and half of it or 4 minutes actually listened.
import { Ico } from "./icons";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "./kit";
import { Link, useNavigate } from "react-router-dom";
import { api, artistUrl, qs, trackUrl, useAuth } from "./lib";
import { errorText, LogoDisc } from "./ui/base";
import type { Ok } from "../shared/auth";
import type { ScrobbleResponse } from "../shared/listening";
import type { Station as StationReply } from "../shared/stations";
import type { VideoLookup } from "../shared/video";

export type PTrack = { title: string; artist: string; album?: string | null; image?: number | null; duration?: number };
type Status = "finding" | "ready" | "missing";
/** An endless queue: `path` is the API request that returns the next batch of tracks. */
type Station = { path: string; title: string };
type State = { queue: PTrack[]; index: number; playing: boolean; status: Status; videoId: string | null; position: number; length: number; scrobbled: boolean; station: Station | null };
const empty: State = { queue: [], index: -1, playing: false, status: "finding", videoId: null, position: 0, length: 0, scrobbled: false, station: null };
type Player = { state: State; play: (q: PTrack[], i?: number) => void; playStation: (path: string) => Promise<void>; toggle: () => void; isCurrent: (t: PTrack) => boolean };
const Ctx = createContext<Player | null>(null);
const usePlayer = () => {
  const p = useContext(Ctx);
  if (!p) throw new Error("The player is used outside <PlayerProvider>");
  return p;
};
const same = (a?: PTrack, b?: PTrack) => !!a && !!b && a.title === b.title && a.artist === b.artist;

// The few parts of the YouTube IFrame API used here (there is no @types package installed).
type YTPlayer = {
  loadVideoById(id: string): void; stopVideo(): void; destroy(): void; pauseVideo(): void; playVideo(): void;
  getDuration(): number; getCurrentTime(): number; getPlayerState(): number;
};
type YTOptions = {
  videoId: string; width: string; height: string; host: string; playerVars: Record<string, number>;
  events: { onStateChange: (e: { data: number }) => void; onError: () => void };
};
type YTApi = { Player: new (el: HTMLElement, opts: YTOptions) => YTPlayer; PlayerState: { ENDED: number; PLAYING: number; PAUSED: number } };
declare global {
  interface Window { YT?: YTApi; onYouTubeIframeAPIReady?: () => void }
}

let apiReady: Promise<YTApi> | null = null;
function loadYouTube(): Promise<YTApi> {
  return apiReady ??= new Promise(resolve => {
    const w = window;
    if (w.YT?.Player) return resolve(w.YT);
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => { prev?.(); if (w.YT) resolve(w.YT); };
    const s = document.createElement("script"); s.src = "https://www.youtube.com/iframe_api"; document.head.appendChild(s);
  });
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { me } = useAuth();
  const [state, setState] = useState<State>(empty);
  const ref = useRef(state); ref.current = state;
  const meRef = useRef(me); meRef.current = me;
  const yt = useRef<YTPlayer | null>(null), mount = useRef<HTMLDivElement>(null);
  const run = useRef({ token: 0, listened: 0, startedAt: 0 });
  const cands = useRef<string[]>([]); // videos still to try for this track: some can't be embedded

  const station = useRef<(Station & { loading: boolean }) | null>(null);

  // A station tops itself up before it runs dry. Tracks heard in the last couple of batches aren't repeated.
  const key = (t: PTrack) => `${t.artist}\n${t.title}`.toLowerCase();
  const refill = () => {
    const st = station.current;
    if (!st || st.loading) return;
    st.loading = true;
    api<StationReply>(st.path).then(r => {
      if (station.current !== st) return;
      setState(s => { const recent = new Set(s.queue.slice(-60).map(key)); return { ...s, queue: [...s.queue, ...r.tracks.filter(t => !recent.has(key(t)))] }; });
    }).catch(() => {}).finally(() => { st.loading = false; });
  };
  const start = (queue: PTrack[], index: number) => {
    const t = queue[index], token = ++run.current.token;
    run.current.listened = 0; run.current.startedAt = Math.floor(Date.now() / 1000);
    try { yt.current?.stopVideo?.(); } catch {}
    if (!t) { station.current = null; setState(empty); if (meRef.current) api<Ok>("/nowplaying", { body: { stop: true } }).catch(() => {}); return; }
    const st = station.current;
    setState({ ...empty, queue, index, playing: true, station: st && { path: st.path, title: st.title } });
    if (st && index >= queue.length - 3) refill();
    api<VideoLookup>(`/video${qs({ artist: t.artist, track: t.title })}`).then(r => r.videoIds || [], (): string[] => []).then(ids => {
      if (run.current.token !== token) return;
      cands.current = ids; const videoId = ids[0] || null;
      setState(s => ({ ...s, videoId, status: videoId ? "ready" : "missing", playing: !!videoId }));
      if (videoId && meRef.current) api<Ok>("/nowplaying", { body: { artist: t.artist, track: t.title, album: t.album || "", duration: t.duration || 0 } }).catch(() => {});
    });
  };
  const next = () => start(ref.current.queue, ref.current.index + 1);

  // Create the embedded player once, then just swap videos in it.
  useEffect(() => {
    const id = state.videoId;
    if (!id) return;
    if (yt.current?.loadVideoById) { yt.current.loadVideoById(id); return; }
    let dead = false;
    loadYouTube().then(YT => {
      if (dead || !mount.current || yt.current) return;
      const el = document.createElement("div"); mount.current.appendChild(el);
      yt.current = new YT.Player(el, {
        videoId: id, width: "100%", height: "100%", host: "https://www.youtube-nocookie.com",
        playerVars: { autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1 },
        events: {
          onStateChange: e => {
            if (e.data === YT.PlayerState.ENDED) next();
            else if (e.data === YT.PlayerState.PLAYING) setState(s => ({ ...s, playing: true }));
            else if (e.data === YT.PlayerState.PAUSED) setState(s => ({ ...s, playing: false }));
          },
          // Removed, private or not embeddable: treat it like a track with no video.
          onError: () => {
            const rest = (cands.current = cands.current.slice(1));
            setState(s => rest[0] ? { ...s, videoId: rest[0] } : { ...s, status: "missing", playing: false });
          },
        },
      });
    });
    return () => { dead = true; };
  }, [state.videoId, state.index]);

  // Once a second while playing: move the progress line and count listening time towards a scrobble.
  useEffect(() => {
    if (!state.playing || state.status !== "ready") return;
    const timer = setInterval(() => {
      const s = ref.current, t = s.queue[s.index], p = yt.current;
      if (!t || !p?.getDuration) return;
      const length = p.getDuration() || 0, position = p.getCurrentTime() || 0;
      run.current.listened++;
      let scrobbled = s.scrobbled;
      if (!scrobbled && meRef.current && length > 30 && run.current.listened >= Math.min(length / 2, 240)) {
        scrobbled = true;
        api<ScrobbleResponse>("/scrobble", { body: { artist: t.artist, track: t.title, album: t.album || "", timestamp: run.current.startedAt, duration: Math.round(length), source: "player" } })
          .then(() => window.dispatchEvent(new Event("spin:scrobble"))).catch(() => {});
      }
      setState(v => ({ ...v, position, length, scrobbled }));
    }, 1000);
    return () => clearInterval(timer);
  }, [state.playing, state.status, state.index]);

  const close = () => { start([], 0); try { yt.current?.destroy?.(); } catch {} yt.current = null; };
  const value = {
    state,
    play: (q: PTrack[], i = 0) => { station.current = null; start(q, i); },
    playStation: async (path: string) => {
      const r = await api<StationReply>(path);
      station.current = { path, title: r.title, loading: false };
      start(r.tracks, 0);
    },
    toggle: () => { const p = yt.current; if (!p?.getPlayerState) return; if (ref.current.playing) p.pauseVideo(); else p.playVideo(); },
    isCurrent: (t: PTrack) => same(state.queue[state.index], t),
  };
  const t = state.queue[state.index], hasNext = state.index < state.queue.length - 1;
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className={t ? "vplayer" : "vplayer off"} role="region" aria-label="Player" aria-hidden={!t}>
        <button type="button" className="vplayer-x" aria-label="Close player" onClick={close}><Ico.X /></button>
        <div className="vplayer-screen">
          <div className="vplayer-video" ref={mount} style={{ visibility: state.status === "ready" ? "visible" : "hidden" }} />
          {state.status !== "ready" && <div className="vplayer-blank"><LogoDisc /></div>}
        </div>
        <div className="vplayer-progress"><div style={{ width: state.length ? `${Math.min(100, (state.position / state.length) * 100)}%` : 0 }} /></div>
        {t && (
          <div className="vplayer-bar">
            <div className="vplayer-meta">
              {state.station && <small><Ico.Scrobble /> {state.station.title}</small>}
              {state.status === "missing" ? <span>Track unavailable.</span> : state.status === "finding" ? <span>Finding “{t.title}”…</span> : (
                <>
                  <Link to={trackUrl(t.artist, t.title)} className="strong">{t.title}</Link>
                  <span><Link to={artistUrl(t.artist)}>{t.artist}</Link>{me && state.scrobbled && <em> · <Ico.Check /> Scrobbled</em>}</span>
                </>
              )}
            </div>
            <button type="button" aria-label="Next track" disabled={!hasNext} onClick={next}><Ico.Next /></button>
            {state.videoId
              ? <a href={`https://www.youtube.com/watch?v=${state.videoId}`} target="_blank" rel="noreferrer" aria-label="Watch on YouTube" title="Watch on YouTube"><VideoMark /></a>
              : <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${t.artist} ${t.title}`)}`} target="_blank" rel="noreferrer" aria-label="Search on YouTube" title="Search on YouTube"><VideoMark /></a>}
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}
const VideoMark = () => <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="4" fill="currentColor" /><path d="M10 9l5 3-5 3z" fill="#222" /></svg>;

export function PlayButton({ queue, index = 0, label }: { queue: PTrack[]; index?: number; label?: string }) {
  const p = usePlayer(), t = queue[index];
  if (!t) return null;
  const current = p.isCurrent(t), active = current && p.state.playing;
  const click = () => (current && p.state.status === "ready" ? p.toggle() : p.play(queue, index));
  if (label) return <Button kind="btn" onClick={click}>{active ? <><Ico.Pause /> Pause</> : <><Ico.Play /> {label}</>}</Button>;
  return <Button kind={"play-btn" + (current ? " on" : "")} aria-label={active ? "Pause" : `Play ${t.title}`} onClick={click}>{active ? <Ico.Pause /> : <Ico.Play />}</Button>;
}

/** Starts an endless station: your library, your recommendations, a mix of both, or radio built around an artist or tag. */
export function StationButton({ type, name, label, ghost }: { type: "library" | "recommended" | "mix" | "artist" | "tag"; name?: string; label: string; ghost?: boolean }) {
  const p = usePlayer(), { me } = useAuth(), nav = useNavigate();
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const path = `/station${qs({ type, name })}`, on = p.state.station?.path === path, active = on && p.state.playing;
  const click = () => {
    if (on && p.state.status === "ready") return p.toggle();
    if (!me && !name) return nav("/login");
    setBusy(true); setError("");
    p.playStation(path).catch(e => setError(errorText(e))).finally(() => setBusy(false));
  };
  return (
    <>
      <Button kind={ghost ? "btn ghost" : "btn"} type="button" loading={busy} onClick={click}>{active ? <><Ico.Pause /> Pause</> : <><Ico.Scrobble /> {label}</>}</Button>
      {error && <span className="form-error station-error" role="alert">{error}</span>}
    </>
  );
}
/** The same thing as a round button with its label beside it, for lists of stations. */
export function StationRow({ type, label }: { type: "library" | "recommended" | "mix"; label: string }) {
  const p = usePlayer();
  const [error, setError] = useState("");
  const path = `/station${qs({ type })}`, on = p.state.station?.path === path, active = on && p.state.playing;
  const click = () => (on && p.state.status === "ready" ? p.toggle() : (setError(""), p.playStation(path).catch(e => setError(errorText(e)))));
  return <li><Button kind={"play-btn" + (on ? " on" : "")} type="button" aria-label={active ? "Pause" : label} onClick={click}>{active ? <Ico.Pause /> : <Ico.Play />}</Button><span>{label}{error && <small className="form-error" role="alert"> {error}</small>}</span></li>;
}
