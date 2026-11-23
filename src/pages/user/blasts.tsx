import { num, plural, userUrl } from "../../lib";
import { Empty, Section } from "../../ui/base";
import { RankList, TrackList } from "../../ui/lists";
import { Username } from "../../ui/username";
import type { Blasts, Throwback } from "../../../shared/listening";

const dayMonth = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });

function Year({ t, name, ago }: { t: Throwback; name: string; ago: number }) {
  return (
    <Section
      title={`${plural(ago, "year")} ago · ${dayMonth(t.from)} to ${dayMonth(t.to)} ${t.year}`}
      more={`${userUrl(name)}/library?from=${t.from}&to=${t.to}`}
      moreLabel={`${num(t.playcount)} scrobbles`}
    >
      <div className="cols even">
        <RankList kind="artist" items={t.topArtists} />
        <TrackList items={t.topTracks} rank={1} count="playcount" />
      </div>
    </Section>
  );
}

export function BlastsBody({ b, name }: { b: Blasts; name: string }) {
  const year = Number(b.date.slice(0, 4));
  return (
    <div className="report">
      <h2 className="report-title">
        <Username name={name} />
        's blasts from the past <span className="muted">· around {dayMonth(b.date)}</span>
      </h2>
      {b.years.length ? (
        b.years.map((t) => <Year key={t.year} t={t} name={name} ago={year - t.year} />)
      ) : (
        <Empty>Nothing scrobbled around {dayMonth(b.date)} in earlier years.</Empty>
      )}
    </div>
  );
}
