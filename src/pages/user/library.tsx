import { DatePicker } from "../../datepicker";
import { useEffect, useState, type FormEvent } from "react";
import { Button, Input, Select, Modal } from "../../kit";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, artistUrl, date, invalidateAll, enc, num, plural, qs, useApi, userUrl } from "../../lib";
import { Art, Async, Empty, Pager, PeriodPicker, Section, Stat, useAction } from "../../ui/base";
import { BarChart, weekTrend } from "../../ui/charts";
import { Grid, RankList, TrackList, type TrackRow } from "../../ui/lists";
import type { Ok } from "../../lib";
import type {
  EditScope,
  RecentTrack,
  ScopeCounts,
  ScrobbleEdited,
  ScrobblesDeleted,
  TopAlbum,
  TopArtist,
  TopTrack,
} from "../../../shared/listening";
import type { UserArtistLibrary, UserRecent, UserTop } from "../../../shared/users";

// One cached path serves either /user/recent or /user/top (by `kind`), so rows are told apart by shape.
type LibraryRow = RecentTrack | TopArtist | TopAlbum | TopTrack;
const isRecent = (i: LibraryRow): i is RecentTrack => "playedAt" in i;
const isArtist = (i: LibraryRow): i is TopArtist => !("title" in i);
const isAlbum = (i: LibraryRow): i is TopAlbum => "title" in i && !("duration" in i);
const isTopTrack = (i: LibraryRow): i is TopTrack => "duration" in i && "listeners" in i;

type Scope = "one" | EditScope;
const toScope = (v: string): Scope => (v === "track" || v === "album" || v === "artist" ? v : "one");

function toTs(d: string, end = false) {
  if (!d) return undefined;
  return Math.floor(new Date(d + "T00:00:00").getTime() / 1000) + (end ? 86400 : 0);
}

const LIBRARY_TABS = [
  ["", "Scrobbles"],
  ["/artists", "Artists"],
  ["/albums", "Albums"],
  ["/tracks", "Tracks"],
];

function DateRange() {
  const [sp, setSp] = useSearchParams();
  const from = sp.get("from") || "";
  const to = sp.get("to") || "";

  const set = (k: string, v: string) =>
    setSp((prev) => {
      const n = new URLSearchParams(prev);
      if (v) n.set(k, v);
      else n.delete(k);
      n.delete("page");
      return n;
    });

  const clear = () =>
    setSp((prev) => {
      const n = new URLSearchParams(prev);
      n.delete("from");
      n.delete("to");
      return n;
    });

  return (
    <span className="daterange">
      <label>
        From{" "}
        <DatePicker
          compact
          label="From"
          placeholder="Any date"
          value={from}
          onChange={(v) => set("from", v)}
          max={to || "now"}
        />
      </label>
      <label>
        to{" "}
        <DatePicker
          compact
          label="To"
          placeholder="Any date"
          value={to}
          onChange={(v) => set("to", v)}
          min={from || undefined}
          max="now"
        />
      </label>
      {from || to ? (
        <Button kind="link" onClick={clear}>
          Clear
        </Button>
      ) : (
        <PeriodPicker />
      )}
    </span>
  );
}

function EditScrobble({ row, onClose, onSaved }: { row: RecentTrack; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ artist: row.artist, track: row.title, album: row.album || "" });
  const [scope, setScope] = useState<Scope>("one");
  const act = useAction();
  const counts = useApi<ScopeCounts>(`/scrobble/${row.id}/scope`).data;

  const field = (k: keyof typeof f, label: string) => (
    <label>
      {label}
      <Input
        value={f[k]}
        onChange={(e) => setF({ ...f, [k]: e.target.value })}
        required={k !== "album"}
        maxLength={255}
      />
    </label>
  );

  // The wider the correction, the fewer fields it can sensibly change.
  const options: [string, string][] = [["one", "This scrobble only"]];
  if ((counts?.track ?? 0) > 1) options.push(["track", `All ${num(counts?.track)} scrobbles of this track`]);
  if ((counts?.album ?? 0) > 1) options.push(["album", `All ${num(counts?.album)} scrobbles from this album`]);
  if ((counts?.artist ?? 0) > 1) options.push(["artist", `All ${num(counts?.artist)} scrobbles by this artist`]);
  const n = scope === "one" ? 1 : (counts?.[scope] ?? 1);

  const save = (e: FormEvent) => {
    e.preventDefault();
    act.run(async () => {
      await api<ScrobbleEdited>(`/scrobble/${row.id}`, {
        method: "PATCH",
        body: scope === "one" ? f : { ...f, scope },
      });
      if (scope !== "one") invalidateAll();
      onSaved();
      onClose();
    });
  };

  return (
    <Modal title="Edit scrobble" onClose={onClose}>
      <form className="form" onSubmit={save}>
        {options.length > 1 && (
          <label>
            Apply to
            <Select label="Apply to" value={scope} onChange={(v) => setScope(toScope(v))} options={options} />
          </label>
        )}
        {(scope === "one" || scope === "track") && field("track", "Track")}
        {field("artist", "Artist")}
        {scope !== "artist" && field("album", "Album")}
        {scope === "artist" && (
          <p className="muted small">
            Every scrobble of {row.artist} in your library moves to the artist you enter. Track and album names stay as
            they are.
          </p>
        )}
        {scope === "album" && (
          <p className="muted small">
            Every scrobble from {row.album || "this album"} gets this artist and album. Track names stay as they are.
          </p>
        )}
        {act.note}
        <Button kind="btn" loading={act.busy}>
          {n > 1 ? `Update ${num(n)} scrobbles` : "Save"}
        </Button>
      </form>
    </Modal>
  );
}

function summary(d: UserRecent | UserTop, kind: string) {
  if ("hidden" in d) return "";
  if (kind === "scrobbles") return plural(d.total, "scrobble");
  const scrobbles = "counts" in d && d.counts ? ` · ${plural(d.counts.playcount, "scrobble")}` : "";
  return `${plural(d.total, kind.slice(0, -1))}${scrobbles}`;
}

export function Library({ name, mine }: { name: string; mine: boolean }) {
  const kind = useParams().kind || "scrobbles";
  const base = `${userUrl(name)}/library`;
  const [sp] = useSearchParams();
  const page = Number(sp.get("page")) || 1;
  const params = {
    name,
    page,
    limit: 50,
    period: sp.get("period") || "overall",
    from: toTs(sp.get("from") || ""),
    to: toTs(sp.get("to") || "", true),
  };
  const q = useApi<UserRecent | UserTop>(
    kind === "scrobbles" ? `/user/recent${qs(params)}` : `/user/top${qs({ ...params, kind })}`
  );
  const [editing, setEditing] = useState<RecentTrack | null>(null);
  // Scrobbles picked for bulk delete; null when not in select mode.
  const [picked, setPicked] = useState<Set<number> | null>(null);
  const [confirm, setConfirm] = useState(false);
  const bulk = useAction();

  const stopPicking = () => {
    setPicked(null);
    setConfirm(false);
  };

  useEffect(stopPicking, [kind, page]);

  const pick = (id: number, on: boolean) => {
    setConfirm(false);
    setPicked((prev) => {
      const n = new Set(prev);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  };

  const removePicked = () =>
    bulk.run(async () => {
      await api<ScrobblesDeleted>("/scrobbles/delete", { body: { ids: [...picked!] } });
      stopPicking();
      invalidateAll();
    });

  const removeOne = (id: number) => api<Ok>(`/scrobble/${id}`, { method: "DELETE" }).then(q.reload);

  const search = sp.toString() ? `?${new URLSearchParams([...sp].filter(([k]) => k !== "page"))}` : "";
  const rank = (page - 1) * 50 + 1;

  const bulkBar = (d: UserRecent | UserTop) => {
    if (!picked) {
      return (
        <Button kind="btn ghost small" type="button" onClick={() => setPicked(new Set())}>
          Select scrobbles
        </Button>
      );
    }
    const all = picked.size === d.items.length;
    const toggleAll = () => {
      setConfirm(false);
      setPicked(new Set(all ? [] : d.items.map((r: LibraryRow) => r.id)));
    };
    return (
      <>
        <b>{picked.size} selected</b>
        <Button kind="link small" type="button" onClick={toggleAll}>
          {all ? "Select none" : "Select all on this page"}
        </Button>
        {confirm ? (
          <Button kind="btn danger small" type="button" loading={bulk.busy} onClick={removePicked}>
            Yes, delete {plural(picked.size, "scrobble")}
          </Button>
        ) : (
          <Button kind="btn ghost small" type="button" disabled={!picked.size} onClick={() => setConfirm(true)}>
            Delete selected
          </Button>
        )}
        <Button kind="link small" type="button" onClick={stopPicking}>
          Cancel
        </Button>
        {bulk.note}
      </>
    );
  };

  const rowActions = (r: TrackRow<RecentTrack>) => {
    if (r._np) return null;
    if (picked) {
      return (
        <Input
          type="checkbox"
          aria-label={`Select ${r.title}`}
          checked={picked.has(r.id)}
          onChange={(e) => pick(r.id, e.target.checked)}
        />
      );
    }
    return (
      <span className="row-actions">
        <Button kind="link small" onClick={() => setEditing(r)}>
          Edit
        </Button>
        <Button kind="link small" onClick={() => removeOne(r.id)}>
          Delete
        </Button>
      </span>
    );
  };

  const list = (d: UserRecent | UserTop) => {
    if ("hidden" in d) return <Empty>{name} keeps their listening history private.</Empty>;
    if (kind === "scrobbles") {
      return (
        <TrackList
          items={d.items.filter(isRecent)}
          nowPlaying={"nowPlaying" in d ? d.nowPlaying : null}
          time
          actions={mine ? rowActions : undefined}
        />
      );
    }
    if (kind === "artists") return <LibraryArtists items={d.items.filter(isArtist)} name={name} rank={rank} />;
    if (kind === "albums") return <RankList kind="album" items={d.items.filter(isAlbum)} rank={rank} />;
    return <TrackList items={d.items.filter(isTopTrack)} rank={rank} count="playcount" />;
  };

  return (
    <>
      <div className="toolbar">
        <nav className="tabs sub">
          {LIBRARY_TABS.map(([p, l]) => (
            <Link key={p} className={(p.slice(1) || "scrobbles") === kind ? "active" : ""} to={base + p + search}>
              {l}
            </Link>
          ))}
        </nav>
        <DateRange />
      </div>
      {editing && <EditScrobble row={editing} onClose={() => setEditing(null)} onSaved={q.reload} />}
      <Async q={q}>
        {(d) => (
          <>
            <p className="muted">{summary(d, kind)}</p>
            {mine && kind === "scrobbles" && d.items.length > 0 && <div className="bulk-bar">{bulkBar(d)}</div>}
            {list(d)}
            <Pager total={d.total} limit={50} />
          </>
        )}
      </Async>
    </>
  );
}

function LibraryArtists({ items, name, rank }: { items: TopArtist[]; name: string; rank: number }) {
  const max = Math.max(1, ...items.map((i) => i.playcount));
  if (!items.length) return <Empty>Nothing to show for this period.</Empty>;
  return (
    <table className="chartlist">
      <tbody>
        {items.map((a, i) => (
          <tr key={a.id}>
            <td className="c-rank">{rank + i}</td>
            <td className="c-art">
              <Link to={artistUrl(a.name)} tabIndex={-1}>
                <Art image={a.image} kind="artist" />
              </Link>
            </td>
            <td className="c-name">
              <Link className="strong" to={artistUrl(a.name)}>
                {a.name}
              </Link>
            </td>
            <td className="c-bar">
              <Link className="bar" to={`${userUrl(name)}/library/music/${enc(a.name)}`}>
                <span style={{ width: `${(a.playcount / max) * 100}%` }} />
                <b>{num(a.playcount)}</b> <em>scrobbles</em>
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function LibraryArtist({ name, artist }: { name: string; artist: string }) {
  const q = useApi<UserArtistLibrary>(`/user/library/artist${qs({ name, artist })}`);
  return (
    <Async q={q}>
      {(d) => (
        <>
          <div className="toolbar">
            <h2>
              <Link to={`${userUrl(name)}/library/artists`}>Library</Link> /{" "}
              <Link to={artistUrl(d.artist.name)}>{d.artist.name}</Link>
            </h2>
          </div>
          {d.counts.playcount === 0 ? (
            <Empty>
              {name} hasn't scrobbled {d.artist.name} yet.
            </Empty>
          ) : (
            <>
              <div className="stats boxed">
                <Stat label="Scrobbles" value={num(d.counts.playcount)} />
                <Stat label="Albums" value={num(d.counts.albums)} />
                <Stat label="Tracks" value={num(d.counts.tracks)} />
                <Stat label="First scrobbled" value={date(d.first ?? 0)} />
              </div>
              <Section title="Scrobbles over the last year">
                <BarChart data={weekTrend(d.trend)} height={120} every={8} />
              </Section>
              <div className="cols">
                <div className="main">
                  <Section title="Tracks">
                    <TrackList items={d.tracks} rank={1} count="playcount" showArtist={false} />
                  </Section>
                </div>
                <aside className="side">
                  <Section title="Albums">
                    <Grid kind="album" cols={2} items={d.albums} sub={(a) => `${num(a.playcount)} scrobbles`} />
                  </Section>
                </aside>
              </div>
            </>
          )}
        </>
      )}
    </Async>
  );
}
