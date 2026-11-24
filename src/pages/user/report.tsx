import { Ico } from "../../icons";
import { Username } from "../../ui/username";
import { Button } from "../../kit";
import { Link } from "react-router-dom";
import { date, num, qs, tagUrl, useApi, useParam, userUrl } from "../../lib";
import { Async, Empty, Section, Stat } from "../../ui/base";
import { locale, t, tx } from "../../i18n";
import { BarChart } from "../../ui/charts";
import { Grid, RankList, TrackList } from "../../ui/lists";
import {
  type Blasts,
  type ListeningStats,
  type Report as ListeningReport,
  type ReportType,
  reportStart,
} from "../../../shared/listening";
import { BlastsBody } from "./blasts";
import { StatsBody } from "./stats";

const hh = (hour: number) => String(hour).padStart(2, "0");
const most = <T extends { count: number }>(xs: T[]) => [...xs].sort((a, b) => b.count - a.count)[0];

function Delta({ now, before }: { now: number; before: number }) {
  if (!before) return <span className="muted">{t("user.noEarlierData")}</span>;
  const pct = Math.round((now / before - 1) * 100);
  return (
    <span>
      {pct >= 0 ? <Ico.Up /> : <Ico.Down />} {t("user.percent", { pct: Math.abs(pct) })}{" "}
      <span className="muted">{t("user.vsPrevious")} </span>
    </span>
  );
}

function reportTitle(r: ListeningReport, type: ReportType) {
  if (type === "all") return `${date(r.start)} – ${date(r.end - 1)}`;
  if (type === "week") return `${date(r.start, { day: "numeric", month: "short" })} – ${date(r.end - 1)}`;
  if (type === "month") return date(r.start, { month: "long", year: "numeric" });
  return String(new Date(r.start * 1000 + 86400000).getFullYear());
}

function bucketLabel(type: ReportType, b: ListeningReport["buckets"][number]) {
  const at = (key: string) => new Date(`${key}T00:00:00Z`);
  if (type === "week") return at(b.key).toLocaleDateString(locale(), { weekday: "short", timeZone: "UTC" });
  if (type === "year") return at(`${b.key}-01`).toLocaleDateString(locale(), { month: "short", timeZone: "UTC" });
  return b.label;
}

function emptyText(type: ReportType) {
  if (type === "week") return t("user.noScrobblesWeek");
  if (type === "month") return t("user.noScrobblesMonth");
  if (type === "year") return t("user.noScrobblesYear");
  return t("user.noScrobbles");
}

function headline(type: ReportType, name: string) {
  const who = { name: <Username name={name} /> };
  if (type === "week") return tx("user.weekInMusic", who);
  if (type === "month") return tx("user.monthInMusic", who);
  if (type === "year") return tx("user.yearInMusic", who);
  return tx("user.allTimeReportTitle", who);
}

function noDiscoveries(type: ReportType) {
  if (type === "week") return t("user.noDiscoveriesWeek");
  if (type === "month") return t("user.noDiscoveriesMonth");
  if (type === "year") return t("user.noDiscoveriesYear");
  return t("user.noDiscoveriesAll");
}

function ReportBody({ r, name, type, offset }: { r: ListeningReport; name: string; type: ReportType; offset: number }) {
  const title = reportTitle(r, type);
  if (!r.totals.playcount) {
    return (
      <>
        <h2 className="report-title">{title}</h2>
        <Empty>{emptyText(type)}</Empty>
      </>
    );
  }
  const hours = Math.floor(r.listeningSeconds / 3600);
  const mins = Math.round((r.listeningSeconds % 3600) / 60);
  const days = Math.max(1, Math.round((Math.min(r.end, Date.now() / 1000) - r.start) / 86400));
  const busiest = most(r.buckets);
  const busiestName =
    type === "month"
      ? date(Date.parse(busiest.key) / 1000, { day: "numeric", month: "long", timeZone: "UTC" })
      : bucketLabel(type, busiest);
  const peak = most(r.clock);
  const byBucket = r.buckets.map((b) => ({ label: bucketLabel(type, b), value: b.count, tip: b.key }));
  const byHour = r.clock.map((c) => ({ label: hh(c.hour), value: c.count, tip: `${hh(c.hour)}:00–${hh(c.hour)}:59` }));
  return (
    <div className="report">
      <h2 className="report-title">
        {headline(type, name)}{" "}
        <span className="muted">
          · {title}
          {offset === 0 && type !== "all" ? ` ${t("user.soFar")}` : ""}
        </span>
      </h2>
      <div className="stats boxed">
        <Stat
          label={t("user.statScrobbles")}
          value={num(r.totals.playcount)}
          hint={type !== "all" && <Delta now={r.totals.playcount} before={r.previous.playcount} />}
        />
        <Stat
          label={t("user.listeningTime")}
          value={t("user.hoursMinutes", { hours, mins })}
          hint={t("user.scrobblesADay", { count: Math.round(r.totals.playcount / days) })}
        />
        <Stat
          label={t("user.statArtists")}
          value={num(r.totals.artists)}
          hint={type !== "all" && <Delta now={r.totals.artists} before={r.previous.artists} />}
        />
        <Stat
          label={t("user.statAlbums")}
          value={num(r.totals.albums)}
          hint={type !== "all" && <Delta now={r.totals.albums} before={r.previous.albums} />}
        />
        <Stat
          label={t("user.statTracks")}
          value={num(r.totals.tracks)}
          hint={type !== "all" && <Delta now={r.totals.tracks} before={r.previous.tracks} />}
        />
      </div>
      <div className="cols even">
        <Section title={type === "year" || type === "all" ? t("user.scrobblesByMonth") : t("user.scrobblesByDay")}>
          <BarChart
            data={byBucket}
            every={type === "all" ? Math.max(1, Math.ceil(byBucket.length / 12)) : type === "month" ? 5 : 1}
          />
          <p className="muted small">{t("user.busiestWith", { name: busiestName, count: busiest.count })}</p>
        </Section>
        <Section title={t("user.listeningClock")}>
          <BarChart data={byHour} every={3} />
          <p className="muted small">{t("user.peakHour", { hour: `${hh(peak.hour)}:00` })}</p>
        </Section>
      </div>
      <div className="cols three">
        <Section title={t("user.topArtists")}>
          <RankList kind="artist" items={r.topArtists} />
        </Section>
        <Section title={t("user.topAlbums")}>
          <RankList kind="album" items={r.topAlbums} />
        </Section>
        <Section title={t("user.topTracks")}>
          <TrackList items={r.topTracks} rank={1} count="playcount" />
        </Section>
      </div>
      <div className="cols even">
        <Section
          title={
            type === "all"
              ? t("user.artistsDiscovered", { count: r.newArtists.count })
              : t("user.newDiscoveries", { count: r.newArtists.count })
          }
        >
          {r.newArtists.items.length ? (
            <Grid
              kind="artist"
              cols={3}
              items={r.newArtists.items}
              sub={(a) => t("user.scrobbleCount", { count: a.playcount })}
            />
          ) : (
            <p className="muted">{noDiscoveries(type)}</p>
          )}
        </Section>
        <Section title={t("user.topTags")}>
          {r.tags.length ? (
            <ul className="tagbars">
              {r.tags.map((tag) => (
                <li key={tag.name}>
                  <Link to={tagUrl(tag.name)}>{tag.name}</Link>
                  <span>
                    <i style={{ width: `${(tag.weight / r.tags[0].weight) * 100}%` }} />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">{t("user.noTaggedArtists")}</p>
          )}
        </Section>
      </div>
    </div>
  );
}

function Period({ name, type, offset }: { name: string; type: ReportType; offset: number }) {
  const q = useApi<ListeningReport>(`/user/report${qs({ name, type, offset, tz: -new Date().getTimezoneOffset() })}`);
  return <Async q={q}>{(r) => <ReportBody r={r} name={name} type={type} offset={offset} />}</Async>;
}

function Stats({ name, offset }: { name: string; offset: number }) {
  const q = useApi<ListeningStats>(`/user/stats${qs({ name, offset, tz: -new Date().getTimezoneOffset() })}`);
  return <Async q={q}>{(s) => <StatsBody s={s} name={name} />}</Async>;
}

function Throwbacks({ name, offset }: { name: string; offset: number }) {
  const q = useApi<Blasts>(`/user/blasts${qs({ name, offset, tz: -new Date().getTimezoneOffset() })}`);
  return <Async q={q}>{(b) => <BlastsBody b={b} name={name} />}</Async>;
}

export type ReportTab = ReportType | "stats" | "blasts";

function Body({ name, type, offset }: { name: string; type: ReportTab; offset: number }) {
  if (type === "stats") return <Stats name={name} offset={offset} />;
  if (type === "blasts") return <Throwbacks name={name} offset={offset} />;
  return <Period name={name} type={type} offset={offset} />;
}

export function Report({ name, type }: { name: string; type: ReportTab }) {
  const start = type === "stats" || type === "blasts" ? 0 : reportStart(type);
  const [offsetStr, setOffset] = useParam("offset", String(start));
  const offset = type === "all" ? 0 : Number(offsetStr);
  const base = `${userUrl(name)}/listening-report`;
  return (
    <>
      <div className="toolbar">
        <nav className="tabs sub">
          <Link className={type === "week" ? "active" : ""} to={`${base}/week`}>
            {t("user.weekly")}
          </Link>
          <Link className={type === "month" ? "active" : ""} to={`${base}/month`}>
            {t("user.monthly")}
          </Link>
          <Link className={type === "year" ? "active" : ""} to={`${base}/year`}>
            {t("user.yearly")}
          </Link>
          <Link className={type === "all" ? "active" : ""} to={`${base}/all`}>
            {t("common.allTime")}
          </Link>
          <Link className={type === "stats" ? "active" : ""} to={`${base}/stats`}>
            {t("user.stats")}
          </Link>
          <Link className={type === "blasts" ? "active" : ""} to={`${base}/blasts`}>
            {t("user.blastsFromThePast")}
          </Link>
        </nav>
        {type !== "all" && (
          <span className="row">
            <Button kind="btn ghost small" onClick={() => setOffset(String(offset + 1))}>
              <Ico.Left /> {t("user.earlier")}
            </Button>
            <Button kind="btn ghost small" disabled={offset === 0} onClick={() => setOffset(String(offset - 1))}>
              {t("user.later")} <Ico.Right />
            </Button>
          </span>
        )}
      </div>
      <Body name={name} type={type} offset={offset} />
    </>
  );
}
