import { Ico } from "../../icons";
import { Button } from "../../kit";
import { Link, useSearchParams } from "react-router-dom";
import { albumUrl, artistUrl, num, prefetch, qs, tagUrl, trackUrl, useApi, useParam, useTitle } from "../../lib";
import { Art, Async, Empty, Pager, PeriodPicker, Section } from "../../ui/base";
import { EventList } from "../../ui/events";
import { RankList, TrackList } from "../../ui/lists";
import { TagChips } from "../../ui/tags";
import type { ChartTag, Charts as ChartsData, Home } from "../../../shared/home";
import type { TopAlbum, TopArtist, TopTrack } from "../../../shared/listening";

const CHART_PERIODS: [string, string][] = [["7day", "This week"], ["1month", "This month"], ["12month", "This year"], ["overall", "All time"]];
const JUMPS = [["top-tracks", "Top Tracks"], ["top-artists", "Top Artists"], ["top-albums", "Top Albums"], ["top-tags", "Top Tags"]];
const LIST_KINDS = ["tracks", "artists", "albums", "tags"];

type ChartItem = TopTrack | TopArtist | TopAlbum | ChartTag;
type ChartColProps = { title: string; more: string } & (
  | { kind: "track"; items: TopTrack[] }
  | { kind: "artist"; items: TopArtist[] }
  | { kind: "album"; items: TopAlbum[] }
  | { kind: "tag"; items: ChartTag[] }
);

const itemName = (r: ChartItem) => ("name" in r ? r.name : r.title);
const itemArtist = (r: ChartItem) => ("artist" in r ? r.artist : undefined);

function itemUrl(kind: ChartColProps["kind"], r: ChartItem) {
  if (kind === "artist") return artistUrl(itemName(r));
  if (kind === "tag") return tagUrl(itemName(r));
  if (kind === "album") return albumUrl(itemArtist(r) ?? "", itemName(r));
  return trackUrl(itemArtist(r) ?? "", itemName(r));
}

const STRIP = "absolute inset-x-0 bottom-0 flex items-center gap-3 px-3 py-2.5 bg-[rgba(0,0,0,.72)]";
const STRIP_LINE = "block truncate leading-[1.3]";
const COVER = "[&>.art]:aspect-[16/11] max-[600px]:[&>.art]:aspect-video";

function ChartCol(props: ChartColProps) {
  const { title, kind, items, more } = props;
  const art = (r: ChartItem) => <Art image={"image" in r ? r.image : undefined} kind={kind === "artist" ? "artist" : "album"} />;
  const [top, ...rest] = items;
  const lead = kind !== "tag" && top;
  return (
    <section className="min-w-0 mb-10 scroll-mt-[70px] max-[600px]:mb-7" id={`top-${kind}s`}>
      <h2 className="text-[30px] mb-3.5 max-[600px]:text-[24px]"><Link className="hover:text-site-ink hover:underline" to={more}>{title}</Link></h2>
      {!items.length ? <Empty>Nothing charted for this period yet.</Empty> : (
        <>
          {lead && (
            <Link className={`group relative block text-white ${COVER}`} to={itemUrl(kind, lead)}>
              {art(lead)}
              <span className={STRIP}>
                <b className="flex-none w-[22px] text-center font-normal text-[15px] tabular-nums">1</b>
                <span className="block flex-none w-11">{art(lead)}</span>
                <span className="grow">
                  <strong className={`${STRIP_LINE} group-hover:underline`}>{itemName(lead)}</strong>
                  {kind !== "artist" && <span className={`${STRIP_LINE} text-[14px] text-[#d6d6d6]`}>{itemArtist(lead)}</span>}
                </span>
              </span>
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
  const path = (kind: string) => `/charts${qs({ kind, period: kind === "tags" ? undefined : period, limit: 10 })}`;
  // Start all five requests at once; otherwise each would wait for the one before it.
  for (const k of LIST_KINDS) prefetch(path(k));
  prefetch("/home");
  const get = <T extends ChartItem>(kind: string) => useApi<ChartsData<T>>(path(kind));
  const tracks = get<TopTrack>("tracks");
  const artists = get<TopArtist>("artists");
  const albums = get<TopAlbum>("albums");
  const tags = get<ChartTag>("tags");
  const home = useApi<Home>("/home");
  const p = period === "overall" ? "" : `&period=${period}`;
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ block: "start" });
  return (
    <div className="wrap page">
      <h1 className="page-title">Charts</h1>
      <nav className="tabs">
        {CHART_PERIODS.map(([k, l]) => <Button key={k} kind={k === period ? "active" : ""} onClick={() => setPeriod(k)}>{l}</Button>)}
      </nav>
      <p className="flex items-baseline gap-x-[18px] gap-y-1 flex-wrap -mt-2.5 mb-[26px] text-[14px] max-[600px]:mb-[18px]">
        <span className="text-site-muted">Jump to:</span>
        {JUMPS.map(([id, l]) => <Button key={id} kind="link text-[14px] font-medium" type="button" onClick={() => jump(id)}>{l}</Button>)}
      </p>
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

function TagTable({ tags, from }: { tags: ChartTag[]; from: number }) {
  return (
    <table className="chartlist">
      <tbody>
        {tags.map((t, i) => (
          <tr key={t.name}>
            <td className="c-rank">{from + i}</td>
            <td className="c-name"><Link className="strong" to={tagUrl(t.name)}>{t.name}</Link></td>
            <td className="c-bar">
              <span className="bar">
                <span style={{ width: `${(t.count / tags[0].count) * 100}%` }} />
                <b>{num(t.count)}</b> <em>taggings</em>
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ChartList() {
  const [kind, setKind] = useParam("kind", "");
  const [sp] = useSearchParams();
  const period = sp.get("period") || "overall";
  const page = Number(sp.get("page")) || 1;
  const from = (page - 1) * 50 + 1;
  const q = useApi<ChartsData>(`/charts${qs({ kind, period: kind === "tags" ? undefined : period, page, limit: 50 })}`);
  return (
    <div className="wrap page">
      <h1 className="page-title">Charts</h1>
      <div className="toolbar">
        <nav className="tabs">
          {["", ...LIST_KINDS].map(k => (
            <Button key={k} kind={k === kind ? "active" : ""} onClick={() => setKind(k)}>{k ? `Top ${k}` : "Overview"}</Button>
          ))}
        </nav>
        {kind !== "tags" && <PeriodPicker def="overall" />}
      </div>
      {/* Every item is of the `kind` asked for; the filters only tell TypeScript which one. */}
      <Async q={q}>
        {d => (
          <>
            {kind === "artists" && <RankList kind="artist" items={d.items} rank={from} count="listeners" />}
            {kind === "albums" && <RankList kind="album" items={d.items} rank={from} count="listeners" />}
            {kind === "tracks" && <TrackList items={d.items.filter(t => "duration" in t)} rank={from} count="listeners" />}
            {kind === "tags" && <TagTable tags={d.items.filter(t => "taggers" in t)} from={from} />}
            <Pager total={d.total} limit={50} />
          </>
        )}
      </Async>
    </div>
  );
}

export function Charts() {
  const [sp] = useSearchParams();
  useTitle("Charts");
  return LIST_KINDS.includes(sp.get("kind") || "") ? <ChartList /> : <ChartsOverview />;
}
