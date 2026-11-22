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
  soft?: boolean;
  over?: ReactNode;
  title: ReactNode;
  actions?: ReactNode;
  stats?: ReactNode;
  cards?: ReactNode;
  tabs?: ReactNode;
  children?: ReactNode;
};

export function MusicHero({ image, soft, over, title, actions, stats, cards, tabs, children }: MusicHeroProps) {
  return (
    <div className="hero [&_h1]:text-ink relative overflow-hidden border-0 bg-panel text-ink not-has-[.hero-tabs]:pb-[34px] max-sm:not-has-[.hero-tabs]:pb-[22px] min-h-[300px] flex flex-col p-0 max-md:min-h-0 [&_.hero-tabs]:mt-0 [&_h1]:text-[54px] [&_h1]:leading-[1.05] [&_h1]:tracking-[-.03em]">
      {image ? <ImageWithFallback className={soft ? "absolute w-[min(62%,900px)] bg-cover bg-[center_22%] [mask-image:linear-gradient(to_right,transparent,#000_55%)] [&>img]:object-[center_22%] max-md:w-full max-md:[mask-image:linear-gradient(to_bottom,#000_40%,transparent)] -top-10 -bottom-10 -right-10 opacity-70 blur-[26px] saturate-[1.1]" : "absolute top-0 bottom-0 right-0 w-[min(62%,900px)] bg-cover bg-[center_22%] [mask-image:linear-gradient(to_right,transparent,#000_55%)] [&>img]:object-[center_22%] max-md:w-full max-md:[mask-image:linear-gradient(to_bottom,#000_40%,transparent)]"} src={imageUrl(image)} alt="" loading="eager" /> : null}
      <div className="relative w-full max-w-[1180px] mx-auto px-5 max-sm:px-4 flex-1 flex flex-col justify-end gap-3.5 pt-14 pb-[26px] [&>*]:max-w-[760px] max-md:pt-7 max-md:pb-[18px] max-md:gap-3">
        {over && <div className="mb-[-8px] text-lg font-semibold [&_a]:text-link max-md:mb-[-6px] max-md:text-[15px]">{over}</div>}
        <h1>{title}</h1>
        <div className="flex flex-wrap items-center gap-x-7 gap-y-3.5">
          <div className="row flex gap-2.5 items-center flex-wrap max-sm:hero:gap-2">{actions}</div>
          {stats && <div className="flex gap-6">{stats}</div>}
        </div>
        {children}
        {cards && <div className="flex flex-wrap gap-3 mt-1.5">{cards}</div>}
      </div>
      {tabs && <div className="hero-tabs relative w-full max-w-[1180px] mx-auto px-5 max-sm:px-4 ml-auto mt-6 pb-6 max-[861px]:[&_.tabs]:flex-nowrap max-[861px]:[&_.tabs]:overflow-x-auto max-[861px]:[&_.tabs]:[scrollbar-width:none] max-[861px]:[&_.tabs_a]:whitespace-nowrap [&_.tabs]:mb-0 [&_.tabs]:border-0 [&_.tabs]:gap-0.5 [&_.tabs]:pb-0">{tabs}</div>}
    </div>
  );
}

export function HeroStat({ label, value }: { label: string; value: number }) {
  return <div className="flex flex-col leading-[1.15] [&_span]:text-[11px] [&_span]:uppercase [&_span]:tracking-[.06em] [&_span]:text-muted [&_b]:font-display [&_b]:text-[22px] [&_b]:font-bold"><span>{label}</span><b title={num(value)}>{short(value)}</b></div>;
}

type FeatureCardProps = { label: string; to: string; image?: string | null; title: string; sub?: ReactNode };

export function FeatureCard({ label, to, image, title, sub }: FeatureCardProps) {
  return (
    <Link className="flex items-center gap-3 w-[300px] max-w-full p-2 rounded-none bg-card text-ink hover:text-ink [&_.art]:w-16 [&_.art]:flex-none [&>span]:flex [&>span]:flex-col [&>span]:min-w-0 [&>span]:leading-[1.3] [&_em]:text-xs [&_em]:not-italic [&_em]:text-muted [&_span_span]:text-[13px] [&_span_span]:truncate [&_span_span]:text-muted [&_strong]:truncate hover:[&_strong]:underline max-md:w-full max-md:[&_.art]:w-[52px]" to={to}>
      <Art image={image} />
      <span><em>{label}</em><strong>{title}</strong>{sub && <span>{sub}</span>}</span>
    </Link>
  );
}

// Noon keeps a bare date from shifting a day in any timezone; year-only dates pass through.
export const releaseDate = (d: string) => (d.length > 4 ? date(Date.parse(d + "T12:00:00") / 1000) : d);

export function YourScrobbles({ count, to }: { count: number; to?: string }) {
  const { me } = useAuth();
  if (!me) return null;
  return (
    <div className="yours flex items-center gap-2.5 mb-5 [&>div]:flex [&>div]:flex-col [&>div]:leading-[1.2] [&_span]:text-[11px] [&_span]:font-semibold [&_span]:uppercase [&_span]:tracking-[.06em] [&_span]:text-muted [&_a]:text-lg [&_a]:font-bold [&_a]:text-ink [&_b]:text-lg [&_b]:font-bold [&_b]:text-ink">
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
    <section className="section grid grid-cols-[minmax(0,1fr)_220px] gap-x-8 gap-y-4 max-md:grid-cols-1 [&_.wiki-summary]:m-0 [&_.tagger]:col-span-full">
      <div className="about-text"><WikiSummary wiki={wiki} to={to} /></div>
      <dl className="m-0 text-sm [&>div]:flex [&>div]:gap-3 [&>div]:py-1.5 [&>div]:border-b [&>div]:border-line [&>div:first-child]:pt-0 [&_dt]:w-24 [&_dt]:flex-none [&_dt]:font-bold [&_dd]:m-0 [&_dd]:text-ink-2">{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      {children}
    </section>
  );
}

export function ByArtist({ name, image }: { name: string; image?: string | null }) {
  return (
    <Section title="Artist">
      <Link className="flex items-center gap-3.5 text-ink hover:text-ink [&_.art]:w-[84px] [&_.art]:flex-none [&_.art]:rounded-none [&>span]:flex [&>span]:flex-col [&>span]:min-w-0 [&_strong]:text-lg hover:[&_strong]:underline [&_span_span]:text-sm [&_span_span]:text-link" to={artistUrl(name)}>
        <Art image={image} kind="artist" />
        <span><strong>{name}</strong><span>View artist <Ico.Right /></span></span>
      </Link>
    </Section>
  );
}

export function Trend({ data }: { data: TrendPoint[] }) {
  const weeks = weekTrend(data);
  if (weeks.every(w => !w.value)) return null;
  return (
    <Section title="Scrobble stats">
      <BarChart data={weeks} height={110} every={5} />
      <p className="text-muted text-[13px]">Scrobbles per week, last 6 months</p>
    </Section>
  );
}

export function Listeners({ items, more }: { items: Listener[]; more?: string }) {
  if (!items.length) return null;
  return (
    <Section title="Listeners" more={more} moreLabel="View all listeners" foot>
      <div className="listeners2 [&_.userlist]:grid [&_.userlist]:grid-cols-2 [&_.userlist]:gap-x-7 max-md:[&_.userlist]:grid-cols-1 [&_.userlist_li]:border-b-0 [&_.userlist_li]:py-1.5 [&_.userlist_.avatar]:size-11!"><UserList items={items} /></div>
    </Section>
  );
}

export function TrendingBand() {
  const q = useApi<Charts>("/charts?kind=tracks&limit=6");
  // Every item is a track with kind=tracks; the filter narrows the type.
  const items = (q.data?.items ?? []).filter(t => "duration" in t);
  if (!items.length) return null;
  return (
    <div className="py-[34px] pb-10 bg-panel text-ink [&_header]:flex [&_header]:items-baseline [&_header]:gap-3 [&_header]:mb-[18px] [&_h2]:flex-1 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-ink [&_.more]:font-medium [&_ol]:grid [&_ol]:grid-cols-6 [&_ol]:gap-4 [&_ol]:m-0 [&_ol]:p-0 [&_ol]:list-none [&_li]:flex [&_li]:flex-col [&_li]:min-w-0 [&_li>a:first-child]:grid [&_li>a:first-child]:grid-cols-[auto_minmax(0,1fr)] [&_li>a:first-child]:gap-x-2 [&_li>a:first-child]:items-baseline [&_li>a:first-child]:text-ink [&_.art]:col-span-full [&_.art]:mb-2 [&_b]:text-[22px] [&_b]:font-display [&_b]:font-bold [&_b]:text-link [&_strong]:truncate [&_.by]:truncate [&_.by]:text-[13px] [&_.by]:text-muted [&_a:hover]:underline [&_a:hover]:text-link max-lg:[&_ol]:grid-cols-3 max-lg:[&_ol]:gap-x-3.5 max-lg:[&_ol]:gap-y-5 max-md:[&_ol]:grid-cols-2 [&+.site-footer]:mt-0">
      <div className="w-full max-w-[1180px] mx-auto px-5 max-sm:px-4">
        <header>
          <h2>Trending tracks</h2>
          <Link className="more whitespace-nowrap text-link text-sm font-semibold hover:underline [&_.ico]:align-[-0.15em]" to="/charts?kind=tracks">View all trending tracks <Ico.Right /></Link>
        </header>
        <ol>
          {items.map((t, i) => (
            <li key={t.id}>
              <Link to={trackUrl(t.artist, t.title)}><Art image={t.image} /><b>{i + 1}</b><strong>{t.title}</strong></Link>
              <Link className="by truncate text-[13px] text-muted" to={artistUrl(t.artist)}>{t.artist}</Link>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
