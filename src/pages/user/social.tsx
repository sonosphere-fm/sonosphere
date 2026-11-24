import { Ico } from "../../icons";
import { useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { Username } from "../../ui/username";
import { Button, Input } from "../../kit";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ago, albumUrl, api, artistUrl, date, qs, tagUrl, trackUrl, useApi, useParam } from "../../lib";
import { t, tx } from "../../i18n";
import { Art, Async, Empty, Pager, Section, useAction } from "../../ui/base";
import { TrackList, UserList } from "../../ui/lists";
import type { ObsessionRemoved, Obsessions as ObsessionList } from "../../../shared/obsessions";
import { type PlaylistCreated, TEMPLATE_IDS, type TemplateId, type UserPlaylists } from "../../../shared/playlists";
import type { TagCount } from "../../../shared/tags";
import type {
  Neighbours as NeighbourList,
  People as PeopleList,
  TaggedItem,
  UserLoved,
  UserTags as UserTagList,
} from "../../../shared/users";

const sixCols: CSSProperties & { "--cols": number } = { "--cols": 6 };
// /user/tags returns the tags used, or with `tag` set, the things tagged with it.
const isTagged = (i: TagCount | TaggedItem): i is TaggedItem => "type" in i;
const isTagCount = (i: TagCount | TaggedItem): i is TagCount => !isTagged(i);

type Person = PeopleList["items"][number];
type Neighbour = NeighbourList["items"][number];

function LastTrack({ u }: { u: Person }) {
  if (!u.lastTrack) return null;
  const last = u.lastTrack;
  return (
    <span className="small">
      <Link to={trackUrl(last.artist, last.title)}>{last.title}</Link>{" "}
      <span className="muted">
        - {last.artist} · {ago(last.playedAt)}
      </span>
    </span>
  );
}

export function People({ path, empty }: { path: string; empty: ReactNode }) {
  const q = useApi<PeopleList>(path);
  return (
    <Async q={q}>
      {(d) =>
        d.items.length ? <UserList items={d.items} extra={(u) => <LastTrack u={u} />} /> : <Empty>{empty}</Empty>
      }
    </Async>
  );
}

function Match({ u }: { u: Neighbour }) {
  return (
    <span className="small">
      <b>{t("user.match", { pct: Math.round(u.match * 100) })}</b>
      {u.shared.length > 0 && (
        <span className="muted"> · {t("user.matchShared", { artists: u.shared.map((a) => a.name).join(", ") })}</span>
      )}
    </span>
  );
}

export function Neighbours({ name }: { name: string }) {
  const q = useApi<NeighbourList>(`/user/neighbours${qs({ name })}`);
  return (
    <>
      <p className="muted">{tx("user.soundalikesIntro", { name: <Username name={name} /> })}</p>
      <Async q={q}>
        {(d) =>
          d.items.length ? (
            <UserList items={d.items} extra={(u) => <Match u={u} />} />
          ) : (
            <Empty>{t("user.noNeighbours")}</Empty>
          )
        }
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
      {(d) =>
        d.total ? (
          <>
            <p className="muted">{t("user.lovedTrackCount", { count: d.total })}</p>
            <TrackList items={d.items.map((l) => ({ ...l, playedAt: l.lovedAt }))} time />
            <Pager total={d.total} limit={d.limit} />
          </>
        ) : (
          <Empty>{tx("user.noLovedTracks", { heart: <Ico.Heart /> })}</Empty>
        )
      }
    </Async>
  );
}

export function Obsessions({ name, mine }: { name: string; mine: boolean }) {
  const q = useApi<ObsessionList>(`/user/obsessions${qs({ name })}`);
  const remove = (id: number) => api<ObsessionRemoved>(`/obsessions/${id}`, { method: "DELETE" }).then(q.reload);
  return (
    <Async q={q}>
      {(d) =>
        d.items.length ? (
          <ul className="obsessions">
            {d.items.map((o, i) => (
              <li key={o.id} className={i === 0 ? "obsession current" : "obsession"}>
                <Link to={trackUrl(o.artist, o.title)}>
                  <Art image={o.image} />
                </Link>
                <div className="grow">
                  {i === 0 && <span className="badge">{t("user.current")}</span>}
                  <Link className="strong" to={trackUrl(o.artist, o.title)}>
                    {o.title}
                  </Link>
                  <Link className="muted" to={artistUrl(o.artist)}>
                    {o.artist}
                  </Link>
                  {o.comment && <p>“{o.comment}”</p>}
                  <span className="muted small">{date(o.createdAt)}</span>
                </div>
                {mine && (
                  <Button kind="link small" onClick={() => remove(o.id)}>
                    {t("user.remove")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>{mine ? t("user.noEarwormsMine") : t("user.noEarworms")}</Empty>
        )
      }
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

  const fromTemplate = (template: TemplateId) =>
    act.run(async () => {
      const r = await api<PlaylistCreated>("/playlists/template", { body: { template } });
      nav(`/playlist/${r.id}`);
    });

  return (
    <>
      {mine && (
        <form className="inline-form" onSubmit={create}>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("user.newPlaylistTitle")}
            aria-label={t("user.newPlaylistTitle")}
            maxLength={100}
          />
          <Button kind="btn" loading={act.busy} disabled={!title.trim()}>
            {t("user.createPlaylist")}
          </Button>
          {act.note}
        </form>
      )}
      {mine && (
        <Section title={t("user.startFromTemplate")}>
          <div className="templates">
            {TEMPLATE_IDS.map((id) => (
              <button type="button" key={id} disabled={act.busy} onClick={() => fromTemplate(id)}>
                <strong>{t(`playlists.${id}Title`)}</strong>
                <span>{t(`playlists.${id}Blurb`)}</span>
              </button>
            ))}
          </div>
        </Section>
      )}
      <Async q={q}>
        {(d) =>
          d.items.length ? (
            <div className="cardgrid below" data-cols={6} style={sixCols}>
              {d.items.map((p) => (
                <Link className="mcard album" key={p.id} to={`/playlist/${p.id}`}>
                  <Art image={p.image} />
                  <strong>{p.title}</strong>
                  <span>{t("user.trackCount", { count: p.trackCount })}</span>
                </Link>
              ))}
            </div>
          ) : (
            <Empty>{t("user.noPlaylists")}</Empty>
          )
        }
      </Async>
    </>
  );
}

function taggedType(i: TaggedItem) {
  if (i.type === "artist") return t("user.badgeArtist");
  if (i.type === "album") return t("user.badgeAlbum");
  return t("user.badgeTrack");
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
          <div className="toolbar">
            <h2>{tx("user.taggedBy", { tag: <Link to={tagUrl(tag)}>{tag}</Link>, name: <Username name={name} /> })}</h2>
            <Button kind="link" onClick={() => setTag("")}>
              <Ico.Left /> {t("user.allTags")}
            </Button>
          </div>
          <ul className="plain">
            {d.items.filter(isTagged).map((i) => (
              <li key={i.type + i.id}>
                <span className="badge">{taggedType(i)}</span>{" "}
                <Link className="strong" to={taggedUrl(i)}>
                  {i.name}
                </Link>
                {i.artist && <span className="muted"> - {i.artist}</span>}
              </li>
            ))}
          </ul>
        </>
      );
    }
    if (!d.items.length) return <Empty>{tx("user.notTagged", { name: <Username name={name} /> })}</Empty>;
    return (
      <div className="chips">
        {d.items.filter(isTagCount).map((tc) => (
          <Button key={tc.name} kind="chip" onClick={() => setTag(tc.name)}>
            {tc.name} <b>{tc.count}</b>
          </Button>
        ))}
      </div>
    );
  };

  return <Async q={q}>{body}</Async>;
}
