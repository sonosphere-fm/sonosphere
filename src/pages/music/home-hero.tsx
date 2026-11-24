import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { TopTrack } from "../../../shared/listening";
import { trackUrl } from "../../../shared/paths";
import { t } from "../../i18n";
import { Button } from "../../kit";
import { num } from "../../lib";

export function HomeHero({ stats, chart = <HomeHeroChart /> }: { stats?: ReactNode; chart?: ReactNode }) {
  return (
    <div className="banner">
      <div className="wrap banner-inner">
        <div className="banner-copy">
          <h1>{t("music.heroTitle")}</h1>
          <p>{t("music.heroBody")}</p>
          <div className="row">
            <Button kind="btn inverse" href="/join">
              {t("music.joinFree")}
            </Button>
            <Button kind="btn outline-invert" href="/login">
              {t("music.logIn")}
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
        {t("music.heroChartTitle")}
      </h2>
      {tracks?.length ? (
        <ol>
          {tracks.slice(0, 5).map((track, i) => (
            <li key={track.id}>
              <b aria-hidden="true">{i + 1}</b>
              <Link to={trackUrl(track.artist, track.title)}>
                <strong>{track.title}</strong>
                <span>{track.artist}</span>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <Link className="banner-chart-more" to="/charts?kind=tracks">
          {t("music.exploreTrackCharts")}
        </Link>
      )}
    </section>
  );
}

export function HomeHeroStats({ users = 0 }: { users?: number }) {
  if (users < 10) return null;
  const place = Math.max(10, 10 ** (String(Math.floor(users)).length - 2));
  const rounded = Math.floor(users / place) * place;
  return <p className="banner-stats">{t("music.heroUsers", { users: num(rounded) })}</p>;
}
