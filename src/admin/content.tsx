import { Suspense, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button, Input } from "../kit";
import { ago, api, qs, useApi, useTitle } from "../lib";
import { Async, Empty, Pager, Section } from "../ui/base";
import { Badge, CHECK, COMPACT_LIST, COMPACT_TABLE, FILTERBAR, LINKISH, LIST } from "./common";
import { QUOTE, RED, TOOLBAR, TYPE_LABEL, adminUrl, cx, useQuery, useConfirm, type AdminKey } from "./common";
import { t, tx } from "./i18n";
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
const DELETE_TITLE: Record<string, AdminKey> = {
  shout: "admin.deleteShout",
  wiki: "admin.deleteWikiRevision",
  journal: "admin.deleteJournalPost",
};
const WIKI_TYPE: Record<string, AdminKey> = {
  artist: "admin.wikiTypeArtist",
  album: "admin.wikiTypeAlbum",
  track: "admin.wikiTypeTrack",
  tag: "admin.wikiTypeTag",
};
const wikiType = (type: string) => (WIKI_TYPE[type] ? t(WIKI_TYPE[type]) : type);

function ReportCount({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <>
      {" "}
      · <b className={RED}>{t("admin.openReports", { count: n })}</b>
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
  useTitle(t("admin.navContent"));
  const del = (k: string, id: number, what: ReactNode) =>
    ask({
      title: t(DELETE_TITLE[k]),
      action: t("admin.delete"),
      danger: true,
      body: (
        <>
          {what}
          <p>{k === "journal" ? t("admin.deleteJournalBody") : t("admin.deleteContentBody")}</p>
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
          {(
            [
              ["shouts", "admin.tabShouts"],
              ["journals", "admin.tabJournals"],
              ["wikis", "admin.tabWikis"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} type="button" className={kind === k ? "active" : ""} onClick={() => switchKind(k)}>
              {t(l)}
            </button>
          ))}
        </nav>
      </div>
      <form className={FILTERBAR} onSubmit={filter}>
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("admin.searchText")}
          aria-label={t("admin.searchText")}
        />
        <Input
          value={user}
          onChange={(e) => setUser(e.target.value)}
          placeholder={t("admin.authorUsername")}
          aria-label={t("admin.author")}
        />
        <Button kind="btn small">{t("admin.filter")}</Button>
        {kind === "wikis" && (
          <label className={CHECK}>
            <Input
              type="checkbox"
              checked={locked === "1"}
              onChange={(e) => set({ locked: e.target.checked ? "1" : "" })}
            />{" "}
            {t("admin.lockedPagesOnly")}
          </label>
        )}
        {(term || who) && (
          <Button kind="link small" type="button" onClick={clear}>
            {t("admin.clear")}
          </Button>
        )}
      </form>
      <Async q={q}>
        {(d) => (
          <>
            <p className="muted small">{t("admin.found", { count: d.total })}</p>
            {d.items.length === 0 && <Empty>{t("admin.nothingMatches")}</Empty>}
            <ul className={LIST}>
              {allItems(d).map((it) => {
                if (isShout(it)) {
                  return (
                    <li key={it.id}>
                      <p className={BODY_TEXT}>{it.body}</p>
                      <div className="row between">
                        <span className="muted small">
                          {tx("admin.postedOn", {
                            author: (
                              <Link to={adminUrl(it.author)}>
                                <Username name={it.author} />
                              </Link>
                            ),
                            page: it.page ? <Link to={it.page.link}>{it.page.label}</Link> : t("admin.aRemovedPage"),
                          })}{" "}
                          · {ago(it.createdAt)}
                          <ReportCount n={it.reports} />
                        </span>
                        <Button
                          kind="link small"
                          type="button"
                          onClick={() => del("shout", it.id, <blockquote className={QUOTE}>{it.body}</blockquote>)}
                        >
                          {t("admin.delete")}
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
                          <Link to={adminUrl(it.author)}>
                            <Username name={it.author} />
                          </Link>{" "}
                          · {ago(it.createdAt)} · {t("admin.commentCount", { count: it.comments })}
                          <ReportCount n={it.reports} />
                        </span>
                        <Button
                          kind="link small"
                          type="button"
                          onClick={() =>
                            del(
                              "journal",
                              it.id,
                              <p>{t("admin.quotedByAuthor", { title: it.title, author: it.author })}</p>
                            )
                          }
                        >
                          {t("admin.delete")}
                        </Button>
                      </div>
                    </li>
                  );
                }
                const key = String(it.id);
                const showing = wiki === key;
                const revisionText = (
                  <p>
                    {t(it.latest ? "admin.wikiVersionLatest" : "admin.wikiVersion", {
                      version: it.version,
                      page: it.page?.label ?? "",
                    })}
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
                        t("admin.removedPage")
                      )}{" "}
                      <span className={TYPE_LABEL}>{wikiType(it.itemType)}</span>{" "}
                      <span className="muted small">
                        {t(it.latest ? "admin.versionCurrent" : "admin.versionN", { version: it.version })}
                      </span>
                      {it.locked && <Badge tone="warn">{t("admin.locked")}</Badge>}
                    </p>
                    <p className={`${BODY_TEXT} muted`}>{it.excerpt}</p>
                    <div className="row between">
                      <span className="muted small">
                        {it.author ? (
                          <Link to={adminUrl(it.author)}>
                            <Username name={it.author} />
                          </Link>
                        ) : (
                          t("admin.deletedUser")
                        )}{" "}
                        · {ago(it.createdAt)}
                        <ReportCount n={it.reports} />
                      </span>
                      <span className="row">
                        <Button kind="link small" type="button" onClick={() => setWiki(showing ? null : key)}>
                          {showing ? t("admin.hideHistory") : t("admin.historyAndLock")}
                        </Button>
                        <Button kind="link small" type="button" onClick={() => del("wiki", it.id, revisionText)}>
                          {t("admin.deleteRevision")}
                        </Button>
                      </span>
                    </div>
                    {showing && (
                      <Suspense fallback={<p className="muted small">{t("admin.loadingHistory")}</p>}>
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
                title: t("admin.unlockWikiFor", { page: d.page.label }),
                action: t("admin.unlock"),
                body: <p>{t("admin.unlockBody")}</p>,
                run: (note) => setLock(false, note),
              });
            } else {
              ask({
                title: t("admin.lockWikiFor", { page: d.page.label }),
                action: t("admin.lock"),
                note: t("admin.reason"),
                body: <p>{t("admin.lockBody")}</p>,
                run: (note) => setLock(true, note),
              });
            }
          };
          return (
            <>
              <div className="row between">
                <span className="small">
                  {d.lock
                    ? tx(d.lock.reason ? "admin.lockedByReason" : "admin.lockedBy", {
                        locked: <b>{t("admin.locked")}</b>,
                        by: d.lock.by || t("admin.staff"),
                        ago: ago(d.lock.at),
                        reason: d.lock.reason,
                      })
                    : t("admin.anyoneCanEdit")}
                </span>
                <Button kind="btn ghost small" type="button" onClick={toggleLock}>
                  {d.lock ? t("admin.unlock") : t("admin.lock")}
                </Button>
              </div>
              <table className={`${COMPACT_TABLE} mt-[10px] bg-site-card`}>
                <tbody>
                  {d.versions.map((v, i) => {
                    const askRevert = () =>
                      ask({
                        title: t("admin.revertToVersion", { version: v.version }),
                        action: t("admin.revert"),
                        body: <p>{t("admin.revertBody", { version: v.version })}</p>,
                        run: (note) => revert(v.id, note),
                      });
                    return (
                      <tr key={v.id}>
                        <td className="nowrap">
                          v{v.version}
                          {i === 0 && <span className="muted"> {t("admin.current")}</span>}
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
                          {v.author || t("admin.deletedUser")} · {ago(v.createdAt)}
                        </td>
                        <td className="nowrap">
                          {i > 0 && (
                            <Button kind="link small" type="button" onClick={askRevert}>
                              {t("admin.revertToThis")}
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
    <Section title={t("admin.lockedWikis")}>
      <Async q={q}>
        {(d) => {
          if (d.items.length === 0) return <p className="muted">{t("admin.noWikiLocked")}</p>;
          return (
            <ul className={COMPACT_LIST}>
              {d.items.map((l) => (
                <li key={`${l.type}:${l.id}`}>
                  <span>
                    {l.page ? <Link to={l.page.link}>{l.page.label}</Link> : t("admin.removedPage")}{" "}
                    <span className={TYPE_LABEL}>{wikiType(l.type)}</span>
                  </span>
                  <span className="muted small">
                    {t("admin.byName", { name: l.by || t("admin.staff") })} · {ago(l.at)}
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
import { Username } from "../ui/username";
