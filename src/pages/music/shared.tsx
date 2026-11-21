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
    <div className="hero">
      {banner
        ? <ImageWithFallback className="hero-banner" src={imageUrl(banner)} alt="" loading="eager" />
        : image ? <ImageWithFallback className="hero-bg" src={imageUrl(image)} alt="" loading="eager" /> : null}
      <div className="wrap hero-inner">
        {art && <div className="hero-art">{art}</div>}
        <div className="hero-body">
          {kicker && <div className="kicker">{kicker}</div>}
          <h1>{title}</h1>
          {sub && <div className="hero-sub">{sub}</div>}
          {stats && <div className="stats">{stats}</div>}
          {actions && <div className="row">{actions}</div>}
          {children}
        </div>
      </div>
      {tabs && <div className="wrap hero-tabs">{tabs}</div>}
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
    <div className="top-tabs">
      <nav className="wrap tabs">
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
