import { Suspense, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { DropdownMenu, DropdownMenuItem } from "@astryxdesign/core/DropdownMenu";
import { Ico } from "../icons";
import { Button } from "../kit";
import { useTurnstile } from "./auth";
import { ago, api, date, invalidateAll, liveSend, mutate, useApi, useAuth, useLive, useTitle, userUrl } from "../lib";
import type { BlockResult } from "../../shared/blocks";
import type { DmAccepted, DmCounts, DmDone, DmSent, DmUnsent, DmWith } from "../../shared/dm";
import { Avatar } from "../ui/base";
import { ReportButton } from "../ui/shoutbox";
import { type Msg, type Thread, type ThreadReply, type ListReply, INBOX, REQUESTS, threadPath, place, applyDmEvent } from "../dm";

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

export function MessagesPage({ view }: { view: "inbox" | "requests" | "thread" | "new" }) {
  const p = useParams();
  const [sp] = useSearchParams();
  const { me } = useAuth();
  const requests = view === "requests" || (view === "thread" && sp.get("box") === "requests");
  const list = useApi<ListReply>(requests ? REQUESTS : INBOX);
  const counts = me!.dm;
  const open = view === "thread" || view === "new";
  useTitle(counts.unread ? `(${counts.unread}) Messages` : "Messages");

  let pane;
  if (view === "thread") {
    pane = <Conversation key={p.id} id={Number(p.id) || 0} back={requests ? "/messages/requests" : "/messages"} />;
  } else if (view === "new") {
    pane = <NewConversation key={p.name} name={p.name || ""} />;
  } else {
    pane = (
      <div className="dm-blank muted">
        <Ico.Chat />
        <p>{requests ? "Choose a request to read it." : "Choose a conversation."}</p>
      </div>
    );
  }

  return (
    <div className="wrap page dm-page">
      <div className={`dm${open ? " dm-open" : ""}`}>
        <aside className="dm-side" aria-label="Conversations">
          <h1 className="dm-title">Messages</h1>
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
              {(list.data?.items ?? []).map(t => (
                <ThreadRow key={t.id} t={t} requests={requests} current={view === "thread" && Number(p.id) === t.id} myId={me!.id} />
              ))}
              {list.data && !list.data.items.length && (
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
          <span className="dm-thread-top"><b>{t.user.username}</b><span className="muted small nowrap">{ago(t.at)}</span></span>
          <span className="dm-preview">{preview}</span>
        </span>
        {t.unread > 0 && <b className="dot" aria-label={`${t.unread} unread`}>{t.unread}</b>}
      </Link>
    </li>
  );
}

const MAX_COMPOSER_HEIGHT = 160;

function Composer({ onSend, max, threadId, placeholder, above }: {
  onSend: (body: string) => Promise<void>;
  max: number;
  threadId?: number;
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
    if (threadId && Date.now() - typed.current > 2000) {
      typed.current = Date.now();
      liveSend({ t: "typing", thread: threadId });
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
        <span><b>{user.username}</b>{user.realname && <span className="muted small">{user.realname}</span>}</span>
      </Link>
      {children}
    </header>
  );
}

function Conversation({ id, back }: { id: number; back: string }) {
  const q = useApi<ThreadReply>(threadPath(id));
  const { me, setMe } = useAuth();
  const nav = useNavigate();
  const [typing, setTyping] = useState(false);
  const [picked, setPicked] = useState(0);
  const [reporting, setReporting] = useState(0);
  const [older, setOlder] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const keep = useRef<number | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const d = q.data;
  const t = d?.thread;
  const lastId = d?.messages.at(-1)?.id ?? 0;
  const firstId = d?.messages[0]?.id ?? 0;
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

  // Stick to the newest message, but hold the view still when earlier messages are prepended.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (keep.current != null) {
      el.scrollTop = el.scrollHeight - keep.current;
      keep.current = null;
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }, [lastId, firstId, typing]);

  // Only mark read while the tab is actually visible.
  useEffect(() => {
    if (!t?.unread) return;
    const mark = () => {
      if (document.visibilityState !== "visible") return;
      mutate<ThreadReply>(threadPath(id), x => ({ ...x, thread: { ...x.thread, unread: 0 } }));
      for (const path of [INBOX, REQUESTS]) {
        mutate<ListReply>(path, x => ({ ...x, items: x.items.map(i => (i.id === id ? { ...i, unread: 0 } : i)) }));
      }
      api<DmDone>(`${threadPath(id)}/read`, { body: {} }).then(counted).catch(() => {});
    };
    mark();
    document.addEventListener("visibilitychange", mark);
    return () => document.removeEventListener("visibilitychange", mark);
  }, [id, t?.unread, lastId]);

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

  const loadOlder = async () => {
    if (older) return;
    setOlder(true);
    try {
      const r = await api<ThreadReply>(`${threadPath(id)}?before=${firstId}`);
      const el = scroller.current;
      if (el) keep.current = el.scrollHeight - el.scrollTop;
      mutate<ThreadReply>(threadPath(id), x => {
        const earlier = r.messages.filter(m => !x.messages.some(y => y.id === m.id));
        return { ...x, messages: [...earlier, ...x.messages], more: r.more };
      });
    } finally {
      setOlder(false);
    }
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
    footer = (
      <>
        {t.left != null && (
          <p className="dm-closed muted small">
            This is a message request: {other.username} will see it under Requests. You can send {t.left}{" "}
            more {t.left === 1 ? "message" : "messages"}, without links, until they reply.
          </p>
        )}
        <Composer onSend={send} max={d.max} threadId={t.status === "active" ? id : undefined} placeholder={`Message ${other.username}`} />
      </>
    );
  }

  return (
    <>
      <Head user={other} back={back}>
        <DropdownMenu
          placement="below"
          alignment="end"
          hasChevron={false}
          menuWidth={210}
          button={{ label: "More actions for this conversation", variant: "secondary", className: "more-btn", children: <Ico.More /> }}
        >
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
        {d.more && (
          <div className="dm-older">
            <Button kind="link small" type="button" onClick={loadOlder}>{older ? "Loading…" : "Show earlier messages"}</Button>
          </div>
        )}
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
            const open = picked === m.id;
            const joined = prev && prev.from === m.from && m.at - prev.at < 300;
            const canUnsend = Date.now() / 1000 - m.at < d.unsendFor;
            return (
              <li key={m.id} className={`${mine ? "mine" : "theirs"}${joined ? " joined" : ""}`}>
                {(!prev || !sameDay(prev.at, m.at)) && <div className="dm-day"><span>{dayLabel(m.at)}</span></div>}
                {m.deleted ? (
                  <div className="dm-bubble gone">Message deleted</div>
                ) : (
                  <button type="button" className="dm-bubble" title={clock(m.at)} aria-expanded={open} onClick={() => setPicked(open ? 0 : m.id)}>
                    {m.body}
                  </button>
                )}
                {open && !m.deleted && (
                  <div className="dm-meta muted small">
                    {clock(m.at)}
                    {mine ? canUnsend && (
                      <>
                        <span className="dm-dot" aria-hidden>·</span>
                        <Button kind="link small" type="button" onClick={() => unsend(m)}>Unsend</Button>
                      </>
                    ) : (
                      <>
                        <span className="dm-dot" aria-hidden>·</span>
                        <Button kind="link small" type="button" onClick={() => setReporting(m.id)}>Report</Button>
                      </>
                    )}
                  </div>
                )}
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
