import { Ico } from "../../icons";
import { Button } from "../../kit";
import { Link, useSearchParams } from "react-router-dom";
import { albumUrl, artistUrl, num, qs, tagUrl, trackUrl, useApi, useParam, useTitle } from "../../lib";
import { Art, Async, Empty, Pager, PeriodPicker, Section } from "../../ui/base";
import { EventList } from "../../ui/events";
import { RankList, TrackList } from "../../ui/lists";
import { TagChips } from "../../ui/tags";
import type { ChartTag, Charts as ChartsData, Home } from "../../../shared/home";
import type { TopAlbum, TopArtist, TopTrack } from "../../../shared/listening";

// ---------- charts ----------
const CHART_PERIODS: [string, string][] = [["7day", "This week"], ["1month", "This month"], ["12month", "This year"], ["overall", "All time"]];
type ChartItem = TopTrack | TopArtist | TopAlbum | ChartTag;
type ChartColProps = { title: string; more: string } & ({ kind: "track"; items: TopTrack[] } | { kind: "artist"; items: TopArtist[] } | { kind: "album"; items: TopAlbum[] } | { kind: "tag"; items: ChartTag[] });
function ChartCol(props: ChartColProps) {
  const { title, kind, items, more } = props;
  const name = (r: ChartItem) => ("name" in r ? r.name : r.title);
  const artist = (r: ChartItem) => ("artist" in r ? r.artist : undefined);
  const to = (r: ChartItem) => kind === "artist" ? artistUrl(name(r)) : kind === "tag" ? tagUrl(name(r)) : kind === "album" ? albumUrl(artist(r) ?? "", name(r)) : trackUrl(artist(r) ?? "", name(r));
  const art = (r: ChartItem) => <Art name={"album" in r ? r.album || r.title : name(r)} sub={artist(r)} image={"image" in r ? r.image : undefined} kind={kind === "artist" ? "artist" : "album"} />;
  const [top, ...rest] = items, lead = kind !== "tag" && top;
  return (
    <section className="chartcol" id={`top-${kind}s`}>
      <h2 className="chart-title"><Link to={more}>{title}</Link></h2>
      {!items.length ? <Empty>Nothing charted for this period yet.</Empty> : (
        <>
          {lead && (
            <Link className="chart-top" to={to(lead)}>
              {art(lead)}
              <span className="chart-top-strip"><b>1</b><span className={kind === "artist" ? "thumb round" : "thumb"}>{art(lead)}</span>
                <span className="grow"><strong>{name(lead)}</strong>{kind !== "artist" && <span>{artist(lead)}</span>}</span></span>
            </Link>
          )}
          {props.kind === "track"
            ? <TrackList compact items={lead ? props.items.slice(1) : props.items} rank={lead ? 2 : 1} count="listeners" />
            : <RankList compact kind={props.kind} items={lead ? rest : items} rank={lead ? 2 : 1} count={kind === "tag" ? "count" : "listeners"} />}
          <Link className="more" to={more}>More {title.toLowerCase()} <Ico.Right /></Link>
        </>
      )}
    </section>
  );
}
function ChartsOverview() {
  const [period, setPeriod] = useParam("period", "overall");
  const get = <T extends ChartItem>(kind: string) => useApi<ChartsData<T>>(`/charts${qs({ kind, period: kind === "tags" ? undefined : period, limit: 10 })}`);
  const tracks = get<TopTrack>("tracks"), artists = get<TopArtist>("artists"), albums = get<TopAlbum>("albums"), tags = get<ChartTag>("tags"), home = useApi<Home>("/home");
  const p = period === "overall" ? "" : `&period=${period}`;
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ block: "start" });
  return (
    <div className="wrap page">
      <h1 className="page-title">Charts</h1>
      <nav className="tabs">{CHART_PERIODS.map(([k, l]) => <Button key={k} kind={k === period ? "active" : ""} onClick={() => setPeriod(k)}>{l}</Button>)}</nav>
      <p className="jump"><span>Jump to:</span>{[["top-tracks", "Top Tracks"], ["top-artists", "Top Artists"], ["top-albums", "Top Albums"], ["top-tags", "Top Tags"]].map(([id, l]) => <Button key={id} kind="link" type="button" onClick={() => jump(id)}>{l}</Button>)}</p>
      <div className="cols">
        <div className="main">
          <div className="cols even">
            <ChartCol title="Top Tracks" kind="track" items={tracks.data?.items ?? []} more={`/charts?kind=tracks${p}`} />
            <ChartCol title="Top Artists" kind="artist" items={artists.data?.items ?? []} more={`/charts?kind=artists${p}`} />
          </div>
          <div className="cols even">
            <ChartCol title="Top Albums" kind="album" items={albums.data?.items ?? []} more={`/charts?kind=albums${p}`} />
            <ChartCol title="Top Tags" kind="tag" items={tags.data?.items ?? []} more="/charts?kind=tags" />
          </div>
        </div>
        <aside className="side">
          <Section title="Coming up" more="/events"><EventList items={home.data?.events ?? []} /></Section>
          <Section title="Popular tags" more="/charts?kind=tags"><TagChips tags={home.data?.tags ?? []} /></Section>
        </aside>
      </div>
    </div>
  );
}
function ChartList() {
  const [kind, setKind] = useParam("kind", "");
  const [sp] = useSearchParams();
  const period = sp.get("period") || "overall", page = Number(sp.get("page")) || 1;
  const q = useApi<ChartsData>(`/charts${qs({ kind, period: kind === "tags" ? undefined : period, page, limit: 50 })}`);
  return (
    <div className="wrap page">
      <h1 className="page-title">Charts</h1>
      <div className="toolbar">
        <nav className="tabs">{["", "tracks", "artists", "albums", "tags"].map(k => <Button key={k} kind={k === kind ? "active" : ""} onClick={() => setKind(k)}>{k ? `Top ${k}` : "Overview"}</Button>)}</nav>
        {kind !== "tags" && <PeriodPicker def="overall" />}
      </div>
      {/* every item is of the `kind` asked for: the filters below only tell TypeScript which one */}
      <Async q={q}>{d => { const tags = d.items.filter(t => "taggers" in t); return (
        <>
          {kind === "artists" && <RankList kind="artist" items={d.items} rank={(page - 1) * 50 + 1} count="listeners" />}
          {kind === "albums" && <RankList kind="album" items={d.items} rank={(page - 1) * 50 + 1} count="listeners" />}
          {kind === "tracks" && <TrackList items={d.items.filter(t => "duration" in t)} rank={(page - 1) * 50 + 1} count="listeners" />}
          {kind === "tags" && (
            <table className="chartlist"><tbody>{tags.map((t, i) => (
              <tr key={t.name}><td className="c-rank">{(page - 1) * 50 + i + 1}</td><td className="c-name"><Link className="strong" to={tagUrl(t.name)}>{t.name}</Link></td>
                <td className="c-bar"><span className="bar"><span style={{ width: `${(t.count / tags[0].count) * 100}%` }} /><b>{num(t.count)}</b> <em>taggings</em></span></td></tr>
            ))}</tbody></table>
          )}
          <Pager total={d.total} limit={50} />
        </>
      ); }}</Async>
    </div>
  );
}
export function Charts() {
  const [sp] = useSearchParams();
  useTitle("Charts");
  return ["tracks", "artists", "albums", "tags"].includes(sp.get("kind") || "") ? <ChartList /> : <ChartsOverview />;
}
