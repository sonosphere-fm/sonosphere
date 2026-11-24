import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Ico } from "../icons";
import { Button, SearchField, Select, Textarea } from "../kit";
import { ago, api, date, dateTime, num, qs, useApi, useAuth, useTitle } from "../lib";
import { Async, Avatar, Empty, Pager, Section, errorText } from "../ui/base";
import { Badge, COUNT, FACTS, FILTERBAR, LIST, PEOPLE, PERSON, QUOTE, RED } from "./common";
import { SCROLL, SEARCH, TABLE, TOOLBAR, USER_HEAD, USER_HEAD_SUB, USER_HEAD_TITLE, WHO } from "./common";
import { adminUrl, useQuery, useRole, useConfirm, useFlash, flagLabel, StatusBadges, type AdminKey } from "./common";
import { t, tx } from "./i18n";
import type {
  DmFlagList,
  DmMessageDeleted,
  DmMuteResult,
  DmPerson,
  DmSummary,
  DmThreadHead,
  DmThreadList,
  DmTranscript,
  DmTranscriptMessage,
  Ok,
  SuspendResult,
} from "../../shared/admin";

// Moderators see the spam flags; only admins can list or read conversations. The server checks both, asks for a reason
// before it shows a transcript, and writes every opening to the audit log.
const DM_STATUS: Record<string, [AdminKey, string]> = {
  active: ["admin.dmActive", ""],
  request: ["admin.dmRequest", "warn"],
  declined: ["admin.dmDeclined", ""],
};
const dmStatusLabel = (s: string) => (DM_STATUS[s] ? t(DM_STATUS[s][0]) : s);
const flagsChanged = () => window.dispatchEvent(new Event("spin:dmflags"));

export function FlagCount() {
  const q = useApi<DmSummary>("/admin/dm/summary");
  useEffect(() => {
    const f = () => q.reload();
    window.addEventListener("spin:dmflags", f);
    return () => window.removeEventListener("spin:dmflags", f);
  }, []);
  if (!q.data?.openFlags) return null;
  return (
    <span className={COUNT} title={t("admin.openSpamFlags")}>
      {q.data.openFlags}
    </span>
  );
}

type LivePerson = Extract<DmPerson, { username: string }>;
const isLive = (u: DmPerson): u is LivePerson => u.username !== null;

function DmStatus({ s }: { s: string }) {
  return <Badge tone={DM_STATUS[s]?.[1]}>{dmStatusLabel(s)}</Badge>;
}

function Pair({ users }: { users: DmPerson[] }) {
  return (
    <span className="adm-pair">
      {users.map((u, i) => (
        <span key={u.id ?? i} className={WHO}>
          {i > 0 && <span className="muted small">{t("admin.and")}</span>}
          {u.username ? (
            <>
              <Avatar user={u} size={24} />
              <Link className="strong" to={adminUrl(u.username)}>
                <Username name={u.username} />
              </Link>
            </>
          ) : (
            <span className="muted">{t("admin.deletedAccount")}</span>
          )}
        </span>
      ))}
    </span>
  );
}

const muteUser = (name: string, muted: boolean, note: string) =>
  api<DmMuteResult>(`/admin/users/${encodeURIComponent(name)}/dm-mute`, { body: { muted, note } });

export function Messages() {
  const role = useRole();
  const [sp, set] = useQuery();
  const tab = role === "admin" ? sp.get("tab") || "threads" : "flags";
  useTitle(t("admin.navMessages"));
  const tabs: [string, AdminKey][] =
    role === "admin"
      ? [
          ["threads", "admin.conversations"],
          ["flags", "admin.spamFlags"],
        ]
      : [["flags", "admin.spamFlags"]];
  return (
    <>
      <div className={TOOLBAR}>
        <nav className="tabs sub">
          {tabs.map(([k, l]) => (
            <button
              key={k}
              type="button"
              className={tab === k ? "active" : ""}
              onClick={() => set({ tab: k === "threads" ? "" : k, q: "", user: "", status: "" })}
            >
              {t(l)}
            </button>
          ))}
        </nav>
      </div>
      {tab === "flags" ? <Flags /> : <Threads />}
    </>
  );
}

function Threads() {
  const [sp, set] = useQuery();
  const term = sp.get("q") || "";
  const who = sp.get("user") || "";
  const status = sp.get("status") || "";
  const page = sp.get("page") || "";
  const [text, setText] = useState(term);
  const q = useApi<DmThreadList>(`/admin/dm/threads${qs({ q: term, user: who, status, page })}`);
  const search = (e: FormEvent) => {
    e.preventDefault();
    set({ q: text.trim() });
  };
  return (
    <>
      <p className="muted small">{t("admin.threadsIntro")}</p>
      <div className={FILTERBAR}>
        <form className={SEARCH} onSubmit={search}>
          <SearchField
            value={text}
            onChange={setText}
            placeholder={t("admin.eitherUsername")}
            label={t("admin.searchConversations")}
            clearable
          />
        </form>
        <Select
          label={t("admin.status")}
          value={status}
          onChange={(v) => set({ status: v })}
          options={[
            ["", t("admin.anyStatus")],
            ["active", t("admin.dmActive")],
            ["request", t("admin.dmRequests")],
            ["declined", t("admin.dmDeclined")],
          ]}
        />
      </div>
      <Async q={q}>
        {(d) => (
          <>
            <p className="muted small">
              {d.user
                ? tx(term ? "admin.conversationsWithMatching" : "admin.conversationsWith", {
                    count: d.total,
                    user: (
                      <Link to={adminUrl(d.user)}>
                        <Username name={d.user} />
                      </Link>
                    ),
                    term,
                  })
                : t(term ? "admin.conversationsMatching" : "admin.conversationCount", { count: d.total, term })}
              {d.user && (
                <>
                  {" "}
                  ·{" "}
                  <Button kind="link small" type="button" onClick={() => set({ user: "" })}>
                    {t("admin.showEveryones")}
                  </Button>
                </>
              )}
            </p>
            {d.items.length === 0 ? (
              <Empty>{t("admin.noConversationsMatch")}</Empty>
            ) : (
              <div className={SCROLL}>
                <table className={TABLE}>
                  <thead>
                    <tr>
                      <th>{t("admin.colBetween")}</th>
                      <th>{t("admin.status")}</th>
                      <th className="num">{t("admin.navMessages")}</th>
                      <th className="num">{t("admin.openReportsLabel")}</th>
                      <th>{t("admin.started")}</th>
                      <th>{t("admin.lastActivity")}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {d.items.map((th) => (
                      <tr key={th.id}>
                        <td>
                          <Pair users={th.users} />
                        </td>
                        <td className="nowrap">
                          <DmStatus s={th.status} />
                          {th.requester && (
                            <span className="muted small"> {t("admin.fromName", { name: th.requester })}</span>
                          )}
                        </td>
                        <td className="num">
                          {num(th.messages)}
                          {th.deleted > 0 && (
                            <span className="muted small"> {t("admin.deletedParen", { count: th.deleted })}</span>
                          )}
                        </td>
                        <td className="num">
                          {th.reports ? <b className={RED}>{th.reports}</b> : <span className="muted">0</span>}
                        </td>
                        <td className="nowrap" title={dateTime(th.createdAt)}>
                          {date(th.createdAt)}
                        </td>
                        <td className="nowrap muted" title={dateTime(th.lastAt)}>
                          {ago(th.lastAt)}
                        </td>
                        <td className="right">
                          <Button kind="btn ghost small" href={`/admin/messages/${th.id}`}>
                            {t("admin.open")}
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

// Fetched by hand rather than through the shared cache, so a transcript never reappears from memory once the server
// has locked it again.
export function Transcript() {
  const id = useParams().id!;
  const [sp] = useSearchParams();
  const { me } = useAuth();
  const [modal, ask] = useConfirm();
  const flash = useFlash();
  const [data, setData] = useState<DmTranscript | null>(null);
  const [older, setOlder] = useState<DmTranscriptMessage[]>([]);
  const [more, setMore] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState(() => {
    const report = sp.get("report");
    return report ? t("admin.reportNumber", { report }) : "";
  });
  useTitle(t("admin.conversation"));
  const load = async () => {
    try {
      const d = await api<DmTranscript>(`/admin/dm/threads/${id}`);
      setData(d);
      setOlder([]);
      setMore(!d.locked && d.more);
      setError("");
    } catch (e) {
      setError(errorText(e));
    }
  };
  useEffect(() => {
    setData(null);
    setError("");
    load();
  }, [id]);
  const open = async () => {
    setBusy(true);
    try {
      await api<Ok>(`/admin/dm/threads/${id}/open`, { body: { note: reason.trim() } });
      await load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const submitReason = (e: FormEvent) => {
    e.preventDefault();
    open();
  };
  const loadOlder = async (first: number) => {
    setBusy(true);
    try {
      const d = await api<DmTranscript>(`/admin/dm/threads/${id}${qs({ before: first })}`);
      if (d.locked) {
        // access ran out: ask for a reason again
        setData(d);
        setOlder([]);
        setMore(false);
      } else {
        setOlder((o) => [...d.messages, ...o]);
        setMore(d.more);
      }
    } catch (e) {
      flash.set({ ok: false, text: errorText(e) });
    } finally {
      setBusy(false);
    }
  };
  const patch = (mid: number, p: Partial<DmTranscriptMessage>) => {
    const fix = (m: DmTranscriptMessage) => (m.id === mid ? { ...m, ...p } : m);
    setOlder((o) => o.map(fix));
    setData((d) => {
      if (!d) return d;
      const thread = { ...d.thread, deleted: d.thread.deleted + 1 };
      if (d.locked) return { ...d, thread };
      return { ...d, thread, messages: d.messages.map(fix) };
    });
  };
  const setMuted = (uid: number, muted: boolean) =>
    setData((d) => {
      if (!d) return d;
      const mute = (u: DmPerson): DmPerson => (u.username !== null && u.id === uid ? { ...u, dmMuted: muted } : u);
      const users: DmThreadHead["users"] = [mute(d.thread.users[0]), mute(d.thread.users[1])];
      return { ...d, thread: { ...d.thread, users } };
    });
  const deleteMessage = (m: DmTranscriptMessage) =>
    ask({
      title: t("admin.deleteMessage"),
      action: t("admin.delete"),
      danger: true,
      body: (
        <>
          <blockquote className={QUOTE}>{m.body}</blockquote>
          <p>{m.reports ? t("admin.deleteMessageReportsBody") : t("admin.deleteMessageBody")}</p>
        </>
      ),
      run: (note) =>
        api<DmMessageDeleted>(`/admin/dm/messages/${m.id}/delete`, { body: { note } }).then(() =>
          patch(m.id, {
            deletedAt: Math.floor(Date.now() / 1000),
            deletedBy: me?.username ?? null,
            bySender: false,
            reports: 0,
          })
        ),
    });
  const toggleMute = (u: LivePerson) => {
    if (u.dmMuted) {
      ask({
        title: t("admin.unmuteTitle", { name: u.username }),
        action: t("admin.allowMessaging"),
        body: <p>{t("admin.unmuteBody")}</p>,
        run: (note) => muteUser(u.username, false, note).then(() => setMuted(u.id, false)),
      });
    } else {
      ask({
        title: t("admin.muteTitle", { name: u.username }),
        action: t("admin.turnOff"),
        danger: true,
        body: <p>{t("admin.muteBodyShort")}</p>,
        run: (note) => muteUser(u.username, true, note).then(() => setMuted(u.id, true)),
      });
    }
  };

  if (!data) {
    return (
      <>
        <p className="small">
          <Link to="/admin/messages">
            <Ico.Left /> {t("admin.allConversations")}
          </Link>
        </p>
        {error ? <Empty>{error}</Empty> : <p className="muted">{t("admin.loading")}</p>}
      </>
    );
  }
  const thread = data.thread;
  const byId: Record<number, DmPerson | undefined> = Object.fromEntries(thread.users.map((u) => [u.id, u]));
  const msgs: DmTranscriptMessage[] = data.locked ? [] : [...older, ...data.messages];
  const minutes = Math.round((data.window || 1800) / 60);
  return (
    <>
      {modal}
      <p className="small">
        <Link to="/admin/messages">
          <Ico.Left /> {t("admin.allConversations")}
        </Link>
      </p>
      <div className={USER_HEAD}>
        <div className="grow">
          <h2 className={USER_HEAD_TITLE}>
            <Pair users={thread.users} />
          </h2>
          <p className={`muted ${USER_HEAD_SUB}`}>
            <DmStatus s={thread.status} />{" "}
            {t("admin.startedBy", {
              name: thread.requester || t("admin.aDeletedAccount"),
              started: ago(thread.createdAt),
              last: ago(thread.lastAt),
            })}
          </p>
        </div>
      </div>
      <div className="cols">
        <div className="main">
          {data.locked ? (
            <Section title={t("admin.readConversation")}>
              <p>{t("admin.readConversationBody", { count: minutes })}</p>
              <form className="form adm-dm-open" onSubmit={submitReason}>
                <label>
                  {t("admin.reason")}
                  <Textarea
                    rows={2}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={1000}
                    placeholder={t("admin.reasonPlaceholder")}
                    aria-label={t("admin.reason")}
                    autoFocus
                  />
                </label>
                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}
                <div className="row">
                  <Button kind="btn" loading={busy} disabled={reason.trim().length < 3}>
                    {t("admin.openConversation")}
                  </Button>
                </div>
              </form>
            </Section>
          ) : (
            <Section title={t("admin.transcript")}>
              <p className="muted small">{t("admin.openedReason", { ago: ago(data.openedAt), reason: data.reason })}</p>
              {flash.note}
              {more && (
                <div className="adm-dm-more">
                  <Button kind="btn ghost small" type="button" loading={busy} onClick={() => loadOlder(msgs[0].id)}>
                    {t("admin.loadOlder")}
                  </Button>
                </div>
              )}
              {msgs.length === 0 ? (
                <Empty>{t("admin.noMessages")}</Empty>
              ) : (
                <ol className="adm-dm">
                  {msgs.map((m) => {
                    const who = byId[m.from];
                    const name = who?.username ?? t("admin.deletedAccount");
                    const side = m.from === thread.users[0].id ? "lo" : "hi";
                    const deletedBy = m.bySender ? t("admin.theSender", { name }) : m.deletedBy || t("admin.staff");
                    return (
                      <li key={m.id} className={[m.deletedAt ? "gone" : "", side].join(" ")}>
                        <div className="adm-dm-meta">
                          {who?.username ? (
                            <Link className="strong" to={adminUrl(name)}>
                              {name}
                            </Link>
                          ) : (
                            <b>
                              <Username name={name} />
                            </b>
                          )}
                          <span className="muted small" title={dateTime(m.at)}>
                            {dateTime(m.at)}
                          </span>
                          {m.reports > 0 && <Badge tone="warn">{t("admin.openReports", { count: m.reports })}</Badge>}
                          {m.deletedAt && <Badge>{t("admin.deleted")}</Badge>}
                          {!m.deletedAt && (
                            <Button kind="link small" type="button" onClick={() => deleteMessage(m)}>
                              {t("admin.delete")}
                            </Button>
                          )}
                        </div>
                        <p className="adm-dm-body">{m.body}</p>
                        {m.deletedAt && (
                          <p className="muted small">
                            {t("admin.deletedBy", { name: deletedBy, ago: ago(m.deletedAt) })}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </Section>
          )}
        </div>
        <aside className="side">
          <Section title={t("admin.conversation")}>
            <dl className={FACTS}>
              <dt>{t("admin.status")}</dt>
              <dd>
                {thread.status !== "active" && thread.requester
                  ? t("admin.statusSentBy", { status: dmStatusLabel(thread.status), name: thread.requester })
                  : dmStatusLabel(thread.status)}
              </dd>
              <dt>{t("admin.started")}</dt>
              <dd>{dateTime(thread.createdAt)}</dd>
              <dt>{t("admin.lastMessage")}</dt>
              <dd>{dateTime(thread.lastAt)}</dd>
              <dt>{t("admin.navMessages")}</dt>
              <dd>
                {thread.deleted
                  ? t("admin.messagesDeleted", { messages: num(thread.messages), deleted: num(thread.deleted) })
                  : num(thread.messages)}
              </dd>
              <dt>{t("admin.openReportsLabel")}</dt>
              <dd>
                {thread.reports ? (
                  <Link to="/admin/reports?type=dm">
                    <b className={RED}>{thread.reports}</b>
                  </Link>
                ) : (
                  t("admin.noneCap")
                )}
              </dd>
            </dl>
          </Section>
          <Section title={t("admin.people")}>
            <ul className={`${PEOPLE} adm-dm-people`}>
              {thread.users.filter(isLive).map((u) => (
                <li key={u.id} className={PERSON}>
                  <Avatar user={u} size={32} />
                  <span className="grow">
                    <Link className="strong" to={adminUrl(u.username)}>
                      <Username name={u.username} />
                    </Link>{" "}
                    <StatusBadges u={u} />
                    {u.dmMuted && <Badge tone="warn">{t("admin.messagingOff")}</Badge>}
                  </span>
                  {u.role === "user" && !u.banned && (
                    <Button kind="link small" type="button" onClick={() => toggleMute(u)}>
                      {u.dmMuted ? t("admin.allowMessaging") : t("admin.turnOffMessaging")}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        </aside>
      </div>
    </>
  );
}

function Flags() {
  const role = useRole();
  const [sp, set] = useQuery();
  const status = sp.get("status") || "open";
  const page = sp.get("page") || "";
  const [modal, ask] = useConfirm();
  const q = useApi<DmFlagList>(`/admin/dm/flags${qs({ status: status === "open" ? "" : status, page })}`);
  const done = () => {
    q.reload();
    flagsChanged();
  };
  const userPost = (name: string, path: string, body: Record<string, unknown>) =>
    api<DmMuteResult | SuspendResult>(`/admin/users/${encodeURIComponent(name)}/${path}`, { body }).then(done);
  return (
    <>
      {modal}
      <p className="muted small">{t("admin.flagsIntro")}</p>
      <div className={TOOLBAR}>
        <nav className="tabs sub">
          {(
            [
              ["open", "admin.flagsOpen"],
              ["resolved", "admin.flagsResolved"],
              ["all", "admin.flagsAll"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              className={status === k ? "active" : ""}
              onClick={() => set({ status: k === "open" ? "" : k })}
            >
              {k === "open" && q.data ? t("admin.labelCount", { label: t(l), count: q.data.open }) : t(l)}
            </button>
          ))}
        </nav>
      </div>
      <Async q={q}>
        {(d) => (
          <>
            {d.items.length === 0 && (
              <Empty>{status === "open" ? t("admin.noOpenFlags") : t("admin.noFlagsMatch")}</Empty>
            )}
            <ul className={LIST}>
              {d.items.map((f) => {
                const u = f.user;
                const plain = u.role === "user";
                const resolve = () =>
                  ask({
                    title: t("admin.resolveFlag"),
                    action: t("admin.resolve"),
                    note: t("admin.resolutionNote"),
                    body: <p>{t("admin.resolveBody", { name: u.username })}</p>,
                    run: (note) => api<Ok>(`/admin/dm/flags/${f.id}/resolve`, { body: { note } }).then(done),
                  });
                const allow = () =>
                  ask({
                    title: t("admin.unmuteTitle", { name: u.username }),
                    action: t("admin.allowMessaging"),
                    body: <p>{t("admin.unmuteBody")}</p>,
                    run: (note) => userPost(u.username, "dm-mute", { muted: false, note }),
                  });
                const mute = () =>
                  ask({
                    title: t("admin.muteTitle", { name: u.username }),
                    action: t("admin.turnOff"),
                    danger: true,
                    body: <p>{t("admin.muteBody")}</p>,
                    run: (note) => userPost(u.username, "dm-mute", { muted: true, note }),
                  });
                const suspend = () =>
                  ask({
                    title: t("admin.suspendTitle"),
                    action: t("admin.suspend"),
                    danger: true,
                    body: <p>{t("admin.suspendBody", { name: u.username })}</p>,
                    run: (note) => userPost(u.username, "suspend", { suspended: true, note }),
                  });
                return (
                  <li key={f.id}>
                    <div className="row adm-flag-head">
                      <span className="badge">{flagLabel(f.kind)}</span>
                      <Link className="strong" to={adminUrl(u.username)}>
                        <Username name={u.username} />
                      </Link>
                      <StatusBadges u={u} />
                      {u.dmMuted && <Badge tone="warn">{t("admin.messagingOff")}</Badge>}
                      <span className="muted small" title={dateTime(f.createdAt)}>
                        {ago(f.createdAt)}
                      </span>
                    </div>
                    <p className="small">
                      {f.detail}
                      {f.detail && " · "}
                      {t("admin.newConversationsDay", { count: f.threadsDay })}
                    </p>
                    {f.sample && <blockquote className={QUOTE}>{f.sample}</blockquote>}
                    {f.resolvedAt ? (
                      <p className="muted small">
                        {t("admin.resolvedBy", {
                          ago: ago(f.resolvedAt),
                          name: f.resolver || t("admin.aDeletedStaffAccount"),
                        })}
                      </p>
                    ) : (
                      <div className="row adm-flag-act">
                        <Button kind="btn ghost small" type="button" onClick={resolve}>
                          {t("admin.resolve")}
                        </Button>
                        {d.canRead && (
                          <Button kind="btn ghost small" href={`/admin/messages${qs({ user: u.username })}`}>
                            {t("admin.theirConversations")}
                          </Button>
                        )}
                        {plain &&
                          !u.banned &&
                          (u.dmMuted ? (
                            <Button kind="btn ghost small" type="button" onClick={allow}>
                              {t("admin.allowMessaging")}
                            </Button>
                          ) : (
                            <Button kind="btn ghost small" type="button" onClick={mute}>
                              {t("admin.turnOffMessaging")}
                            </Button>
                          ))}
                        {plain && !u.banned && !u.suspended && (
                          <Button kind="btn danger small" type="button" onClick={suspend}>
                            {t("admin.suspend")}
                          </Button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <Pager total={d.total} limit={d.limit} />
          </>
        )}
      </Async>
      {role !== "admin" && <p className="muted small">{t("admin.adminsReadOnly")}</p>}
    </>
  );
}
import { Username } from "../ui/username";
