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
// /user/tags returns the tags used, or with `tag` set, the things tagged with it.
const isTagged = (i: TagCount | TaggedItem): i is TaggedItem => "type" in i;
const isTagCount = (i: TagCount | TaggedItem): i is TagCount => !isTagged(i);

type Person = PeopleList["items"][number];
type Neighbour = NeighbourList["items"][number];

function LastTrack({ u }: { u: Person }) {
  if (!u.lastTrack) return null;
  const t = u.lastTrack;
  return (
    <span className="text-[13px]">
      <Link to={trackUrl(t.artist, t.title)}>{t.title}</Link> <span className="text-muted">- {t.artist} · {ago(t.playedAt)}</span>
    </span>
  );
}

export function People({ path, empty }: { path: string; empty: string }) {
  const q = useApi<PeopleList>(path);
  return (
    <Async q={q}>
      {d => d.items.length ? <UserList items={d.items} extra={u => <LastTrack u={u} />} /> : <Empty>{empty}</Empty>}
    </Async>
  );
}

function Match({ u }: { u: Neighbour }) {
  return (
    <span className="text-[13px]">
      <b>{Math.round(u.match * 100)}% match</b>
      {u.shared.length > 0 && <span className="text-muted"> · both listen to {u.shared.map(a => a.name).join(", ")}</span>}
    </span>
  );
}

export function Neighbours({ name }: { name: string }) {
  const q = useApi<NeighbourList>(`/user/neighbours${qs({ name })}`);
  return (
    <>
      <p className="text-muted">Soundalikes are listeners whose libraries overlap most with {name}'s, recalculated from everyone's scrobbles.</p>
      <Async q={q}>
        {d => d.items.length
          ? <UserList items={d.items} extra={u => <Match u={u} />} />
          : <Empty>Not enough scrobbles to find neighbours yet.</Empty>}
      </Async>
    </>
  );
}

export function Loved({ name }: { name: string }) {
  const [sp] = useSearchParams();
  const page = Number(sp.get("page")) || 1;
  const q = useApi<UserLoved>(`/user/loved${qs({ name, page })}`);
  return (
    <Async q={q}>
      {d => d.total ? (
        <>
          <p className="text-muted">{plural(d.total, "loved track")}</p>
          <TrackList items={d.items.map(t => ({ ...t, playedAt: t.lovedAt }))} time />
          <Pager total={d.total} limit={d.limit} />
        </>
      ) : (
        <Empty>No loved tracks yet. Hit the <Ico.Heart /> next to any track.</Empty>
      )}
    </Async>
  );
}

export function Obsessions({ name, mine }: { name: string; mine: boolean }) {
  const q = useApi<ObsessionList>(`/user/obsessions${qs({ name })}`);
  const remove = (id: number) => api<ObsessionRemoved>(`/obsessions/${id}`, { method: "DELETE" }).then(q.reload);
  return (
    <Async q={q}>
      {d => d.items.length ? (
        <ul className="list-none m-0 p-0 [&>li]:flex [&>li]:gap-3 [&>li]:items-center [&>li]:py-2.5 [&>li]:border-b [&>li]:border-line">
          {d.items.map((o, i) => (
            <li key={o.id} className="flex gap-3 items-start [&>a]:w-[84px] [&>a]:flex-none [&>div>*]:block [&>div>*]:overflow-hidden [&>div>*]:text-ellipsis [&_p]:my-1">
              <Link to={trackUrl(o.artist, o.title)}><Art image={o.image} /></Link>
              <div className="flex-1 min-w-0">
                {i === 0 && <span className="inline-block text-[11px] uppercase tracking-[.05em] px-1.5 py-px font-medium bg-ink text-bg">Current</span>}
                <Link className="font-semibold" to={trackUrl(o.artist, o.title)}>{o.title}</Link>
                <Link className="text-muted" to={artistUrl(o.artist)}>{o.artist}</Link>
                {o.comment && <p>“{o.comment}”</p>}
                <span className="text-muted text-[13px]">{date(o.createdAt)}</span>
              </div>
              {mine && <Button kind="small" className="bg-transparent border-0 p-0 text-link font-semibold hover:underline" onClick={() => remove(o.id)}>Remove</Button>}
            </li>
          ))}
        </ul>
      ) : (
        <Empty>{mine ? "No earworms yet - open any track and choose “Set as earworm”." : "No earworms yet."}</Empty>
      )}
    </Async>
  );
}

export function Playlists({ name, mine }: { name: string; mine: boolean }) {
  const q = useApi<UserPlaylists>(`/user/playlists${qs({ name })}`);
  const nav = useNavigate();
  const [title, setTitle] = useState("");
  const act = useAction();

  const create = (e: FormEvent) => {
    e.preventDefault();
    act.run(async () => {
      const r = await api<PlaylistCreated>("/playlists", { body: { title } });
      nav(`/playlist/${r.id}`);
    });
  };

  return (
    <>
      {mine && (
        <form className="inline-form flex gap-2 items-center flex-wrap my-2.5 max-sm:[&>.field]:flex-[1_1_180px] max-sm:[&>.field]:min-w-0 max-sm:[&>.astryx-text-input]:flex-[1_1_180px] max-sm:[&>.astryx-text-input]:min-w-0 max-sm:[&>div:has(>.astryx-text-input)]:flex-[1_1_180px] max-sm:[&>div:has(>.astryx-text-input)]:min-w-0 coarse:[&>.astryx-button]:min-h-10 [&:has(.astryx-text-input)>.astryx-button]:min-h-10 [&:has(.astryx-text-input)>.astryx-button]:px-4 [&>.check]:items-center [&>.check]:gap-2 [&>.check]:ml-2.5 [&>.check]:leading-6 max-[641px]:[&>.check]:ml-0 max-sm:[&>.check]:basis-full max-sm:[&>.check]:min-h-10" onSubmit={create}>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="New playlist title" aria-label="New playlist title" maxLength={100} />
          <Button kind="btn" loading={act.busy} disabled={!title.trim()}>Create playlist</Button>
          {act.note}
        </form>
      )}
      <Async q={q}>
        {d => d.items.length ? (
          <div className="grid below" data-cols={6} style={sixCols}>
            {d.items.map(p => (
              <Link className="mcard" key={p.id} to={`/playlist/${p.id}`}>
                <Art image={p.image} />
                <strong>{p.title}</strong>
                <span>{plural(p.trackCount, "track")}</span>
              </Link>
            ))}
          </div>
        ) : (
          <Empty>No playlists yet.</Empty>
        )}
      </Async>
    </>
  );
}

function taggedUrl(i: TaggedItem) {
  if (i.type === "artist") return artistUrl(i.name ?? "");
  if (i.type === "album") return albumUrl(i.artist ?? "", i.name ?? "");
  return trackUrl(i.artist ?? "", i.name ?? "");
}

export function UserTags({ name }: { name: string }) {
  const [tag, setTag] = useParam("tag");
  const q = useApi<UserTagList>(`/user/tags${qs({ name, tag })}`);

  const body = (d: UserTagList) => {
    if (tag) {
      return (
        <>
          <div className="toolbar flex items-center justify-between gap-3.5 flex-wrap mb-3.5 max-sm:items-stretch max-sm:flex-col [&_.page-title]:mb-0 [&_.tabs]:mb-0 [&_.tabs]:flex-1">
            <h2>Tagged “<Link to={tagUrl(tag)}>{tag}</Link>” by {name}</h2>
            <Button className="bg-transparent border-0 p-0 text-link font-semibold hover:underline" onClick={() => setTag("")}><Ico.Left /> All tags</Button>
          </div>
          <ul className="list-none m-0 p-0 [&_li]:py-[7px] [&_li]:border-b [&_li]:border-line [&_li:last-child]:border-b-0">
            {d.items.filter(isTagged).map(i => (
              <li key={i.type + i.id}>
                <span className="inline-block text-[11px] uppercase tracking-[.05em] px-1.5 py-px font-medium bg-ink text-bg">{i.type}</span> <Link className="font-semibold" to={taggedUrl(i)}>{i.name}</Link>
                {i.artist && <span className="text-muted"> - {i.artist}</span>}
              </li>
            ))}
          </ul>
        </>
      );
    }
    if (!d.items.length) return <Empty>{name} hasn't tagged anything yet.</Empty>;
    return (
      <div className="inline-flex flex-wrap gap-1.5">
        {d.items.filter(isTagCount).map(t => <Button key={t.name} className="inline-block rounded-none bg-fill px-2.5 py-[3px] text-[13px] font-medium text-ink hover:bg-fill-hover hover:text-ink" onClick={() => setTag(t.name)}>{t.name} <b>{t.count}</b></Button>)}
      </div>
    );
  };

  return <Async q={q}>{body}</Async>;
}
