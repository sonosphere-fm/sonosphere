import { Suspense, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button, Input, Modal, SearchField, Select } from "../kit";
import { ago, albumUrl, api, artistUrl, num, qs, tagUrl, trackUrl, useApi, useTitle } from "../lib";
import { Async, Empty, Pager } from "../ui/base";
import { CHECK, COMPACT_LIST, FILTERBAR, PICKED_ROW, SCROLL, SEARCH, TABLE } from "./common";
import { TOOLBAR, WIDE_SEARCH, useQuery, useConfirm, useAction2, useFlash, type AdminKey } from "./common";
import { t, tx } from "./i18n";
import type {
  AdminTagList,
  CatalogueDetails,
  CatalogueDuplicates,
  CatalogueItem,
  CatalogueMerged,
  CatalogueSearch,
  Ok,
  OrphanList,
  OrphansDeleted,
  TagDeleted,
  Tracklist,
  TracklistTrack,
} from "../../shared/admin-content";
import { Ico } from "../icons";

type KindKeys = Record<string, AdminKey>;
const SEARCH_KIND: KindKeys = {
  artist: "admin.searchArtists",
  album: "admin.searchAlbums",
  track: "admin.searchTracks",
};
const KIND_COUNT: KindKeys = { artist: "admin.artistCount", album: "admin.albumCount", track: "admin.trackCount" };
const RENAME_KIND: KindKeys = { artist: "admin.renameArtist", album: "admin.renameAlbum", track: "admin.renameTrack" };
const MERGE_KIND: KindKeys = { artist: "admin.mergeArtist", album: "admin.mergeAlbum", track: "admin.mergeTrack" };
const MERGE_FROM: KindKeys = {
  artist: "admin.mergeFromArtist",
  album: "admin.mergeFromAlbum",
  track: "admin.mergeFromTrack",
};
const FIND_KEEP: KindKeys = {
  artist: "admin.findArtistKeep",
  album: "admin.findAlbumKeep",
  track: "admin.findTrackKeep",
};
const EDIT_DETAILS: KindKeys = {
  artist: "admin.editArtistDetails",
  album: "admin.editAlbumDetails",
  track: "admin.editTrackDetails",
};
const NO_OTHER: KindKeys = { artist: "admin.noOtherArtist", album: "admin.noOtherAlbum", track: "admin.noOtherTrack" };
const ORPHANS_NOTE: KindKeys = {
  artist: "admin.orphansNoteArtist",
  album: "admin.orphansNoteAlbum",
  track: "admin.orphansNoteTrack",
};
const ORPHAN_COUNT: KindKeys = {
  artist: "admin.orphanedArtists",
  album: "admin.orphanedAlbums",
  track: "admin.orphanedTracks",
};
const DELETE_KIND: KindKeys = {
  artist: "admin.deleteArtists",
  album: "admin.deleteAlbums",
  track: "admin.deleteTracks",
};
const DELETE_SELECTED: KindKeys = {
  artist: "admin.deleteSelectedArtists",
  album: "admin.deleteSelectedAlbums",
  track: "admin.deleteSelectedTracks",
};
const nameBy = (name: string, artist: string | null) => (artist ? t("admin.nameByArtist", { name, artist }) : name);
function boldBy(it: { name: string; artist: string | null }) {
  if (!it.artist) return <b>{it.name}</b>;
  return tx("admin.nameByArtist", { name: <b>{it.name}</b>, artist: it.artist });
}

function itemUrl(kind: string, it: CatalogueItem) {
  if (kind === "artist") return artistUrl(it.name);
  if (kind === "album") return albumUrl(it.artist ?? "", it.name);
  return trackUrl(it.artist ?? "", it.name);
}

function CatalogueTab({ tab }: { tab: string }) {
  if (tab === "duplicates") return <Duplicates />;
  if (tab === "browse") return <Browse />;
  if (tab === "orphans") return <Orphans />;
  return <Tags />;
}

export function Catalogue() {
  const [sp, set] = useQuery();
  const tab = sp.get("tab") || "duplicates";
  useTitle(t("admin.navCatalogue"));
  return (
    <>
      <div className={TOOLBAR}>
        <nav className="tabs sub">
          {(
            [
              ["duplicates", "admin.tabDuplicates"],
              ["browse", "admin.tabBrowse"],
              ["orphans", "admin.tabOrphans"],
              ["tags", "admin.tabTags"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              className={tab === k ? "active" : ""}
              onClick={() => set({ tab: k === "duplicates" ? "" : k, kind: "", q: "" })}
            >
              {t(l)}
            </button>
          ))}
        </nav>
      </div>
      <CatalogueTab tab={tab} />
    </>
  );
}

const GROUP = "border border-site-line pt-[10px] px-[14px] pb-[14px]";
const RADIO = "flex items-center gap-[10px] py-1.5 flex-wrap cursor-pointer";

function Duplicates() {
  const q = useApi<CatalogueDuplicates>("/admin/catalogue/duplicates");
  const [modal, ask] = useConfirm();
  const [target, setTarget] = useState<Record<number, number>>({});
  const flash = useFlash();
  return (
    <>
      {modal}
      <p className="muted">{t("admin.duplicatesIntro")}</p>
      {flash.note}
      <Async q={q}>
        {(d) => {
          if (d.groups.length === 0) return <Empty>{t("admin.noDuplicates")}</Empty>;
          return (
            <div className="grid gap-3">
              {d.groups.map((g, gi) => {
                const keep = target[gi] ?? g[0].id;
                const kept = g.find((a) => a.id === keep)!;
                const rest = g.filter((a) => a.id !== keep);
                const mergeAll = async (note: string) => {
                  let done = 0;
                  for (const a of rest) {
                    await api<CatalogueMerged>("/admin/catalogue/merge", {
                      body: { kind: "artist", source: a.id, target: keep, note },
                    });
                    done++;
                  }
                  q.reload();
                  flash.set({ ok: true, text: t("admin.mergedArtistsInto", { count: done, name: kept.name }) });
                };
                const askMerge = () =>
                  ask({
                    title: t("admin.mergeInto", { name: kept.name }),
                    action: t("admin.mergeCount", { count: rest.length }),
                    danger: true,
                    body: (
                      <p>
                        {t("admin.mergeArtistsBody", {
                          names: rest.map((a) => `“${a.name}”`).join(", "),
                          name: kept.name,
                        })}
                      </p>
                    ),
                    run: mergeAll,
                  });
                return (
                  <div key={g.map((a) => a.id).join("-")} className={GROUP}>
                    <ul className="list-none m-[0_0_10px] p-0">
                      {g.map((a) => (
                        <li key={a.id}>
                          <label className={RADIO}>
                            <input
                              className="accent-site-accent"
                              type="radio"
                              name={`dup-${gi}`}
                              checked={a.id === keep}
                              onChange={() => setTarget({ ...target, [gi]: a.id })}
                            />
                            <span className="grow">
                              <b>{a.name}</b>{" "}
                              <Link className="muted small" to={artistUrl(a.name)}>
                                {t("admin.view")}
                              </Link>
                            </span>
                            <span className="muted small">
                              {t("admin.scrobbleCount", { count: a.scrobbles })} ·{" "}
                              {t("admin.trackCount", { count: a.tracks })} ·{" "}
                              {t("admin.albumCount", { count: a.albums })}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                    <Button kind="btn ghost small" type="button" onClick={askMerge}>
                      {t("admin.keepMergeOthers", { name: kept.name, count: rest.length })}
                    </Button>
                  </div>
                );
              })}
            </div>
          );
        }}
      </Async>
    </>
  );
}

function Browse() {
  const [sp, set] = useQuery();
  const kind = sp.get("kind") || "artist";
  const term = sp.get("q") || "";
  const page = sp.get("page") || "";
  const [text, setText] = useState(term);
  const [rename, setRename] = useState<CatalogueItem | null>(null);
  const [merge, setMerge] = useState<CatalogueItem | null>(null);
  const [editing, setEditing] = useState<CatalogueItem | null>(null);
  const [details, setDetails] = useState<CatalogueItem | null>(null);
  const flash = useFlash();
  const q = useApi<CatalogueSearch>(`/admin/catalogue/search${qs({ kind, q: term, page })}`);
  const search = (e: FormEvent) => {
    e.preventDefault();
    set({ q: text.trim() });
  };
  const finished = (msg: string) => {
    q.reload();
    flash.set({ ok: true, text: msg });
  };
  const renamed = (msg: string) => {
    setRename(null);
    finished(msg);
  };
  const merged = (msg: string) => {
    setMerge(null);
    finished(msg);
  };
  const edited = (msg: string) => {
    setEditing(null);
    finished(msg);
  };
  const detailed = (msg: string) => {
    setDetails(null);
    finished(msg);
  };
  return (
    <>
      <div className={FILTERBAR}>
        <Select
          label={t("admin.kind")}
          value={kind}
          onChange={(v) => set({ kind: v === "artist" ? "" : v })}
          options={[
            ["artist", t("admin.kindArtists")],
            ["album", t("admin.kindAlbums")],
            ["track", t("admin.kindTracks")],
          ]}
        />
        <form className={SEARCH} onSubmit={search}>
          <SearchField value={text} onChange={setText} placeholder={t(SEARCH_KIND[kind])} clearable />
        </form>
      </div>
      {flash.note}
      <Async q={q}>
        {(d) => (
          <>
            <p className="muted small">{t(KIND_COUNT[kind], { count: d.total })}</p>
            {d.items.length === 0 ? (
              <Empty>{t("admin.nothingMatches")}</Empty>
            ) : (
              <div className={SCROLL}>
                <table className={TABLE}>
                  <thead>
                    <tr>
                      <th>{t("admin.colName")}</th>
                      {kind !== "artist" && <th>{t("admin.colArtist")}</th>}
                      {kind !== "track" && <th className="num">{t("admin.kindTracks")}</th>}
                      {kind === "artist" && <th className="num">{t("admin.kindAlbums")}</th>}
                      <th className="num">{t("admin.colScrobbles")}</th>
                      <th className="num">#</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {d.items.map((it) => (
                      <tr key={it.id}>
                        <td>
                          <Link className="strong" to={itemUrl(kind, it)}>
                            {it.name}
                          </Link>
                        </td>
                        {kind !== "artist" && <td>{it.artist}</td>}
                        {kind !== "track" && <td className="num">{num(it.tracks)}</td>}
                        {kind === "artist" && <td className="num">{num(it.albums)}</td>}
                        <td className="num">{num(it.scrobbles)}</td>
                        <td className="num muted small">{it.id}</td>
                        <td className="nowrap right">
                          <Button kind="link small" type="button" onClick={() => setRename(it)}>
                            {t("admin.rename")}
                          </Button>{" "}
                          <Button kind="link small" type="button" onClick={() => setDetails(it)}>
                            {t("admin.colDetails")}
                          </Button>{" "}
                          <Button kind="link small" type="button" onClick={() => setMerge(it)}>
                            {t("admin.mergeIntoEllipsis")}
                          </Button>
                          {kind === "album" && (
                            <>
                              {" "}
                              <Button kind="link small" type="button" onClick={() => setEditing(it)}>
                                {t("admin.trackList")}
                              </Button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pager total={d.total} limit={d.limit} />
          </>
        )}
      </Async>
      {rename && <RenameDialog kind={kind} item={rename} close={() => setRename(null)} done={renamed} />}
      {merge && <MergeDialog kind={kind} item={merge} close={() => setMerge(null)} done={merged} />}
      {editing && <TracklistDialog item={editing} close={() => setEditing(null)} done={edited} />}
      {details && <DetailsDialog kind={kind} item={details} close={() => setDetails(null)} done={detailed} />}
    </>
  );
}

export type EditTarget = Pick<CatalogueItem, "id" | "name" | "artist">;
type DialogProps = { kind: string; item: EditTarget; close: () => void; done: (msg: string) => void };
type RenameProps = Omit<DialogProps, "done"> & { done: (msg: string, name: string) => void };

export function RenameDialog({ kind, item, close, done }: RenameProps) {
  const [name, setName] = useState(item.name);
  const act = useAction2();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    act.run(async () => {
      await api<Ok>("/admin/catalogue/rename", { body: { kind, id: item.id, name } });
      done(t("admin.renamed", { from: item.name, to: name.trim() }), name.trim());
    });
  };
  return (
    <Modal title={t(RENAME_KIND[kind])} onClose={close}>
      <form className="form" onSubmit={submit}>
        <p className="muted small">{t("admin.renameIntro", { item: nameBy(item.name, item.artist) })}</p>
        <label>
          {t("admin.newName")}
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus aria-label={t("admin.newName")} />
        </label>
        {act.note}
        <div className="row">
          <Button kind="btn" loading={act.busy} disabled={!name.trim() || name.trim() === item.name}>
            {t("admin.rename")}
          </Button>
          <Button kind="btn ghost" type="button" onClick={close}>
            {t("admin.cancel")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function MergeDialog({ kind, item, close, done }: DialogProps & { item: CatalogueItem }) {
  const [text, setText] = useState(item.name);
  const [term, setTerm] = useState(item.name);
  const [pick, setPick] = useState<CatalogueItem | null>(null);
  const act = useAction2();
  const search = (e: FormEvent) => {
    e.preventDefault();
    setTerm(text.trim());
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!pick) return;
    act.run(async () => {
      const r = await api<CatalogueMerged>("/admin/catalogue/merge", {
        body: { kind, source: item.id, target: pick.id },
      });
      if (r.merged === undefined) done(t("admin.mergedInto", { from: item.name, to: pick.name }));
      else done(t("admin.mergedIntoCounts", { from: item.name, to: pick.name, merged: r.merged, moved: r.moved ?? 0 }));
    });
  };
  return (
    <Modal title={t(MERGE_KIND[kind])} onClose={close}>
      <div className="form">
        <p className="small">{tx(MERGE_FROM[kind], { item: boldBy(item), id: item.id })}</p>
        {!pick ? (
          <>
            <form className={WIDE_SEARCH} onSubmit={search}>
              <SearchField value={text} onChange={setText} placeholder={t(FIND_KEEP[kind])} autoFocus />
            </form>
            <Suspense fallback={<p className="muted small">{t("admin.searching")}</p>}>
              <MergeResults
                kind={kind}
                term={term}
                fallback={item.artist}
                skip={[item.id]}
                pickLabel={t("admin.keepThis")}
                onPick={setPick}
              />
            </Suspense>
          </>
        ) : (
          <form className="form" onSubmit={submit}>
            <p className="notice">
              {tx("admin.mergeConfirm", {
                source: <b>{item.name}</b>,
                sourceId: item.id,
                sourceScrobbles: num(item.scrobbles),
                target: boldBy(pick),
                targetId: pick.id,
                targetScrobbles: num(pick.scrobbles),
              })}
            </p>
            {act.note}
            <div className="row">
              <Button kind="btn danger" loading={act.busy}>
                {t("admin.merge")}
              </Button>
              <Button kind="btn ghost" type="button" onClick={() => setPick(null)}>
                {t("admin.pickAnother")}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}

export function DetailsDialog(props: DialogProps) {
  return (
    <Modal title={t(EDIT_DETAILS[props.kind])} onClose={props.close}>
      <Suspense fallback={<p className="muted small">{t("admin.loading")}</p>}>
        <DetailsLoader {...props} />
      </Suspense>
    </Modal>
  );
}

function DetailsLoader(props: DialogProps) {
  const q = useApi<CatalogueDetails>(`/admin/catalogue/details${qs({ kind: props.kind, id: props.item.id })}`);
  return <Async q={q}>{(d) => <DetailsForm {...props} initial={d} />}</Async>;
}

const releaseTypes = (): [string, string][] => [
  ["", t("admin.releaseTypeUnset")],
  ["album", t("admin.releaseTypeAlbum")],
  ["single", t("admin.releaseTypeSingle")],
  ["ep", t("admin.releaseTypeEp")],
  ["broadcast", t("admin.releaseTypeBroadcast")],
  ["other", t("admin.releaseTypeOther")],
];

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function seconds(text: string): number {
  const [m, s] = text.split(":");
  return s === undefined ? Number(m) : Number(m) * 60 + Number(s);
}

function DetailsForm({ kind, item, initial, close, done }: DialogProps & { initial: CatalogueDetails }) {
  const [mbid, setMbid] = useState(initial.mbid ?? "");
  const [spotifyId, setSpotifyId] = useState(initial.spotifyId ?? "");
  const [releaseDate, setReleaseDate] = useState(initial.releaseDate ?? "");
  const [releaseType, setReleaseType] = useState(initial.releaseType ?? "");
  const [length, setLength] = useState(initial.duration ? clock(initial.duration) : "");
  const act = useAction2();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const fields: Record<string, CatalogueDetails> = {
      artist: { mbid, spotifyId },
      album: { releaseDate, releaseType, mbid },
      track: { duration: seconds(length || "0") },
    };
    const changed = Object.entries(fields[kind]!).filter(
      ([k, v]) => v !== (initial[k as keyof CatalogueDetails] ?? "")
    );
    act.run(async () => {
      await api<Ok>("/admin/catalogue/details", { body: { kind, id: item.id, ...Object.fromEntries(changed) } });
      done(t("admin.savedDetails", { name: item.name }));
    });
  };
  return (
    <form className="form" onSubmit={submit}>
      <p className="muted small">{t("admin.detailsIntro", { item: nameBy(item.name, item.artist) })}</p>
      {kind === "album" && (
        <>
          <label>
            {t("admin.releaseDate")} <span className="muted small">{t("admin.releaseDateHint")}</span>
            <Input value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} autoFocus />
          </label>
          <Select
            label={t("admin.releaseType")}
            value={releaseType}
            onChange={setReleaseType}
            options={releaseTypes()}
          />
        </>
      )}
      {kind === "track" && (
        <label>
          {t("admin.length")} <span className="muted small">{t("admin.lengthHint")}</span>
          <Input value={length} onChange={(e) => setLength(e.target.value)} autoFocus />
        </label>
      )}
      {kind !== "track" && (
        <label>
          {t("admin.fieldMbid")}
          <Input value={mbid} onChange={(e) => setMbid(e.target.value)} />
        </label>
      )}
      {kind === "artist" && (
        <label>
          {t("admin.fieldSpotifyId")}
          <Input value={spotifyId} onChange={(e) => setSpotifyId(e.target.value)} />
        </label>
      )}
      {act.note}
      <div className="row">
        <Button kind="btn" loading={act.busy}>
          {t("admin.save")}
        </Button>
        <Button kind="btn ghost" type="button" onClick={close}>
          {t("admin.cancel")}
        </Button>
      </div>
    </form>
  );
}

type TracklistProps = { item: EditTarget; close: () => void; done: (msg: string) => void };

export function TracklistDialog({ item, close, done }: TracklistProps) {
  return (
    <Modal title={t("admin.editTrackList")} onClose={close}>
      <Suspense fallback={<p className="muted small">{t("admin.loading")}</p>}>
        <TracklistEditor item={item} close={close} done={done} />
      </Suspense>
    </Modal>
  );
}

const TRACK_ROW = "flex items-center gap-2 py-1 border-b border-site-line";

function TracklistEditor({ item, close, done }: TracklistProps) {
  const q = useApi<Tracklist>(`/admin/catalogue/tracklist${qs({ id: item.id })}`);
  return <Async q={q}>{(d) => <TracklistForm item={item} initial={d.tracks} close={close} done={done} />}</Async>;
}

function TracklistForm({ item, initial, close, done }: TracklistProps & { initial: TracklistTrack[] }) {
  const [list, setList] = useState(initial);
  const [text, setText] = useState(item.artist ?? "");
  const [term, setTerm] = useState(item.artist ?? "");
  const act = useAction2();
  const ids = list.map((track) => track.id);
  const changed = ids.join() !== initial.map((track) => track.id).join();
  const move = (i: number, by: number) => {
    const next = [...list];
    [next[i], next[i + by]] = [next[i + by]!, next[i]!];
    setList(next);
  };
  const add = (it: CatalogueItem) => setList([...list, { id: it.id, name: it.name, artist: it.artist ?? "" }]);
  // new tracks get a temporary negative id until saving creates them
  const addNew = () => {
    setList([...list, { id: -Date.now(), name: term, artist: item.artist ?? "" }]);
    setText("");
    setTerm(item.artist ?? "");
  };
  const listed = list.some((track) => track.name.toLowerCase() === term.toLowerCase());
  const offerNew = term !== "" && term !== item.artist && !listed;
  const search = (e: FormEvent) => {
    e.preventDefault();
    setTerm(text.trim());
  };
  const save = () =>
    act.run(async () => {
      const tracks = list.map((track) => (track.id > 0 ? track.id : track.name));
      await api<Ok>("/admin/catalogue/tracklist", { body: { id: item.id, tracks } });
      done(t("admin.savedTrackList", { name: item.name, count: list.length }));
    });
  return (
    <div className="form">
      <p className="muted small">
        {t("admin.trackListIntro", { item: t("admin.nameByArtist", { name: item.name, artist: item.artist ?? "" }) })}
      </p>
      {list.length === 0 ? (
        <p className="muted small">{t("admin.noTracks")}</p>
      ) : (
        <ol className="list-none w-full m-0 p-0 max-h-[40vh] overflow-auto">
          {list.map((track, i) => (
            <li key={track.id} className={TRACK_ROW}>
              <span className="muted small w-6 text-right">{i + 1}</span>
              <span className="grow">
                {track.name}
                {track.artist !== item.artist && (
                  <span className="muted"> {t("admin.byName", { name: track.artist })}</span>
                )}
                {track.id < 0 && <span className="muted small"> {t("admin.new")}</span>}
              </span>
              <Button
                kind="link small"
                type="button"
                aria-label={t("admin.moveUp", { name: track.name })}
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                <Ico.SortUp />
              </Button>
              <Button
                kind="link small"
                type="button"
                aria-label={t("admin.moveDown", { name: track.name })}
                disabled={i === list.length - 1}
                onClick={() => move(i, 1)}
              >
                <Ico.SortDown />
              </Button>
              <Button kind="link small" type="button" onClick={() => setList(list.filter((x) => x.id !== track.id))}>
                {t("admin.remove")}
              </Button>
            </li>
          ))}
        </ol>
      )}
      {act.note}
      <div className="row">
        <Button kind="btn" type="button" loading={act.busy} disabled={!changed} onClick={save}>
          {t("admin.save")}
        </Button>
        <Button kind="btn ghost" type="button" onClick={close}>
          {t("admin.cancel")}
        </Button>
      </div>
      <form className={WIDE_SEARCH} onSubmit={search}>
        <SearchField value={text} onChange={setText} placeholder={t("admin.findTrackToAdd")} />
      </form>
      {offerNew && (
        <Button kind="btn ghost small" type="button" onClick={addNew}>
          {t("admin.addAsNewTrack", { name: term })}
        </Button>
      )}
      <Suspense fallback={<p className="muted small">{t("admin.searching")}</p>}>
        <MergeResults
          kind="track"
          term={term}
          fallback={item.artist}
          skip={ids}
          pickLabel={t("admin.add")}
          onPick={add}
        />
      </Suspense>
    </div>
  );
}

type MergeResultsProps = {
  kind: string;
  term: string;
  fallback: string | null;
  skip: number[];
  pickLabel: string;
  onPick: (it: CatalogueItem) => void;
};

// with no other match by name, the artist's others are the likely targets (a single into its album)
function MergeResults({ kind, term, fallback, skip, pickLabel, onPick }: MergeResultsProps) {
  const q = useApi<CatalogueSearch>(`/admin/catalogue/search${qs({ kind, q: term, limit: 8 })}`);
  return (
    <Async q={q}>
      {(d) => {
        const items = d.items.filter((x) => !skip.includes(x.id));
        if (items.length === 0 && fallback && fallback !== term) {
          return (
            <MergeResults
              kind={kind}
              term={fallback}
              fallback={null}
              skip={skip}
              pickLabel={pickLabel}
              onPick={onPick}
            />
          );
        }
        if (items.length === 0) return <p className="muted small">{t(NO_OTHER[kind])}</p>;
        return (
          <ul className={`${COMPACT_LIST} max-h-[320px] overflow-auto [&>li]:items-center`}>
            {items.map((x) => (
              <li key={x.id}>
                <span>
                  <b>{x.name}</b>
                  {x.artist && <span className="muted"> {t("admin.byName", { name: x.artist })}</span>}{" "}
                  <span className="muted small">
                    #{x.id} · {t("admin.scrobbleCount", { count: x.scrobbles })}
                  </span>
                </span>
                <Button kind="btn ghost small" type="button" onClick={() => onPick(x)}>
                  {pickLabel}
                </Button>
              </li>
            ))}
          </ul>
        );
      }}
    </Async>
  );
}

function Orphans() {
  const [sp, set] = useQuery();
  const kind = sp.get("kind") || "track";
  const imported = sp.get("imported") || "";
  const q = useApi<OrphanList>(`/admin/catalogue/orphans${qs({ kind, imported })}`);
  const [modal, ask] = useConfirm();
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const flash = useFlash();
  useEffect(() => setPicked(new Set()), [kind, imported]);
  const deletePicked = async (note: string) => {
    const r = await api<OrphansDeleted>("/admin/catalogue/orphans/delete", { body: { kind, ids: [...picked], note } });
    setPicked(new Set());
    q.reload();
    const text = r.skipped
      ? t("admin.orphansDeletedSkipped", { deleted: num(r.deleted), skipped: num(r.skipped) })
      : t("admin.orphansDeleted", { deleted: num(r.deleted) });
    flash.set({ ok: true, text });
  };
  const askDelete = () =>
    ask({
      title: t(DELETE_KIND[kind], { count: picked.size }),
      action: t("admin.delete"),
      danger: true,
      body: <p>{t(DELETE_SELECTED[kind])}</p>,
      run: deletePicked,
    });
  const togglePick = (id: number, on: boolean) => {
    const n = new Set(picked);
    if (on) n.add(id);
    else n.delete(id);
    setPicked(n);
  };
  return (
    <>
      {modal}
      <div className={FILTERBAR}>
        <Select
          label={t("admin.kind")}
          value={kind}
          onChange={(v) => set({ kind: v === "track" ? "" : v })}
          options={[
            ["track", t("admin.kindTracks")],
            ["album", t("admin.kindAlbums")],
            ["artist", t("admin.kindArtists")],
          ]}
        />
        <label className={CHECK}>
          <Input
            type="checkbox"
            checked={imported === "1"}
            onChange={(e) => set({ imported: e.target.checked ? "1" : "" })}
          />{" "}
          {t("admin.includeImported")}
        </label>
      </div>
      <p className="muted small">{t(ORPHANS_NOTE[kind])}</p>
      {flash.note}
      <Async q={q}>
        {(d) => {
          const all = picked.size === d.items.length;
          const toggleAll = () => setPicked(new Set(all ? [] : d.items.map((x) => x.id)));
          return (
            <>
              <div className="bulk-bar">
                <b>{t(ORPHAN_COUNT[kind], { count: d.total })}</b>
                {d.total > d.items.length && (
                  <span className="muted small">{t("admin.showingNewest", { count: d.items.length })}</span>
                )}
                {d.items.length > 0 && (
                  <Button kind="link small" type="button" onClick={toggleAll}>
                    {all ? t("admin.selectNone") : t("admin.selectAll")}
                  </Button>
                )}
                {picked.size > 0 && (
                  <Button kind="btn danger small" type="button" onClick={askDelete}>
                    {t("admin.deleteSelected", { count: picked.size })}
                  </Button>
                )}
              </div>
              {d.items.length === 0 ? (
                <Empty>{t("admin.nothingToClean")}</Empty>
              ) : (
                <div className={SCROLL}>
                  <table className={TABLE}>
                    <tbody>
                      {d.items.map((x) => (
                        <tr key={x.id} className={picked.has(x.id) ? PICKED_ROW : ""}>
                          <td className="w-7">
                            <Input
                              type="checkbox"
                              aria-label={t("admin.selectItem", { name: x.name })}
                              checked={picked.has(x.id)}
                              onChange={(e) => togglePick(x.id, e.target.checked)}
                            />
                          </td>
                          <td>
                            <b>{x.name}</b>
                            {x.artist && <span className="muted"> {t("admin.byName", { name: x.artist })}</span>}
                          </td>
                          <td className="num muted small">
                            {x.basePlaycount ? t("admin.importedPlays", { count: x.basePlaycount }) : ""}
                          </td>
                          <td className="nowrap muted small">{t("admin.addedAgo", { ago: ago(x.createdAt) })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          );
        }}
      </Async>
    </>
  );
}

function Tags() {
  const [sp, set] = useQuery();
  const term = sp.get("q") || "";
  const sort = sp.get("sort") || "uses";
  const page = sp.get("page") || "";
  const [text, setText] = useState(term);
  const [modal, ask] = useConfirm();
  const flash = useFlash();
  const q = useApi<AdminTagList>(`/admin/tags${qs({ q: term, sort: sort === "uses" ? "" : sort, page })}`);
  const search = (e: FormEvent) => {
    e.preventDefault();
    set({ q: text.trim() });
  };
  const askDelete = (g: { id: number; name: string; uses: number }) =>
    ask({
      title: t("admin.deleteTagTitle", { name: g.name }),
      action: t("admin.deleteTag"),
      danger: true,
      body: <p>{t("admin.deleteTagBody", { count: g.uses })}</p>,
      run: (note) =>
        api<TagDeleted>("/admin/tags/delete", { body: { id: g.id, note } }).then(() => {
          q.reload();
          flash.set({ ok: true, text: t("admin.deletedName", { name: g.name }) });
        }),
    });
  return (
    <>
      {modal}
      <div className={FILTERBAR}>
        <form className={SEARCH} onSubmit={search}>
          <SearchField value={text} onChange={setText} placeholder={t("admin.searchTags")} clearable />
        </form>
        <Select
          label={t("admin.sort")}
          value={sort}
          onChange={(v) => set({ sort: v === "uses" ? "" : v })}
          options={[
            ["uses", t("admin.mostUsed")],
            ["name", t("admin.aToZ")],
          ]}
        />
      </div>
      {flash.note}
      <Async q={q}>
        {(d) => (
          <>
            {d.items.length === 0 ? (
              <Empty>{t("admin.noTagsMatch")}</Empty>
            ) : (
              <div className={SCROLL}>
                <table className={TABLE}>
                  <thead>
                    <tr>
                      <th>{t("admin.colTag")}</th>
                      <th className="num">{t("admin.colUses")}</th>
                      <th className="num">{t("admin.colByListeners")}</th>
                      <th className="num">{t("admin.colImported")}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {d.items.map((g) => (
                      <tr key={g.id}>
                        <td>
                          <Link className="strong" to={tagUrl(g.name)}>
                            {g.name}
                          </Link>
                        </td>
                        <td className="num">{num(g.uses)}</td>
                        <td className="num">{num(g.users)}</td>
                        <td className="num">{num(g.imported ?? 0)}</td>
                        <td className="right">
                          <Button kind="link small" type="button" onClick={() => askDelete(g)}>
                            {t("admin.delete")}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pager total={d.total} limit={d.limit} />
          </>
        )}
      </Async>
    </>
  );
}
