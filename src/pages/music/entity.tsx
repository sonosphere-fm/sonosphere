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
    <div className="hero mhero">
      {image ? <ImageWithFallback className={soft ? "mhero-img soft" : "mhero-img"} src={imageUrl(image)} alt="" loading="eager" /> : null}
      <div className="wrap mhero-inner">
        {over && <div className="mhero-over">{over}</div>}
        <h1>{title}</h1>
        <div className="mhero-bar">
          <div className="row">{actions}</div>
          {stats && <div className="mhero-stats">{stats}</div>}
        </div>
        {children}
        {cards && <div className="mhero-cards">{cards}</div>}
      </div>
      {tabs && <div className="wrap hero-tabs">{tabs}</div>}
    </div>
  );
}

export function HeroStat({ label, value }: { label: string; value: number }) {
  return <div className="mstat"><span>{label}</span><b title={num(value)}>{short(value)}</b></div>;
}

type FeatureCardProps = { label: string; to: string; image?: string | null; title: string; sub?: ReactNode };

export function FeatureCard({ label, to, image, title, sub }: FeatureCardProps) {
  return (
    <Link className="mfeat" to={to}>
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
    <section className="section about">
      <div className="about-text"><WikiSummary wiki={wiki} to={to} /></div>
      <dl className="facts">{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      {children}
    </section>
  );
}

export function ByArtist({ name, image }: { name: string; image?: string | null }) {
  return (
    <Section title="Artist">
      <Link className="by-artist" to={artistUrl(name)}>
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
      <p className="muted small">Scrobbles per week, last 6 months</p>
    </Section>
  );
}

export function Listeners({ items, more }: { items: Listener[]; more?: string }) {
  if (!items.length) return null;
  return (
    <Section title="Listeners" more={more} moreLabel="View all listeners" foot>
      <div className="listeners2"><UserList items={items} /></div>
    </Section>
  );
}

export function TrendingBand() {
  const q = useApi<Charts>("/charts?kind=tracks&limit=6");
  // Every item is a track with kind=tracks; the filter narrows the type.
  const items = (q.data?.items ?? []).filter(t => "duration" in t);
  if (!items.length) return null;
  return (
    <div className="trending">
      <div className="wrap">
        <header>
          <h2>Trending tracks</h2>
          <Link className="more" to="/charts?kind=tracks">View all trending tracks <Ico.Right /></Link>
        </header>
        <ol>
          {items.map((t, i) => (
            <li key={t.id}>
              <Link to={trackUrl(t.artist, t.title)}><Art image={t.image} /><b>{i + 1}</b><strong>{t.title}</strong></Link>
              <Link className="by" to={artistUrl(t.artist)}>{t.artist}</Link>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
