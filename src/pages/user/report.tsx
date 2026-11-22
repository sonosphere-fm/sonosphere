import { Ico } from "../../icons";
import { colsEven, colsThree } from "../../ui/tw";
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
  if (!before) return <span className="text-muted">no earlier data</span>;
  const pct = Math.round((now / before - 1) * 100);
  return <span>{pct >= 0 ? <Ico.Up /> : <Ico.Down />} {Math.abs(pct)}% <span className="text-muted">vs previous </span></span>;
}

function reportTitle(r: ListeningReport, type: "week" | "year") {
  if (type === "week") return `${date(r.start, { day: "numeric", month: "short" })} – ${date(r.end - 1)}`;
  return String(new Date(r.start * 1000 + 86400000).getFullYear());
}

function ReportBody({ r, name, type, offset }: { r: ListeningReport; name: string; type: "week" | "year"; offset: number }) {
  const title = reportTitle(r, type);
  if (!r.totals.playcount) {
    return <><h2 className="text-[26px] mb-4">{title}</h2><Empty>No scrobbles in this {type}.</Empty></>;
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
      <h2 className="text-[26px] mb-4">
        {name}'s {type} in music <span className="text-muted">· {title}{offset === 0 ? " (so far)" : ""}</span>
      </h2>
      <div className="stats boxed flex flex-wrap gap-0 mb-7 bg-panel *:flex-1 *:min-w-[140px] *:px-[18px] *:py-3.5 max-sm:*:min-w-1/2 max-sm:*:border-b max-sm:*:border-line">
        <Stat label="Scrobbles" value={num(r.totals.playcount)} hint={<Delta now={r.totals.playcount} before={r.previous.playcount} />} />
        <Stat label="Listening time" value={`${hours}h ${mins}m`} hint={`${num(Math.round(r.totals.playcount / days))} scrobbles a day`} />
        <Stat label="Artists" value={num(r.totals.artists)} hint={<Delta now={r.totals.artists} before={r.previous.artists} />} />
        <Stat label="Albums" value={num(r.totals.albums)} hint={<Delta now={r.totals.albums} before={r.previous.albums} />} />
        <Stat label="Tracks" value={num(r.totals.tracks)} hint={<Delta now={r.totals.tracks} before={r.previous.tracks} />} />
      </div>
      <div className={colsEven}>
        <Section title={type === "week" ? "Scrobbles by day" : "Scrobbles by month"}>
          <BarChart data={byBucket} />
          <p className="text-muted text-[13px]">Busiest: {busiest.label} with {num(busiest.count)} scrobbles</p>
        </Section>
        <Section title="Listening clock">
          <BarChart data={byHour} every={3} />
          <p className="text-muted text-[13px]">Peak hour: {hh(peak.hour)}:00 · times shown in your timezone</p>
        </Section>
      </div>
      <div className={colsThree}>
        <Section title="Top artists"><RankList kind="artist" items={r.topArtists} /></Section>
        <Section title="Top albums"><RankList kind="album" items={r.topAlbums} /></Section>
        <Section title="Top tracks"><TrackList items={r.topTracks} rank={1} count="playcount" /></Section>
      </div>
      <div className={colsEven}>
        <Section title={`New discoveries (${r.newArtists.count})`}>
          {r.newArtists.items.length
            ? <Grid kind="artist" cols={3} items={r.newArtists.items} sub={a => `${num(a.playcount)} scrobbles`} />
            : <p className="text-muted">No artists scrobbled for the first time this {type}.</p>}
        </Section>
        <Section title="Top tags">
          {r.tags.length ? (
            <ul className="list-none m-0 p-0 [&_li]:grid [&_li]:grid-cols-[130px_1fr] [&_li]:gap-3 [&_li]:items-center [&_li]:py-[5px] [&_span]:block [&_span]:h-2 [&_span]:bg-line [&_i]:block [&_i]:h-full [&_i]:bg-accent [&_a]:truncate">
              {r.tags.map(t => (
                <li key={t.name}>
                  <Link to={tagUrl(t.name)}>{t.name}</Link>
                  <span><i style={{ width: `${(t.weight / r.tags[0].weight) * 100}%` }} /></span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">No tagged artists.</p>
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
      <div className="toolbar flex items-center justify-between gap-3.5 flex-wrap mb-3.5 max-sm:items-stretch max-sm:flex-col [&_.page-title]:mb-0 [&_.tabs]:mb-0 [&_.tabs]:flex-1">
        <nav className="tabs sub flex flex-wrap mb-6 *:hover:no-underline *:current:font-medium gap-1 *:m-0 *:h-auto *:rounded-none *:border-0 *:bg-fill *:px-[11px] *:py-[5px] *:text-[11px] *:font-medium *:uppercase *:tracking-[.05em] *:text-ink *:hover:bg-fill-hover *:hover:text-ink *:current:bg-ink *:current:text-bg max-md:toolbar:max-w-full">
          <Link className={type === "week" ? "active" : ""} to={`${base}/week`}>Weekly</Link>
          <Link className={type === "year" ? "active" : ""} to={`${base}/year`}>Yearly</Link>
        </nav>
        <span className="row flex gap-2.5 items-center flex-wrap max-sm:hero:gap-2">
          <Button kind="btn ghost small" onClick={() => setOffset(String(offset + 1))}><Ico.Left /> Earlier</Button>
          <Button kind="btn ghost small" disabled={offset === 0} onClick={() => setOffset(String(offset - 1))}>Later <Ico.Right /></Button>
        </span>
      </div>
      <Async q={q}>{r => <ReportBody r={r} name={name} type={type} offset={offset} />}</Async>
    </>
  );
}
