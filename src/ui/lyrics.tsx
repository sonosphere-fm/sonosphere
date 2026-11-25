import { useEffect, useRef, useState } from "react";
import { usePlayer, type PTrack } from "../player";
import { Section } from "./base";
import { t } from "../i18n";
import { api, useAuth } from "../lib";
import type { SpotifyNow } from "../../shared/spotify";

type El = HTMLElement & {
  songTitle?: string;
  songArtist?: string;
  songAlbum?: string;
  songDurationMs?: number;
  query?: string;
  currentTime: number;
  paused: boolean;
  highlightColor: string;
  fontFamily?: string;
  autoScroll: boolean;
  noBlur: boolean;
  isLoading?: boolean;
  lyrics?: unknown[];
};
declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "am-lyrics": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}

let loaded: Promise<unknown> | null = null;
const load = () => (loaded ??= import("@uimaxbai/am-lyrics/am-lyrics.js"));
// The component's toolbar and footer live in its shadow root, out of reach of styles.css. The footer is collapsed
// rather than removed because the component measures how far it can scroll from the footer's position.
const SHADOW_CSS = `
  .lyrics-header { display: none !important; }
  .lyrics-footer {
    visibility: hidden !important;
    height: 0 !important;
    min-height: 0 !important;
    padding: 0 !important;
    margin: 0 !important;
    overflow: hidden !important;
  }
  :host { font-weight: 600; letter-spacing: -0.01em; }
  .lyrics-container { padding: 20px 0 24px !important; }
  .lyrics-line { padding-inline: 8px !important; }
  :host(:not([data-reading])) .lyrics-container { padding-bottom: 320px !important; }
  :host([data-reading]) .lyrics-header + .lyrics-gap { display: none !important; }
`;
let sheet: CSSStyleSheet | null = null;
function restyle(el: El) {
  const root = el.shadowRoot;
  if (!root) return;
  if (!sheet) {
    sheet = new CSSStyleSheet();
    sheet.replaceSync(SHADOW_CSS);
  }
  if (!root.adoptedStyleSheets.includes(sheet)) root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
}

const POLL_MS = 10_000;
const SETTLE_MS = 2000;
const SETTLE_POLLS = 3;
const JUMP_MS = 750;
// how fast a reading loses trust, since the listener's device and this page do not keep perfectly equal time
const STALE_PER_MS = 0.002;

const loose = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s*[([].*?[)\]]/g, "")
    .replace(/\s+-\s+.*$/, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");

type Clock = { ms: number; at: number; playing: boolean; spread: number };
const clockNow = (c: Clock) => (c.playing ? c.ms + performance.now() - c.at : c.ms);
const trust = (c: Clock) => c.spread + (performance.now() - c.at) * STALE_PER_MS;

// Each answer is a reading of the position with a known margin of error. The tightest reading is kept, and a looser
// one only replaces it when the two disagree by more than both margins allow, which means a seek or a skip.
function better(c: Clock | null, next: Clock): Clock {
  if (!c || c.playing !== next.playing) return next;
  const apart = Math.abs(clockNow(c) - next.ms);
  if (apart > trust(c) + next.spread + JUMP_MS) return next;
  return next.spread < trust(c) ? next : c;
}

// Spotify is only asked every few seconds, so the position runs on locally in between.
function useSpotifyClock(track: PTrack, on: boolean): Clock | null {
  const [clock, setClock] = useState<Clock | null>(null);
  useEffect(() => {
    setClock(null);
    if (!on) return;
    let run = 0;
    let polls = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ask = async () => {
      const mine = ++run;
      clearTimeout(timer);
      if (document.hidden) return;
      const sent = performance.now();
      const r = await api<SpotifyNow>("/spotify/playing").catch(() => null);
      if (mine !== run) return;
      if (!r?.connected) return setClock(null);
      const p = r.playing;
      const at = performance.now();
      const half = (at - sent) / 2;
      let next = ++polls < SETTLE_POLLS ? SETTLE_MS : POLL_MS;
      if (p && loose(p.track) === loose(track.title) && loose(p.artist) === loose(track.artist)) {
        const ms = p.progressMs + (p.playing ? p.ageMs + half : 0);
        setClock((c) => better(c, { ms, at, playing: p.playing, spread: p.spreadMs + half }));
        if (p.playing) next = Math.min(next, Math.max(1000, p.durationMs - ms + 500));
      } else {
        polls = 0;
        setClock(null);
      }
      timer = setTimeout(ask, next);
    };
    ask();
    document.addEventListener("visibilitychange", ask);
    return () => {
      run++;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", ask);
    };
  }, [on, track.title, track.artist]);
  return clock;
}

export function Lyrics({ track }: { track: PTrack }) {
  const p = usePlayer();
  const ref = useRef<El>(null);
  const [ready, setReady] = useState(false);
  const [found, setFound] = useState<boolean | null>(null);
  const { me } = useAuth();
  const current = p.isCurrent(track) && p.state.status === "ready";
  const clock = useSpotifyClock(track, !!me && !current && found === true);
  const following = current || !!clock;

  useEffect(() => {
    let on = true;
    load()
      .then(() => on && setReady(true))
      .catch(() => on && setFound(false));
    return () => {
      on = false;
    };
  }, []);

  // the component has no "done" event, so poll until it stops loading to learn whether it found any
  useEffect(() => {
    const el = ref.current;
    if (!ready || !el) return;
    setFound(null);
    restyle(el);
    Object.assign(el, {
      songTitle: track.title,
      songArtist: track.artist,
      songAlbum: track.album || undefined,
      query: `${track.title} ${track.artist}`,
      songDurationMs: track.duration ? track.duration * 1000 : undefined,
      highlightColor: "var(--ink)",
      fontFamily: "var(--display)",
    });
    let tries = 0;
    const timer = setInterval(() => {
      if (++tries < 3 || (el.isLoading && tries < 80)) return; // ~20s at most
      clearInterval(timer);
      setFound(!el.isLoading && !!el.lyrics?.length);
    }, 250);
    return () => clearInterval(timer);
  }, [ready, track.title, track.artist, track.album, track.duration]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.autoScroll = following;
    el.noBlur = !following;
    el.toggleAttribute("data-reading", !following);
    if (!clock) {
      el.paused = !(current && p.state.playing);
      el.currentTime = current ? p.state.position * 1000 : 0;
      return;
    }
    el.paused = !clock.playing;
    el.currentTime = clockNow(clock);
    if (!clock.playing) return;
    const timer = setInterval(() => (el.currentTime = clockNow(clock)), 200);
    return () => clearInterval(timer);
  }, [ready, current, following, clock, p.state.playing, p.state.position]);

  useEffect(() => {
    const box = ref.current?.shadowRoot?.querySelector(".lyrics-container");
    if (found && !following && box) box.scrollTop = 0;
  }, [found, following]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const click = (e: Event) => {
      const ms = (e as CustomEvent<{ timestamp: number }>).detail?.timestamp;
      if (current) p.seek((ms ?? 0) / 1000);
      else if (!clock) p.play([track]);
    };
    el.addEventListener("line-click", click);
    return () => el.removeEventListener("line-click", click);
  });

  if (found === false) return null;
  return (
    <div hidden={!found}>
      <Section title={t("player.lyrics")}>
        <div className="lyrics-box h-[440px] border-y border-site-line overflow-hidden">
          {ready && <am-lyrics ref={ref} />}
        </div>
      </Section>
    </div>
  );
}
