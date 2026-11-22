import { Suspense, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button, Input, Modal, SearchField, Select } from "../kit";
import { ago, albumUrl, api, artistUrl, num, plural, qs, tagUrl, trackUrl, useApi, useTitle } from "../lib";
import { Async, Empty, Pager } from "../ui/base";
import { useQuery, useConfirm, useAction2, useFlash } from "./common";
import type { AdminTagList, CatalogueDuplicates, CatalogueItem, CatalogueMerged, CatalogueSearch, Ok, OrphanList, OrphansDeleted, TagDeleted } from "../../shared/admin-content";

const KIND_LABEL: Record<string, string> = { artist: "Artists", album: "Albums", track: "Tracks" };

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
  useTitle("Catalogue");
  return (
    <>
      <div className="toolbar flex items-center justify-between gap-3.5 flex-wrap mb-3.5 max-sm:items-stretch max-sm:flex-col [&_.page-title]:mb-0 [&_.tabs]:mb-0 [&_.tabs]:flex-1">
        <nav className="tabs sub flex flex-wrap mb-6 *:hover:no-underline *:current:font-medium gap-1 *:m-0 *:h-auto *:rounded-none *:border-0 *:bg-fill *:px-[11px] *:py-[5px] *:text-[11px] *:font-medium *:uppercase *:tracking-[.05em] *:text-ink *:hover:bg-fill-hover *:hover:text-ink *:current:bg-ink *:current:text-bg max-md:toolbar:max-w-full">
          {[["duplicates", "Duplicate artists"], ["browse", "Rename and merge"], ["orphans", "Orphans"], ["tags", "Tags"]].map(([k, l]) => (
            <button key={k} type="button" className={tab === k ? "active" : ""} onClick={() => set({ tab: k === "duplicates" ? "" : k, kind: "", q: "" })}>
              {l}
            </button>
          ))}
        </nav>
      </div>
      <CatalogueTab tab={tab} />
    </>
  );
}

function Duplicates() {
  const q = useApi<CatalogueDuplicates>("/admin/catalogue/duplicates");
  const [modal, ask] = useConfirm();
  const [target, setTarget] = useState<Record<number, number>>({});
  const flash = useFlash();
  return (
    <>
      {modal}
      <p className="text-muted">
        Artists whose names only differ by case, accents, punctuation, “the” or “&amp;”. Pick the one to keep; the rest are merged into it with their
        tracks, albums, scrobbles, tags, wiki history and wall posts. Tracks and albums with the same title are combined.
      </p>
      {flash.note}
      <Async q={q}>{d => {
        if (d.groups.length === 0) return <Empty>No likely duplicates.</Empty>;
        return (
          <div className="grid gap-3">
            {d.groups.map((g, gi) => {
              const keep = target[gi] ?? g[0].id;
              const kept = g.find(a => a.id === keep)!;
              const rest = g.filter(a => a.id !== keep);
              const mergeAll = async (note: string) => {
                let done = 0;
                for (const a of rest) {
                  await api<CatalogueMerged>("/admin/catalogue/merge", { body: { kind: "artist", source: a.id, target: keep, note } });
                  done++;
                }
                q.reload();
                flash.set({ ok: true, text: `Merged ${plural(done, "artist")} into ${kept.name}.` });
              };
              const askMerge = () => ask({
                title: `Merge into ${kept.name}`,
                action: `Merge ${rest.length}`,
                danger: true,
                body: <p>Merge {rest.map(a => `“${a.name}”`).join(", ")} into “{kept.name}”. The merged artists are deleted. This can't be undone.</p>,
                run: mergeAll,
              });
              return (
                <div key={g.map(a => a.id).join("-")} className="border border-line px-3.5 pt-2.5 pb-3.5 [&_ul]:list-none [&_ul]:m-0 [&_ul]:mb-2.5 [&_ul]:p-0">
                  <ul>
                    {g.map(a => (
                      <li key={a.id}>
                        <label className="flex items-center gap-2.5 py-1.5 flex-wrap cursor-pointer [&_input]:accent-accent">
                          <input type="radio" name={`dup-${gi}`} checked={a.id === keep} onChange={() => setTarget({ ...target, [gi]: a.id })} />
                          <span className="flex-1 min-w-0"><b>{a.name}</b> <Link className="text-muted text-[13px]" to={artistUrl(a.name)}>view</Link></span>
                          <span className="text-muted text-[13px]">{plural(a.scrobbles, "scrobble")} · {plural(a.tracks, "track")} · {plural(a.albums, "album")}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                  <Button kind="btn ghost small" type="button" onClick={askMerge}>
                    Keep “{kept.name}”, merge {rest.length} other{rest.length === 1 ? "" : "s"}
                  </Button>
                </div>
              );
            })}
          </div>
        );
      }}</Async>
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
  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5 mb-3.5 [&_.astryx-text-input]:min-w-[170px] [&>.field]:min-w-[170px] [&>div:has(>input)]:min-w-[170px] max-[861px]:[&>*]:flex-[1_1_160px]">
        <Select
          label="Kind"
          value={kind}
          onChange={v => set({ kind: v === "artist" ? "" : v })}
          options={[["artist", "Artists"], ["album", "Albums"], ["track", "Tracks"]]}
        />
        <form className="min-w-[260px] flex-[0_1_340px] [&_.search-field]:h-10 [&_.search-go]:w-[42px] [&_.search-go]:text-base [&.wide]:flex-1 [&.wide]:min-w-0 max-[861px]:flex-[1_1_100%] max-[861px]:min-w-0" onSubmit={search}>
          <SearchField value={text} onChange={setText} placeholder={`Search ${KIND_LABEL[kind].toLowerCase()}`} clearable />
        </form>
      </div>
      {flash.note}
      <Async q={q}>{d => (
        <>
          <p className="text-muted text-[13px]">{num(d.total)} {KIND_LABEL[kind].toLowerCase()}</p>
          {d.items.length === 0 ? <Empty>Nothing matches.</Empty> : (
            <div className="overflow-x-auto mb-3.5">
              <table className="adm-table [&_th_button_.ico]:ml-1 [&_th_button_.ico]:size-[.85em] w-full border-collapse text-sm [&_td]:p-2 [&_td]:border-b [&_td]:border-line [&_td]:align-middle [&_th]:text-left [&_th]:text-xs [&_th]:font-bold [&_th]:uppercase [&_th]:tracking-[.05em] [&_th]:text-muted [&_th]:p-2 [&_th]:border-b-2 [&_th]:border-line [&_th]:whitespace-nowrap [&_th_button]:bg-transparent [&_th_button]:border-0 [&_th_button]:p-0 [&_th_button]:[font:inherit] [&_th_button]:text-inherit [&_th_button]:uppercase [&_th_button]:tracking-[.05em] [&_th_button]:cursor-pointer [&_th_button:hover]:text-ink [&_th_button.on]:text-ink [&_.num]:text-right [&_.num]:tabular-nums [&_.right]:text-right [&_.tick]:w-7 [&_.grow-cell]:w-full [&_tr.picked_td]:bg-[light-dark(#fff7f6,#1f2659)] [&.compact_td]:p-1.5 [&.compact_td]:align-top [&.adm-log_td]:align-top">
                <thead>
                  <tr>
                    <th>Name</th>
                    {kind !== "artist" && <th>Artist</th>}
                    {kind !== "track" && <th className="num">Tracks</th>}
                    {kind === "artist" && <th className="num">Albums</th>}
                    <th className="num">Scrobbles</th>
                    <th className="num">#</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {d.items.map(it => (
                    <tr key={it.id}>
                      <td><Link className="font-semibold" to={itemUrl(kind, it)}>{it.name}</Link></td>
                      {kind !== "artist" && <td>{it.artist}</td>}
                      {kind !== "track" && <td className="num">{num(it.tracks)}</td>}
                      {kind === "artist" && <td className="num">{num(it.albums)}</td>}
                      <td className="num">{num(it.scrobbles)}</td>
                      <td className="num text-muted text-[13px]">{it.id}</td>
                      <td className="whitespace-nowrap text-right">
                        <Button kind="small" className="bg-transparent border-0 p-0 text-link font-semibold hover:underline" type="button" onClick={() => setRename(it)}>Rename</Button>{" "}
                        <Button kind="small" className="bg-transparent border-0 p-0 text-link font-semibold hover:underline" type="button" onClick={() => setMerge(it)}>Merge into…</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pager total={d.total} limit={d.limit} />
        </>
      )}</Async>
      {rename && <RenameDialog kind={kind} item={rename} close={() => setRename(null)} done={renamed} />}
      {merge && <MergeDialog kind={kind} item={merge} close={() => setMerge(null)} done={merged} />}
    </>
  );
}

type DialogProps = { kind: string; item: CatalogueItem; close: () => void; done: (msg: string) => void };

function RenameDialog({ kind, item, close, done }: DialogProps) {
  const [name, setName] = useState(item.name);
  const act = useAction2();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    act.run(async () => {
      await api<Ok>("/admin/catalogue/rename", { body: { kind, id: item.id, name } });
      done(`Renamed “${item.name}” to “${name.trim()}”.`);
    });
  };
  return (
    <Modal title={`Rename ${kind}`} onClose={close}>
      <form className="form flex flex-col gap-3.5 items-start [&>label]:flex [&>label]:flex-col [&>label]:gap-1 [&>label]:font-semibold [&>label]:text-sm [&>label]:w-full [&_.row]:w-full [&_.row>label]:flex [&_.row>label]:flex-col [&_.row>label]:gap-1 [&_.row>label]:font-semibold [&_.row>label]:text-sm [&_.row>label]:w-full [&_label_:is(input,textarea)]:font-normal [&_label_:is(input,textarea)]:text-base [&_label_:is(input,textarea)]:w-full" onSubmit={submit}>
        <p className="text-muted text-[13px]">
          {item.artist ? `${item.name} by ${item.artist}` : item.name}. Every scrobble, tag and page follows the new name. If the name is taken, merge instead.
        </p>
        <label>New name<Input value={name} onChange={e => setName(e.target.value)} autoFocus aria-label="New name" /></label>
        {act.note}
        <div className="row flex gap-2.5 items-center flex-wrap max-sm:hero:gap-2">
          <Button kind="btn" loading={act.busy} disabled={!name.trim() || name.trim() === item.name}>Rename</Button>
          <Button kind="btn ghost" type="button" onClick={close}>Cancel</Button>
        </div>
      </form>
    </Modal>
  );
}

function MergeDialog({ kind, item, close, done }: DialogProps) {
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
      const r = await api<CatalogueMerged>("/admin/catalogue/merge", { body: { kind, source: item.id, target: pick.id } });
      const counts = r.merged !== undefined ? ` (${r.merged} combined, ${r.moved} moved)` : "";
      done(`Merged “${item.name}” into “${pick.name}”${counts}.`);
    });
  };
  return (
    <Modal title={`Merge ${kind}`} onClose={close}>
      <div className="form flex flex-col gap-3.5 items-start [&>label]:flex [&>label]:flex-col [&>label]:gap-1 [&>label]:font-semibold [&>label]:text-sm [&>label]:w-full [&_.row]:w-full [&_.row>label]:flex [&_.row>label]:flex-col [&_.row>label]:gap-1 [&_.row>label]:font-semibold [&_.row>label]:text-sm [&_.row>label]:w-full [&_label_:is(input,textarea)]:font-normal [&_label_:is(input,textarea)]:text-base [&_label_:is(input,textarea)]:w-full">
        <p className="text-[13px]">
          Move everything from <b>{item.name}</b>{item.artist && <> by {item.artist}</>} (#{item.id}) into another {kind}, then delete it.
        </p>
        {!pick ? (
          <>
            <form className="min-w-[260px] flex-[0_1_340px] [&_.search-field]:h-10 [&_.search-go]:w-[42px] [&_.search-go]:text-base [&.wide]:flex-1 [&.wide]:min-w-0 max-[861px]:flex-[1_1_100%] max-[861px]:min-w-0 wide" onSubmit={search}>
              <SearchField value={text} onChange={setText} placeholder={`Find the ${kind} to keep`} autoFocus />
            </form>
            <Suspense fallback={<p className="text-muted text-[13px]">Searching…</p>}>
              <MergeResults kind={kind} term={term} skip={item.id} onPick={setPick} />
            </Suspense>
          </>
        ) : (
          <form className="form flex flex-col gap-3.5 items-start [&>label]:flex [&>label]:flex-col [&>label]:gap-1 [&>label]:font-semibold [&>label]:text-sm [&>label]:w-full [&_.row]:w-full [&_.row>label]:flex [&_.row>label]:flex-col [&_.row>label]:gap-1 [&_.row>label]:font-semibold [&_.row>label]:text-sm [&_.row>label]:w-full [&_label_:is(input,textarea)]:font-normal [&_label_:is(input,textarea)]:text-base [&_label_:is(input,textarea)]:w-full" onSubmit={submit}>
            <p className="bg-[light-dark(#f6f3ee,#121636)] border-l-[3px] border-accent py-2.5 px-3.5 mb-5">
              Merge <b>{item.name}</b> (#{item.id}, {num(item.scrobbles)} scrobbles) into <b>{pick.name}</b>
              {pick.artist && <> by {pick.artist}</>} (#{pick.id}, {num(pick.scrobbles)} scrobbles)? This can't be undone.
            </p>
            {act.note}
            <div className="row flex gap-2.5 items-center flex-wrap max-sm:hero:gap-2">
              <Button kind="btn danger" loading={act.busy}>Merge</Button>
              <Button kind="btn ghost" type="button" onClick={() => setPick(null)}>Pick another</Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}

function MergeResults({ kind, term, skip, onPick }: { kind: string; term: string; skip: number; onPick: (it: CatalogueItem) => void }) {
  const q = useApi<CatalogueSearch>(`/admin/catalogue/search${qs({ kind, q: term, limit: 8 })}`);
  return (
    <Async q={q}>{d => {
      const items = d.items.filter(x => x.id !== skip);
      if (items.length === 0) return <p className="text-muted text-[13px]">No other {kind} matches.</p>;
      return (
        <ul className="list-none m-0 p-0 [&>li]:py-3 [&>li]:border-b [&>li]:border-line [&>li_p]:m-0 [&>li_p]:mb-1 [&.compact>li]:flex [&.compact>li]:justify-between [&.compact>li]:gap-x-3.5 [&.compact>li]:gap-y-1.5 [&.compact>li]:flex-wrap [&.compact>li]:py-2 [&.compact>li]:text-sm [&_.c-name]:w-auto max-h-80 overflow-auto [&_li]:items-center">
          {items.map(x => (
            <li key={x.id}>
              <span>
                <b>{x.name}</b>{x.artist && <span className="text-muted"> by {x.artist}</span>}{" "}
                <span className="text-muted text-[13px]">#{x.id} · {plural(x.scrobbles, "scrobble")}</span>
              </span>
              <Button kind="btn ghost small" type="button" onClick={() => onPick(x)}>Keep this</Button>
            </li>
          ))}
        </ul>
      );
    }}</Async>
  );
}

const ORPHAN_EXTRA: Record<string, string> = {
  artist: ", and they have no tracks, albums or events",
  album: ", and no track points at them",
};

function Orphans() {
  const [sp, set] = useQuery();
  const kind = sp.get("kind") || "track";
  const imported = sp.get("imported") || "";
  const q = useApi<OrphanList>(`/admin/catalogue/orphans${qs({ kind, imported })}`);
  const [modal, ask] = useConfirm();
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const flash = useFlash();
  useEffect(() => setPicked(new Set()), [kind, imported]);
  const label = KIND_LABEL[kind].toLowerCase();
  const deletePicked = async (note: string) => {
    const r = await api<OrphansDeleted>("/admin/catalogue/orphans/delete", { body: { kind, ids: [...picked], note } });
    setPicked(new Set());
    q.reload();
    const skipped = r.skipped ? `, skipped ${num(r.skipped)} now in use` : "";
    flash.set({ ok: true, text: `Deleted ${num(r.deleted)}${skipped}.` });
  };
  const askDelete = () => ask({
    title: `Delete ${plural(picked.size, kind)}`,
    action: "Delete",
    danger: true,
    body: <p>Permanently delete the selected {label}. Anything that started being used since this list loaded is skipped.</p>,
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
      <div className="flex flex-wrap items-center gap-2.5 mb-3.5 [&_.astryx-text-input]:min-w-[170px] [&>.field]:min-w-[170px] [&>div:has(>input)]:min-w-[170px] max-[861px]:[&>*]:flex-[1_1_160px]">
        <Select
          label="Kind"
          value={kind}
          onChange={v => set({ kind: v === "track" ? "" : v })}
          options={[["track", "Tracks"], ["album", "Albums"], ["artist", "Artists"]]}
        />
        <label className="check flex! flex-row! items-start gap-2.5 font-normal! text-[15px] [&_input]:w-4! [&_input]:mt-[3px] [&_input]:flex-none [&_input[type=checkbox]]:h-4! [&_input[type=checkbox]]:min-h-0! [&_input[type=checkbox]]:p-0! items-center! text-sm! m-0">
          <Input type="checkbox" checked={imported === "1"} onChange={e => set({ imported: e.target.checked ? "1" : "" })} /> Include imported items with play counts
        </label>
      </div>
      <p className="text-muted text-[13px]">
        Nobody has scrobbled, loved, tagged, written about or playlisted these{ORPHAN_EXTRA[kind] ?? ""}. Each one is checked again before it's deleted.
      </p>
      {flash.note}
      <Async q={q}>{d => {
        const all = picked.size === d.items.length;
        const toggleAll = () => setPicked(new Set(all ? [] : d.items.map(x => x.id)));
        return (
          <>
            <div className="flex items-center gap-3 flex-wrap min-h-9 mt-0 mb-2 [&_p]:m-0">
              <b>{num(d.total)} orphaned {label}</b>
              {d.total > d.items.length && <span className="text-muted text-[13px]">(showing the newest {d.items.length})</span>}
              {d.items.length > 0 && <Button kind="small" className="bg-transparent border-0 p-0 text-link font-semibold hover:underline" type="button" onClick={toggleAll}>{all ? "Select none" : "Select all"}</Button>}
              {picked.size > 0 && <Button kind="btn danger small" type="button" onClick={askDelete}>Delete {picked.size} selected</Button>}
            </div>
            {d.items.length === 0 ? <Empty>Nothing to clean up.</Empty> : (
              <div className="overflow-x-auto mb-3.5">
                <table className="adm-table [&_th_button_.ico]:ml-1 [&_th_button_.ico]:size-[.85em] w-full border-collapse text-sm [&_td]:p-2 [&_td]:border-b [&_td]:border-line [&_td]:align-middle [&_th]:text-left [&_th]:text-xs [&_th]:font-bold [&_th]:uppercase [&_th]:tracking-[.05em] [&_th]:text-muted [&_th]:p-2 [&_th]:border-b-2 [&_th]:border-line [&_th]:whitespace-nowrap [&_th_button]:bg-transparent [&_th_button]:border-0 [&_th_button]:p-0 [&_th_button]:[font:inherit] [&_th_button]:text-inherit [&_th_button]:uppercase [&_th_button]:tracking-[.05em] [&_th_button]:cursor-pointer [&_th_button:hover]:text-ink [&_th_button.on]:text-ink [&_.num]:text-right [&_.num]:tabular-nums [&_.right]:text-right [&_.tick]:w-7 [&_.grow-cell]:w-full [&_tr.picked_td]:bg-[light-dark(#fff7f6,#1f2659)] [&.compact_td]:p-1.5 [&.compact_td]:align-top [&.adm-log_td]:align-top">
                  <tbody>
                    {d.items.map(x => (
                      <tr key={x.id} className={picked.has(x.id) ? "picked" : ""}>
                        <td className="tick">
                          <Input type="checkbox" aria-label={`Select ${x.name}`} checked={picked.has(x.id)} onChange={e => togglePick(x.id, e.target.checked)} />
                        </td>
                        <td><b>{x.name}</b>{x.artist && <span className="text-muted"> by {x.artist}</span>}</td>
                        <td className="num text-muted text-[13px]">{x.basePlaycount ? `${num(x.basePlaycount)} imported plays` : ""}</td>
                        <td className="whitespace-nowrap text-muted text-[13px]">added {ago(x.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        );
      }}</Async>
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
  const askDelete = (g: { id: number; name: string; uses: number }) => ask({
    title: `Delete tag “${g.name}”`,
    action: "Delete tag",
    danger: true,
    body: <p>Removes the tag from {plural(g.uses, "item")}, along with its wiki and wall. This can't be undone.</p>,
    run: note => api<TagDeleted>("/admin/tags/delete", { body: { id: g.id, note } }).then(() => {
      q.reload();
      flash.set({ ok: true, text: `Deleted “${g.name}”.` });
    }),
  });
  return (
    <>
      {modal}
      <div className="flex flex-wrap items-center gap-2.5 mb-3.5 [&_.astryx-text-input]:min-w-[170px] [&>.field]:min-w-[170px] [&>div:has(>input)]:min-w-[170px] max-[861px]:[&>*]:flex-[1_1_160px]">
        <form className="min-w-[260px] flex-[0_1_340px] [&_.search-field]:h-10 [&_.search-go]:w-[42px] [&_.search-go]:text-base [&.wide]:flex-1 [&.wide]:min-w-0 max-[861px]:flex-[1_1_100%] max-[861px]:min-w-0" onSubmit={search}>
          <SearchField value={text} onChange={setText} placeholder="Search tags" clearable />
        </form>
        <Select label="Sort" value={sort} onChange={v => set({ sort: v === "uses" ? "" : v })} options={[["uses", "Most used"], ["name", "A to Z"]]} />
      </div>
      {flash.note}
      <Async q={q}>{d => (
        <>
          {d.items.length === 0 ? <Empty>No tags match.</Empty> : (
            <div className="overflow-x-auto mb-3.5">
              <table className="adm-table [&_th_button_.ico]:ml-1 [&_th_button_.ico]:size-[.85em] w-full border-collapse text-sm [&_td]:p-2 [&_td]:border-b [&_td]:border-line [&_td]:align-middle [&_th]:text-left [&_th]:text-xs [&_th]:font-bold [&_th]:uppercase [&_th]:tracking-[.05em] [&_th]:text-muted [&_th]:p-2 [&_th]:border-b-2 [&_th]:border-line [&_th]:whitespace-nowrap [&_th_button]:bg-transparent [&_th_button]:border-0 [&_th_button]:p-0 [&_th_button]:[font:inherit] [&_th_button]:text-inherit [&_th_button]:uppercase [&_th_button]:tracking-[.05em] [&_th_button]:cursor-pointer [&_th_button:hover]:text-ink [&_th_button.on]:text-ink [&_.num]:text-right [&_.num]:tabular-nums [&_.right]:text-right [&_.tick]:w-7 [&_.grow-cell]:w-full [&_tr.picked_td]:bg-[light-dark(#fff7f6,#1f2659)] [&.compact_td]:p-1.5 [&.compact_td]:align-top [&.adm-log_td]:align-top">
                <thead>
                  <tr>
                    <th>Tag</th>
                    <th className="num">Uses</th>
                    <th className="num">By listeners</th>
                    <th className="num">Imported</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {d.items.map(g => (
                    <tr key={g.id}>
                      <td><Link className="font-semibold" to={tagUrl(g.name)}>{g.name}</Link></td>
                      <td className="num">{num(g.uses)}</td>
                      <td className="num">{num(g.users)}</td>
                      <td className="num">{num(g.imported ?? 0)}</td>
                      <td className="text-right"><Button kind="small" className="bg-transparent border-0 p-0 text-link font-semibold hover:underline" type="button" onClick={() => askDelete(g)}>Delete</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pager total={d.total} limit={d.limit} />
        </>
      )}</Async>
    </>
  );
}
