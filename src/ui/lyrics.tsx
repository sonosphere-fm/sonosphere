import { useEffect, useRef, useState } from "react";
import { usePlayer, type PTrack } from "../player";
import { Section } from "./base";

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
const load = () => loaded ??= import("@uimaxbai/am-lyrics/am-lyrics.js");
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
  .lyrics-container { padding-top: 16px !important; padding-bottom: 24px !important; }
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

export function Lyrics({ track }: { track: PTrack }) {
  const p = usePlayer();
  const ref = useRef<El>(null);
  const [ready, setReady] = useState(false);
  const [found, setFound] = useState<boolean | null>(null);
  const current = p.isCurrent(track) && p.state.status === "ready";

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
      fontFamily: "inherit",
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
    el.autoScroll = current;
    el.noBlur = !current;
    el.toggleAttribute("data-reading", !current);
    el.paused = !(current && p.state.playing);
    el.currentTime = current ? p.state.position * 1000 : 0;
  }, [ready, current, p.state.playing, p.state.position]);

  useEffect(() => {
    const box = ref.current?.shadowRoot?.querySelector(".lyrics-container");
    if (found && !current && box) box.scrollTop = 0;
  }, [found, current]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const click = (e: Event) => {
      const ms = (e as CustomEvent<{ timestamp: number }>).detail?.timestamp;
      if (current) p.seek((ms ?? 0) / 1000);
      else p.play([track]);
    };
    el.addEventListener("line-click", click);
    return () => el.removeEventListener("line-click", click);
  });

  if (found === false) return null;
  return (
    <div hidden={!found}>
      <Section title="Lyrics"><div className="lyrics-box h-[440px] bg-site-panel overflow-hidden">{ready && <am-lyrics ref={ref} />}</div></Section>
    </div>
  );
}
