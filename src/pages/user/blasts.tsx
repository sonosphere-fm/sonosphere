import { userUrl } from "../../lib";
import { locale, t, tx } from "../../i18n";
import { Empty, Section } from "../../ui/base";
import { RankList, TrackList } from "../../ui/lists";
import { Username } from "../../ui/username";
import type { Blasts, Throwback } from "../../../shared/listening";

const dayMonth = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString(locale(), { day: "numeric", month: "long", timeZone: "UTC" });

function Year({ y, name, ago }: { y: Throwback; name: string; ago: number }) {
  return (
    <Section
      title={t("user.blastYear", { count: ago, from: dayMonth(y.from), to: dayMonth(y.to), year: y.year })}
      more={`${userUrl(name)}/library?from=${y.from}&to=${y.to}`}
      moreLabel={t("user.scrobbleCount", { count: y.playcount })}
    >
      <div className="cols even">
        <RankList kind="artist" items={y.topArtists} />
        <TrackList items={y.topTracks} rank={1} count="playcount" />
      </div>
    </Section>
  );
}

export function BlastsBody({ b, name }: { b: Blasts; name: string }) {
  const year = Number(b.date.slice(0, 4));
  return (
    <div className="report">
      <h2 className="report-title">
        {tx("user.blastsTitle", { name: <Username name={name} /> })}{" "}
        <span className="muted">· {t("user.aroundDate", { date: dayMonth(b.date) })}</span>
      </h2>
      {b.years.length ? (
        b.years.map((y) => <Year key={y.year} y={y} name={name} ago={year - y.year} />)
      ) : (
        <Empty>{t("user.blastsEmpty", { date: dayMonth(b.date) })}</Empty>
      )}
    </div>
  );
}
