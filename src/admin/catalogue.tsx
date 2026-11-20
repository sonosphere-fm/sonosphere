import { Suspense, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Input, Modal, SearchField, Select } from "../kit";
import { ago, albumUrl, api, artistUrl, num, plural, qs, tagUrl, trackUrl, useApi, useTitle } from "../lib";
import { Async, Empty, Pager } from "../ui/base";
import { useQuery, useConfirm, useAction2, useFlash } from "./common";
import type { AdminTagList, CatalogueDuplicates, CatalogueItem, CatalogueMerged, CatalogueSearch, Ok, OrphanList, OrphansDeleted, TagDeleted } from "../../shared/admin-content";

// ---------- catalogue ----------
const KIND_LABEL: Record<string, string> = { artist: "Artists", album: "Albums", track: "Tracks" };
const itemUrl = (kind: string, it: CatalogueItem) => kind === "artist" ? artistUrl(it.name) : kind === "album" ? albumUrl(it.artist ?? "", it.name) : trackUrl(it.artist ?? "", it.name);
export function Catalogue() {
  const [sp, set] = useQuery(), tab = sp.get("tab") || "duplicates";
  useTitle("Catalogue");
  return (
    <>
      <div className="toolbar">
        <nav className="tabs sub">{[["duplicates", "Duplicate artists"], ["browse", "Rename and merge"], ["orphans", "Orphans"], ["tags", "Tags"]].map(([k, l]) => (
          <button key={k} type="button" className={tab === k ? "active" : ""} onClick={() => set({ tab: k === "duplicates" ? "" : k, kind: "", q: "" })}>{l}</button>
        ))}</nav>
      </div>
      {tab === "duplicates" ? <Duplicates /> : tab === "browse" ? <Browse /> : tab === "orphans" ? <Orphans /> : <Tags />}
    </>
  );
}
function Duplicates() {
  const q = useApi<CatalogueDuplicates>("/admin/catalogue/duplicates"), [modal, ask] = useConfirm(), [target, setTarget] = useState<Record<number, number>>({}), flash = useFlash();
  return (
    <>
      {modal}
      <p className="muted">Artists whose names only differ by case, accents, punctuation, “the” or “&amp;”. Pick the one to keep; the rest are merged into it with their tracks, albums, scrobbles, tags, wiki history and wall posts. Tracks and albums with the same title are combined.</p>
      {flash.note}
      <Async q={q}>{d => d.groups.length === 0 ? <Empty>No likely duplicates.</Empty> : (
        <div className="adm-groups">{d.groups.map((g, gi) => {
          const keep = target[gi] ?? g[0].id, kept = g.find(a => a.id === keep)!, rest = g.filter(a => a.id !== keep);
          return (
            <div key={g.map(a => a.id).join("-")} className="adm-group">
              <ul>{g.map(a => (
                <li key={a.id}>
                  <label className="adm-radio"><input type="radio" name={`dup-${gi}`} checked={a.id === keep} onChange={() => setTarget({ ...target, [gi]: a.id })} />
                    <span className="grow"><b>{a.name}</b> <Link className="muted small" to={artistUrl(a.name)}>view</Link></span>
                    <span className="muted small">{plural(a.scrobbles, "scrobble")} · {plural(a.tracks, "track")} · {plural(a.albums, "album")}</span></label>
                </li>
              ))}</ul>
              <Button kind="btn ghost small" type="button" onClick={() => ask({ title: `Merge into ${kept.name}`, action: `Merge ${rest.length}`, danger: true,
                body: <p>Merge {rest.map(a => `“${a.name}”`).join(", ")} into “{kept.name}”. The merged artists are deleted. This can't be undone.</p>,
                run: async note => { let done = 0; for (const a of rest) { await api<CatalogueMerged>("/admin/catalogue/merge", { body: { kind: "artist", source: a.id, target: keep, note } }); done++; } q.reload(); flash.set({ ok: true, text: `Merged ${plural(done, "artist")} into ${kept.name}.` }); } })}>
                Keep “{kept.name}”, merge {rest.length} other{rest.length === 1 ? "" : "s"}
              </Button>
            </div>
          );
        })}</div>
      )}</Async>
    </>
  );
}
function Browse() {
  const [sp, set] = useQuery(), kind = sp.get("kind") || "artist", term = sp.get("q") || "", page = sp.get("page") || "";
  const [text, setText] = useState(term), [rename, setRename] = useState<CatalogueItem | null>(null), [merge, setMerge] = useState<CatalogueItem | null>(null), flash = useFlash();
  const q = useApi<CatalogueSearch>(`/admin/catalogue/search${qs({ kind, q: term, page })}`);
  return (
    <>
      <div className="adm-filterbar">
        <Select label="Kind" value={kind} onChange={v => set({ kind: v === "artist" ? "" : v })} options={[["artist", "Artists"], ["album", "Albums"], ["track", "Tracks"]]} />
        <form className="adm-search" onSubmit={e => { e.preventDefault(); set({ q: text.trim() }); }}><SearchField value={text} onChange={setText} placeholder={`Search ${KIND_LABEL[kind].toLowerCase()}`} clearable /></form>
      </div>
      {flash.note}
      <Async q={q}>{d => (
        <>
          <p className="muted small">{num(d.total)} {KIND_LABEL[kind].toLowerCase()}</p>
          {d.items.length === 0 ? <Empty>Nothing matches.</Empty> : (
            <div className="adm-scroll"><table className="adm-table">
              <thead><tr><th>Name</th>{kind !== "artist" && <th>Artist</th>}{kind !== "track" && <th className="num">Tracks</th>}{kind === "artist" && <th className="num">Albums</th>}<th className="num">Scrobbles</th><th className="num">#</th><th /></tr></thead>
              <tbody>{d.items.map(it => (
                <tr key={it.id}>
                  <td><Link className="strong" to={itemUrl(kind, it)}>{it.name}</Link></td>
                  {kind !== "artist" && <td>{it.artist}</td>}
                  {kind !== "track" && <td className="num">{num(it.tracks)}</td>}
                  {kind === "artist" && <td className="num">{num(it.albums)}</td>}
                  <td className="num">{num(it.scrobbles)}</td>
                  <td className="num muted small">{it.id}</td>
                  <td className="nowrap right"><Button kind="link small" type="button" onClick={() => setRename(it)}>Rename</Button> <Button kind="link small" type="button" onClick={() => setMerge(it)}>Merge into…</Button></td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
          <Pager total={d.total} limit={d.limit} />
        </>
      )}</Async>
      {rename && <RenameDialog kind={kind} item={rename} close={() => setRename(null)} done={msg => { setRename(null); q.reload(); flash.set({ ok: true, text: msg }); }} />}
      {merge && <MergeDialog kind={kind} item={merge} close={() => setMerge(null)} done={msg => { setMerge(null); q.reload(); flash.set({ ok: true, text: msg }); }} />}
    </>
  );
}
function RenameDialog({ kind, item, close, done }: { kind: string; item: CatalogueItem; close: () => void; done: (msg: string) => void }) {
  const [name, setName] = useState(item.name), act = useAction2();
  return (
    <Modal title={`Rename ${kind}`} onClose={close}>
      <form className="form" onSubmit={e => { e.preventDefault(); act.run(async () => { await api<Ok>("/admin/catalogue/rename", { body: { kind, id: item.id, name } }); done(`Renamed “${item.name}” to “${name.trim()}”.`); }); }}>
        <p className="muted small">{item.artist ? `${item.name} by ${item.artist}` : item.name}. Every scrobble, tag and page follows the new name. If the name is taken, merge instead.</p>
        <label>New name<Input value={name} onChange={e => setName(e.target.value)} autoFocus aria-label="New name" /></label>
        {act.note}
        <div className="row"><Button kind="btn" loading={act.busy} disabled={!name.trim() || name.trim() === item.name}>Rename</Button><Button kind="btn ghost" type="button" onClick={close}>Cancel</Button></div>
      </form>
    </Modal>
  );
}
function MergeDialog({ kind, item, close, done }: { kind: string; item: CatalogueItem; close: () => void; done: (msg: string) => void }) {
  const [text, setText] = useState(item.name), [term, setTerm] = useState(item.name), [pick, setPick] = useState<CatalogueItem | null>(null), act = useAction2();
  return (
    <Modal title={`Merge ${kind}`} onClose={close}>
      <div className="form">
        <p className="small">Move everything from <b>{item.name}</b>{item.artist && <> by {item.artist}</>} (#{item.id}) into another {kind}, then delete it.</p>
        {!pick ? (
          <>
            <form className="adm-search wide" onSubmit={e => { e.preventDefault(); setTerm(text.trim()); }}><SearchField value={text} onChange={setText} placeholder={`Find the ${kind} to keep`} autoFocus /></form>
            <Suspense fallback={<p className="muted small">Searching…</p>}><MergeResults kind={kind} term={term} skip={item.id} onPick={setPick} /></Suspense>
          </>
        ) : (
          <form className="form" onSubmit={e => { e.preventDefault(); act.run(async () => {
            const r = await api<CatalogueMerged>("/admin/catalogue/merge", { body: { kind, source: item.id, target: pick.id } });
            done(`Merged “${item.name}” into “${pick.name}”${r.merged !== undefined ? ` (${r.merged} combined, ${r.moved} moved)` : ""}.`);
          }); }}>
            <p className="notice">Merge <b>{item.name}</b> (#{item.id}, {num(item.scrobbles)} scrobbles) into <b>{pick.name}</b>{pick.artist && <> by {pick.artist}</>} (#{pick.id}, {num(pick.scrobbles)} scrobbles)? This can't be undone.</p>
            {act.note}
            <div className="row"><Button kind="btn danger" loading={act.busy}>Merge</Button><Button kind="btn ghost" type="button" onClick={() => setPick(null)}>Pick another</Button></div>
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
      return items.length === 0 ? <p className="muted small">No other {kind} matches.</p> : (
        <ul className="adm-list compact adm-pick">{items.map(x => (
          <li key={x.id}><span><b>{x.name}</b>{x.artist && <span className="muted"> by {x.artist}</span>} <span className="muted small">#{x.id} · {plural(x.scrobbles, "scrobble")}</span></span><Button kind="btn ghost small" type="button" onClick={() => onPick(x)}>Keep this</Button></li>
        ))}</ul>
      );
    }}</Async>
  );
}
function Orphans() {
  const [sp, set] = useQuery(), kind = sp.get("kind") || "track", imported = sp.get("imported") || "";
  const q = useApi<OrphanList>(`/admin/catalogue/orphans${qs({ kind, imported })}`), [modal, ask] = useConfirm(), [picked, setPicked] = useState<Set<number>>(new Set()), flash = useFlash();
  useEffect(() => setPicked(new Set()), [kind, imported]);
  return (
    <>
      {modal}
      <div className="adm-filterbar">
        <Select label="Kind" value={kind} onChange={v => set({ kind: v === "track" ? "" : v })} options={[["track", "Tracks"], ["album", "Albums"], ["artist", "Artists"]]} />
        <label className="check adm-check"><Input type="checkbox" checked={imported === "1"} onChange={e => set({ imported: e.target.checked ? "1" : "" })} /> Include imported items with play counts</label>
      </div>
      <p className="muted small">Nobody has scrobbled, loved, tagged, written about or playlisted these{kind === "artist" ? ", and they have no tracks, albums or events" : kind === "album" ? ", and no track points at them" : ""}. Each one is checked again before it's deleted.</p>
      {flash.note}
      <Async q={q}>{d => (
        <>
          <div className="bulk-bar">
            <b>{num(d.total)} orphaned {KIND_LABEL[kind].toLowerCase()}</b>{d.total > d.items.length && <span className="muted small">(showing the newest {d.items.length})</span>}
            {d.items.length > 0 && <Button kind="link small" type="button" onClick={() => setPicked(new Set(picked.size === d.items.length ? [] : d.items.map(x => x.id)))}>{picked.size === d.items.length ? "Select none" : "Select all"}</Button>}
            {picked.size > 0 && <Button kind="btn danger small" type="button" onClick={() => ask({ title: `Delete ${plural(picked.size, kind)}`, action: "Delete", danger: true,
              body: <p>Permanently delete the selected {KIND_LABEL[kind].toLowerCase()}. Anything that started being used since this list loaded is skipped.</p>,
              run: async note => { const r = await api<OrphansDeleted>("/admin/catalogue/orphans/delete", { body: { kind, ids: [...picked], note } }); setPicked(new Set()); q.reload(); flash.set({ ok: true, text: `Deleted ${num(r.deleted)}${r.skipped ? `, skipped ${num(r.skipped)} now in use` : ""}.` }); } })}>Delete {picked.size} selected</Button>}
          </div>
          {d.items.length === 0 ? <Empty>Nothing to clean up.</Empty> : (
            <div className="adm-scroll"><table className="adm-table">
              <tbody>{d.items.map(x => (
                <tr key={x.id} className={picked.has(x.id) ? "picked" : ""}>
                  <td className="tick"><Input type="checkbox" aria-label={`Select ${x.name}`} checked={picked.has(x.id)} onChange={e => { const n = new Set(picked); e.target.checked ? n.add(x.id) : n.delete(x.id); setPicked(n); }} /></td>
                  <td><b>{x.name}</b>{x.artist && <span className="muted"> by {x.artist}</span>}</td>
                  <td className="num muted small">{x.basePlaycount ? `${num(x.basePlaycount)} imported plays` : ""}</td>
                  <td className="nowrap muted small">added {ago(x.createdAt)}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </>
      )}</Async>
    </>
  );
}
function Tags() {
  const [sp, set] = useQuery(), term = sp.get("q") || "", sort = sp.get("sort") || "uses", page = sp.get("page") || "";
  const [text, setText] = useState(term), [modal, ask] = useConfirm(), flash = useFlash();
  const q = useApi<AdminTagList>(`/admin/tags${qs({ q: term, sort: sort === "uses" ? "" : sort, page })}`);
  return (
    <>
      {modal}
      <div className="adm-filterbar">
        <form className="adm-search" onSubmit={e => { e.preventDefault(); set({ q: text.trim() }); }}><SearchField value={text} onChange={setText} placeholder="Search tags" clearable /></form>
        <Select label="Sort" value={sort} onChange={v => set({ sort: v === "uses" ? "" : v })} options={[["uses", "Most used"], ["name", "A to Z"]]} />
      </div>
      {flash.note}
      <Async q={q}>{d => (
        <>
          {d.items.length === 0 ? <Empty>No tags match.</Empty> : (
            <div className="adm-scroll"><table className="adm-table">
              <thead><tr><th>Tag</th><th className="num">Uses</th><th className="num">By listeners</th><th className="num">Imported</th><th /></tr></thead>
              <tbody>{d.items.map(g => (
                <tr key={g.id}>
                  <td><Link className="strong" to={tagUrl(g.name)}>{g.name}</Link></td>
                  <td className="num">{num(g.uses)}</td><td className="num">{num(g.users)}</td><td className="num">{num(g.imported ?? 0)}</td>
                  <td className="right"><Button kind="link small" type="button" onClick={() => ask({ title: `Delete tag “${g.name}”`, action: "Delete tag", danger: true,
                    body: <p>Removes the tag from {plural(g.uses, "item")}, along with its wiki and wall. This can't be undone.</p>,
                    run: note => api<TagDeleted>("/admin/tags/delete", { body: { id: g.id, note } }).then(() => { q.reload(); flash.set({ ok: true, text: `Deleted “${g.name}”.` }); }) })}>Delete</Button></td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
          <Pager total={d.total} limit={d.limit} />
        </>
      )}</Async>
    </>
  );
}
