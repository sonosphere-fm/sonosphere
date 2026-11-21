import { Suspense, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { DropdownMenu, DropdownMenuItem } from "@astryxdesign/core/DropdownMenu";
import { Ico } from "../icons";
import { Button, Input, useConfirm } from "../kit";
import { useTurnstile } from "./auth";
import { ago, api, date, invalidateAll, liveSend, mutate, useApi, useAuth, useLive, useTitle, userUrl } from "../lib";
import type { BlockResult } from "../../shared/blocks";
import type {
  DmAccepted, DmClientMessage, DmCounts, DmDone, DmGroup, DmGroupCandidates, DmGroupMessage, DmGroupPage, DmGroupSent, DmSent,
  DmUnsent, DmUser, DmWith,
} from "../../shared/dm";
import { Avatar, useAction } from "../ui/base";
import { UserLabels } from "../ui/user-labels";
import { ReportButton } from "../ui/shoutbox";
import { type Msg, type Thread, type ThreadReply, type ListReply, INBOX, REQUESTS, threadPath, groupPath, place, placeGroup, applyDmEvent } from "../dm";

const clock = (at: number) => new Date(at * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const sameDay = (a: number, b: number) => new Date(a * 1000).toDateString() === new Date(b * 1000).toDateString();
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

function dayLabel(at: number) {
  const now = Date.now() / 1000;
  if (sameDay(at, now)) return "Today";
  if (sameDay(at, now - 86400)) return "Yesterday";
  return date(at);
}

const setBlocked = (username: string, block: boolean) => api<BlockResult>("/block", { body: { username, block } });

function groupName(g: DmGroup, myId: number) {
  if (g.title) return g.title;
  const others = g.members.filter(m => m.id !== myId).map(m => m.username);
  return others.length ? others.join(", ") : "Just you";
}

type View = "inbox" | "requests" | "thread" | "new" | "group" | "new-group";
type Row = { kind: "thread"; at: number; t: Thread } | { kind: "group"; at: number; g: DmGroup };

export function MessagesPage({ view }: { view: View }) {
  const p = useParams();
  const [sp] = useSearchParams();
  const { me } = useAuth();
  const requests = view === "requests" || (view === "thread" && sp.get("box") === "requests");
  const list = useApi<ListReply>(requests ? REQUESTS : INBOX);
  const counts = me!.dm;
  const open = view !== "inbox" && view !== "requests";
  useTitle(counts.unread ? `(${counts.unread}) Messages` : "Messages");

  let pane;
  if (view === "thread") {
    pane = <Conversation key={p.id} id={Number(p.id) || 0} back={requests ? "/messages/requests" : "/messages"} />;
  } else if (view === "new") {
    pane = <NewConversation key={p.name} name={p.name || ""} />;
  } else if (view === "group") {
    pane = <GroupConversation key={p.id} id={Number(p.id) || 0} />;
  } else if (view === "new-group") {
    pane = <NewGroup />;
  } else {
    pane = (
      <div className="dm-blank muted">
        <Ico.Chat />
        <p>{requests ? "Choose a request to read it." : "Choose a conversation."}</p>
      </div>
    );
  }

  const rows: Row[] = [
    ...(list.data?.items ?? []).map((t): Row => ({ kind: "thread", at: t.at, t })),
    ...(list.data?.groups ?? []).map((g): Row => ({ kind: "group", at: g.at, g })),
  ].sort((a, b) => b.at - a.at);
  const currentId = Number(p.id);

  return (
    <div className="wrap page dm-page">
      <div className={`dm${open ? " dm-open" : ""}`}>
        <aside className="dm-side" aria-label="Conversations">
          <div className="dm-title-row">
            <h1 className="dm-title">Messages</h1>
            <Button kind="btn ghost small" href="/messages/new-group"><Ico.Plus /> New group</Button>
          </div>
          <nav className="tabs dm-tabs">
            <Link to="/messages" className={requests ? "" : "active"}>
              Inbox{counts.unread > 0 && <b className="dot">{counts.unread}</b>}
            </Link>
            <Link to="/messages/requests" className={requests ? "active" : ""}>
              Requests{counts.requests > 0 && <b className="dot">{counts.requests}</b>}
            </Link>
          </nav>
          {requests && (
            <p className="muted small dm-hint">Messages from users you don't follow appear here. Read receipts will not be sent until you accept.</p>
          )}
          {list.error ? (
            <p className="form-error">{list.error.message}</p>
          ) : (
            <ul className="dm-threads">
              {rows.map(r => (r.kind === "thread" ? (
                <ThreadRow key={`t${r.t.id}`} t={r.t} requests={requests} current={view === "thread" && currentId === r.t.id} myId={me!.id} />
              ) : (
                <GroupRow key={`g${r.g.id}`} g={r.g} current={view === "group" && currentId === r.g.id} myId={me!.id} />
              )))}
              {list.data && !rows.length && (
                <li className="dm-none muted">
                  {requests ? "No message requests." : "No conversations yet. You can start one from someone's profile."}
                </li>
              )}
            </ul>
          )}
        </aside>
        <section className="dm-pane">
          <Suspense fallback={null}>{pane}</Suspense>
        </section>
      </div>
    </div>
  );
}

function ThreadRow({ t, requests, current, myId }: { t: Thread; requests: boolean; current: boolean; myId: number }) {
  let preview = "";
  if (t.last) preview = t.last.deleted ? "Message deleted" : `${t.last.from === myId ? "You: " : ""}${t.last.body}`;
  return (
    <li>
      <Link
        to={`/messages/${t.id}${requests ? "?box=requests" : ""}`}
        className={`dm-thread${current ? " current" : ""}${t.unread ? " unread" : ""}`}
      >
        <Avatar user={t.user} size={44} plain />
        <span className="grow">
          <span className="dm-thread-top"><b>{t.user.username} <UserLabels name={t.user.username} /></b><span className="muted small nowrap">{ago(t.at)}</span></span>
          <span className="dm-preview">{preview}</span>
        </span>
        {t.unread > 0 && <b className="dot" aria-label={`${t.unread} unread`}>{t.unread}</b>}
      </Link>
    </li>
  );
}

function GroupAvatar({ g, myId, size }: { g: DmGroup; myId: number; size: number }) {
  const [a, b] = g.members.filter(m => m.id !== myId);
  if (!b) return <Avatar user={a ?? g.members[0]} size={size} plain />;
  return (
    <span className="dm-group-avatar" style={{ width: size, height: size }} aria-hidden>
      <Avatar user={a} size={Math.round(size * 0.68)} plain />
      <Avatar user={b} size={Math.round(size * 0.68)} plain />
    </span>
  );
}

function GroupRow({ g, current, myId }: { g: DmGroup; current: boolean; myId: number }) {
  let preview = "";
  if (g.last?.event) preview = g.last.body;
  else if (g.last?.deleted) preview = "Message deleted";
  else if (g.last) preview = `${g.last.from === myId ? "You" : g.last.name}: ${g.last.body}`;
  return (
    <li>
      <Link to={`/messages/g/${g.id}`} className={`dm-thread${current ? " current" : ""}${g.unread ? " unread" : ""}`}>
        <GroupAvatar g={g} myId={myId} size={44} />
        <span className="grow">
          <span className="dm-thread-top"><b>{groupName(g, myId)}</b><span className="muted small nowrap">{ago(g.at)}</span></span>
          <span className="dm-preview">{preview}</span>
        </span>
        {g.unread > 0 && <b className="dot" aria-label={`${g.unread} unread`}>{g.unread}</b>}
      </Link>
    </li>
  );
}

const MAX_COMPOSER_HEIGHT = 160;

function Composer({ onSend, max, typing, placeholder, above }: {
  onSend: (body: string) => Promise<void>;
  max: number;
  typing?: DmClientMessage;
  placeholder: string;
  above?: ReactNode;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const busy = useRef(false);
  const typed = useRef(0);
  const box = useRef<HTMLTextAreaElement>(null);

  const send = async () => {
    const body = text.trim();
    if (!body || busy.current) return;
    busy.current = true;
    try {
      await onSend(body);
      setText("");
      setError("");
    } catch (e) {
      setError(errorText(e));
    } finally {
      busy.current = false;
      box.current?.focus();
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    send();
  };

  const key = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  const change = (value: string) => {
    setText(value);
    // Typing pings are throttled to one every two seconds.
    if (typing && Date.now() - typed.current > 2000) {
      typed.current = Date.now();
      liveSend(typing);
    }
  };

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    const h = el.scrollHeight + 2;
    el.style.height = Math.min(MAX_COMPOSER_HEIGHT, h) + "px";
    el.style.overflowY = h > MAX_COMPOSER_HEIGHT ? "auto" : "hidden";
  }, [text]);

  return (
    <form className="dm-composer" onSubmit={submit}>
      {error && <p className="form-error" role="alert">{error}</p>}
      {above}
      <div className="dm-composer-row">
        <textarea
          ref={box}
          className="native-input"
          rows={1}
          value={text}
          maxLength={max}
          placeholder={placeholder}
          aria-label="Message"
          name="message"
          autoFocus
          onKeyDown={key}
          onChange={e => change(e.target.value)}
        />
        <Button kind="btn" type="submit" aria-label="Send" disabled={!text.trim()}><Ico.Send /></Button>
      </div>
      {text.length > max - 200 && <span className="muted small">{max - text.length} characters left</span>}
    </form>
  );
}

function Head({ user, back, children }: { user: Thread["user"]; back: string; children?: ReactNode }) {
  return (
    <header className="dm-head">
      <Link to={back} className="dm-back" aria-label="Back to conversations"><Ico.ChevLeft /></Link>
      <Link to={userUrl(user.username)} className="dm-who">
        <Avatar user={user} size={36} plain />
        <span><b>{user.username} <UserLabels name={user.username} /></b>{user.realname && <span className="muted small">{user.realname}</span>}</span>
      </Link>
      {children}
    </header>
  );
}

const MoreButton = { label: "More actions for this conversation", variant: "secondary", className: "more-btn", children: <Ico.More /> } as const;

type Paged<M> = { messages: M[]; more: boolean };

// Stick to the newest message, but hold the view still when earlier messages are prepended.
function useMessagePane<M extends { id: number }, T extends Paged<M>>(path: string, data: T | null, settle: unknown) {
  const scroller = useRef<HTMLDivElement>(null);
  const keep = useRef<number | null>(null);
  const [older, setOlder] = useState(false);
  const lastId = data?.messages.at(-1)?.id ?? 0;
  const firstId = data?.messages[0]?.id ?? 0;

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (keep.current != null) {
      el.scrollTop = el.scrollHeight - keep.current;
      keep.current = null;
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }, [lastId, firstId, settle]);

  const loadOlder = async () => {
    if (older) return;
    setOlder(true);
    try {
      const r = await api<T>(`${path}?before=${firstId}`);
      const el = scroller.current;
      if (el) keep.current = el.scrollHeight - el.scrollTop;
      mutate<T>(path, x => {
        const earlier = r.messages.filter(m => !x.messages.some(y => y.id === m.id));
        return { ...x, messages: [...earlier, ...x.messages], more: r.more };
      });
    } finally {
      setOlder(false);
    }
  };

  return { scroller, older, loadOlder, lastId };
}

// Only mark read while the tab is actually visible.
function useMarkRead(unread: number, lastId: number, mark: () => void) {
  useEffect(() => {
    if (!unread) return;
    const run = () => {
      if (document.visibilityState === "visible") mark();
    };
    run();
    document.addEventListener("visibilitychange", run);
    return () => document.removeEventListener("visibilitychange", run);
  }, [unread, lastId]);
}

function Bubble({ m, mine, open, onToggle, unsendable, onUnsend, onReport }: {
  m: Msg;
  mine: boolean;
  open: boolean;
  onToggle: () => void;
  unsendable: boolean;
  onUnsend: () => void;
  onReport: () => void;
}) {
  if (m.deleted) return <div className="dm-bubble gone">Message deleted</div>;
  let action = null;
  if (!mine) action = <Button kind="link small" type="button" onClick={onReport}>Report</Button>;
  else if (unsendable) action = <Button kind="link small" type="button" onClick={onUnsend}>Unsend</Button>;
  return (
    <>
      <button type="button" className="dm-bubble" title={clock(m.at)} aria-expanded={open} onClick={onToggle}>
        {m.body}
      </button>
      {open && (
        <div className="dm-meta muted small">
          {clock(m.at)}
          {action && (
            <>
              <span className="dm-dot" aria-hidden>·</span>
              {action}
            </>
          )}
        </div>
      )}
    </>
  );
}

const DayDivider = ({ prev, at }: { prev: Msg | undefined; at: number }) =>
  !prev || !sameDay(prev.at, at) ? <div className="dm-day"><span>{dayLabel(at)}</span></div> : null;

function Older({ more, older, loadOlder }: { more: boolean; older: boolean; loadOlder: () => void }) {
  if (!more) return null;
  return (
    <div className="dm-older">
      <Button kind="link small" type="button" onClick={loadOlder}>{older ? "Loading…" : "Show earlier messages"}</Button>
    </div>
  );
}

function Conversation({ id, back }: { id: number; back: string }) {
  const q = useApi<ThreadReply>(threadPath(id));
  const { me, setMe } = useAuth();
  const nav = useNavigate();
  const [typing, setTyping] = useState(false);
  const [picked, setPicked] = useState(0);
  const [reporting, setReporting] = useState(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const d = q.data;
  const t = d?.thread;
  const { scroller, older, loadOlder, lastId } = useMessagePane(threadPath(id), d, typing);
  const counted = (r: { counts: DmCounts }) => setMe({ ...me!, dm: r.counts });

  useLive(e => {
    if (e.t === "dm-typing" && e.threadId === id) {
      setTyping(true);
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTyping(false), 4000);
    }
    if (e.t === "dm" && e.thread.id === id && e.message.from !== me!.id) setTyping(false);
  });

  useEffect(() => () => clearTimeout(typingTimer.current), []);

  useMarkRead(t?.unread ?? 0, lastId, () => {
    mutate<ThreadReply>(threadPath(id), x => ({ ...x, thread: { ...x.thread, unread: 0 } }));
    for (const path of [INBOX, REQUESTS]) {
      mutate<ListReply>(path, x => ({ ...x, items: x.items.map(i => (i.id === id ? { ...i, unread: 0 } : i)) }));
    }
    api<DmDone>(`${threadPath(id)}/read`, { body: {} }).then(counted).catch(() => {});
  });

  if (q.error) {
    return (
      <div className="dm-blank muted">
        <p>{q.error.message}</p>
        <Link to="/messages">Back to messages</Link>
      </div>
    );
  }
  if (!d || !t) return null;
  const other = t.user;

  const send = async (body: string) => {
    const r = await api<DmSent>("/dm/send", { body: { thread: id, body } });
    applyDmEvent({ t: "dm", ...r });
  };

  const leave = (r: DmDone) => {
    counted(r);
    place(null, id);
    nav(back, { replace: true });
  };

  const accept = async () => {
    const r = await api<DmAccepted>(`${threadPath(id)}/accept`, { body: {} });
    counted(r);
    place(r.thread);
    mutate<ThreadReply>(threadPath(id), x => ({ ...x, thread: r.thread }));
    nav(`/messages/${id}`, { replace: true });
  };

  const decline = () => api<DmDone>(`${threadPath(id)}/decline`, { body: {} }).then(leave);
  const remove = () => api<DmDone>(threadPath(id), { method: "DELETE" }).then(leave);

  const block = async () => {
    await setBlocked(other.username, true);
    invalidateAll();
    nav(back, { replace: true });
  };

  const unblock = async () => {
    await setBlocked(other.username, false);
    invalidateAll();
    q.reload();
  };

  const unsend = (m: Msg) => api<DmUnsent>(`/dm/message/${m.id}`, { method: "DELETE" })
    .then(() => applyDmEvent({ t: "dm-deleted", threadId: id, id: m.id }))
    .catch(() => {});

  // A report is filed against one message; staff see the ones around it.
  const lastTheirs = d.messages.findLast(m => m.from !== me!.id && !m.deleted);
  const lastMine = d.messages.findLast(m => m.from === me!.id && !m.deleted);

  let footer;
  if (t.incoming) {
    footer = (
      <div className="dm-request">
        <p>
          <b>{other.username} wants to message you.</b>{" "}
          <span className="muted">They won't know you've seen this unless you accept. Declining is silent.</span>
        </p>
        <div className="dm-request-actions">
          <Button kind="btn" type="button" onClick={accept}>Accept</Button>
          <Button kind="btn ghost" type="button" onClick={decline}>Decline</Button>
          <Button kind="btn ghost" type="button" onClick={() => decline().then(block)}>Block</Button>
        </div>
      </div>
    );
  } else if (d.blocked) {
    footer = <Blocked name={other.username} onUnblock={unblock} />;
  } else if (!d.can) {
    footer = <p className="dm-closed muted">{d.why}</p>;
  } else if (t.left === 0) {
    footer = <p className="dm-closed muted">Your message request has been sent. You can write again once {other.username} replies.</p>;
  } else {
    const typingPing = t.status === "active" ? { t: "typing" as const, thread: id } : undefined;
    footer = (
      <>
        {t.left != null && (
          <p className="dm-closed muted small">
            This is a message request: {other.username} will see it under Requests. You can send {t.left}{" "}
            more {t.left === 1 ? "message" : "messages"}, without links, until they reply.
          </p>
        )}
        <Composer onSend={send} max={d.max} typing={typingPing} placeholder={`Message ${other.username}`} />
      </>
    );
  }

  return (
    <>
      <Head user={other} back={back}>
        <DropdownMenu placement="below" alignment="end" hasChevron={false} menuWidth={210} button={MoreButton}>
          <DropdownMenuItem label="View profile" href={userUrl(other.username)} />
          {lastTheirs && <DropdownMenuItem label={`Report ${other.username}`} onClick={() => setReporting(lastTheirs.id)} />}
          <DropdownMenuItem label="Delete conversation" onClick={remove} />
          <DropdownMenuItem
            label={d.blocked ? `Unblock ${other.username}` : `Block ${other.username}`}
            onClick={d.blocked ? unblock : block}
          />
        </DropdownMenu>
      </Head>
      <div className="dm-scroll" ref={scroller}>
        <Older more={d.more} older={older} loadOlder={loadOlder} />
        {!d.more && (
          <p className="dm-start muted small">
            This is the start of your conversation with {other.username}. Messages are private between the two of you, but staff may
            review them when investigating a report or abuse.
          </p>
        )}
        <ol className="dm-msgs">
          {d.messages.map((m, i) => {
            const prev = d.messages[i - 1];
            const mine = m.from === me!.id;
            const joined = prev && prev.from === m.from && m.at - prev.at < 300;
            return (
              <li key={m.id} className={`${mine ? "mine" : "theirs"}${joined ? " joined" : ""}`}>
                <DayDivider prev={prev} at={m.at} />
                <Bubble
                  m={m}
                  mine={mine}
                  open={picked === m.id}
                  onToggle={() => setPicked(picked === m.id ? 0 : m.id)}
                  unsendable={Date.now() / 1000 - m.at < d.unsendFor}
                  onUnsend={() => unsend(m)}
                  onReport={() => setReporting(m.id)}
                />
                {lastMine?.id === m.id && t.status === "active" && t.seen >= m.id && <div className="dm-meta muted small">Seen</div>}
              </li>
            );
          })}
        </ol>
        {typing && <p className="dm-typing muted small" role="status">{other.username} is typing…</p>}
      </div>
      {footer}
      {reporting > 0 && <ReportButton type="dm" id={reporting} open onClose={() => setReporting(0)} />}
    </>
  );
}

function Blocked({ name, onUnblock }: { name: string; onUnblock: () => Promise<unknown> }) {
  const [busy, setBusy] = useState(false);
  const unblock = () => {
    setBusy(true);
    onUnblock().finally(() => setBusy(false));
  };
  return (
    <p className="dm-closed muted">
      You blocked {name}, so you can't message each other. <Button kind="link" type="button" loading={busy} onClick={unblock}>Unblock</Button>
    </p>
  );
}

function typingLine(names: string[]) {
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return "Several people are typing…";
}

function GroupConversation({ id }: { id: number }) {
  const path = groupPath(id);
  const q = useApi<DmGroupPage>(path);
  const { me, setMe } = useAuth();
  const nav = useNavigate();
  const [typing, setTyping] = useState<string[]>([]);
  const [info, setInfo] = useState(false);
  const [picked, setPicked] = useState(0);
  const [reporting, setReporting] = useState(0);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const d = q.data;
  const g = d?.group;
  const { scroller, older, loadOlder, lastId } = useMessagePane<DmGroupMessage, DmGroupPage>(path, d, typing.length);

  const stopTyping = (name: string) => {
    clearTimeout(timers.current.get(name));
    timers.current.delete(name);
    setTyping(names => names.filter(n => n !== name));
  };

  useLive(e => {
    if (e.t === "dm-group-typing" && e.groupId === id) {
      const name = e.name;
      clearTimeout(timers.current.get(name));
      timers.current.set(name, setTimeout(() => stopTyping(name), 4000));
      setTyping(names => (names.includes(name) ? names : [...names, name]));
    }
    if (e.t === "dm-group" && e.group.id === id) stopTyping(e.message.name);
    if (e.t === "dm-group-gone" && e.groupId === id) nav("/messages", { replace: true });
  });

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  useMarkRead(g?.unread ?? 0, lastId, () => {
    mutate<DmGroupPage>(path, x => ({ ...x, group: { ...x.group, unread: 0 } }));
    mutate<ListReply>(INBOX, x => ({ ...x, groups: x.groups.map(i => (i.id === id ? { ...i, unread: 0 } : i)) }));
    api<DmDone>(`${path}/read`, { body: {} }).then(r => setMe({ ...me!, dm: r.counts })).catch(() => {});
  });

  if (q.error) {
    return (
      <div className="dm-blank muted">
        <p>{q.error.message}</p>
        <Link to="/messages">Back to messages</Link>
      </div>
    );
  }
  if (!d || !g) return null;
  const myId = me!.id;
  const name = groupName(g, myId);

  const send = async (body: string) => {
    const r = await api<DmGroupSent>(`${path}/send`, { body: { body } });
    applyDmEvent({ t: "dm-group", ...r });
  };

  const unsend = (m: Msg) => api<DmUnsent>(`/dm/group/message/${m.id}`, { method: "DELETE" })
    .then(() => applyDmEvent({ t: "dm-group-deleted", groupId: id, id: m.id }))
    .catch(() => {});

  return (
    <>
      <header className="dm-head">
        <Link to="/messages" className="dm-back" aria-label="Back to conversations"><Ico.ChevLeft /></Link>
        <button type="button" className="dm-who dm-who-group" onClick={() => setInfo(!info)} aria-expanded={info}>
          <GroupAvatar g={g} myId={myId} size={36} />
          <span><b>{name}</b><span className="muted small">{g.members.length} people</span></span>
        </button>
        <DropdownMenu placement="below" alignment="end" hasChevron={false} menuWidth={210} button={MoreButton}>
          <DropdownMenuItem label={info ? "Back to messages" : "Group details"} onClick={() => setInfo(!info)} />
        </DropdownMenu>
      </header>
      {info ? (
        <div className="dm-scroll" key="info">
          <GroupInfo d={d} onDone={() => setInfo(false)} />
        </div>
      ) : (
        <div className="dm-scroll" ref={scroller}>
          <Older more={d.more} older={older} loadOlder={loadOlder} />
          {!d.more && (
            <p className="dm-start muted small">
              This is the start of {g.title ? `"${g.title}"` : "this group"}. Messages are seen by everyone in the group, but staff
              may review them when investigating a report or abuse.
            </p>
          )}
          <ol className="dm-msgs">
            {d.messages.map((m, i) => {
              const prev = d.messages[i - 1];
              if (m.event) {
                return (
                  <li key={m.id} className="dm-event">
                    <DayDivider prev={prev} at={m.at} />
                    <span className="muted small">{m.body}</span>
                  </li>
                );
              }
              const mine = m.from === myId;
              const joined = prev && !prev.event && prev.from === m.from && m.at - prev.at < 300;
              return (
                <li key={m.id} className={`${mine ? "mine" : "theirs"}${joined ? " joined" : ""}`}>
                  <DayDivider prev={prev} at={m.at} />
                  {!mine && !joined && <span className="dm-sender muted small">{m.name} <UserLabels name={m.name} /></span>}
                  <Bubble
                    m={m}
                    mine={mine}
                    open={picked === m.id}
                    onToggle={() => setPicked(picked === m.id ? 0 : m.id)}
                    unsendable={Date.now() / 1000 - m.at < d.unsendFor}
                    onUnsend={() => unsend(m)}
                    onReport={() => setReporting(m.id)}
                  />
                </li>
              );
            })}
          </ol>
          {typing.length > 0 && <p className="dm-typing muted small" role="status">{typingLine(typing)}</p>}
        </div>
      )}
      {!info && (d.can
        ? <Composer onSend={send} max={d.max} typing={{ t: "typing", group: id }} placeholder={`Message ${name}`} />
        : <p className="dm-closed muted">{d.why}</p>)}
      {reporting > 0 && <ReportButton type="group" id={reporting} open onClose={() => setReporting(0)} />}
    </>
  );
}

function GroupInfo({ d, onDone }: { d: DmGroupPage; onDone: () => void }) {
  const { me, setMe } = useAuth();
  const nav = useNavigate();
  const confirm = useConfirm();
  const act = useAction();
  const g = d.group;
  const path = groupPath(g.id);
  const owner = g.owner === me!.id;
  const [title, setTitle] = useState(g.title);
  const apply = (r: DmGroupSent) => applyDmEvent({ t: "dm-group", ...r });

  const rename = (e: FormEvent) => {
    e.preventDefault();
    act.run(async () => apply(await api<DmGroupSent>(`${path}/title`, { body: { title } })));
  };
  const makeOwner = (u: DmUser) => confirm.ask({
    title: "Change owner",
    body: `${u.username} will be able to rename the group and add or remove people. You won't be able to anymore.`,
    action: "Make owner",
    run: async () => apply(await api<DmGroupSent>(`${path}/owner`, { body: { user: u.id } })),
  });
  const remove = (u: DmUser) => act.run(async () => {
    apply(await api<DmGroupSent>(`${path}/members/${u.id}`, { method: "DELETE" }));
  });
  const leave = () => confirm.ask({
    title: "Leave group",
    body: owner && g.members.length > 1
      ? "You won't see new messages unless someone adds you back. The person who has been in the group longest becomes the owner."
      : "You won't see new messages unless someone adds you back.",
    action: "Leave",
    danger: true,
    run: async () => {
      const r = await api<DmDone>(`${path}/leave`, { body: {} });
      setMe({ ...me!, dm: r.counts });
      applyDmEvent({ t: "dm-group-gone", groupId: g.id });
      nav("/messages", { replace: true });
    },
  });

  return (
    <div className="dm-info">
      <div className="dm-info-head">
        <h2>Group details</h2>
        <Button kind="link small" type="button" onClick={onDone}>Done</Button>
      </div>
      {owner && (
        <form className="dm-info-title" onSubmit={rename}>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Group name" aria-label="Group name" />
          <Button kind="btn small" disabled={title.trim() === g.title}>Save</Button>
        </form>
      )}
      <h3>{g.members.length} of {d.size} people</h3>
      <ul className="dm-members">
        {g.members.map(u => (
          <li key={u.id}>
            <Avatar user={u} size={32} />
            <Link to={userUrl(u.username)} className="grow">{u.username} <UserLabels name={u.username} />{u.id === me!.id && <span className="muted"> (you)</span>}</Link>
            {u.id === g.owner && <span className="badge off">Owner</span>}
            {owner && u.id !== me!.id && (
              <span className="dm-member-actions">
                <Button kind="link small" type="button" onClick={() => makeOwner(u)}>Make owner</Button>
                <Button kind="link small" type="button" onClick={() => remove(u)}>Remove</Button>
              </span>
            )}
          </li>
        ))}
      </ul>
      {owner && g.members.length < d.size && <AddPeople groupId={g.id} onAdd={apply} />}
      {act.note}
      <Button kind="btn ghost" type="button" onClick={leave}>Leave group</Button>
      {confirm.dialog}
    </div>
  );
}

function AddPeople({ groupId, onAdd }: { groupId: number; onAdd: (r: DmGroupSent) => void }) {
  const q = useApi<DmGroupCandidates>(`/dm/group/candidates?group=${groupId}`);
  const act = useAction();
  const add = (u: DmUser) => act.run(async () => {
    onAdd(await api<DmGroupSent>(`${groupPath(groupId)}/members`, { body: { user: u.id } }));
    q.reload();
  });
  const users = q.data?.users ?? [];
  return (
    <>
      <h3>Add people</h3>
      {q.data && !users.length && (
        <p className="muted small">You can add people you already have a conversation with. There's no one else to add right now.</p>
      )}
      <ul className="dm-members">
        {users.map(u => (
          <li key={u.id}>
            <Avatar user={u} size={32} plain />
            <span className="grow">{u.username} <UserLabels name={u.username} /></span>
            <Button kind="link small" type="button" onClick={() => add(u)}>Add</Button>
          </li>
        ))}
      </ul>
      {act.note}
    </>
  );
}

function NewGroup() {
  const q = useApi<DmGroupCandidates>("/dm/group/candidates");
  const nav = useNavigate();
  const act = useAction();
  const [title, setTitle] = useState("");
  const [picked, setPicked] = useState<number[]>([]);
  const d = q.data;
  if (q.error) {
    return (
      <div className="dm-blank muted">
        <p>{q.error.message}</p>
        <Link to="/messages">Back to messages</Link>
      </div>
    );
  }
  if (!d) return null;
  const room = d.size - 1 - picked.length;

  const toggle = (id: number, on: boolean) => {
    setPicked(ids => (on ? [...ids, id] : ids.filter(x => x !== id)));
  };

  const create = (e: FormEvent) => {
    e.preventDefault();
    act.run(async () => {
      const r = await api<DmGroupSent>("/dm/group", { body: { title, users: picked } });
      placeGroup(r.group);
      nav(`/messages/g/${r.group.id}`, { replace: true });
    });
  };

  return (
    <>
      <header className="dm-head">
        <Link to="/messages" className="dm-back" aria-label="Back to conversations"><Ico.ChevLeft /></Link>
        <span className="dm-who"><b>New group</b></span>
      </header>
      <form className="dm-scroll dm-info" onSubmit={create}>
        <p className="muted small">
          You can add people you already have a conversation with, up to {d.size} people including you. You'll be the group's owner.
        </p>
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Group name (optional)" aria-label="Group name" />
        <h3>People</h3>
        {!d.users.length && <p className="muted small">There's no one you can add yet. Start a conversation with someone first.</p>}
        <ul className="dm-members">
          {d.users.map(u => {
            const on = picked.includes(u.id);
            return (
              <li key={u.id}>
                <label className="check dm-pick">
                  <Input
                    type="checkbox"
                    aria-label={`Add ${u.username}`}
                    checked={on}
                    disabled={!on && room <= 0}
                    onChange={e => toggle(u.id, e.target.checked)}
                  />
                  <Avatar user={u} size={32} plain />
                  <span className="grow">{u.username} <UserLabels name={u.username} /></span>
                </label>
              </li>
            );
          })}
        </ul>
        {act.note}
        <Button kind="btn" loading={act.busy} disabled={picked.length < 2}>Start group</Button>
      </form>
    </>
  );
}

// Nothing exists on the server until the first message is sent.
function NewConversation({ name }: { name: string }) {
  const path = `/dm/with?name=${encodeURIComponent(name)}`;
  const q = useApi<DmWith>(path);
  const nav = useNavigate();
  if (q.error) {
    return (
      <div className="dm-blank muted">
        <p>{q.error.message}</p>
        <Link to="/messages">Back to messages</Link>
      </div>
    );
  }
  const d = q.data;
  if (!d) return null;
  if (d.threadId) return <Navigate to={`/messages/${d.threadId}`} replace />;
  const username = d.user.username;

  const send = async (body: string, turnstile?: string) => {
    const r = await api<DmSent>("/dm/send", { body: { to: username, body, turnstile } });
    mutate<DmWith>(path, x => ({ ...x, threadId: r.thread.id }));
    place(r.thread);
    nav(`/messages/${r.thread.id}`, { replace: true });
  };

  const unblock = async () => {
    await setBlocked(username, false);
    invalidateAll();
    q.reload();
  };

  let intro: string = d.why;
  if (d.can) {
    intro = d.request
      ? `${username} doesn't follow you, so your message will arrive as a request. You can send up to 3 messages, without links, until they reply.`
      : `Say hello to ${username}.`;
  }

  return (
    <>
      <Head user={d.user} back="/messages" />
      <div className="dm-scroll">{!d.blocked && <p className="dm-start muted small">{intro}</p>}</div>
      {d.blocked && <Blocked name={username} onUnblock={unblock} />}
      {d.can && (d.human
        ? <HumanComposer onSend={send} name={username} />
        : <Composer onSend={send} max={2000} placeholder={`Message ${username}`} />)}
    </>
  );
}

// First messages to someone who doesn't follow you need the robot check.
function HumanComposer({ onSend, name }: { onSend: (body: string, turnstile?: string) => Promise<void>; name: string }) {
  const robot = useTurnstile("dm");
  const send = async (body: string) => {
    if (robot.on && !robot.token) throw new Error("Complete the check that you are not a robot first.");
    try {
      await onSend(body, robot.token || undefined);
    } catch (e) {
      robot.reset();
      throw e;
    }
  };
  const above = robot.view && <div className="dm-human">{robot.view}</div>;
  return <Composer onSend={send} max={2000} placeholder={`Message ${name}`} above={above} />;
}
