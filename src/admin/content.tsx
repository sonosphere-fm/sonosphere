import { Suspense, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button, Input } from "../kit";
import { ago, api, num, plural, qs, useApi, useTitle } from "../lib";
import { Async, Empty, Pager, Section } from "../ui/base";
import { Badge, CHECK, COMPACT_LIST, COMPACT_TABLE, FILTERBAR, LINKISH, LIST } from "./common";
import { QUOTE, RED, TOOLBAR, TYPE_LABEL, adminUrl, cx, useQuery, useConfirm } from "./common";
import type {
  ContentList,
  JournalItem,
  Ok,
  ShoutItem,
  WikiHistory,
  WikiItem,
  WikiLocked,
  WikiLockList,
  WikiReverted,
} from "../../shared/admin-content";

// a list holds one kind at a time, so rows are told apart by their fields
type ContentItem = ShoutItem | JournalItem | WikiItem;
const allItems = (d: ContentList): ContentItem[] => d.items;
const isShout = (it: ContentItem): it is ShoutItem => "body" in it;
const isJournal = (it: ContentItem): it is JournalItem => "title" in it;

const BODY_TEXT = "whitespace-pre-wrap wrap-anywhere";
const PRE = cx(
  "whitespace-pre-wrap wrap-anywhere [font-family:inherit] leading-[inherit] text-[13px]",
  "m-[6px_0_0] p-2 bg-site-panel max-h-[260px] overflow-auto"
);
const DELETE_NAME: Record<string, string> = { wiki: "wiki revision", journal: "journal post" };

function ReportCount({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <>
      {" "}
      · <b className={RED}>{plural(n, "open report")}</b>
    </>
  );
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
  const q = useApi<ContentList>(
    `/admin/content${qs({ kind, q: term, user: who, locked: kind === "wikis" ? locked : "", page })}`
  );
  useTitle("Content");
  const del = (k: string, id: number, what: ReactNode) =>
    ask({
      title: `Delete ${DELETE_NAME[k] ?? k}`,
      action: "Delete",
      danger: true,
      body: (
        <>
          {what}
          <p>
            This can't be undone{k === "journal" ? ", and its comments go with it" : ""}. Open reports on it are closed.
          </p>
        </>
      ),
      run: (note) => api<Ok>("/admin/content/delete", { body: { kind: k, id, note } }).then(() => q.reload()),
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
    setLockRev((n) => n + 1);
  };
  return (
    <>
      {modal}
      <div className={TOOLBAR}>
        <nav className="tabs sub">
          {[
            ["shouts", "Wall posts"],
            ["journals", "Journals"],
            ["wikis", "Wiki revisions"],
          ].map(([k, l]) => (
            <button key={k} type="button" className={kind === k ? "active" : ""} onClick={() => switchKind(k)}>
              {l}
            </button>
          ))}
        </nav>
      </div>
      <form className={FILTERBAR} onSubmit={filter}>
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search text"
          aria-label="Search text"
        />
        <Input
          value={user}
          onChange={(e) => setUser(e.target.value)}
          placeholder="Author username"
          aria-label="Author"
        />
        <Button kind="btn small">Filter</Button>
        {kind === "wikis" && (
          <label className={CHECK}>
            <Input
              type="checkbox"
              checked={locked === "1"}
              onChange={(e) => set({ locked: e.target.checked ? "1" : "" })}
            />{" "}
            Locked pages only
          </label>
        )}
        {(term || who) && (
          <Button kind="link small" type="button" onClick={clear}>
            Clear
          </Button>
        )}
      </form>
      <Async q={q}>
        {(d) => (
          <>
            <p className="muted small">{num(d.total)} found</p>
            {d.items.length === 0 && <Empty>Nothing matches.</Empty>}
            <ul className={LIST}>
              {allItems(d).map((it) => {
                if (isShout(it)) {
                  return (
                    <li key={it.id}>
                      <p className={BODY_TEXT}>{it.body}</p>
                      <div className="row between">
                        <span className="muted small">
                          <Link to={adminUrl(it.author)}>{it.author}</Link> on{" "}
                          {it.page ? <Link to={it.page.link}>{it.page.label}</Link> : "a removed page"} ·{" "}
                          {ago(it.createdAt)}
                          <ReportCount n={it.reports} />
                        </span>
                        <Button
                          kind="link small"
                          type="button"
                          onClick={() => del("shout", it.id, <blockquote className={QUOTE}>{it.body}</blockquote>)}
                        >
                          Delete
                        </Button>
                      </div>
                    </li>
                  );
                }
                if (isJournal(it)) {
                  return (
                    <li key={it.id}>
                      <p>
                        <Link className="strong" to={it.link || "#"}>
                          {it.title}
                        </Link>
                      </p>
                      <p className={`${BODY_TEXT} muted`}>{it.excerpt}</p>
                      <div className="row between">
                        <span className="muted small">
                          <Link to={adminUrl(it.author)}>{it.author}</Link> · {ago(it.createdAt)} ·{" "}
                          {plural(it.comments, "comment")}
                          <ReportCount n={it.reports} />
                        </span>
                        <Button
                          kind="link small"
                          type="button"
                          onClick={() =>
                            del(
                              "journal",
                              it.id,
                              <p>
                                “{it.title}” by {it.author}
                              </p>
                            )
                          }
                        >
                          Delete
                        </Button>
                      </div>
                    </li>
                  );
                }
                const key = String(it.id);
                const showing = wiki === key;
                const revisionText = (
                  <p>
                    Version {it.version} of the wiki for {it.page?.label}.
                    {it.latest ? " The previous version becomes current." : ""}
                  </p>
                );
                return (
                  <li key={it.id}>
                    <p>
                      {it.page ? (
                        <Link className="strong" to={it.page.link}>
                          {it.page.label}
                        </Link>
                      ) : (
                        "Removed page"
                      )}{" "}
                      <span className={TYPE_LABEL}>{it.itemType}</span>{" "}
                      <span className="muted small">
                        version {it.version}
                        {it.latest ? " (current)" : ""}
                      </span>
                      {it.locked && <Badge tone="warn">Locked</Badge>}
                    </p>
                    <p className={`${BODY_TEXT} muted`}>{it.excerpt}</p>
                    <div className="row between">
                      <span className="muted small">
                        {it.author ? <Link to={adminUrl(it.author)}>{it.author}</Link> : "deleted user"} ·{" "}
                        {ago(it.createdAt)}
                        <ReportCount n={it.reports} />
                      </span>
                      <span className="row">
                        <Button kind="link small" type="button" onClick={() => setWiki(showing ? null : key)}>
                          {showing ? "Hide history" : "History and lock"}
                        </Button>
                        <Button kind="link small" type="button" onClick={() => del("wiki", it.id, revisionText)}>
                          Delete revision
                        </Button>
                      </span>
                    </div>
                    {showing && (
                      <Suspense fallback={<p className="muted small">Loading history…</p>}>
                        <WikiPanel type={it.itemType} id={it.itemId} onChange={wikiChanged} />
                      </Suspense>
                    )}
                  </li>
                );
              })}
            </ul>
            <Pager total={d.total} limit={d.limit} />
          </>
        )}
      </Async>
      {kind === "wikis" && (
        <Suspense fallback={null}>
          <Locks rev={lockRev} />
        </Suspense>
      )}
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
  const setLock = (locked: boolean, note: string) =>
    api<WikiLocked>("/admin/wiki/lock", { body: { type, id, locked, note } }).then(reload);
  const revert = (revision: number, note: string) =>
    api<WikiReverted>("/admin/wiki/revert", { body: { revision, note } }).then(reload);
  return (
    <div className="mt-[10px] p-3 bg-site-panel border border-site-line">
      {modal}
      <Async q={q}>
        {(d) => {
          const toggleLock = () => {
            if (d.lock) {
              ask({
                title: `Unlock wiki for ${d.page.label}`,
                action: "Unlock",
                body: <p>Everyone will be able to edit it again.</p>,
                run: (note) => setLock(false, note),
              });
            } else {
              ask({
                title: `Lock wiki for ${d.page.label}`,
                action: "Lock",
                note: "Reason",
                body: <p>Only staff will be able to edit it until it's unlocked.</p>,
                run: (note) => setLock(true, note),
              });
            }
          };
          return (
            <>
              <div className="row between">
                <span className="small">
                  {d.lock ? (
                    <>
                      <b>Locked</b> by {d.lock.by || "staff"} {ago(d.lock.at)}
                      {d.lock.reason && <>: “{d.lock.reason}”</>}. Only staff can edit.
                    </>
                  ) : (
                    "Anyone who isn't suspended can edit this wiki."
                  )}
                </span>
                <Button kind="btn ghost small" type="button" onClick={toggleLock}>
                  {d.lock ? "Unlock" : "Lock"}
                </Button>
              </div>
              <table className={`${COMPACT_TABLE} mt-[10px] bg-site-card`}>
                <tbody>
                  {d.versions.map((v, i) => {
                    const askRevert = () =>
                      ask({
                        title: `Revert to version ${v.version}`,
                        action: "Revert",
                        body: (
                          <p>
                            Saves version {v.version} as a new current version. Nothing is lost: the history keeps every
                            version.
                          </p>
                        ),
                        run: (note) => revert(v.id, note),
                      });
                    return (
                      <tr key={v.id}>
                        <td className="nowrap">
                          v{v.version}
                          {i === 0 && <span className="muted"> current</span>}
                        </td>
                        <td className="w-full">
                          <button
                            type="button"
                            className={LINKISH}
                            onClick={() => setOpen(open === v.id ? null : v.id)}
                          >
                            {v.content.slice(0, 90)}
                            {v.content.length > 90 ? "…" : ""}
                          </button>
                          {open === v.id && <pre className={PRE}>{v.content}</pre>}
                        </td>
                        <td className="nowrap muted small">
                          {v.author || "deleted user"} · {ago(v.createdAt)}
                        </td>
                        <td className="nowrap">
                          {i > 0 && (
                            <Button kind="link small" type="button" onClick={askRevert}>
                              Revert to this
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          );
        }}
      </Async>
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
      <Async q={q}>
        {(d) => {
          if (d.items.length === 0) return <p className="muted">No wiki is locked.</p>;
          return (
            <ul className={COMPACT_LIST}>
              {d.items.map((l) => (
                <li key={`${l.type}:${l.id}`}>
                  <span>
                    {l.page ? <Link to={l.page.link}>{l.page.label}</Link> : "Removed page"}{" "}
                    <span className={TYPE_LABEL}>{l.type}</span>
                  </span>
                  <span className="muted small">
                    by {l.by || "staff"} · {ago(l.at)}
                    {l.reason && <> · “{l.reason}”</>}
                  </span>
                </li>
              ))}
            </ul>
          );
        }}
      </Async>
    </Section>
  );
}
