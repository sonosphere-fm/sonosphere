import { Suspense, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button, Input } from "../kit";
import { ago, api, num, plural, qs, useApi, useTitle } from "../lib";
import { Async, Empty, Pager, Section } from "../ui/base";
import { adminUrl, admBadge, useQuery, useConfirm } from "./common";
import type { ContentList, JournalItem, Ok, ShoutItem, WikiHistory, WikiItem, WikiLocked, WikiLockList, WikiReverted } from "../../shared/admin-content";

// a list holds one kind at a time, so rows are told apart by their fields
type ContentItem = ShoutItem | JournalItem | WikiItem;
const allItems = (d: ContentList): ContentItem[] => d.items;
const isShout = (it: ContentItem): it is ShoutItem => "body" in it;
const isJournal = (it: ContentItem): it is JournalItem => "title" in it;

const DELETE_NAME: Record<string, string> = { wiki: "wiki revision", journal: "journal post" };

function ReportCount({ n }: { n: number }) {
  if (n <= 0) return null;
  return <> · <b className="text-accent-dark">{plural(n, "open report")}</b></>;
}

export function Content() {
  const [sp, set] = useQuery();
  const [modal, ask] = useConfirm();
  const kind = sp.get("kind") || "shouts";
  const term = sp.get("q") || "";
  const who = sp.get("user") || "";
  const locked = sp.get("locked") || "";
  const page = sp.get("page") || "";
  const [text, setText] = useState(term);
  const [user, setUser] = useState(who);
  const [wiki, setWiki] = useState<string | null>(null);
  const [lockRev, setLockRev] = useState(0);
  const q = useApi<ContentList>(`/admin/content${qs({ kind, q: term, user: who, locked: kind === "wikis" ? locked : "", page })}`);
  useTitle("Content");
  const del = (k: string, id: number, what: ReactNode) => ask({
    title: `Delete ${DELETE_NAME[k] ?? k}`,
    action: "Delete",
    danger: true,
    body: (
      <>
        {what}
        <p>This can't be undone{k === "journal" ? ", and its comments go with it" : ""}. Open reports on it are closed.</p>
      </>
    ),
    run: note => api<Ok>("/admin/content/delete", { body: { kind: k, id, note } }).then(() => q.reload()),
  });
  const switchKind = (k: string) => {
    setWiki(null);
    set({ kind: k === "shouts" ? "" : k, locked: "" });
  };
  const filter = (e: FormEvent) => {
    e.preventDefault();
    set({ q: text.trim(), user: user.trim() });
  };
  const clear = () => {
    setText("");
    setUser("");
    set({ q: "", user: "" });
  };
  const wikiChanged = () => {
    q.reload();
    setLockRev(n => n + 1);
  };
  return (
    <>
      {modal}
      <div className="toolbar flex items-center justify-between gap-3.5 flex-wrap mb-3.5 max-sm:items-stretch max-sm:flex-col [&_.page-title]:mb-0 [&_.tabs]:mb-0 [&_.tabs]:flex-1">
        <nav className="tabs sub flex flex-wrap mb-6 *:hover:no-underline *:current:font-medium gap-1 *:m-0 *:h-auto *:rounded-none *:border-0 *:bg-fill *:px-[11px] *:py-[5px] *:text-[11px] *:font-medium *:uppercase *:tracking-[.05em] *:text-ink *:hover:bg-fill-hover *:hover:text-ink *:current:bg-ink *:current:text-bg max-md:toolbar:max-w-full">
          {[["shouts", "Wall posts"], ["journals", "Journals"], ["wikis", "Wiki revisions"]].map(([k, l]) => (
            <button key={k} type="button" className={kind === k ? "active" : ""} onClick={() => switchKind(k)}>{l}</button>
          ))}
        </nav>
      </div>
      <form className="flex flex-wrap items-center gap-2.5 mb-3.5 [&_.astryx-text-input]:min-w-[170px] [&>.field]:min-w-[170px] [&>div:has(>input)]:min-w-[170px] max-[861px]:[&>*]:flex-[1_1_160px]" onSubmit={filter}>
        <Input value={text} onChange={e => setText(e.target.value)} placeholder="Search text" aria-label="Search text" />
        <Input value={user} onChange={e => setUser(e.target.value)} placeholder="Author username" aria-label="Author" />
        <Button kind="btn small">Filter</Button>
        {kind === "wikis" && (
          <label className="check flex! flex-row! items-start gap-2.5 font-normal! text-[15px] [&_input]:w-4! [&_input]:mt-[3px] [&_input]:flex-none [&_input[type=checkbox]]:h-4! [&_input[type=checkbox]]:min-h-0! [&_input[type=checkbox]]:p-0! items-center! text-sm! m-0">
            <Input type="checkbox" checked={locked === "1"} onChange={e => set({ locked: e.target.checked ? "1" : "" })} /> Locked pages only
          </label>
        )}
        {(term || who) && <Button kind="small" className="bg-transparent border-0 p-0 text-link font-semibold hover:underline" type="button" onClick={clear}>Clear</Button>}
      </form>
      <Async q={q}>{d => (
        <>
          <p className="text-muted text-[13px]">{num(d.total)} found</p>
          {d.items.length === 0 && <Empty>Nothing matches.</Empty>}
          <ul className="list-none m-0 p-0 [&>li]:py-3 [&>li]:border-b [&>li]:border-line [&>li_p]:m-0 [&>li_p]:mb-1 [&.compact>li]:flex [&.compact>li]:justify-between [&.compact>li]:gap-x-3.5 [&.compact>li]:gap-y-1.5 [&.compact>li]:flex-wrap [&.compact>li]:py-2 [&.compact>li]:text-sm">
            {allItems(d).map(it => {
              if (isShout(it)) {
                return (
                  <li key={it.id}>
                    <p className="whitespace-pre-wrap wrap-anywhere">{it.body}</p>
                    <div className="row flex gap-2.5 items-center flex-wrap justify-between">
                      <span className="text-muted text-[13px]">
                        <Link to={adminUrl(it.author)}>{it.author}</Link> on{" "}
                        {it.page ? <Link to={it.page.link}>{it.page.label}</Link> : "a removed page"} · {ago(it.createdAt)}
                        <ReportCount n={it.reports} />
                      </span>
                      <Button kind="small" className="bg-transparent border-0 p-0 text-link font-semibold hover:underline" type="button" onClick={() => del("shout", it.id, <blockquote className="m-0 mb-2.5 px-3 py-2 border-l-[3px] border-line bg-panel whitespace-pre-wrap max-h-[200px] overflow-auto">{it.body}</blockquote>)}>
                        Delete
                      </Button>
                    </div>
                  </li>
                );
              }
              if (isJournal(it)) {
                return (
                  <li key={it.id}>
                    <p><Link className="font-semibold" to={it.link || "#"}>{it.title}</Link></p>
                    <p className="whitespace-pre-wrap wrap-anywhere text-muted">{it.excerpt}</p>
                    <div className="row flex gap-2.5 items-center flex-wrap justify-between">
                      <span className="text-muted text-[13px]">
                        <Link to={adminUrl(it.author)}>{it.author}</Link> · {ago(it.createdAt)} · {plural(it.comments, "comment")}
                        <ReportCount n={it.reports} />
                      </span>
                      <Button kind="small" className="bg-transparent border-0 p-0 text-link font-semibold hover:underline" type="button" onClick={() => del("journal", it.id, <p>“{it.title}” by {it.author}</p>)}>Delete</Button>
                    </div>
                  </li>
                );
              }
              const key = String(it.id);
              const showing = wiki === key;
              const revisionText = (
                <p>Version {it.version} of the wiki for {it.page?.label}.{it.latest ? " The previous version becomes current." : ""}</p>
              );
              return (
                <li key={it.id}>
                  <p>
                    {it.page ? <Link className="font-semibold" to={it.page.link}>{it.page.label}</Link> : "Removed page"}{" "}
                    <span className="text-xs font-semibold uppercase tracking-[.05em] text-muted">{it.itemType}</span>{" "}
                    <span className="text-muted text-[13px]">version {it.version}{it.latest ? " (current)" : ""}</span>
                    {it.locked && <span className={admBadge("warn")}>Locked</span>}
                  </p>
                  <p className="whitespace-pre-wrap wrap-anywhere text-muted">{it.excerpt}</p>
                  <div className="row flex gap-2.5 items-center flex-wrap justify-between">
                    <span className="text-muted text-[13px]">
                      {it.author ? <Link to={adminUrl(it.author)}>{it.author}</Link> : "deleted user"} · {ago(it.createdAt)}
                      <ReportCount n={it.reports} />
                    </span>
                    <span className="row flex gap-2.5 items-center flex-wrap max-sm:hero:gap-2">
                      <Button kind="small" className="bg-transparent border-0 p-0 text-link font-semibold hover:underline" type="button" onClick={() => setWiki(showing ? null : key)}>
                        {showing ? "Hide history" : "History and lock"}
                      </Button>
                      <Button kind="small" className="bg-transparent border-0 p-0 text-link font-semibold hover:underline" type="button" onClick={() => del("wiki", it.id, revisionText)}>Delete revision</Button>
                    </span>
                  </div>
                  {showing && (
                    <Suspense fallback={<p className="text-muted text-[13px]">Loading history…</p>}>
                      <WikiPanel type={it.itemType} id={it.itemId} onChange={wikiChanged} />
                    </Suspense>
                  )}
                </li>
              );
            })}
          </ul>
          <Pager total={d.total} limit={d.limit} />
        </>
      )}</Async>
      {kind === "wikis" && <Suspense fallback={null}><Locks rev={lockRev} /></Suspense>}
    </>
  );
}

function WikiPanel({ type, id, onChange }: { type: string; id: number; onChange: () => void }) {
  const q = useApi<WikiHistory>(`/admin/wiki${qs({ type, id })}`);
  const [modal, ask] = useConfirm();
  const [open, setOpen] = useState<number | null>(null);
  const reload = () => {
    q.reload();
    onChange();
  };
  const setLock = (locked: boolean, note: string) => api<WikiLocked>("/admin/wiki/lock", { body: { type, id, locked, note } }).then(reload);
  const revert = (revision: number, note: string) => api<WikiReverted>("/admin/wiki/revert", { body: { revision, note } }).then(reload);
  return (
    <div className="mt-2.5 p-3 bg-panel border border-line [&_.adm-table]:mt-2.5 [&_.adm-table]:bg-card">
      {modal}
      <Async q={q}>{d => {
        const toggleLock = () => {
          if (d.lock) {
            ask({
              title: `Unlock wiki for ${d.page.label}`,
              action: "Unlock",
              body: <p>Everyone will be able to edit it again.</p>,
              run: note => setLock(false, note),
            });
          } else {
            ask({
              title: `Lock wiki for ${d.page.label}`,
              action: "Lock",
              note: "Reason",
              body: <p>Only staff will be able to edit it until it's unlocked.</p>,
              run: note => setLock(true, note),
            });
          }
        };
        return (
          <>
            <div className="row flex gap-2.5 items-center flex-wrap justify-between">
              <span className="text-[13px]">
                {d.lock ? (
                  <>
                    <b>Locked</b> by {d.lock.by || "staff"} {ago(d.lock.at)}{d.lock.reason && <>: “{d.lock.reason}”</>}. Only staff can edit.
                  </>
                ) : "Anyone who isn't suspended can edit this wiki."}
              </span>
              <Button kind="btn ghost small" type="button" onClick={toggleLock}>{d.lock ? "Unlock" : "Lock"}</Button>
            </div>
            <table className="adm-table [&_th_button_.ico]:ml-1 [&_th_button_.ico]:size-[.85em] compact w-full border-collapse text-sm [&_td]:p-2 [&_td]:border-b [&_td]:border-line [&_td]:align-middle [&_th]:text-left [&_th]:text-xs [&_th]:font-bold [&_th]:uppercase [&_th]:tracking-[.05em] [&_th]:text-muted [&_th]:p-2 [&_th]:border-b-2 [&_th]:border-line [&_th]:whitespace-nowrap [&_th_button]:bg-transparent [&_th_button]:border-0 [&_th_button]:p-0 [&_th_button]:[font:inherit] [&_th_button]:text-inherit [&_th_button]:uppercase [&_th_button]:tracking-[.05em] [&_th_button]:cursor-pointer [&_th_button:hover]:text-ink [&_th_button.on]:text-ink [&_.num]:text-right [&_.num]:tabular-nums [&_.right]:text-right [&_.tick]:w-7 [&_.grow-cell]:w-full [&_tr.picked_td]:bg-[light-dark(#fff7f6,#1f2659)] [&.compact_td]:p-1.5 [&.compact_td]:align-top [&.adm-log_td]:align-top [&_.c-name]:w-auto">
              <tbody>
                {d.versions.map((v, i) => {
                  const askRevert = () => ask({
                    title: `Revert to version ${v.version}`,
                    action: "Revert",
                    body: <p>Saves version {v.version} as a new current version. Nothing is lost: the history keeps every version.</p>,
                    run: note => revert(v.id, note),
                  });
                  return (
                    <tr key={v.id}>
                      <td className="whitespace-nowrap">v{v.version}{i === 0 && <span className="text-muted"> current</span>}</td>
                      <td className="grow-cell">
                        <button type="button" className="bg-transparent border-0 p-0 [font:inherit] text-link text-left cursor-pointer hover:underline" onClick={() => setOpen(open === v.id ? null : v.id)}>
                          {v.content.slice(0, 90)}{v.content.length > 90 ? "…" : ""}
                        </button>
                        {open === v.id && <pre className="whitespace-pre-wrap [font-family:inherit] [font-style:inherit] [font-weight:inherit] [line-height:inherit] text-[13px] mt-1.5 mb-0 p-2 bg-panel max-h-[260px] overflow-auto">{v.content}</pre>}
                      </td>
                      <td className="whitespace-nowrap text-muted text-[13px]">{v.author || "deleted user"} · {ago(v.createdAt)}</td>
                      <td className="whitespace-nowrap">
                        {i > 0 && <Button kind="small" className="bg-transparent border-0 p-0 text-link font-semibold hover:underline" type="button" onClick={askRevert}>Revert to this</Button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        );
      }}</Async>
    </div>
  );
}

function Locks({ rev }: { rev: number }) {
  const q = useApi<WikiLockList>("/admin/wiki/locks");
  useEffect(() => {
    if (rev) q.reload();
  }, [rev]);
  return (
    <Section title="Locked wikis">
      <Async q={q}>{d => {
        if (d.items.length === 0) return <p className="text-muted">No wiki is locked.</p>;
        return (
          <ul className="list-none m-0 p-0 [&>li]:py-3 [&>li]:border-b [&>li]:border-line [&>li_p]:m-0 [&>li_p]:mb-1 [&.compact>li]:flex [&.compact>li]:justify-between [&.compact>li]:gap-x-3.5 [&.compact>li]:gap-y-1.5 [&.compact>li]:flex-wrap [&.compact>li]:py-2 [&.compact>li]:text-sm [&_.c-name]:w-auto">
            {d.items.map(l => (
              <li key={`${l.type}:${l.id}`}>
                <span>
                  {l.page ? <Link to={l.page.link}>{l.page.label}</Link> : "Removed page"} <span className="text-xs font-semibold uppercase tracking-[.05em] text-muted">{l.type}</span>
                </span>
                <span className="text-muted text-[13px]">by {l.by || "staff"} · {ago(l.at)}{l.reason && <> · “{l.reason}”</>}</span>
              </li>
            ))}
          </ul>
        );
      }}</Async>
    </Section>
  );
}
