import { Ico } from "../../icons";
import { useState, type CSSProperties, type FormEvent } from "react";
import { Button, Input } from "../../kit";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ago, albumUrl, api, artistUrl, date, plural, qs, tagUrl, trackUrl, useApi, useParam } from "../../lib";
import { Art, Async, Empty, Pager, useAction } from "../../ui/base";
import { TrackList, UserList } from "../../ui/lists";
import type { ObsessionRemoved, Obsessions as ObsessionList } from "../../../shared/obsessions";
import type { PlaylistCreated, UserPlaylists } from "../../../shared/playlists";
import type { TagCount } from "../../../shared/tags";
import type { Neighbours as NeighbourList, People as PeopleList, TaggedItem, UserLoved, UserTags as UserTagList } from "../../../shared/users";

const sixCols: CSSProperties & { "--cols": number } = { "--cols": 6 };
/** /user/tags sends the tags used, or with `tag` given, the things tagged with it: tell the two apart by shape. */
const isTagged = (i: TagCount | TaggedItem): i is TaggedItem => "type" in i;
const isTagCount = (i: TagCount | TaggedItem): i is TagCount => !isTagged(i);

// ---------- social tabs ----------
export function People({ path, empty }: { path: string; empty: string }) {
  const q = useApi<PeopleList>(path);
  return <Async q={q}>{d => d.items.length ? <UserList items={d.items} extra={u => u.lastTrack && <span className="small"><Link to={trackUrl(u.lastTrack.artist, u.lastTrack.title)}>{u.lastTrack.title}</Link> <span className="muted">- {u.lastTrack.artist} · {ago(u.lastTrack.playedAt)}</span></span>} /> : <Empty>{empty}</Empty>}</Async>;
}
export function Neighbours({ name }: { name: string }) {
  const q = useApi<NeighbourList>(`/user/neighbours${qs({ name })}`);
  return (
    <>
      <p className="muted">Soundalikes are listeners whose libraries overlap most with {name}'s, recalculated from everyone's scrobbles.</p>
      <Async q={q}>{d => d.items.length ? <UserList items={d.items} extra={u => (
        <span className="small"><b>{Math.round(u.match * 100)}% match</b>{u.shared.length > 0 && <span className="muted"> · both listen to {u.shared.map(a => a.name).join(", ")}</span>}</span>)} /> : <Empty>Not enough scrobbles to find neighbours yet.</Empty>}</Async>
    </>
  );
}
export function Loved({ name }: { name: string }) {
  const [sp] = useSearchParams(), page = Number(sp.get("page")) || 1;
  const q = useApi<UserLoved>(`/user/loved${qs({ name, page })}`);
  return <Async q={q}>{d => d.total ? <><p className="muted">{plural(d.total, "loved track")}</p><TrackList items={d.items.map(t => ({ ...t, playedAt: t.lovedAt }))} time /><Pager total={d.total} limit={d.limit} /></> : <Empty>No loved tracks yet. Hit the <Ico.Heart /> next to any track.</Empty>}</Async>;
}
export function Obsessions({ name, mine }: { name: string; mine: boolean }) {
  const q = useApi<ObsessionList>(`/user/obsessions${qs({ name })}`);
  return (
    <Async q={q}>{d => d.items.length ? (
      <ul className="obsessions">{d.items.map((o, i) => (
        <li key={o.id} className="obsession">
          <Link to={trackUrl(o.artist, o.title)}><Art image={o.image} /></Link>
          <div className="grow">{i === 0 && <span className="badge">Current</span>}<Link className="strong" to={trackUrl(o.artist, o.title)}>{o.title}</Link><Link className="muted" to={artistUrl(o.artist)}>{o.artist}</Link>
            {o.comment && <p>“{o.comment}”</p>}<span className="muted small">{date(o.createdAt)}</span></div>
          {mine && <Button kind="link small" onClick={() => api<ObsessionRemoved>(`/obsessions/${o.id}`, { method: "DELETE" }).then(q.reload)}>Remove</Button>}
        </li>
      ))}</ul>
    ) : <Empty>{mine ? "No earworms yet - open any track and choose “Set as earworm”." : "No earworms yet."}</Empty>}</Async>
  );
}
export function Playlists({ name, mine }: { name: string; mine: boolean }) {
  const q = useApi<UserPlaylists>(`/user/playlists${qs({ name })}`), nav = useNavigate();
  const [title, setTitle] = useState(""), act = useAction();
  const create = (e: FormEvent) => { e.preventDefault(); act.run(async () => { const r = await api<PlaylistCreated>("/playlists", { body: { title } }); nav(`/playlist/${r.id}`); }); };
  return (
    <>
      {mine && <form className="inline-form" onSubmit={create}><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="New playlist title" aria-label="New playlist title" maxLength={100} /><Button kind="btn" loading={act.busy} disabled={!title.trim()}>Create playlist</Button>{act.note}</form>}
      <Async q={q}>{d => d.items.length ? (
        <div className="grid" data-cols={6} style={sixCols}>{d.items.map(p => (
          <div className="tile" key={p.id}><Link to={`/playlist/${p.id}`}><Art image={p.image} /></Link><Link className="strong" to={`/playlist/${p.id}`}>{p.title}</Link><span className="muted small">{plural(p.trackCount, "track")}</span></div>
        ))}</div>
      ) : <Empty>No playlists yet.</Empty>}</Async>
    </>
  );
}
export function UserTags({ name }: { name: string }) {
  const [tag, setTag] = useParam("tag");
  const q = useApi<UserTagList>(`/user/tags${qs({ name, tag })}`);
  return (
    <Async q={q}>{d => tag ? (
      <>
        <div className="toolbar"><h2>Tagged “<Link to={tagUrl(tag)}>{tag}</Link>” by {name}</h2><Button kind="link" onClick={() => setTag("")}><Ico.Left /> All tags</Button></div>
        <ul className="plain">{d.items.filter(isTagged).map(i => (
          <li key={i.type + i.id}><span className="badge">{i.type}</span> <Link className="strong" to={i.type === "artist" ? artistUrl(i.name ?? "") : i.type === "album" ? albumUrl(i.artist ?? "", i.name ?? "") : trackUrl(i.artist ?? "", i.name ?? "")}>{i.name}</Link>{i.artist && <span className="muted"> - {i.artist}</span>}</li>
        ))}</ul>
      </>
    ) : d.items.length ? <div className="chips">{d.items.filter(isTagCount).map(t => <Button key={t.name} kind="chip" onClick={() => setTag(t.name)}>{t.name} <b>{t.count}</b></Button>)}</div> : <Empty>{name} hasn't tagged anything yet.</Empty>}</Async>
  );
}
