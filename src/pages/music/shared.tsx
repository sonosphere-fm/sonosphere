import { lazy, Suspense, useRef, type ChangeEvent, type ComponentProps, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { DropdownMenuItem } from "@astryxdesign/core/DropdownMenu";
import { t, tx } from "../../i18n";
import { Button, useConfirm } from "../../kit";
import { Link } from "react-router-dom";
import { api, imageUrl, invalidateAll, qs } from "../../lib";
import { useAction } from "../../ui/base";
import { ImageWithFallback } from "../../ui/image";
import type { Recommended } from "../../../shared/home";
import type { ImageSaved } from "../../../shared/images";
import type { EditScope, ScrobblesDeleted, TopAlbum, TopTrack } from "../../../shared/listening";
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
  banner?: string | null;
};

export function Hero({ art, kicker, title, sub, stats, actions, children, tabs, banner }: HeroProps) {
  return (
    <div className="hero">
      {banner && <ImageWithFallback className="hero-banner" src={imageUrl(banner)} alt="" loading="eager" />}
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

export function UploadImage({
  type,
  id,
  onDone,
}: {
  type: "artist" | "album" | "user";
  id?: number;
  onDone: () => void;
}) {
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
      <Button kind="btn ghost" type="button" loading={act.busy} onClick={() => input.current?.click()}>
        {t("music.uploadImage")}
      </Button>
      {act.note}
    </>
  );
}

/** MoreMenu item: removes every scrobble of this artist, album or track from the viewer's library. */
export function RemoveScrobbles({
  scope,
  id,
  name,
  count,
}: {
  scope: EditScope;
  id: number;
  name: string;
  count: number;
}) {
  const confirm = useConfirm();
  if (!count) return null;
  const params = { count, name: <b>{name}</b> };
  const body =
    scope === "artist"
      ? tx("music.removeScrobblesBy", params)
      : scope === "album"
        ? tx("music.removeScrobblesFrom", params)
        : tx("music.removeScrobblesOf", params);
  const remove = () =>
    confirm.ask({
      title: t("music.removeScrobblesTitle"),
      body: <>{body}</>,
      action: t("music.removeScrobblesAction", { count }),
      danger: true,
      run: async () => {
        await api<ScrobblesDeleted>("/scrobbles/delete-by", { body: { scope, id } });
        invalidateAll();
      },
    });
  return (
    <>
      <DropdownMenuItem label={t("music.removeScrobbles")} variant="destructive" onClick={remove} />
      {/* Outside the menu popover, which owns focus and hides its content when closed. */}
      {createPortal(confirm.dialog, document.body)}
    </>
  );
}

export type HomeTab = "home" | "artists" | "albums" | "tracks" | "events";

const homeTabs = (): [HomeTab, string, string][] => [
  ["home", t("music.allRecommendations"), "/"],
  ["artists", t("music.artists"), "/recommended"],
  ["albums", t("music.albums"), "/recommended?show=albums"],
  ["tracks", t("music.tracks"), "/recommended?show=tracks"],
  ["events", t("music.events"), "/recommended?show=events"],
];

export function TopTabs({ children }: { children: ReactNode }) {
  return (
    <div className="top-tabs bg-site-panel py-3 [border-block-style:none]">
      <nav className="wrap tabs">{children}</nav>
    </div>
  );
}

export function HomeTabs({ at }: { at: HomeTab }) {
  return (
    <TopTabs>
      {homeTabs().map(([k, l, to]) => (
        <Link key={k} className={at === k ? "active" : ""} to={to}>
          {l}
        </Link>
      ))}
    </TopTabs>
  );
}

type MixedRec = { kind: "artist" | "album" | "track"; item: Recommendation | TopAlbum | TopTrack; because: string[] };

// Interleaves one artist, one track and one album per round.
export function mixRecs(d: Pick<Recommended, "artists" | "tracks" | "albums">, limit = 15) {
  const why = new Map(d.artists.map((a) => [a.name, a.because]));
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

export function ImportPrompt() {
  return (
    <div className="import-prompt">
      <h2>{t("music.importTitle")}</h2>
      <p>{t("music.importBody")}</p>
      <div className="row">
        <Button kind="btn" href="/import">
          {t("music.importScrobbles")}
        </Button>
        <Button kind="btn ghost" href="/settings/applications">
          {t("music.connectPlayer")}
        </Button>
      </div>
    </div>
  );
}

const adminTools = () => import("../../admin/page-tools").then(async (m) => (await m.ready, m));
const LazyAdminItems = lazy(() => adminTools().then((m) => ({ default: m.AdminItems })));
const LazyAdminDialog = lazy(() => adminTools().then((m) => ({ default: m.AdminDialog })));

export function AdminItems(props: ComponentProps<typeof LazyAdminItems>) {
  return (
    <Suspense fallback={null}>
      <LazyAdminItems {...props} />
    </Suspense>
  );
}

export function AdminDialog(props: ComponentProps<typeof LazyAdminDialog>) {
  return (
    <Suspense fallback={null}>
      <LazyAdminDialog {...props} />
    </Suspense>
  );
}
