import { Ico } from "../icons";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Button } from "../kit";
import { Link, useNavigate } from "react-router-dom";
import { ago, albumUrl, api, artistUrl, dateTime, dur, num, tagUrl, trackUrl, useAuth, userUrl } from "../lib";
import { PlayButton, type PTrack } from "../player";
import { Art, Empty, Avatar } from "./base";
import { cn, chartlist, chartlistSlim, cRank, cPlay, cLove, cArt, cName, cDur, cTime, cCount, cActions, cBar, bar, barFill, barNum, barNote, np, eq, mcard, grid, gridBelow, love, loveOn } from "./tw";
import { UserLabels } from "./user-labels";
import type { ChartTag } from "../../shared/home";
import type { Loved, TopAlbum, TopArtist, TopTrack } from "../../shared/listening";
import type { Recommendation } from "../../shared/recommend";
import type { TagCount } from "../../shared/tags";
import type { FollowResult, PublicUser } from "../../shared/users";

export function LoveButton({ track, loved, onChange, label }: {
  track: { id?: number; trackId?: number; artist: string; title: string };
  loved: boolean | number;
  onChange?: (v: boolean) => void;
  label?: boolean;
}) {
  const { me } = useAuth();
  const nav = useNavigate();
  const [on, setOn] = useState(!!loved);
  useEffect(() => setOn(!!loved), [loved]);
  const toggle = () => {
    if (!me) return nav("/login");
    const next = !on;
    setOn(next);
    api<Loved>("/love", { body: { artist: track.artist, track: track.title, loved: next } })
      .then(() => onChange?.(next), () => setOn(!next));
  };
  return (
    <Button
      kind={label ? "btn ghost" : "bare"}
      className={cn(label ? "" : love, on && (label ? "border-accent text-link hero:text-ink" : loveOn))}
      aria-pressed={on}
      aria-label={on ? "Unlove this track" : "Love this track"}
      title={on ? "Unlove" : "Love"}
      onClick={toggle}
    >
      <Ico.Heart on={on} />
      {label && (on ? " Loved" : " Love")}
    </Button>
  );
}

type Row = {
  id?: number;
  trackId?: number;
  title: string;
  artist: string;
  album?: string | null;
  image?: string | null;
  duration?: number;
  playcount?: number;
  listeners?: number;
  loved?: number | boolean;
  playedAt?: number;
  position?: number;
};
/** A row as `actions` sees it: one of the items, or the "scrobbling now" row put in front of them. */
export type TrackRow<R extends Row> = (R & { _np?: false }) | (Row & { _np: true });
export function TrackList<R extends Row>({ items, count, rank, time, showArtist = true, showDuration, nowPlaying, actions, numbered, compact }: {
  items: R[];
  count?: "playcount" | "listeners";
  rank?: number;
  time?: boolean;
  showArtist?: boolean;
  showDuration?: boolean;
  nowPlaying?: Row | null;
  actions?: (row: TrackRow<R>) => ReactNode;
  numbered?: boolean;
  compact?: boolean;
}) {
  const rows: TrackRow<R>[] = nowPlaying ? [{ ...nowPlaying, _np: true }, ...items] : items;
  const max = count ? Math.max(1, ...items.map(i => i[count] || 0)) : 1;
  const queue: PTrack[] = rows.map(r => ({ title: r.title, artist: r.artist, album: r.album, image: r.image, duration: r.duration }));
  if (!rows.length) return <Empty>No tracks to show yet.</Empty>;
  return (
    <table className={cn(compact ? chartlistSlim : "", chartlist)}>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.id ?? `${r.artist}-${r.title}-${i}`} className={r._np ? "now" : ""}>
            {(rank !== undefined || numbered) && (
              <td className={cRank}>{numbered ? r.position : rank! + i - (nowPlaying ? 1 : 0)}</td>
            )}
            <td className={cPlay}><PlayButton queue={queue} index={i} /></td>
            <td className={cArt}>
              <Link to={r.album ? albumUrl(r.artist, r.album) : trackUrl(r.artist, r.title)} tabIndex={-1}><Art image={r.image} /></Link>
            </td>
            {!compact && <td className={cLove}><LoveButton track={r} loved={!!r.loved} /></td>}
            <td className={cName}>
              <Link className="font-semibold block truncate" to={trackUrl(r.artist, r.title)}>{r.title}</Link>
              {showArtist && <Link className="text-muted text-sm block truncate" to={artistUrl(r.artist)}>{r.artist}</Link>}
            </td>
            {showDuration && <td className={cDur}>{dur(r.duration || 0)}</td>}
            {actions && <td className={cActions}>{actions(r)}</td>}
            {count && <CountCell value={r[count] || 0} max={max} unit={trackUnit(count, r[count])} plain={compact} />}
            {time && (
              <td className={cTime}>
                {r._np
                  ? <span className={np}>Scrobbling now <i className={eq}><i /><i /><i /></i></span>
                  : <span title={dateTime(r.playedAt!)}>{ago(r.playedAt!)}</span>}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function trackUnit(count: "playcount" | "listeners", value: number | undefined) {
  if (count === "listeners") return "listeners";
  return value === 1 ? "scrobble" : "scrobbles";
}

function CountCell({ value, max, unit, plain }: { value: number; max: number; unit: string; plain?: boolean }) {
  if (plain) return <td className={cCount}>{num(value)} {unit}</td>;
  return (
    <td className={cBar}>
      <span className={bar}>
        <span className={barFill} style={{ width: `${(value / max) * 100}%` }} />
        <b className={barNum}>{num(value)}</b> <em className={barNote}>{unit}</em>
      </span>
    </td>
  );
}

type RankItem = TopArtist | TopAlbum | TopTrack | TagCount | ChartTag;
type RankCount = "playcount" | "listeners" | "count";
const RANK_UNIT: Record<RankCount, string> = { listeners: "listeners", count: "taggings", playcount: "scrobbles" };
function rankValue(r: RankItem, count: RankCount) {
  if (count === "count") return ("count" in r ? r.count : 0) || 0;
  if (count === "playcount") return ("playcount" in r ? r.playcount : 0) || 0;
  return ("listeners" in r ? r.listeners : 0) || 0;
}
function rankUrl(kind: "artist" | "album" | "tag", name: string, artist: string) {
  if (kind === "artist") return artistUrl(name);
  if (kind === "tag") return tagUrl(name);
  return albumUrl(artist, name);
}
export function RankList({ items, kind, rank = 1, count = kind === "tag" ? "count" : "playcount", compact }: {
  items: RankItem[];
  kind: "artist" | "album" | "tag";
  rank?: number;
  count?: RankCount;
  compact?: boolean;
}) {
  const max = Math.max(1, ...items.map(i => rankValue(i, count)));
  if (!items.length) return <Empty>Nothing to show for this period.</Empty>;
  return (
    <table className={cn(compact ? chartlistSlim : "", chartlist)}>
      <tbody>
        {items.map((r, i) => {
          const name = "title" in r ? r.title : r.name;
          const artist = "artist" in r ? r.artist : "";
          const image = "image" in r ? r.image : null;
          const to = rankUrl(kind, name, artist);
          return (
            <tr key={"id" in r ? r.id : r.name}>
              <td className={cRank}>{rank + i}</td>
              {kind !== "tag" && (
                <td className={cn(cArt, kind === "artist" ? "[&_.art]:rounded-none" : "")}>
                  <Link to={to} tabIndex={-1}><Art image={image} kind={kind} /></Link>
                </td>
              )}
              <td className={cName}>
                <Link className="font-semibold block truncate" to={to}>{name}</Link>
                {kind === "album" && <Link className="text-muted text-sm block truncate" to={artistUrl(artist)}>{artist}</Link>}
              </td>
              <CountCell value={rankValue(r, count)} max={max} unit={RANK_UNIT[count]} plain={compact} />
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

type CardKind = "artist" | "album";
type CardItem =
  | { id?: number; name: string; image?: string | null; listeners?: number }
  | { id?: number; title: string; artist: string; image?: string | null; listeners?: number };
const cardName = (it: CardItem) => ("name" in it ? it.name : it.title);
const listeners = (n: number) => `${num(n)} ${n === 1 ? "listener" : "listeners"}`;

function MediaCard({ kind, item, sub, below }: { kind: CardKind; item: CardItem; sub?: ReactNode; below?: boolean }) {
  const name = cardName(item);
  const artist = "artist" in item ? item.artist : "";
  const to = kind === "artist" ? artistUrl(name) : albumUrl(artist, name);
  if (below) {
    let caption = sub;
    if (!caption && item.listeners != null) caption = <span>{listeners(item.listeners)}</span>;
    else if (!caption && kind === "album") caption = <span>{artist}</span>;
    return (
      <Link className={cn(mcard, kind, kind === "artist" && "text-left")} to={to}>
        <Art image={item.image} kind={kind} />
        <strong>{name}</strong>
        {caption}
      </Link>
    );
  }
  return (
    <Link className="relative block text-white" to={to}>
      <Art image={item.image} kind={kind} />
      <span className="absolute z-[1] left-3 right-3 bottom-2.5 flex flex-col [.cards:is([data-cols='5'],[data-cols='6'])_&]:left-[9px] [.cards:is([data-cols='5'],[data-cols='6'])_&]:right-[9px] [.cards:is([data-cols='5'],[data-cols='6'])_&]:bottom-2 side:[.cards_&]:left-[9px] side:[.cards_&]:right-[9px] side:[.cards_&]:bottom-2 max-sm:[.tiles_&]:left-2 max-sm:[.tiles_&]:right-2 max-sm:[.tiles_&]:bottom-2">
        <strong className="text-lg [.tiles_&]:text-base leading-[1.2] truncate [.cards:is([data-cols='5'],[data-cols='6'])_&]:text-[15px] side:[.cards_&]:text-[15px] max-sm:[.tiles_&]:text-sm">{name}</strong>
        {kind === "album" && <span className="text-[13px] opacity-[.88] truncate [.cards:is([data-cols='5'],[data-cols='6'])_&]:text-xs side:[.cards_&]:text-xs">{artist}</span>}
        {sub ? <span className="text-[13px] opacity-[.88] truncate [.cards:is([data-cols='5'],[data-cols='6'])_&]:text-xs side:[.cards_&]:text-xs">{sub}</span> : kind === "artist" && item.listeners != null && <span className="text-[13px] opacity-[.88] truncate [.cards:is([data-cols='5'],[data-cols='6'])_&]:text-xs side:[.cards_&]:text-xs">{listeners(item.listeners)}</span>}
      </span>
    </Link>
  );
}

export function Grid<T extends CardItem>({ items, kind, sub, cols = 6, lead, flush, below }: {
  items: T[];
  kind: CardKind;
  sub?: (i: T) => ReactNode;
  cols?: number;
  lead?: boolean;
  flush?: boolean;
  below?: boolean;
}) {
  if (!items.length) return <Empty>Nothing to show yet.</Empty>;
  if (flush) {
    return <div className="tiles grid grid-cols-4 gap-0 max-md:grid-cols-2 max-md:[&>:last-child:nth-child(2n+1)]:col-span-full max-md:[&>:last-child:nth-child(2n+1)_.art]:aspect-[2/1]">{items.map(it => <MediaCard key={it.id ?? cardName(it)} kind={kind} item={it} sub={sub?.(it)} />)}</div>;
  }
  const style: CSSProperties & { "--cols": number } = { "--cols": cols };
  let className = grid;
  if (lead) className = cn(grid, "[&>:first-child]:col-span-2 [&>:first-child]:row-span-2 [&>:first-child_>_span>strong]:text-2xl max-md:[&>:first-child]:row-span-1 max-sm:[&>:first-child]:col-span-1");
  else if (below) className = cn(grid, gridBelow);
  return (
    <div className={className} data-cols={cols} style={style}>
      {items.map(it => <MediaCard key={it.id ?? cardName(it)} kind={kind} item={it} sub={sub?.(it)} below={below} />)}
    </div>
  );
}

const REC_KIND = {
  artist: { title: "Artist", Badge: Ico.Star },
  album: { title: "Album", Badge: Ico.Disc },
  track: { title: "Track", Badge: Ico.Music },
};
export function RecCard({ kind, item, because = [] }: {
  kind: "artist" | "album" | "track";
  item: Recommendation | TopAlbum | TopTrack;
  because?: string[];
}) {
  const via = "via" in item ? item.via : undefined;
  const name = "name" in item ? item.name : item.title;
  const artist = "artist" in item ? item.artist : "";
  const album = "album" in item ? item.album : null;
  const duration = "duration" in item ? item.duration : 0;
  let to = trackUrl(artist, name);
  if (kind === "artist") to = artistUrl(name);
  else if (kind === "album") to = albumUrl(artist, name);
  const { title, Badge } = REC_KIND[kind];
  const similar = because.map((b, i) => <span key={b}>{i > 0 && " & "}<Link to={artistUrl(b)}>{b}</Link></span>);
  return (
    <article className="break-inside-avoid mb-5 max-sm:mb-2.5">
      <div className="relative">
        <Link className="relative block text-white" to={to}>
          <Art image={item.image} kind={kind === "artist" ? "artist" : "album"} />
          <span className="absolute z-[1] left-3 right-11 bottom-2.5 flex flex-col max-sm:left-2 max-sm:right-[30px] max-sm:bottom-2">
            <strong className="text-lg leading-[1.2] whitespace-normal line-clamp-2 max-sm:text-sm">{name}{kind === "track" && duration > 0 && <i className="not-italic font-normal opacity-[.85]"> ({dur(duration)})</i>}</strong>
            {kind !== "artist" && <span className="text-[13px] opacity-[.88] truncate max-sm:text-xs">{artist}</span>}
            {item.listeners != null && <span className="text-[13px] opacity-[.88] truncate max-sm:text-xs max-sm:hidden">{listeners(item.listeners)}</span>}
          </span>
        </Link>
        {kind === "track" && <span className="absolute z-[2] top-2.5 left-2.5 [&_.astryx-button.play-btn]:w-9 [&_.astryx-button.play-btn]:h-9 [&_.astryx-button.play-btn]:bg-card [&_.astryx-button.play-btn]:text-ink [&_.astryx-button.play-btn]:border-edge"><PlayButton queue={[{ title: name, artist, album, image: item.image, duration }]} /></span>}
        <span className={"absolute z-[2] right-2.5 bottom-[-14px] w-[30px] h-[30px] rounded-full grid place-items-center text-white border-2 border-white max-sm:w-6 max-sm:h-6 max-sm:right-1.5 max-sm:bottom-[-12px] [&>svg]:w-[15px] [&>svg]:h-[15px] max-sm:[&>svg]:w-4 max-sm:[&>svg]:h-4 " + (kind === "track" ? "bg-[#2f7fd6]" : kind === "artist" ? "bg-[#f08a1c]" : "bg-[#2e9d5b]")} title={title}><Badge /></span>
      </div>
      <p className="m-0 px-3 py-3 bg-panel border border-line border-t-0 text-[13.5px] leading-[1.4] text-ink-2 max-sm:px-2 max-sm:py-2 max-sm:text-[12.5px]">
        {kind !== "artist" && <>By <Link to={artistUrl(artist)}>{artist}</Link>{similar.length > 0 && ", similar to "}</>}
        {kind === "artist" && similar.length > 0 && "Similar to "}
        {similar}
        {kind === "artist" && !similar.length && (via === "neighbours" ? "Popular with listeners like you" : "Picked from your listening")}
      </p>
    </article>
  );
}
export function UserList<U extends PublicUser & { playcount?: number }>({ items, extra }: { items: U[]; extra?: (u: U) => ReactNode }) {
  if (!items.length) return <Empty>No one here yet.</Empty>;
  return (
    <ul className="userlist list-none m-0 p-0 [.listeners2_&]:grid [.listeners2_&]:grid-cols-2 [.listeners2_&]:gap-x-7 max-md:[.listeners2_&]:grid-cols-1">
      {items.map(u => (
        <li key={u.username} className="flex gap-3 items-center py-2.5 border-b border-line [.listeners2_&]:border-b-0 [.listeners2_&]:py-1.5">
          <Avatar user={u} size={56} className="side:size-10! [.listeners2_&]:size-11!" />
          <div className="flex-1 min-w-0 *:block *:overflow-hidden *:text-ellipsis">
            <Link className="font-semibold" to={userUrl(u.username)}>{u.username}</Link> <UserLabels name={u.username} />
            {(u.realname || u.country) && <span className="text-muted text-[13px]">{[u.realname, u.country].filter(Boolean).join(" · ")}</span>}
            {extra?.(u)}
          </div>
          {u.playcount !== undefined && <span className="text-muted text-[13px] whitespace-nowrap">{num(u.playcount)} scrobbles</span>}
        </li>
      ))}
    </ul>
  );
}
export function FollowButton({ username, following, onChange }: { username: string; following: boolean; onChange?: (v: boolean) => void }) {
  const { me } = useAuth();
  const nav = useNavigate();
  const [on, setOn] = useState(following);
  useEffect(() => setOn(following), [following]);
  if (me?.username === username) return null;
  const toggle = () => {
    if (!me) return nav("/login");
    const next = !on;
    setOn(next);
    api<FollowResult>("/follow", { body: { username, follow: next } })
      .then(() => onChange?.(next), () => setOn(!next));
  };
  return <Button kind={on ? "btn ghost" : "btn"} onClick={toggle}>{on ? <><Ico.Check /> Following</> : <><Ico.Plus /> Follow</>}</Button>;
}
