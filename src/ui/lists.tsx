import { Ico } from "../icons";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Button } from "../kit";
import { Link, useNavigate } from "react-router-dom";
import { ago, albumUrl, api, artistUrl, dateTime, dur, num, tagUrl, trackUrl, useAuth, userUrl } from "../lib";
import { PlayButton, type PTrack } from "../player";
import { Art, Empty, Avatar } from "./base";
import { UserLabels } from "./user-labels";
import type { ChartTag } from "../../shared/home";
import type { Loved, TopAlbum, TopArtist, TopTrack } from "../../shared/listening";
import type { Recommendation } from "../../shared/recommend";
import type { TagCount } from "../../shared/tags";
import type { FollowResult, PublicUser } from "../../shared/users";

export function LoveButton({
  track,
  loved,
  onChange,
  label,
}: {
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
    api<Loved>("/love", { body: { artist: track.artist, track: track.title, loved: next } }).then(
      () => onChange?.(next),
      () => setOn(!next)
    );
  };
  return (
    <Button
      kind={(label ? "btn ghost love" : "love") + (on ? " on" : "")}
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
export function TrackList<R extends Row>({
  items,
  count,
  rank,
  time,
  showArtist = true,
  showDuration,
  nowPlaying,
  actions,
  timeActions,
  onSelect,
  numbered,
  compact,
}: {
  items: R[];
  count?: "playcount" | "listeners";
  rank?: number;
  time?: boolean;
  showArtist?: boolean;
  showDuration?: boolean;
  nowPlaying?: Row | null;
  actions?: (row: TrackRow<R>) => ReactNode;
  timeActions?: (row: R) => ReactNode;
  onSelect?: (row: R) => void;
  numbered?: boolean;
  compact?: boolean;
}) {
  const rows: TrackRow<R>[] = nowPlaying ? [{ ...nowPlaying, _np: true }, ...items] : items;
  const max = count ? Math.max(1, ...items.map((i) => i[count] || 0)) : 1;
  const queue: PTrack[] = rows.map((r) => ({
    title: r.title,
    artist: r.artist,
    album: r.album,
    image: r.image,
    duration: r.duration,
  }));
  if (!rows.length) return <Empty>No tracks to show yet.</Empty>;
  return (
    <table className={compact ? "chartlist slim" : "chartlist"}>
      <thead className="sr-only">
        <tr>
          {(rank !== undefined || numbered) && <th scope="col">{numbered ? "Position" : "Rank"}</th>}
          <th scope="col">Playback</th>
          <th scope="col">Artwork</th>
          {!compact && <th scope="col">Love</th>}
          <th scope="col">Track</th>
          {showDuration && <th scope="col">Duration</th>}
          {actions && <th scope="col">Actions</th>}
          {count && <th scope="col">{count === "listeners" ? "Listeners" : "Scrobbles"}</th>}
          {time && <th scope="col">Played</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr
            key={r.id ?? `${r.artist}-${r.title}-${i}`}
            className={r._np ? "now" : onSelect ? "selectable" : ""}
            onMouseDownCapture={
              onSelect && !r._np
                ? (e) => {
                    // In-app links navigate on mousedown, before the selection click.
                    if (e.button === 0 && (e.target as Element).closest("a")) e.preventDefault();
                  }
                : undefined
            }
            onClickCapture={
              onSelect && !r._np
                ? (e) => {
                    if ((e.target as Element).closest("button, input, label")) return;
                    e.preventDefault();
                    e.stopPropagation();
                    onSelect(r);
                  }
                : undefined
            }
            onContextMenu={
              timeActions && !r._np
                ? (e) => {
                    if (e.defaultPrevented) return;
                    const trigger = e.currentTarget.querySelector<HTMLElement>("[data-scrobble-context-trigger]");
                    if (!trigger) return;
                    e.preventDefault();
                    // ContextMenu cannot wrap table rows, so forward their cursor coordinates.
                    trigger.dispatchEvent(
                      new MouseEvent("contextmenu", {
                        bubbles: true,
                        cancelable: true,
                        clientX: e.clientX,
                        clientY: e.clientY,
                        detail: e.detail,
                        button: 2,
                      })
                    );
                  }
                : undefined
            }
          >
            {(rank !== undefined || numbered) && (
              <td className="c-rank">{numbered ? r.position : rank! + i - (nowPlaying ? 1 : 0)}</td>
            )}
            <td className="c-play">
              <PlayButton queue={queue} index={i} />
            </td>
            <td className="c-art">
              <Link
                to={r.album ? albumUrl(r.artist, r.album) : trackUrl(r.artist, r.title)}
                aria-label={r.album || r.title}
                tabIndex={-1}
              >
                <Art image={r.image} />
              </Link>
            </td>
            {!compact && (
              <td className="c-love">
                <LoveButton track={r} loved={!!r.loved} />
              </td>
            )}
            <td className="c-name">
              <Link className="strong" to={trackUrl(r.artist, r.title)}>
                {r.title}
              </Link>
              {showArtist && (
                <Link className="muted" to={artistUrl(r.artist)}>
                  {r.artist}
                </Link>
              )}
            </td>
            {showDuration && <td className="c-dur">{dur(r.duration || 0)}</td>}
            {actions && <td className="c-actions">{actions(r)}</td>}
            {count && <CountCell value={r[count] || 0} max={max} unit={trackUnit(count, r[count])} plain={compact} />}
            {time && (
              <td className="c-time">
                <div className="track-tail">
                  {r._np ? (
                    <span className="np">
                      Scrobbling now{" "}
                      <i className="eq">
                        <i />
                        <i />
                        <i />
                      </i>
                    </span>
                  ) : (
                    <>
                      <span className="track-time" title={dateTime(r.playedAt!)}>
                        {ago(r.playedAt!)}
                      </span>
                      {timeActions && <div className="track-time-actions">{timeActions(r)}</div>}
                    </>
                  )}
                </div>
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
  if (plain)
    return (
      <td className="c-count">
        {num(value)} {unit}
      </td>
    );
  return (
    <td className="c-bar">
      <span className="bar">
        <span style={{ width: `${(value / max) * 100}%` }} />
        <b>{num(value)}</b> <em>{unit}</em>
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
export function RankList({
  items,
  kind,
  rank = 1,
  count = kind === "tag" ? "count" : "playcount",
  compact,
}: {
  items: RankItem[];
  kind: "artist" | "album" | "tag";
  rank?: number;
  count?: RankCount;
  compact?: boolean;
}) {
  const max = Math.max(1, ...items.map((i) => rankValue(i, count)));
  if (!items.length) return <Empty>Nothing to show for this period.</Empty>;
  return (
    <table className={compact ? "chartlist slim" : "chartlist"}>
      <tbody>
        {items.map((r, i) => {
          const name = "title" in r ? r.title : r.name;
          const artist = "artist" in r ? r.artist : "";
          const image = "image" in r ? r.image : null;
          const to = rankUrl(kind, name, artist);
          return (
            <tr key={"id" in r ? r.id : r.name}>
              <td className="c-rank">{rank + i}</td>
              {kind !== "tag" && (
                <td className={kind === "artist" ? "c-art round" : "c-art"}>
                  <Link to={to} tabIndex={-1}>
                    <Art image={image} kind={kind} />
                  </Link>
                </td>
              )}
              <td className="c-name">
                <Link className="strong" to={to}>
                  {name}
                </Link>
                {kind === "album" && (
                  <Link className="muted" to={artistUrl(artist)}>
                    {artist}
                  </Link>
                )}
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
      <Link className={`mcard ${kind}`} to={to}>
        <Art image={item.image} kind={kind} />
        <strong>{name}</strong>
        {caption}
      </Link>
    );
  }
  return (
    <Link className="rcard-img" to={to}>
      <Art image={item.image} kind={kind} />
      <span className="rcard-cap">
        <strong>{name}</strong>
        {kind === "album" && <span>{artist}</span>}
        {sub ? (
          <span>{sub}</span>
        ) : (
          kind === "artist" && item.listeners != null && <span>{listeners(item.listeners)}</span>
        )}
      </span>
    </Link>
  );
}

const tiles = "tiles grid grid-cols-4 gap-0 max-[700px]:grid-cols-2";

export function Grid<T extends CardItem>({
  items,
  kind,
  sub,
  cols = 6,
  lead,
  flush,
  below,
}: {
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
    return (
      <div className={tiles}>
        {items.map((it) => (
          <MediaCard key={it.id ?? cardName(it)} kind={kind} item={it} sub={sub?.(it)} />
        ))}
      </div>
    );
  }
  const style: CSSProperties & { "--cols": number } = { "--cols": cols };
  let className = "cardgrid";
  if (lead) className = "cardgrid lead";
  else if (below) className = "cardgrid below";
  return (
    <div className={className} data-cols={cols} style={style}>
      {items.map((it) => (
        <MediaCard key={it.id ?? cardName(it)} kind={kind} item={it} sub={sub?.(it)} below={below} />
      ))}
    </div>
  );
}

const REC_KIND = {
  artist: { title: "Artist", Badge: Ico.Star, color: "bg-[#f08a1c]" },
  album: { title: "Album", Badge: Ico.Disc, color: "bg-[#2e9d5b]" },
  track: { title: "Track", Badge: Ico.Music, color: "bg-[#2f7fd6]" },
};
const rec = "rec break-inside-avoid m-0 mb-5 min-[601px]:max-[900px]:mb-4 max-[600px]:mb-2.5";
const recBadge =
  "absolute z-2 right-2.5 -bottom-3.5 size-[30px] rounded-[50%] grid place-items-center " +
  "text-white border-2 border-white [&_svg]:size-[15px] " +
  "max-[600px]:size-6 max-[600px]:right-1.5 max-[600px]:-bottom-3 max-[600px]:[&_svg]:size-3";
const recWhy =
  "m-0 py-3 pr-12 pl-3 bg-site-panel border border-site-line [border-top:0] text-[13.5px] leading-[1.4] " +
  "text-site-ink-2 [&_a]:text-site-link max-[600px]:py-2 max-[600px]:pr-[30px] max-[600px]:pl-2 max-[600px]:text-[12.5px]";
export function RecCard({
  kind,
  item,
  because = [],
}: {
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
  const { title, Badge, color } = REC_KIND[kind];
  const similar = because.map((b, i) => (
    <span key={b}>
      {i > 0 && " & "}
      <Link to={artistUrl(b)}>{b}</Link>
    </span>
  ));
  return (
    <article className={rec}>
      <div className="rec-img relative">
        <Link className="rcard-img" to={to}>
          <Art image={item.image} kind={kind === "artist" ? "artist" : "album"} />
          <span className="rcard-cap">
            <strong>
              {name}
              {kind === "track" && duration > 0 && <i> ({dur(duration)})</i>}
            </strong>
            {kind !== "artist" && <span>{artist}</span>}
            {item.listeners != null && <span>{listeners(item.listeners)}</span>}
          </span>
        </Link>
        {kind === "track" && <PlayButton queue={[{ title: name, artist, album, image: item.image, duration }]} />}
        <span className={`${recBadge} ${color}`} title={title}>
          <Badge />
        </span>
      </div>
      <p className={recWhy}>
        {kind !== "artist" && (
          <>
            By <Link to={artistUrl(artist)}>{artist}</Link>
            {similar.length > 0 && ", similar to "}
          </>
        )}
        {kind === "artist" && similar.length > 0 && "Similar to "}
        {similar}
        {kind === "artist" &&
          !similar.length &&
          (via === "neighbours" ? "Popular with listeners like you" : "Picked from your listening")}
      </p>
    </article>
  );
}
export function UserList<U extends PublicUser & { playcount?: number }>({
  items,
  extra,
}: {
  items: U[];
  extra?: (u: U) => ReactNode;
}) {
  if (!items.length) return <Empty>No one here yet.</Empty>;
  return (
    <ul className="userlist">
      {items.map((u) => (
        <li key={u.username}>
          <Avatar user={u} size={56} />
          <div className="grow">
            <span>
              <Link className="strong" to={userUrl(u.username)}>
                <Username user={u} />
              </Link>
              <UserLabels name={u.username} />
            </span>
            {(u.realname || u.country) && (
              <span className="muted small">{[u.realname, u.country].filter(Boolean).join(" · ")}</span>
            )}
            {extra?.(u)}
          </div>
          {u.playcount !== undefined && <span className="muted small nowrap">{num(u.playcount)} scrobbles</span>}
        </li>
      ))}
    </ul>
  );
}
export function FollowButton({
  username,
  following,
  onChange,
}: {
  username: string;
  following: boolean;
  onChange?: (v: boolean) => void;
}) {
  const { me } = useAuth();
  const nav = useNavigate();
  const [on, setOn] = useState(following);
  useEffect(() => setOn(following), [following]);
  if (me?.username === username) return null;
  const toggle = () => {
    if (!me) return nav("/login");
    const next = !on;
    setOn(next);
    api<FollowResult>("/follow", { body: { username, follow: next } }).then(
      () => onChange?.(next),
      () => setOn(!next)
    );
  };
  return (
    <Button kind={on ? "btn ghost" : "btn"} onClick={toggle}>
      {on ? (
        <>
          <Ico.Check /> Following
        </>
      ) : (
        <>
          <Ico.Plus /> Follow
        </>
      )}
    </Button>
  );
}
import { Username } from "./username";
