import { Suspense, useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button, Input } from "../kit";
import { ago, api, num, plural, qs, useApi, useTitle } from "../lib";
import { Async, Empty, Pager, Section } from "../ui/base";
import { adminUrl, useQuery, useConfirm } from "./common";
import type { ContentList, JournalItem, Ok, ShoutItem, WikiHistory, WikiItem, WikiLocked, WikiLockList, WikiReverted } from "../../shared/admin-content";

// ---------- content ----------
// One list holds a single kind (the `kind` asked for); these tell the rows apart by their fields.
type ContentItem = ShoutItem | JournalItem | WikiItem;
const allItems = (d: ContentList): ContentItem[] => d.items;
const isShout = (it: ContentItem): it is ShoutItem => "body" in it;
const isJournal = (it: ContentItem): it is JournalItem => "title" in it;
export function Content() {
  const [sp, set] = useQuery(), [modal, ask] = useConfirm();
  const kind = sp.get("kind") || "shouts", term = sp.get("q") || "", who = sp.get("user") || "", locked = sp.get("locked") || "", page = sp.get("page") || "";
  const [text, setText] = useState(term), [user, setUser] = useState(who), [wiki, setWiki] = useState<string | null>(null), [lockRev, setLockRev] = useState(0);
  const q = useApi<ContentList>(`/admin/content${qs({ kind, q: term, user: who, locked: kind === "wikis" ? locked : "", page })}`);
  useTitle("Content");
  const del = (k: string, id: number, what: ReactNode) => ask({ title: `Delete ${k === "wiki" ? "wiki revision" : k === "journal" ? "journal post" : k}`, action: "Delete", danger: true,
    body: <>{what}<p>This can't be undone{k === "journal" ? ", and its comments go with it" : ""}. Open reports on it are closed.</p></>, run: note => api<Ok>("/admin/content/delete", { body: { kind: k, id, note } }).then(() => q.reload()) });
  return (
    <>
      {modal}
      <div className="toolbar">
        <nav className="tabs sub">{[["shouts", "Wall posts"], ["journals", "Journals"], ["wikis", "Wiki revisions"]].map(([k, l]) => (
          <button key={k} type="button" className={kind === k ? "active" : ""} onClick={() => { setWiki(null); set({ kind: k === "shouts" ? "" : k, locked: "" }); }}>{l}</button>
        ))}</nav>
      </div>
      <form className="adm-filterbar" onSubmit={e => { e.preventDefault(); set({ q: text.trim(), user: user.trim() }); }}>
        <Input value={text} onChange={e => setText(e.target.value)} placeholder="Search text" aria-label="Search text" />
        <Input value={user} onChange={e => setUser(e.target.value)} placeholder="Author username" aria-label="Author" />
        <Button kind="btn small">Filter</Button>
        {kind === "wikis" && <label className="check adm-check"><Input type="checkbox" checked={locked === "1"} onChange={e => set({ locked: e.target.checked ? "1" : "" })} /> Locked pages only</label>}
        {(term || who) && <Button kind="link small" type="button" onClick={() => { setText(""); setUser(""); set({ q: "", user: "" }); }}>Clear</Button>}
      </form>
      <Async q={q}>{d => (
        <>
          <p className="muted small">{num(d.total)} found</p>
          {d.items.length === 0 && <Empty>Nothing matches.</Empty>}
          <ul className="adm-list">{allItems(d).map(it => {
            if (isShout(it)) return (
              <li key={it.id}>
                <p className="adm-body-text">{it.body}</p>
                <div className="row between">
                  <span className="muted small"><Link to={adminUrl(it.author)}>{it.author}</Link> on {it.page ? <Link to={it.page.link}>{it.page.label}</Link> : "a removed page"} · {ago(it.createdAt)}{it.reports > 0 && <> · <b className="adm-red">{plural(it.reports, "open report")}</b></>}</span>
                  <Button kind="link small" type="button" onClick={() => del("shout", it.id, <blockquote className="adm-quote">{it.body}</blockquote>)}>Delete</Button>
                </div>
              </li>
            );
            if (isJournal(it)) return (
              <li key={it.id}>
                <p><Link className="strong" to={it.link || "#"}>{it.title}</Link></p>
                <p className="adm-body-text muted">{it.excerpt}</p>
                <div className="row between">
                  <span className="muted small"><Link to={adminUrl(it.author)}>{it.author}</Link> · {ago(it.createdAt)} · {plural(it.comments, "comment")}{it.reports > 0 && <> · <b className="adm-red">{plural(it.reports, "open report")}</b></>}</span>
                  <Button kind="link small" type="button" onClick={() => del("journal", it.id, <p>“{it.title}” by {it.author}</p>)}>Delete</Button>
                </div>
              </li>
            );
            const key = String(it.id);
            return (
              <li key={it.id}>
                <p>{it.page ? <Link className="strong" to={it.page.link}>{it.page.label}</Link> : "Removed page"} <span className="adm-type">{it.itemType}</span> <span className="muted small">version {it.version}{it.latest ? " (current)" : ""}</span>{it.locked && <span className="adm-badge warn">Locked</span>}</p>
                <p className="adm-body-text muted">{it.excerpt}</p>
                <div className="row between">
                  <span className="muted small">{it.author ? <Link to={adminUrl(it.author)}>{it.author}</Link> : "deleted user"} · {ago(it.createdAt)}{it.reports > 0 && <> · <b className="adm-red">{plural(it.reports, "open report")}</b></>}</span>
                  <span className="row">
                    <Button kind="link small" type="button" onClick={() => setWiki(wiki === key ? null : key)}>{wiki === key ? "Hide history" : "History and lock"}</Button>
                    <Button kind="link small" type="button" onClick={() => del("wiki", it.id, <p>Version {it.version} of the wiki for {it.page?.label}.{it.latest ? " The previous version becomes current." : ""}</p>)}>Delete revision</Button>
                  </span>
                </div>
                {wiki === key && <Suspense fallback={<p className="muted small">Loading history…</p>}><WikiPanel type={it.itemType} id={it.itemId} onChange={() => { q.reload(); setLockRev(n => n + 1); }} /></Suspense>}
              </li>
            );
          })}</ul>
          <Pager total={d.total} limit={d.limit} />
        </>
      )}</Async>
      {kind === "wikis" && <Suspense fallback={null}><Locks rev={lockRev} /></Suspense>}
    </>
  );
}
function WikiPanel({ type, id, onChange }: { type: string; id: number; onChange: () => void }) {
  const q = useApi<WikiHistory>(`/admin/wiki${qs({ type, id })}`), [modal, ask] = useConfirm(), [open, setOpen] = useState<number | null>(null);
  const reload = () => { q.reload(); onChange(); };
  return (
    <div className="adm-wiki">
      {modal}
      <Async q={q}>{d => (
        <>
          <div className="row between">
            <span className="small">{d.lock ? <><b>Locked</b> by {d.lock.by || "staff"} {ago(d.lock.at)}{d.lock.reason && <>: “{d.lock.reason}”</>}. Only staff can edit.</> : "Anyone who isn't suspended can edit this wiki."}</span>
            <Button kind="btn ghost small" type="button" onClick={() => ask(d.lock
              ? { title: `Unlock wiki for ${d.page.label}`, action: "Unlock", body: <p>Everyone will be able to edit it again.</p>, run: note => api<WikiLocked>("/admin/wiki/lock", { body: { type, id, locked: false, note } }).then(reload) }
              : { title: `Lock wiki for ${d.page.label}`, action: "Lock", note: "Reason", body: <p>Only staff will be able to edit it until it's unlocked.</p>, run: note => api<WikiLocked>("/admin/wiki/lock", { body: { type, id, locked: true, note } }).then(reload) })}>{d.lock ? "Unlock" : "Lock"}</Button>
          </div>
          <table className="adm-table compact">
            <tbody>{d.versions.map((v, i) => (
              <tr key={v.id}>
                <td className="nowrap">v{v.version}{i === 0 && <span className="muted"> current</span>}</td>
                <td className="grow-cell">
                  <button type="button" className="adm-linkish" onClick={() => setOpen(open === v.id ? null : v.id)}>{v.content.slice(0, 90)}{v.content.length > 90 ? "…" : ""}</button>
                  {open === v.id && <pre className="adm-pre">{v.content}</pre>}
                </td>
                <td className="nowrap muted small">{v.author || "deleted user"} · {ago(v.createdAt)}</td>
                <td className="nowrap">{i > 0 && <Button kind="link small" type="button" onClick={() => ask({ title: `Revert to version ${v.version}`, action: "Revert",
                  body: <p>Saves version {v.version} as a new current version. Nothing is lost: the history keeps every version.</p>, run: note => api<WikiReverted>("/admin/wiki/revert", { body: { revision: v.id, note } }).then(reload) })}>Revert to this</Button>}</td>
              </tr>
            ))}</tbody>
          </table>
        </>
      )}</Async>
    </div>
  );
}
function Locks({ rev }: { rev: number }) {
  const q = useApi<WikiLockList>("/admin/wiki/locks");
  useEffect(() => { if (rev) q.reload(); }, [rev]);
  return (
    <Section title="Locked wikis">
      <Async q={q}>{d => d.items.length === 0 ? <p className="muted">No wiki is locked.</p> : (
        <ul className="adm-list compact">{d.items.map(l => (
          <li key={`${l.type}:${l.id}`}><span>{l.page ? <Link to={l.page.link}>{l.page.label}</Link> : "Removed page"} <span className="adm-type">{l.type}</span></span><span className="muted small">by {l.by || "staff"} · {ago(l.at)}{l.reason && <> · “{l.reason}”</>}</span></li>
        ))}</ul>
      )}</Async>
    </Section>
  );
}
