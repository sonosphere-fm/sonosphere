import { useRef, type ChangeEvent, type ReactNode } from "react";
import { Button } from "../../kit";
import { Link } from "react-router-dom";
import { api, imageUrl, qs } from "../../lib";
import { useAction } from "../../ui/base";
import { ImageWithFallback } from "../../ui/image";
import type { Recommended } from "../../../shared/home";
import type { ImageSaved } from "../../../shared/images";
import type { TopAlbum, TopTrack } from "../../../shared/listening";
import type { Recommendation } from "../../../shared/recommend";

type HeroProps = {
  art?: ReactNode;
  kicker?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  stats?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  tabs?: ReactNode;
  image?: string | null;
  banner?: string | null;
};

export function Hero({ art, kicker, title, sub, stats, actions, children, tabs, image, banner }: HeroProps) {
  return (
    <div className="hero [&_h1]:text-ink relative overflow-hidden border-0 pt-[34px] pb-0 bg-panel text-ink not-has-[.hero-tabs]:pb-[34px] max-sm:pt-5 max-sm:not-has-[.hero-tabs]:pb-[22px]">
      {banner
        ? <ImageWithFallback className="absolute inset-0 bg-cover bg-center pointer-events-none after:absolute after:inset-0 after:bg-[linear-gradient(0deg,var(--bg)_0%,transparent_75%),linear-gradient(90deg,color-mix(in_srgb,var(--bg)_82%,transparent),color-mix(in_srgb,var(--bg)_55%,transparent))]" src={imageUrl(banner)} alt="" loading="eager" />
        : image ? <ImageWithFallback className="absolute -inset-[60px] bg-cover bg-[center_30%] blur-[34px] brightness-[.42] saturate-[1.15] hidden" src={imageUrl(image)} alt="" loading="eager" /> : null}
      <div className="relative w-full max-w-[1180px] mx-auto px-5 max-sm:px-4 flex items-start gap-[26px] max-lg:gap-5 max-sm:has-[>.hero-art]:grid max-sm:has-[>.hero-art]:grid-cols-[92px_minmax(0,1fr)] max-sm:has-[>.hero-art]:gap-x-3.5 max-sm:has-[>.hero-art]:gap-y-2.5 max-sm:has-[>.hero-art]:items-center max-sm:has-[>.hero-art]:[&>.hero-art]:col-start-1 max-sm:has-[>.hero-art]:[&>.hero-art]:row-span-3 max-sm:has-[>.hero-art]:[&>.hero-art]:self-start max-sm:has-[>.hero-art]:[&>.hero-art]:w-auto max-sm:has-[>.hero-art]:[&>.hero-body]:contents max-sm:has-[>.hero-art]:[&>.hero-body>*]:col-span-full max-sm:has-[>.hero-art]:[&>.hero-body>:is(.kicker,h1,.hero-sub)]:col-start-2 max-sm:has-[>.hero-art]:[&>.hero-body>.kicker]:self-end max-sm:has-[>.hero-art]:[&>.hero-body>.kicker]:mb-[-6px] max-sm:has-[>.hero-art]:[&>.hero-body>h1]:self-center max-sm:has-[>.hero-art]:[&>.hero-body>.hero-sub]:self-start max-sm:has-[>.hero-art]:[&>.hero-body>.hero-sub]:text-[15px]">
        {art && <div className="hero-art w-[190px] flex-none max-lg:w-[150px] max-sm:w-auto [&_.art-user]:overflow-hidden [&_.art-user]:rounded-full has-[.art-user]:overflow-hidden has-[.art-user]:rounded-full">{art}</div>}
        <div className="hero-body flex-1 min-w-0 flex flex-col gap-3.5 [&>.kicker]:mb-[-8px] [&>.stats]:my-1 [&>.stats]:mb-1.5">
          {kicker && <div className="kicker uppercase text-[11px] font-medium tracking-[.08em] text-link">{kicker}</div>}
          <h1 className="text-[44px] tracking-[-.03em] wrap-anywhere max-lg:text-[32px] max-sm:text-[28px]">{title}</h1>
          {sub && <div className="hero-sub text-[17px] text-muted [&_a]:font-semibold [&_a]:text-link [&_a]:underline">{sub}</div>}
          {stats && <div className="stats flex flex-wrap gap-7 max-sm:gap-x-5 max-sm:gap-y-2.5">{stats}</div>}
          {actions && <div className="row flex gap-2.5 items-center flex-wrap max-sm:hero:gap-2">{actions}</div>}
          {children}
        </div>
      </div>
      {tabs && <div className="hero-tabs relative w-full max-w-[1180px] mx-auto px-5 max-sm:px-4 ml-auto mt-6 pb-6 max-[861px]:[&_.tabs]:flex-nowrap max-[861px]:[&_.tabs]:overflow-x-auto max-[861px]:[&_.tabs]:[scrollbar-width:none] max-[861px]:[&_.tabs_a]:whitespace-nowrap [&_.tabs]:mb-0 [&_.tabs]:border-0 [&_.tabs]:gap-0.5 [&_.tabs]:pb-0">{tabs}</div>}
    </div>
  );
}

export function UploadImage({ type, id, onDone }: { type: "artist" | "album" | "user"; id?: number; onDone: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const act = useAction();

  const upload = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    act.run(async () => {
      await api<ImageSaved>(`/image${qs({ type, id })}`, { raw: f, headers: { "Content-Type": f.type } });
      onDone();
    });
    // Clear it so picking the same file again still fires change.
    e.target.value = "";
  };

  return (
    <>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={upload} />
      <Button kind="btn ghost" type="button" loading={act.busy} onClick={() => input.current?.click()}>Upload image</Button>
      {act.note}
    </>
  );
}

export type HomeTab = "home" | "artists" | "albums" | "tracks" | "events";

const HOME_TABS: [HomeTab, string, string][] = [
  ["home", "All recommendations", "/"],
  ["artists", "Artists", "/recommended"],
  ["albums", "Albums", "/recommended?show=albums"],
  ["tracks", "Tracks", "/recommended?show=tracks"],
  ["events", "Events", "/recommended?show=events"],
];

export function HomeTabs({ at }: { at: HomeTab }) {
  return (
    <div className="py-3 bg-panel [&_.tabs]:flex-nowrap [&_.tabs]:overflow-x-auto [&_.tabs]:[scrollbar-width:none] [&_.tabs]:mb-0 [&_.tabs]:gap-0.5 [&_.tabs]:pb-0 [&_.tabs_a]:whitespace-nowrap [&_.tabs_a]:flex-none [&_.tabs_a]:current:bg-sun [&_.tabs_a]:current:text-on-sun [&_.tabs_a]:current:font-bold">
      <nav className="tabs w-full max-w-[1180px] mx-auto px-5 max-sm:px-4 flex flex-wrap gap-0.5 mb-6 *:h-auto *:rounded-none *:m-0 *:border-0 *:bg-transparent *:px-2.5 *:py-1.5 *:text-base *:font-medium *:text-ink-2 *:hover:bg-tint *:hover:text-ink *:hover:no-underline *:current:bg-sun *:current:text-on-sun *:current:font-bold max-md:flex-nowrap max-md:overflow-x-auto max-md:[scrollbar-width:none] max-md:gap-x-[22px] max-md:gap-y-0 max-md:[&::-webkit-scrollbar]:hidden max-md:*:flex-none max-md:*:whitespace-nowrap">
        {HOME_TABS.map(([k, l, to]) => <Link key={k} className={at === k ? "active" : ""} to={to}>{l}</Link>)}
      </nav>
    </div>
  );
}

type MixedRec = { kind: "artist" | "album" | "track"; item: Recommendation | TopAlbum | TopTrack; because: string[] };

// Interleaves one artist, one track and one album per round.
export function mixRecs(d: Pick<Recommended, "artists" | "tracks" | "albums">, limit = 15) {
  const why = new Map(d.artists.map(a => [a.name, a.because]));
  const out: MixedRec[] = [];
  for (let i = 0; out.length < limit && (i < d.artists.length || i < d.tracks.length || i < d.albums.length); i++) {
    const artist = d.artists[i];
    const track = d.tracks[i * 2];
    const album = d.albums[i];
    if (artist) out.push({ kind: "artist", item: artist, because: artist.because });
    if (track) out.push({ kind: "track", item: track, because: why.get(track.artist) || [] });
    if (album) out.push({ kind: "album", item: album, because: why.get(album.artist) || [] });
  }
  return out.slice(0, limit);
}
