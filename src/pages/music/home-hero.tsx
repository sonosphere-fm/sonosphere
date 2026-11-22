import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { TopTrack } from "../../../shared/listening";
import { trackUrl } from "../../../shared/paths";
import { Button } from "../../kit";

export function HomeHero({ stats, chart = <HomeHeroChart /> }: { stats?: ReactNode; chart?: ReactNode }) {
  return (
    <div className="banner">
      <div className="wrap banner-inner">
        <div className="banner-copy">
          <h1>Track what you love.</h1>
          <p>
            Sonosphere scrobbles everything you play, turns it into your own charts, and finds the music and people that
            match your taste.
          </p>
          <div className="row">
            <Button kind="btn inverse" href="/join">
              Join free
            </Button>
            <Button kind="btn outline-invert" href="/login">
              Log in
            </Button>
          </div>
          <div className="banner-stats-slot">{stats}</div>
        </div>
        {chart}
      </div>
    </div>
  );
}

export function HomeHeroChart({ tracks }: { tracks?: TopTrack[] }) {
  return (
    <section className="banner-chart" aria-labelledby="home-chart-title">
      <h2 className="banner-chart-head" id="home-chart-title">
        Top tracks right now
      </h2>
      {tracks?.length ? (
        <ol>
          {tracks.slice(0, 5).map((t, i) => (
            <li key={t.id}>
              <b aria-hidden="true">{i + 1}</b>
              <Link to={trackUrl(t.artist, t.title)}>
                <strong>{t.title}</strong>
                <span>{t.artist}</span>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <Link className="banner-chart-more" to="/charts?kind=tracks">
          Explore track charts
        </Link>
      )}
    </section>
  );
}

export function HomeHeroStats({ users = 0 }: { users?: number }) {
  if (users < 10) return null;
  const place = Math.max(10, 10 ** (String(Math.floor(users)).length - 2));
  const rounded = Math.floor(users / place) * place;
  return <p className="banner-stats">Join {rounded.toLocaleString("en-US")}+ users scrobbling on Sonosphere</p>;
}
