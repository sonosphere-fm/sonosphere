import { Ico } from "../icons";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Button } from "../kit";
import { Link, useNavigate } from "react-router-dom";
import { ago, albumUrl, api, artistUrl, dateTime, dur, num, tagUrl, trackUrl, useAuth, userUrl } from "../lib";
import { PlayButton, type PTrack } from "../player";
import { Art, Empty, Avatar } from "./base";
import type { ChartTag } from "../../shared/home";
import type { Loved, TopAlbum, TopArtist, TopTrack } from "../../shared/listening";
import type { Recommendation } from "../../shared/recommend";
import type { TagCount } from "../../shared/tags";
import type { FollowResult, PublicUser } from "../../shared/users";

// ---------- love ----------
export function LoveButton({ track, loved, onChange, label }: { track: { id?: number; trackId?: number; artist: string; title: string }; loved: boolean | number; onChange?: (v: boolean) => void; label?: boolean }) {
  const { me } = useAuth(), nav = useNavigate();
  const [on, setOn] = useState(!!loved);
  useEffect(() => setOn(!!loved), [loved]);
  const toggle = () => {
    if (!me) return nav("/login");
    const next = !on; setOn(next);
    api<Loved>("/love", { body: { artist: track.artist, track: track.title, loved: next } }).then(() => onChange?.(next), () => setOn(!next));
  };
  return <Button kind={(label ? "btn ghost love" : "love") + (on ? " on" : "")} aria-pressed={on} aria-label={on ? "Unlove this track" : "Love this track"} title={on ? "Unlove" : "Love"} onClick={toggle}><Ico.Heart on={on} />{label && (on ? " Loved" : " Love")}</Button>;
}

// ---------- chart list (tracks) ----------
/** What a track row needs: every track shape the API sends (chart, recent, album, playlist, search...) fits it. */
type Row = { id?: number; trackId?: number; title: string; artist: string; album?: string | null; image?: string | null; duration?: number; playcount?: number; listeners?: number; loved?: number | boolean; playedAt?: number; position?: number };
/** A row as `actions` sees it: one of the items, or the "scrobbling now" row put in front of them. */
export type TrackRow<R extends Row> = (R & { _np?: false }) | (Row & { _np: true });
export function TrackList<R extends Row>({ items, count, rank, time, showArtist = true, showDuration, nowPlaying, actions, numbered, compact }: {
  items: R[]; count?: "playcount" | "listeners"; rank?: number; time?: boolean; showArtist?: boolean; showDuration?: boolean; nowPlaying?: Row | null; actions?: (row: TrackRow<R>) => ReactNode; numbered?: boolean; compact?: boolean;
}) {
  const rows: TrackRow<R>[] = nowPlaying ? [{ ...nowPlaying, _np: true }, ...items] : items;
  const max = count ? Math.max(1, ...items.map(i => i[count] || 0)) : 1;
  const queue: PTrack[] = rows.map(r => ({ title: r.title, artist: r.artist, album: r.album, image: r.image, duration: r.duration }));
  if (!rows.length) return <Empty>No tracks to show yet.</Empty>;
  return (
    <table className={compact ? "chartlist slim" : "chartlist"}>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.id ?? `${r.artist}-${r.title}-${i}`} className={r._np ? "now" : ""}>
            {(rank !== undefined || numbered) && <td className="c-rank">{numbered ? r.position : rank! + i - (nowPlaying ? 1 : 0)}</td>}
            <td className="c-play"><PlayButton queue={queue} index={i} /></td>
            <td className="c-art"><Link to={r.album ? albumUrl(r.artist, r.album) : trackUrl(r.artist, r.title)} tabIndex={-1}><Art image={r.image} /></Link></td>
            {!compact && <td className="c-love"><LoveButton track={r} loved={!!r.loved} /></td>}
            <td className="c-name">
              <Link className="strong" to={trackUrl(r.artist, r.title)}>{r.title}</Link>
              {showArtist && <Link className="muted" to={artistUrl(r.artist)}>{r.artist}</Link>}
            </td>
            {showDuration && <td className="c-dur">{dur(r.duration || 0)}</td>}
            {actions && <td className="c-actions">{actions(r)}</td>}
            {count && <CountCell value={r[count] || 0} max={max} unit={count === "listeners" ? "listeners" : r[count] === 1 ? "scrobble" : "scrobbles"} plain={compact} />}
            {time && <td className="c-time">{r._np ? <span className="np">Scrobbling now <i className="eq"><i /><i /><i /></i></span> : <span title={dateTime(r.playedAt!)}>{ago(r.playedAt!)}</span>}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The count at the end of a list row: a bar on full-width lists, plain text in narrow columns. */
const CountCell = ({ value, max, unit, plain }: { value: number; max: number; unit: string; plain?: boolean }) => plain
  ? <td className="c-count">{num(value)} {unit}</td>
  : <td className="c-bar"><span className="bar"><span style={{ width: `${(value / max) * 100}%` }} /><b>{num(value)}</b> <em>{unit}</em></span></td>;

/** Ranked list of artists, albums or tags (charts and library pages). */
type RankItem = TopArtist | TopAlbum | TopTrack | TagCount | ChartTag;
type RankCount = "playcount" | "listeners" | "count";
const rankValue = (r: RankItem, count: RankCount) =>
  (count === "count" ? ("count" in r ? r.count : 0) : count === "playcount" ? ("playcount" in r ? r.playcount : 0) : "listeners" in r ? r.listeners : 0) || 0;
export function RankList({ items, kind, rank = 1, count = kind === "tag" ? "count" : "playcount", compact }: { items: RankItem[]; kind: "artist" | "album" | "tag"; rank?: number; count?: RankCount; compact?: boolean }) {
  const max = Math.max(1, ...items.map(i => rankValue(i, count)));
  if (!items.length) return <Empty>Nothing to show for this period.</Empty>;
  return (
    <table className={compact ? "chartlist slim" : "chartlist"}>
      <tbody>
        {items.map((r, i) => {
          const name = "title" in r ? r.title : r.name, artist = "artist" in r ? r.artist : "", image = "image" in r ? r.image : null;
          const to = kind === "artist" ? artistUrl(name) : kind === "tag" ? tagUrl(name) : albumUrl(artist, name);
          return (
            <tr key={"id" in r ? r.id : r.name}>
              <td className="c-rank">{rank + i}</td>
              {kind !== "tag" && <td className={kind === "artist" ? "c-art round" : "c-art"}><Link to={to} tabIndex={-1}><Art image={image} kind={kind} /></Link></td>}
              <td className="c-name"><Link className="strong" to={to}>{name}</Link>{kind === "album" && <Link className="muted" to={artistUrl(artist)}>{artist}</Link>}</td>
              <CountCell value={rankValue(r, count)} max={max} unit={count === "listeners" ? "listeners" : count === "count" ? "taggings" : "scrobbles"} plain={compact} />
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ---------- grids ----------
type CardKind = "artist" | "album";
/** An artist (by `name`) or an album (by `title` and `artist`), as any list of them arrives from the API. */
type CardItem = { id?: number; name: string; image?: string | null; listeners?: number } | { id?: number; title: string; artist: string; image?: string | null; listeners?: number };
const cardName = (it: CardItem) => ("name" in it ? it.name : it.title);
const listeners = (n: number) => `${num(n)} ${n === 1 ? "listener" : "listeners"}`;

/** The one artist/album card: a square picture with the name and a line or two of detail laid over it. */
function MediaCard({ kind, item, sub, below }: { kind: CardKind; item: CardItem; sub?: ReactNode; below?: boolean }) {
  const name = cardName(item), artist = "artist" in item ? item.artist : "";
  // `below`: the detail-page card, picture (round for artists) with its caption underneath
  if (below) return (
    <Link className={`mcard ${kind}`} to={kind === "artist" ? artistUrl(name) : albumUrl(artist, name)}>
      <Art image={item.image} kind={kind} />
      <strong>{name}</strong>
      {sub ? sub : item.listeners != null ? <span>{listeners(item.listeners)}</span> : kind === "album" && <span>{artist}</span>}
    </Link>
  );
  return (
    <Link className="rcard-img" to={kind === "artist" ? artistUrl(name) : albumUrl(artist, name)}>
      <Art image={item.image} kind={kind} />
      <span className="rcard-cap">
        <strong>{name}</strong>
        {kind === "album" && <span>{artist}</span>}
        {sub ? <span>{sub}</span> : kind === "artist" && item.listeners != null && <span>{listeners(item.listeners)}</span>}
      </span>
    </Link>
  );
}

/** Every grid of artists or albums. `flush` drops the gaps (search results); `lead` doubles the first card. */
export function Grid<T extends CardItem>({ items, kind, sub, cols = 6, lead, flush, below }: { items: T[]; kind: CardKind; sub?: (i: T) => ReactNode; cols?: number; lead?: boolean; flush?: boolean; below?: boolean }) {
  if (!items.length) return <Empty>Nothing to show yet.</Empty>;
  if (flush) return <div className="tiles">{items.map(it => <MediaCard key={it.id ?? cardName(it)} kind={kind} item={it} sub={sub?.(it)} />)}</div>;
  const style: CSSProperties & { "--cols": number } = { "--cols": cols };
  return (
    <div className={lead ? "grid lead" : below ? "grid below" : "grid"} data-cols={cols} style={style}>
      {items.map(it => <MediaCard key={it.id ?? cardName(it)} kind={kind} item={it} sub={sub?.(it)} below={below} />)}
    </div>
  );
}

/** One recommendation: picture with caption, a badge for what it is, and the reason underneath. */
export function RecCard({ kind, item, because = [] }: { kind: "artist" | "album" | "track"; item: Recommendation | TopAlbum | TopTrack; because?: string[] }) {
  const via = "via" in item ? item.via : undefined;
  const name = "name" in item ? item.name : item.title, artist = "artist" in item ? item.artist : "";
  const album = "album" in item ? item.album : null, duration = "duration" in item ? item.duration : 0;
  const to = kind === "artist" ? artistUrl(name) : kind === "album" ? albumUrl(artist, name) : trackUrl(artist, name);
  const Badge = kind === "artist" ? Ico.Star : kind === "album" ? Ico.Disc : Ico.Music;
  const similar = because.map((b, i) => <span key={b}>{i > 0 && " & "}<Link to={artistUrl(b)}>{b}</Link></span>);
  return (
    <article className="rec">
      <div className="rec-img">
        <Link className="rcard-img" to={to}>
          <Art image={item.image} kind={kind === "artist" ? "artist" : "album"} />
          <span className="rcard-cap">
            <strong>{name}{kind === "track" && duration > 0 && <i> ({dur(duration)})</i>}</strong>
            {kind !== "artist" && <span>{artist}</span>}
            {item.listeners != null && <span>{listeners(item.listeners)}</span>}
          </span>
        </Link>
        {kind === "track" && <PlayButton queue={[{ title: name, artist, album, image: item.image, duration }]} />}
        <span className={`rec-badge ${kind}`} title={kind === "artist" ? "Artist" : kind === "album" ? "Album" : "Track"}><Badge /></span>
      </div>
      <p className="rec-why">
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
    <ul className="userlist">
      {items.map(u => (
        <li key={u.username}>
          <Avatar user={u} size={56} />
          <div className="grow">
            <Link className="strong" to={userUrl(u.username)}>{u.username}</Link>
            {(u.realname || u.country) && <span className="muted small">{[u.realname, u.country].filter(Boolean).join(" · ")}</span>}
            {extra?.(u)}
          </div>
          {u.playcount !== undefined && <span className="muted small nowrap">{num(u.playcount)} scrobbles</span>}
        </li>
      ))}
    </ul>
  );
}
export function FollowButton({ username, following, onChange }: { username: string; following: boolean; onChange?: (v: boolean) => void }) {
  const { me } = useAuth(), nav = useNavigate();
  const [on, setOn] = useState(following);
  useEffect(() => setOn(following), [following]);
  if (me?.username === username) return null;
  const toggle = () => {
    if (!me) return nav("/login");
    const next = !on; setOn(next);
    api<FollowResult>("/follow", { body: { username, follow: next } }).then(() => onChange?.(next), () => setOn(!next));
  };
  return <Button kind={on ? "btn ghost" : "btn"} onClick={toggle}>{on ? <><Ico.Check /> Following</> : <><Ico.Plus /> Follow</>}</Button>;
}
