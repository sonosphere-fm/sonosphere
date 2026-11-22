import { Ico } from "../../icons";
import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { artistUrl, date, imageUrl, num, short, trackUrl, useApi, useAuth } from "../../lib";
import { Art, Avatar, Section } from "../../ui/base";
import { ImageWithFallback } from "../../ui/image";
import { BarChart, weekTrend } from "../../ui/charts";
import { UserList } from "../../ui/lists";
import { WikiSummary } from "../../ui/wiki";
import type { Listener, TrendPoint } from "../../../shared/catalog";
import type { Charts } from "../../../shared/home";
import type { WikiVersion } from "../../../shared/wiki";

type MusicHeroProps = {
  image?: string | null;
  cover?: boolean;
  over?: ReactNode;
  title: ReactNode;
  actions?: ReactNode;
  stats?: ReactNode;
  cards?: ReactNode;
  tabs?: ReactNode;
  children?: ReactNode;
};

const MHERO = "hero bg-site-panel p-0 min-h-[300px] flex flex-col max-[700px]:min-h-0";
const MHERO_INNER =
  "wrap flex-1 flex flex-col justify-end gap-3.5 pt-14 pb-[26px] *:max-w-[760px] max-[700px]:pt-7 max-[700px]:pb-[18px] max-[700px]:gap-3";
const MHERO_OVER = "text-[18px] font-semibold -mb-2 max-[700px]:text-[15px] max-[700px]:-mb-1.5 [&_a]:text-site-link";

export function MusicHero({ image, cover, over, title, actions, stats, cards, tabs, children }: MusicHeroProps) {
  return (
    <div className={MHERO}>
      {image ? (
        <ImageWithFallback
          className={cover ? "mhero-img cover" : "mhero-img"}
          src={imageUrl(image)}
          alt=""
          loading="eager"
        />
      ) : null}
      <div className={MHERO_INNER}>
        {over && <div className={MHERO_OVER}>{over}</div>}
        <h1 className="text-[54px] leading-[1.05]">{title}</h1>
        <div className="flex flex-wrap items-center gap-x-7 gap-y-3.5">
          <div className="row">{actions}</div>
          {stats && <div className="flex gap-6">{stats}</div>}
        </div>
        {children}
        {cards && <div className="flex flex-wrap gap-3 mt-1.5">{cards}</div>}
      </div>
      {tabs && <div className="wrap hero-tabs mt-0">{tabs}</div>}
    </div>
  );
}

export function HeroStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col leading-[1.15]">
      <span className="text-[11px] text-site-muted uppercase tracking-[.06em]">{label}</span>
      <b className="text-[22px] font-site-display" title={num(value)}>
        {short(value)}
      </b>
    </div>
  );
}

type FeatureCardProps = { label: string; to: string; image?: string | null; title: string; sub?: ReactNode };

const MFEAT = [
  "group flex items-center gap-3 w-[300px] max-w-full p-2 bg-site-card border-none hover:no-underline hover:bg-(--fill-hover)",
  "*:flex *:flex-col *:min-w-0 *:leading-[1.3] [&>.art]:w-16 [&>.art]:flex-none",
  "max-[700px]:w-full max-[700px]:[&>.art]:w-[52px]",
].join(" ");

export function FeatureCard({ label, to, image, title, sub }: FeatureCardProps) {
  return (
    <Link className={MFEAT} to={to}>
      <Art image={image} />
      <span>
        <em className="not-italic text-[12px] text-site-muted">{label}</em>
        <strong className="truncate group-hover:underline">{title}</strong>
        {sub && <span className="truncate text-[13px] text-site-muted">{sub}</span>}
      </span>
    </Link>
  );
}

// Noon keeps a bare date from shifting a day in any timezone; year-only dates pass through.
export const releaseDate = (d: string) => (d.length > 4 ? date(Date.parse(d + "T12:00:00") / 1000) : d);

export const SIDE_LINKS =
  "flex gap-3.5 mt-3 mb-0 text-[14px] [&>a+a]:pl-3.5 [&>a+a]:border-l [&>a+a]:border-l-site-line";

const ABOUT = "section grid grid-cols-[minmax(0,1fr)_220px] gap-x-8 gap-y-4 max-[700px]:grid-cols-[minmax(0,1fr)]";

export function YourScrobbles({ count, to }: { count: number; to?: string }) {
  const { me } = useAuth();
  if (!me) return null;
  return (
    <div className="yours">
      <Avatar user={me} size={34} />
      <div>
        <span>Your scrobbles</span>
        {count && to ? <Link to={to}>{num(count)}</Link> : <b>{num(count)}</b>}
      </div>
    </div>
  );
}

type AboutProps = { wiki: WikiVersion | null; to: string; facts: [string, ReactNode][]; children?: ReactNode };

export function About({ wiki, to, facts, children }: AboutProps) {
  return (
    <section className={ABOUT}>
      <div>
        <WikiSummary wiki={wiki} to={to} flush />
      </div>
      <dl className="m-0 text-[14px]">
        {facts.map(([k, v]) => (
          <div key={k} className="flex gap-3 py-1.5 first:pt-0 border-b border-b-site-line">
            <dt className="w-24 flex-none font-bold">{k}</dt>
            <dd className="m-0 text-site-ink-2">{v}</dd>
          </div>
        ))}
      </dl>
      {children}
    </section>
  );
}

const BY_ARTIST =
  "group flex items-center gap-3.5 text-site-ink *:flex *:flex-col *:min-w-0 [&>.art]:w-[84px] [&>.art]:flex-none";

export function ByArtist({ name, image }: { name: string; image?: string | null }) {
  return (
    <Section title="Artist">
      <Link className={BY_ARTIST} to={artistUrl(name)}>
        <Art image={image} kind="artist" />
        <span>
          <strong className="text-[18px] group-hover:underline">{name}</strong>
          <span className="text-[14px] text-site-link">
            View artist <Ico.Right />
          </span>
        </span>
      </Link>
    </Section>
  );
}

export function Trend({ data }: { data: TrendPoint[] }) {
  const weeks = weekTrend(data);
  if (weeks.every((w) => !w.value)) return null;
  return (
    <Section title="Scrobble stats">
      <BarChart data={weeks} height={110} every={5} />
      <p className="muted small">Scrobbles per week, last 6 months</p>
    </Section>
  );
}

export function Listeners({ items, more }: { items: Listener[]; more?: string }) {
  if (!items.length) return null;
  return (
    <Section title="Listeners" more={more} moreLabel="View all listeners" foot>
      <div className="listeners2">
        <UserList items={items} />
      </div>
    </Section>
  );
}

const TRENDING_LIST =
  "list-none m-0 p-0 grid grid-cols-6 gap-4 max-[900px]:grid-cols-3 max-[900px]:gap-x-3.5 max-[900px]:gap-y-5 max-[700px]:grid-cols-2";
const TRENDING_ITEM =
  "grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 items-baseline text-site-ink hover:text-site-link hover:underline [&>.art]:col-span-full [&>.art]:mb-2";

export function TrendingBand() {
  const q = useApi<Charts>("/charts?kind=tracks&limit=6");
  // Every item is a track with kind=tracks; the filter narrows the type.
  const items = (q.data?.items ?? []).filter((t) => "duration" in t);
  if (!items.length) return null;
  return (
    <div className="trending bg-site-panel text-site-ink pt-[34px] pb-10 [border-block-style:none]">
      <div className="wrap">
        <header className="flex items-baseline gap-3 mb-[18px]">
          <h2 className="flex-1 text-[24px] text-site-ink">Trending tracks</h2>
          <Link className="more text-site-link font-medium hover:underline" to="/charts?kind=tracks">
            View all trending tracks <Ico.Right />
          </Link>
        </header>
        <ol className={TRENDING_LIST}>
          {items.map((t, i) => (
            <li key={t.id} className="flex flex-col min-w-0">
              <Link className={TRENDING_ITEM} to={trackUrl(t.artist, t.title)}>
                <Art image={t.image} />
                <b className="text-[22px] text-site-link font-site-display">{i + 1}</b>
                <strong className="truncate">{t.title}</strong>
              </Link>
              <Link
                className="truncate text-[13px] text-site-muted hover:text-site-link hover:underline"
                to={artistUrl(t.artist)}
              >
                {t.artist}
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
