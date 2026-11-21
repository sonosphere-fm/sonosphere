import { Ico } from "../../icons";
import { Button } from "../../kit";
import { Link } from "react-router-dom";
import { date, num, qs, tagUrl, useApi, useParam, userUrl } from "../../lib";
import { Async, Empty, Section, Stat } from "../../ui/base";
import { BarChart } from "../../ui/charts";
import { Grid, RankList, TrackList } from "../../ui/lists";
import type { Report as ListeningReport } from "../../../shared/listening";

const hh = (hour: number) => String(hour).padStart(2, "0");
const most = <T extends { count: number }>(xs: T[]) => [...xs].sort((a, b) => b.count - a.count)[0];

function Delta({ now, before }: { now: number; before: number }) {
  if (!before) return <span className="muted">no earlier data</span>;
  const pct = Math.round((now / before - 1) * 100);
  return <span>{pct >= 0 ? <Ico.Up /> : <Ico.Down />} {Math.abs(pct)}% <span className="muted">vs previous </span></span>;
}

function reportTitle(r: ListeningReport, type: "week" | "year") {
  if (type === "week") return `${date(r.start, { day: "numeric", month: "short" })} – ${date(r.end - 1)}`;
  return String(new Date(r.start * 1000 + 86400000).getFullYear());
}

function ReportBody({ r, name, type, offset }: { r: ListeningReport; name: string; type: "week" | "year"; offset: number }) {
  const title = reportTitle(r, type);
  if (!r.totals.playcount) {
    return <><h2 className="report-title">{title}</h2><Empty>No scrobbles in this {type}.</Empty></>;
  }
  const hours = Math.floor(r.listeningSeconds / 3600);
  const mins = Math.round((r.listeningSeconds % 3600) / 60);
  const days = Math.max(1, Math.round((Math.min(r.end, Date.now() / 1000) - r.start) / 86400));
  const busiest = most(r.buckets);
  const peak = most(r.clock);
  const byBucket = r.buckets.map(b => ({ label: b.label, value: b.count, tip: b.key }));
  const byHour = r.clock.map(c => ({ label: hh(c.hour), value: c.count, tip: `${hh(c.hour)}:00–${hh(c.hour)}:59` }));
  return (
    <div className="report">
      <h2 className="report-title">
        {name}'s {type} in music <span className="muted">· {title}{offset === 0 ? " (so far)" : ""}</span>
      </h2>
      <div className="stats boxed">
        <Stat label="Scrobbles" value={num(r.totals.playcount)} hint={<Delta now={r.totals.playcount} before={r.previous.playcount} />} />
        <Stat label="Listening time" value={`${hours}h ${mins}m`} hint={`${num(Math.round(r.totals.playcount / days))} scrobbles a day`} />
        <Stat label="Artists" value={num(r.totals.artists)} hint={<Delta now={r.totals.artists} before={r.previous.artists} />} />
        <Stat label="Albums" value={num(r.totals.albums)} hint={<Delta now={r.totals.albums} before={r.previous.albums} />} />
        <Stat label="Tracks" value={num(r.totals.tracks)} hint={<Delta now={r.totals.tracks} before={r.previous.tracks} />} />
      </div>
      <div className="cols even">
        <Section title={type === "week" ? "Scrobbles by day" : "Scrobbles by month"}>
          <BarChart data={byBucket} />
          <p className="muted small">Busiest: {busiest.label} with {num(busiest.count)} scrobbles</p>
        </Section>
        <Section title="Listening clock">
          <BarChart data={byHour} every={3} />
          <p className="muted small">Peak hour: {hh(peak.hour)}:00 · times shown in your timezone</p>
        </Section>
      </div>
      <div className="cols three">
        <Section title="Top artists"><RankList kind="artist" items={r.topArtists} /></Section>
        <Section title="Top albums"><RankList kind="album" items={r.topAlbums} /></Section>
        <Section title="Top tracks"><TrackList items={r.topTracks} rank={1} count="playcount" /></Section>
      </div>
      <div className="cols even">
        <Section title={`New discoveries (${r.newArtists.count})`}>
          {r.newArtists.items.length
            ? <Grid kind="artist" cols={3} items={r.newArtists.items} sub={a => `${num(a.playcount)} scrobbles`} />
            : <p className="muted">No artists scrobbled for the first time this {type}.</p>}
        </Section>
        <Section title="Top tags">
          {r.tags.length ? (
            <ul className="tagbars">
              {r.tags.map(t => (
                <li key={t.name}>
                  <Link to={tagUrl(t.name)}>{t.name}</Link>
                  <span><i style={{ width: `${(t.weight / r.tags[0].weight) * 100}%` }} /></span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No tagged artists.</p>
          )}
        </Section>
      </div>
    </div>
  );
}

export function Report({ name, type }: { name: string; type: "week" | "year" }) {
  const [offsetStr, setOffset] = useParam("offset", type === "week" ? "1" : "0");
  const offset = Number(offsetStr);
  const q = useApi<ListeningReport>(`/user/report${qs({ name, type, offset, tz: -new Date().getTimezoneOffset() })}`);
  const base = `${userUrl(name)}/listening-report`;
  return (
    <>
      <div className="toolbar">
        <nav className="tabs sub">
          <Link className={type === "week" ? "active" : ""} to={`${base}/week`}>Weekly</Link>
          <Link className={type === "year" ? "active" : ""} to={`${base}/year`}>Yearly</Link>
        </nav>
        <span className="row">
          <Button kind="btn ghost small" onClick={() => setOffset(String(offset + 1))}><Ico.Left /> Earlier</Button>
          <Button kind="btn ghost small" disabled={offset === 0} onClick={() => setOffset(String(offset - 1))}>Later <Ico.Right /></Button>
        </span>
      </div>
      <Async q={q}>{r => <ReportBody r={r} name={name} type={type} offset={offset} />}</Async>
    </>
  );
}
