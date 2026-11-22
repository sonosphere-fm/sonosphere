import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Ico } from "../icons";
import { Button, SearchField, Select, Textarea } from "../kit";
import { ago, api, date, dateTime, num, plural, qs, useApi, useAuth, useTitle } from "../lib";
import { Async, Avatar, Empty, Pager, Section, errorText } from "../ui/base";
import { Badge, COUNT, FACTS, FILTERBAR, LIST, PEOPLE, PERSON, QUOTE, RED } from "./common";
import { SCROLL, SEARCH, TABLE, TOOLBAR, USER_HEAD, USER_HEAD_SUB, USER_HEAD_TITLE, WHO } from "./common";
import { adminUrl, useQuery, useRole, useConfirm, useFlash, FLAG, StatusBadges } from "./common";
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
const DM_STATUS: Record<string, [string, string]> = {
  active: ["Active", ""],
  request: ["Request", "warn"],
  declined: ["Declined", ""],
};
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
    <span className={COUNT} title="Open spam flags">
      {q.data.openFlags}
    </span>
  );
}

type LivePerson = Extract<DmPerson, { username: string }>;
const isLive = (u: DmPerson): u is LivePerson => u.username !== null;

function DmStatus({ s }: { s: string }) {
  return <Badge tone={DM_STATUS[s]?.[1]}>{DM_STATUS[s]?.[0] ?? s}</Badge>;
}

function Pair({ users }: { users: DmPerson[] }) {
  return (
    <span className="adm-pair">
      {users.map((u, i) => (
        <span key={u.id ?? i} className={WHO}>
          {i > 0 && <span className="muted small">and</span>}
          {u.username ? (
            <>
              <Avatar user={u} size={24} />
              <Link className="strong" to={adminUrl(u.username)}>
                <Username name={u.username} />
              </Link>
            </>
          ) : (
            <span className="muted">deleted account</span>
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
  useTitle("Messages");
  const tabs: [string, string][] =
    role === "admin"
      ? [
          ["threads", "Conversations"],
          ["flags", "Spam flags"],
        ]
      : [["flags", "Spam flags"]];
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
              {l}
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
      <p className="muted small">
        Conversations are private. This list shows who talks to whom but no text; opening one asks for a reason and is
        written to the audit log.
      </p>
      <div className={FILTERBAR}>
        <form className={SEARCH} onSubmit={search}>
          <SearchField
            value={text}
            onChange={setText}
            placeholder="Either person's username"
            label="Search conversations"
            clearable
          />
        </form>
        <Select
          label="Status"
          value={status}
          onChange={(v) => set({ status: v })}
          options={[
            ["", "Any status"],
            ["active", "Active"],
            ["request", "Requests"],
            ["declined", "Declined"],
          ]}
        />
      </div>
      <Async q={q}>
        {(d) => (
          <>
            <p className="muted small">
              {plural(d.total, "conversation")}
              {d.user && (
                <>
                  {" "}
                  with{" "}
                  <Link to={adminUrl(d.user)}>
                    <Username name={d.user} />
                  </Link>
                </>
              )}
              {term && <> matching “{term}”</>}
              {d.user && (
                <>
                  {" "}
                  ·{" "}
                  <Button kind="link small" type="button" onClick={() => set({ user: "" })}>
                    Show everyone's
                  </Button>
                </>
              )}
            </p>
            {d.items.length === 0 ? (
              <Empty>No conversations match.</Empty>
            ) : (
              <div className={SCROLL}>
                <table className={TABLE}>
                  <thead>
                    <tr>
                      <th>Between</th>
                      <th>Status</th>
                      <th className="num">Messages</th>
                      <th className="num">Open reports</th>
                      <th>Started</th>
                      <th>Last activity</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {d.items.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <Pair users={t.users} />
                        </td>
                        <td className="nowrap">
                          <DmStatus s={t.status} />
                          {t.requester && <span className="muted small"> from {t.requester}</span>}
                        </td>
                        <td className="num">
                          {num(t.messages)}
                          {t.deleted > 0 && <span className="muted small"> ({num(t.deleted)} deleted)</span>}
                        </td>
                        <td className="num">
                          {t.reports ? <b className={RED}>{t.reports}</b> : <span className="muted">0</span>}
                        </td>
                        <td className="nowrap" title={dateTime(t.createdAt)}>
                          {date(t.createdAt)}
                        </td>
                        <td className="nowrap muted" title={dateTime(t.lastAt)}>
                          {ago(t.lastAt)}
                        </td>
                        <td className="right">
                          <Button kind="btn ghost small" href={`/admin/messages/${t.id}`}>
                            Open
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
  const [reason, setReason] = useState(sp.get("report") ? `Report #${sp.get("report")}` : "");
  useTitle("Conversation");
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
      title: "Delete message",
      action: "Delete",
      danger: true,
      body: (
        <>
          <blockquote className={QUOTE}>{m.body}</blockquote>
          <p>
            It disappears for both people at once. It stays visible here, marked as deleted by you.
            {m.reports ? " Its open reports are closed." : ""}
          </p>
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
        title: `Turn messaging back on for ${u.username}`,
        action: "Allow messaging",
        body: <p>They will be able to send direct messages again.</p>,
        run: (note) => muteUser(u.username, false, note).then(() => setMuted(u.id, false)),
      });
    } else {
      ask({
        title: `Turn off messaging for ${u.username}`,
        action: "Turn off",
        danger: true,
        body: <p>They won't be able to send direct messages to anyone. They can still read their conversations.</p>,
        run: (note) => muteUser(u.username, true, note).then(() => setMuted(u.id, true)),
      });
    }
  };

  if (!data) {
    return (
      <>
        <p className="small">
          <Link to="/admin/messages">
            <Ico.Left /> All conversations
          </Link>
        </p>
        {error ? <Empty>{error}</Empty> : <p className="muted">Loading…</p>}
      </>
    );
  }
  const t = data.thread;
  const byId: Record<number, DmPerson | undefined> = Object.fromEntries(t.users.map((u) => [u.id, u]));
  const msgs: DmTranscriptMessage[] = data.locked ? [] : [...older, ...data.messages];
  const minutes = Math.round((data.window || 1800) / 60);
  return (
    <>
      {modal}
      <p className="small">
        <Link to="/admin/messages">
          <Ico.Left /> All conversations
        </Link>
      </p>
      <div className={USER_HEAD}>
        <div className="grow">
          <h2 className={USER_HEAD_TITLE}>
            <Pair users={t.users} />
          </h2>
          <p className={`muted ${USER_HEAD_SUB}`}>
            <DmStatus s={t.status} /> Started by {t.requester || "a deleted account"} {ago(t.createdAt)} · last message{" "}
            {ago(t.lastAt)}
          </p>
        </div>
      </div>
      <div className="cols">
        <div className="main">
          {data.locked ? (
            <Section title="Read this conversation">
              <p>
                Direct messages are private. Opening this one writes your name, the time, who the conversation is
                between and your reason to the audit log, where other staff can see it. Access lasts {minutes} minutes,
                then you'll be asked again.
              </p>
              <form className="form adm-dm-open" onSubmit={submitReason}>
                <label>
                  Reason
                  <Textarea
                    rows={2}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={1000}
                    placeholder="For example: report #12, harassment complaint"
                    aria-label="Reason"
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
                    Open conversation
                  </Button>
                </div>
              </form>
            </Section>
          ) : (
            <Section title="Transcript">
              <p className="muted small">
                Opened {ago(data.openedAt)}: “{data.reason}”. Messages removed by either person or by staff are shown
                here but hidden from both people.
              </p>
              {flash.note}
              {more && (
                <div className="adm-dm-more">
                  <Button kind="btn ghost small" type="button" loading={busy} onClick={() => loadOlder(msgs[0].id)}>
                    Load older messages
                  </Button>
                </div>
              )}
              {msgs.length === 0 ? (
                <Empty>No messages.</Empty>
              ) : (
                <ol className="adm-dm">
                  {msgs.map((m) => {
                    const who = byId[m.from];
                    const name = who?.username ?? "deleted account";
                    const side = m.from === t.users[0].id ? "lo" : "hi";
                    const deletedBy = m.bySender ? `${name}, the sender` : m.deletedBy || "staff";
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
                          {m.reports > 0 && <Badge tone="warn">{plural(m.reports, "open report")}</Badge>}
                          {m.deletedAt && <Badge>Deleted</Badge>}
                          {!m.deletedAt && (
                            <Button kind="link small" type="button" onClick={() => deleteMessage(m)}>
                              Delete
                            </Button>
                          )}
                        </div>
                        <p className="adm-dm-body">{m.body}</p>
                        {m.deletedAt && (
                          <p className="muted small">
                            Deleted by {deletedBy} {ago(m.deletedAt)}
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
          <Section title="Conversation">
            <dl className={FACTS}>
              <dt>Status</dt>
              <dd>
                {DM_STATUS[t.status]?.[0] ?? t.status}
                {t.status !== "active" && t.requester ? `, sent by ${t.requester}` : ""}
              </dd>
              <dt>Started</dt>
              <dd>{dateTime(t.createdAt)}</dd>
              <dt>Last message</dt>
              <dd>{dateTime(t.lastAt)}</dd>
              <dt>Messages</dt>
              <dd>
                {num(t.messages)}
                {t.deleted ? `, ${num(t.deleted)} deleted` : ""}
              </dd>
              <dt>Open reports</dt>
              <dd>
                {t.reports ? (
                  <Link to="/admin/reports?type=dm">
                    <b className={RED}>{t.reports}</b>
                  </Link>
                ) : (
                  "None"
                )}
              </dd>
            </dl>
          </Section>
          <Section title="People">
            <ul className={`${PEOPLE} adm-dm-people`}>
              {t.users.filter(isLive).map((u) => (
                <li key={u.id} className={PERSON}>
                  <Avatar user={u} size={32} />
                  <span className="grow">
                    <Link className="strong" to={adminUrl(u.username)}>
                      <Username name={u.username} />
                    </Link>{" "}
                    <StatusBadges u={u} />
                    {u.dmMuted && <Badge tone="warn">Messaging off</Badge>}
                  </span>
                  {u.role === "user" && !u.banned && (
                    <Button kind="link small" type="button" onClick={() => toggleMute(u)}>
                      {u.dmMuted ? "Allow messaging" : "Turn off messaging"}
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
      <p className="muted small">
        The message limits raise a flag when someone sends the same text to many people, starts a lot of new
        conversations, or hits the daily cap. The message that tripped it is shown as a sample.
      </p>
      <div className={TOOLBAR}>
        <nav className="tabs sub">
          {[
            ["open", "Open"],
            ["resolved", "Resolved"],
            ["all", "All"],
          ].map(([k, l]) => (
            <button
              key={k}
              type="button"
              className={status === k ? "active" : ""}
              onClick={() => set({ status: k === "open" ? "" : k })}
            >
              {l}
              {k === "open" && q.data ? ` (${q.data.open})` : ""}
            </button>
          ))}
        </nav>
      </div>
      <Async q={q}>
        {(d) => (
          <>
            {d.items.length === 0 && <Empty>{status === "open" ? "No open spam flags." : "No flags match."}</Empty>}
            <ul className={LIST}>
              {d.items.map((f) => {
                const u = f.user;
                const plain = u.role === "user";
                const resolve = () =>
                  ask({
                    title: "Resolve flag",
                    action: "Resolve",
                    note: "Resolution note",
                    body: <p>Close this flag for {u.username}. A new one is raised if the limits trip again.</p>,
                    run: (note) => api<Ok>(`/admin/dm/flags/${f.id}/resolve`, { body: { note } }).then(done),
                  });
                const allow = () =>
                  ask({
                    title: `Turn messaging back on for ${u.username}`,
                    action: "Allow messaging",
                    body: <p>They will be able to send direct messages again.</p>,
                    run: (note) => userPost(u.username, "dm-mute", { muted: false, note }),
                  });
                const mute = () =>
                  ask({
                    title: `Turn off messaging for ${u.username}`,
                    action: "Turn off",
                    danger: true,
                    body: (
                      <p>
                        They won't be able to send direct messages. They can still read their conversations and use the
                        rest of the site.
                      </p>
                    ),
                    run: (note) => userPost(u.username, "dm-mute", { muted: true, note }),
                  });
                const suspend = () =>
                  ask({
                    title: "Suspend from posting",
                    action: "Suspend",
                    danger: true,
                    body: (
                      <p>
                        {u.username} can keep listening and scrobbling but can't post on walls, journals, wiki edits or
                        send messages.
                      </p>
                    ),
                    run: (note) => userPost(u.username, "suspend", { suspended: true, note }),
                  });
                return (
                  <li key={f.id}>
                    <div className="row adm-flag-head">
                      <span className="badge">{FLAG[f.kind] ?? f.kind}</span>
                      <Link className="strong" to={adminUrl(u.username)}>
                        <Username name={u.username} />
                      </Link>
                      <StatusBadges u={u} />
                      {u.dmMuted && <Badge tone="warn">Messaging off</Badge>}
                      <span className="muted small" title={dateTime(f.createdAt)}>
                        {ago(f.createdAt)}
                      </span>
                    </div>
                    <p className="small">
                      {f.detail}
                      {f.detail && " · "}
                      {plural(f.threadsDay, "new conversation")} in the last day
                    </p>
                    {f.sample && <blockquote className={QUOTE}>{f.sample}</blockquote>}
                    {f.resolvedAt ? (
                      <p className="muted small">
                        Resolved {ago(f.resolvedAt)} by {f.resolver || "a deleted staff account"}
                      </p>
                    ) : (
                      <div className="row adm-flag-act">
                        <Button kind="btn ghost small" type="button" onClick={resolve}>
                          Resolve
                        </Button>
                        {d.canRead && (
                          <Button kind="btn ghost small" href={`/admin/messages${qs({ user: u.username })}`}>
                            Their conversations
                          </Button>
                        )}
                        {plain &&
                          !u.banned &&
                          (u.dmMuted ? (
                            <Button kind="btn ghost small" type="button" onClick={allow}>
                              Allow messaging
                            </Button>
                          ) : (
                            <Button kind="btn ghost small" type="button" onClick={mute}>
                              Turn off messaging
                            </Button>
                          ))}
                        {plain && !u.banned && !u.suspended && (
                          <Button kind="btn danger small" type="button" onClick={suspend}>
                            Suspend
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
      {role !== "admin" && (
        <p className="muted small">Only admins can read conversations. Reported messages are in the reports queue.</p>
      )}
    </>
  );
}
import { Username } from "../ui/username";
