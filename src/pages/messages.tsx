import {
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { DropdownMenu, DropdownMenuItem } from "@astryxdesign/core/DropdownMenu";
import { Ico } from "../icons";
import { locale, t, tx } from "../i18n";
import { Button, Input, useConfirm } from "../kit";
import { useTurnstile } from "./auth";
import {
  ago,
  api,
  date,
  invalidateAll,
  liveSend,
  mutate,
  qs,
  useApi,
  useAuth,
  useLive,
  useTitle,
  userUrl,
} from "../lib";
import type { BlockResult } from "../../shared/blocks";
import { DM_REACTIONS } from "../../shared/dm";
import type {
  DmAccepted,
  DmClientMessage,
  DmCounts,
  DmDone,
  DmGroup,
  DmGroupCandidates,
  DmGroupMessage,
  DmGroupPage,
  DmGroupSent,
  DmLink,
  DmLinkPreview,
  DmReacted,
  DmSent,
  DmUnsent,
  DmUser,
  DmWith,
} from "../../shared/dm";
import type { SearchResults } from "../../shared/search";
import { BARE_URL } from "../md";
import { Avatar, useAction } from "../ui/base";
import { UserLabels } from "../ui/user-labels";
import { ReportButton } from "../ui/shoutbox";
import {
  type Msg,
  type Thread,
  type ThreadReply,
  type ListReply,
  INBOX,
  REQUESTS,
  threadPath,
  groupPath,
  place,
  placeGroup,
  applyDmEvent,
  groupName,
} from "../dm";

const clock = (at: number) => new Date(at * 1000).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });
const sameDay = (a: number, b: number) => new Date(a * 1000).toDateString() === new Date(b * 1000).toDateString();
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

function dayLabel(at: number) {
  const now = Date.now() / 1000;
  if (sameDay(at, now)) return t("messages.today");
  if (sameDay(at, now - 86400)) return t("messages.yesterday");
  return date(at);
}

const setBlocked = (username: string, block: boolean) => api<BlockResult>("/block", { body: { username, block } });

type View = "inbox" | "requests" | "thread" | "new" | "group" | "compose";
type Row = { kind: "thread"; at: number; t: Thread } | { kind: "group"; at: number; g: DmGroup };

export function MessagesPage({ view }: { view: View }) {
  const p = useParams();
  const [sp] = useSearchParams();
  const { me } = useAuth();
  const requests = view === "requests" || (view === "thread" && sp.get("box") === "requests");
  const list = useApi<ListReply>(requests ? REQUESTS : INBOX);
  const counts = me!.dm;
  const open = view !== "inbox" && view !== "requests";
  useTitle(counts.unread ? t("messages.titleUnread", { count: counts.unread }) : t("messages.title"));

  let pane;
  if (view === "thread") {
    pane = <Conversation key={p.id} id={Number(p.id) || 0} back={requests ? "/messages/requests" : "/messages"} />;
  } else if (view === "new") {
    pane = <NewConversation key={p.name} name={p.name || ""} />;
  } else if (view === "group") {
    pane = <GroupConversation key={p.id} id={Number(p.id) || 0} />;
  } else if (view === "compose") {
    pane = <Compose />;
  } else {
    pane = (
      <div className="dm-blank muted">
        <Ico.Chat />
        <p>{requests ? t("messages.chooseRequest") : t("messages.chooseConversation")}</p>
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
        <aside className="dm-side" aria-label={t("messages.conversations")}>
          <div className="dm-title-row">
            <h1 className="dm-title">{t("messages.title")}</h1>
            <Button
              kind="btn ghost small dm-new"
              href="/messages/new"
              aria-label={t("messages.newMessage")}
              title={t("messages.newMessage")}
            >
              <Ico.Plus />
            </Button>
          </div>
          <nav className="tabs dm-tabs">
            <Link to="/messages" className={requests ? "" : "active"}>
              {t("messages.inbox")}
              {counts.unread > 0 && <b className="dot">{counts.unread}</b>}
            </Link>
            <Link to="/messages/requests" className={requests ? "active" : ""}>
              {t("messages.requests")}
              {counts.requests > 0 && <b className="dot">{counts.requests}</b>}
            </Link>
          </nav>
          {requests && <p className="muted small dm-hint">{t("messages.requestsHint")}</p>}
          {list.error ? (
            <p className="form-error">{list.error.message}</p>
          ) : (
            <ul className="dm-threads">
              {rows.map((r) =>
                r.kind === "thread" ? (
                  <ThreadRow
                    key={`t${r.t.id}`}
                    thread={r.t}
                    requests={requests}
                    current={view === "thread" && currentId === r.t.id}
                    myId={me!.id}
                  />
                ) : (
                  <GroupRow
                    key={`g${r.g.id}`}
                    g={r.g}
                    current={view === "group" && currentId === r.g.id}
                    myId={me!.id}
                  />
                )
              )}
              {list.data && !rows.length && (
                <li className="dm-none muted">{requests ? t("messages.noRequests") : t("messages.noConversations")}</li>
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

function ThreadRow({
  thread,
  requests,
  current,
  myId,
}: {
  thread: Thread;
  requests: boolean;
  current: boolean;
  myId: number;
}) {
  let preview = "";
  if (thread.last?.deleted) preview = t("messages.messageDeleted");
  else if (thread.last)
    preview = thread.last.from === myId ? t("messages.previewMine", { body: thread.last.body }) : thread.last.body;
  return (
    <li>
      <Link
        to={`/messages/${thread.id}${requests ? "?box=requests" : ""}`}
        className={`dm-thread${current ? " current" : ""}${thread.unread ? " unread" : ""}`}
      >
        <Avatar user={thread.user} size={44} plain />
        <span className="grow">
          <span className="dm-thread-top">
            <b>
              <Username user={thread.user} /> <UserLabels name={thread.user.username} />
            </b>
            <span className="muted small nowrap">{ago(thread.at)}</span>
          </span>
          <span className="dm-preview">{preview}</span>
        </span>
        {thread.unread > 0 && (
          <b className="dot" aria-label={t("messages.unread", { count: thread.unread })}>
            {thread.unread}
          </b>
        )}
      </Link>
    </li>
  );
}

function GroupAvatar({ g, myId, size }: { g: DmGroup; myId: number; size: number }) {
  const [a, b] = g.members.filter((m) => m.id !== myId);
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
  else if (g.last?.deleted) preview = t("messages.messageDeleted");
  else if (g.last?.from === myId) preview = t("messages.previewMine", { body: g.last.body });
  else if (g.last) preview = t("messages.preview", { name: g.last.name, body: g.last.body });
  return (
    <li>
      <Link to={`/messages/g/${g.id}`} className={`dm-thread${current ? " current" : ""}${g.unread ? " unread" : ""}`}>
        <GroupAvatar g={g} myId={myId} size={44} />
        <span className="grow">
          <span className="dm-thread-top">
            <b>{groupName(g, myId)}</b>
            <span className="muted small nowrap">{ago(g.at)}</span>
          </span>
          <span className="dm-preview">{preview}</span>
        </span>
        {g.unread > 0 && (
          <b className="dot" aria-label={t("messages.unread", { count: g.unread })}>
            {g.unread}
          </b>
        )}
      </Link>
    </li>
  );
}

const MAX_COMPOSER_HEIGHT = 160;

function Composer({
  onSend,
  max,
  typing,
  placeholder,
}: {
  onSend: (body: string) => Promise<void>;
  max: number;
  typing?: DmClientMessage;
  placeholder: string;
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
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="dm-composer-row">
        <textarea
          ref={box}
          className="native-input"
          rows={1}
          value={text}
          maxLength={max}
          placeholder={placeholder}
          aria-label={t("messages.message")}
          name="message"
          autoFocus
          onKeyDown={key}
          onChange={(e) => change(e.target.value)}
        />
        <Button kind="btn" type="submit" aria-label={t("messages.send")} disabled={!text.trim()}>
          <Ico.Send />
        </Button>
      </div>
      {text.length > max - 200 && (
        <span className="muted small">{t("messages.charsLeft", { count: max - text.length })}</span>
      )}
    </form>
  );
}

function Head({ user, back, children }: { user: Thread["user"]; back: string; children?: ReactNode }) {
  return (
    <header className="dm-head">
      <Link to={back} className="dm-back" aria-label={t("messages.backToConversations")}>
        <Ico.ChevLeft />
      </Link>
      <Link to={userUrl(user.username)} className="dm-who">
        <Avatar user={user} size={36} plain />
        <span>
          <b>
            <Username user={user} /> <UserLabels name={user.username} />
          </b>
          {user.realname && <span className="muted small">{user.realname}</span>}
        </span>
      </Link>
      {children}
    </header>
  );
}

const moreButton = () =>
  ({
    label: t("messages.moreActions"),
    variant: "secondary",
    className: "more-btn",
    children: <Ico.More />,
  }) as const;

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
      mutate<T>(path, (x) => {
        const earlier = r.messages.filter((m) => !x.messages.some((y) => y.id === m.id));
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

function Reactions({
  m,
  myId,
  who,
  canReact,
  onReact,
}: {
  m: Msg;
  myId: number;
  who: (id: number) => string;
  canReact: boolean;
  onReact: (emoji: string) => void;
}) {
  if (!m.reactions.length) return null;
  return (
    <div className="dm-reactions">
      {m.reactions.map((r) => {
        const names = r.users.map(who).join(", ");
        return (
          <button
            type="button"
            key={r.emoji}
            className="dm-reaction"
            title={names}
            aria-label={`${r.emoji} ${names}`}
            aria-pressed={r.users.includes(myId)}
            disabled={!canReact}
            onClick={() => onReact(r.emoji)}
          >
            <span aria-hidden>{r.emoji}</span>
            {r.users.length > 1 && <span>{r.users.length}</span>}
          </button>
        );
      })}
    </div>
  );
}

const LINKS = new RegExp(`(${BARE_URL.source})`, "g");
const OUT = { target: "_blank", rel: "noopener noreferrer nofollow ugc" } as const;

function Linked({ text }: { text: string }) {
  return text.split(LINKS).map((s, i) =>
    i % 2 ? (
      <a key={i} href={s} {...OUT}>
        {s}
      </a>
    ) : (
      s
    )
  );
}

const previews = new Map<string, Promise<DmLinkPreview | null>>();

function previewOf(key: string): Promise<DmLinkPreview | null> {
  let req = previews.get(key);
  if (!req) {
    req = api<DmLink>(`/dm/link?${key}`).then(
      (r) => r.preview,
      () => {
        previews.delete(key);
        return null;
      }
    );
    previews.set(key, req);
  }
  return req;
}

function LinkCard({ where, url }: { where: string; url: string }) {
  const [p, setP] = useState<DmLinkPreview | null>(null);
  const [broken, setBroken] = useState(false);
  const card = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    let live = true;
    previewOf(`${where}&url=${encodeURIComponent(url)}`).then((v) => live && setP(v));
    return () => {
      live = false;
    };
  }, [where, url]);

  // arriving after the messages, so keep the newest in view if that's where the reader was
  useLayoutEffect(() => {
    const el = card.current;
    const pane = el?.closest(".dm-scroll");
    if (!el || !pane) return;
    if (pane.scrollHeight - pane.scrollTop - pane.clientHeight - el.offsetHeight < 120) {
      pane.scrollTop = pane.scrollHeight;
    }
  }, [p]);

  if (!p) return null;
  return (
    <a ref={card} className="dm-link" href={p.url} {...OUT}>
      {p.image && !broken && (
        <img src={`/api/dm/link/picture/${p.image}`} alt="" loading="lazy" onError={() => setBroken(true)} />
      )}
      <span className="dm-link-text">
        {p.site && <span className="dm-link-site">{p.site}</span>}
        <b>{p.title}</b>
        {p.description && <span className="dm-link-desc">{p.description}</span>}
      </span>
    </a>
  );
}

function Bubble({
  m,
  mine,
  myId,
  who,
  links,
  open,
  onToggle,
  unsendable,
  onUnsend,
  onReport,
  canReact,
  onReact,
}: {
  m: Msg;
  mine: boolean;
  myId: number;
  who: (id: number) => string;
  links: string | null;
  open: boolean;
  onToggle: () => void;
  unsendable: boolean;
  onUnsend: () => void;
  onReport: () => void;
  canReact: boolean;
  onReact: (emoji: string) => void;
}) {
  if (m.deleted) return <div className="dm-bubble gone">{t("messages.messageDeleted")}</div>;
  let action = null;
  if (!mine)
    action = (
      <Button kind="link small" type="button" onClick={onReport}>
        {t("messages.report")}
      </Button>
    );
  else if (unsendable)
    action = (
      <Button kind="link small" type="button" onClick={onUnsend}>
        {t("messages.unsend")}
      </Button>
    );
  const url = links ? BARE_URL.exec(m.body)?.[0] : undefined;
  return (
    <>
      <div
        role="button"
        tabIndex={0}
        className="dm-bubble"
        title={clock(m.at)}
        aria-expanded={open}
        onClick={(e) => {
          if (!(e.target instanceof Element && e.target.closest("a"))) onToggle();
        }}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
          e.preventDefault();
          onToggle();
        }}
      >
        {links ? <Linked text={m.body} /> : m.body}
      </div>
      {links && url && <LinkCard where={links} url={url} />}
      <Reactions m={m} myId={myId} who={who} canReact={canReact} onReact={onReact} />
      {open && canReact && (
        <div className="dm-picker" role="group" aria-label={t("messages.react")}>
          {DM_REACTIONS.map((e) => {
            const on = m.reactions.some((r) => r.emoji === e && r.users.includes(myId));
            return (
              <button type="button" key={e} aria-pressed={on} onClick={() => onReact(e)}>
                {e}
              </button>
            );
          })}
        </div>
      )}
      {open && (
        <div className="dm-meta muted small">
          {clock(m.at)}
          {action && (
            <>
              <span className="dm-dot" aria-hidden>
                ·
              </span>
              {action}
            </>
          )}
        </div>
      )}
    </>
  );
}

const DayDivider = ({ prev, at }: { prev: Msg | undefined; at: number }) =>
  !prev || !sameDay(prev.at, at) ? (
    <div className="dm-day">
      <span>{dayLabel(at)}</span>
    </div>
  ) : null;

function Older({ more, older, loadOlder }: { more: boolean; older: boolean; loadOlder: () => void }) {
  if (!more) return null;
  return (
    <div className="dm-older">
      <Button kind="link small" type="button" onClick={loadOlder}>
        {older ? t("messages.loading") : t("messages.showEarlier")}
      </Button>
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
  const thread = d?.thread;
  const { scroller, older, loadOlder, lastId } = useMessagePane(threadPath(id), d, typing);
  const counted = (r: { counts: DmCounts }) => setMe({ ...me!, dm: r.counts });

  useLive((e) => {
    if (e.t === "dm-typing" && e.threadId === id) {
      setTyping(true);
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTyping(false), 4000);
    }
    if (e.t === "dm" && e.thread.id === id && e.message.from !== me!.id) setTyping(false);
  });

  useEffect(() => () => clearTimeout(typingTimer.current), []);

  useMarkRead(thread?.unread ?? 0, lastId, () => {
    mutate<ThreadReply>(threadPath(id), (x) => ({ ...x, thread: { ...x.thread, unread: 0 } }));
    for (const path of [INBOX, REQUESTS]) {
      mutate<ListReply>(path, (x) => ({ ...x, items: x.items.map((i) => (i.id === id ? { ...i, unread: 0 } : i)) }));
    }
    api<DmDone>(`${threadPath(id)}/read`, { body: {} })
      .then(counted)
      .catch(() => {});
  });

  if (q.error) {
    return (
      <div className="dm-blank muted">
        <p>{q.error.message}</p>
        <Link to="/messages">{t("messages.backToMessages")}</Link>
      </div>
    );
  }
  if (!d || !thread) return null;
  const other = thread.user;

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
    mutate<ThreadReply>(threadPath(id), (x) => ({ ...x, thread: r.thread }));
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

  const unsend = (m: Msg) =>
    api<DmUnsent>(`/dm/message/${m.id}`, { method: "DELETE" })
      .then(() => applyDmEvent({ t: "dm-deleted", threadId: id, id: m.id }))
      .catch(() => {});

  const react = (m: Msg, emoji: string) =>
    api<DmReacted>(`/dm/message/${m.id}/react`, { body: { emoji } })
      .then((r) => applyDmEvent({ t: "dm-react", threadId: id, id: m.id, reactions: r.reactions }))
      .catch(() => {});

  const canReact = thread.status === "active" && d.can && !d.blocked;
  const who = (uid: number) => (uid === me!.id ? t("messages.you") : other.username);

  // A report is filed against one message; staff see the ones around it.
  const lastTheirs = d.messages.findLast((m) => m.from !== me!.id && !m.deleted);
  const lastMine = d.messages.findLast((m) => m.from === me!.id && !m.deleted);

  let footer;
  if (thread.incoming) {
    footer = (
      <div className="dm-request">
        <p>
          <b>{tx("messages.wantsToMessage", { name: <Username user={other} /> })}</b>{" "}
          <span className="muted">{t("messages.wontKnow")}</span>
        </p>
        <div className="dm-request-actions">
          <Button kind="btn" type="button" onClick={accept}>
            {t("messages.accept")}
          </Button>
          <Button kind="btn ghost" type="button" onClick={decline}>
            {t("messages.decline")}
          </Button>
          <Button kind="btn ghost" type="button" onClick={() => decline().then(block)}>
            {t("messages.block")}
          </Button>
        </div>
      </div>
    );
  } else if (d.blocked) {
    footer = <Blocked name={other.username} onUnblock={unblock} />;
  } else if (!d.can) {
    footer = <p className="dm-closed muted">{d.why}</p>;
  } else if (thread.left === 0) {
    footer = <p className="dm-closed muted">{tx("messages.requestSent", { name: <Username user={other} /> })}</p>;
  } else {
    const typingPing = thread.status === "active" ? { t: "typing" as const, thread: id } : undefined;
    footer = (
      <>
        {thread.left != null && (
          <p className="dm-closed muted small">
            {tx("messages.requestLeft", { name: <Username user={other} />, count: thread.left })}
          </p>
        )}
        <Composer
          onSend={send}
          max={d.max}
          typing={typingPing}
          placeholder={t("messages.messageTo", { name: other.username })}
        />
      </>
    );
  }

  return (
    <>
      <Head user={other} back={back}>
        <DropdownMenu placement="below" alignment="end" hasChevron={false} menuWidth={210} button={moreButton()}>
          <DropdownMenuItem label={t("messages.viewProfile")} href={userUrl(other.username)} />
          {lastTheirs && (
            <DropdownMenuItem
              label={t("messages.reportUser", { name: other.username })}
              onClick={() => setReporting(lastTheirs.id)}
            />
          )}
          <DropdownMenuItem label={t("messages.deleteConversation")} onClick={remove} />
          <DropdownMenuItem
            label={t(d.blocked ? "messages.unblockUser" : "messages.blockUser", { name: other.username })}
            onClick={d.blocked ? unblock : block}
          />
        </DropdownMenu>
      </Head>
      <div className="dm-scroll" ref={scroller}>
        <Older more={d.more} older={older} loadOlder={loadOlder} />
        {!d.more && (
          <p className="dm-start muted small">{tx("messages.startWith", { name: <Username user={other} /> })}</p>
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
                  myId={me!.id}
                  who={who}
                  links={thread.status === "active" ? `thread=${id}` : null}
                  open={picked === m.id}
                  onToggle={() => setPicked(picked === m.id ? 0 : m.id)}
                  unsendable={Date.now() / 1000 - m.at < d.unsendFor}
                  onUnsend={() => unsend(m)}
                  onReport={() => setReporting(m.id)}
                  canReact={canReact}
                  onReact={(e) => react(m, e)}
                />
                {lastMine?.id === m.id && thread.status === "active" && thread.seen >= m.id && (
                  <div className="dm-meta muted small">{t("messages.seen")}</div>
                )}
              </li>
            );
          })}
        </ol>
        {typing && (
          <p className="dm-typing muted small" role="status">
            {tx("messages.isTyping", { name: <Username user={other} /> })}
          </p>
        )}
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
      {t("messages.blockedLine", { name })}{" "}
      <Button kind="link" type="button" loading={busy} onClick={unblock}>
        {t("messages.unblock")}
      </Button>
    </p>
  );
}

function typingLine(names: string[]) {
  if (names.length === 1) return t("messages.isTyping", { name: names[0] });
  if (names.length === 2) return t("messages.twoTyping", { a: names[0], b: names[1] });
  return t("messages.severalTyping");
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
    setTyping((names) => names.filter((n) => n !== name));
  };

  useLive((e) => {
    if (e.t === "dm-group-typing" && e.groupId === id) {
      const name = e.name;
      clearTimeout(timers.current.get(name));
      timers.current.set(
        name,
        setTimeout(() => stopTyping(name), 4000)
      );
      setTyping((names) => (names.includes(name) ? names : [...names, name]));
    }
    if (e.t === "dm-group" && e.group.id === id) stopTyping(e.message.name);
    if (e.t === "dm-group-gone" && e.groupId === id) nav("/messages", { replace: true });
  });

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  useMarkRead(g?.unread ?? 0, lastId, () => {
    mutate<DmGroupPage>(path, (x) => ({ ...x, group: { ...x.group, unread: 0 } }));
    mutate<ListReply>(INBOX, (x) => ({ ...x, groups: x.groups.map((i) => (i.id === id ? { ...i, unread: 0 } : i)) }));
    api<DmDone>(`${path}/read`, { body: {} })
      .then((r) => setMe({ ...me!, dm: r.counts }))
      .catch(() => {});
  });

  if (q.error) {
    return (
      <div className="dm-blank muted">
        <p>{q.error.message}</p>
        <Link to="/messages">{t("messages.backToMessages")}</Link>
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

  const unsend = (m: Msg) =>
    api<DmUnsent>(`/dm/group/message/${m.id}`, { method: "DELETE" })
      .then(() => applyDmEvent({ t: "dm-group-deleted", groupId: id, id: m.id }))
      .catch(() => {});

  const react = (m: Msg, emoji: string) =>
    api<DmReacted>(`/dm/group/message/${m.id}/react`, { body: { emoji } })
      .then((r) => applyDmEvent({ t: "dm-group-react", groupId: id, id: m.id, reactions: r.reactions }))
      .catch(() => {});

  const who = (uid: number) => {
    if (uid === myId) return t("messages.you");
    return g.members.find((u) => u.id === uid)?.username ?? t("messages.someoneWhoLeft");
  };

  return (
    <>
      <header className="dm-head">
        <Link to="/messages" className="dm-back" aria-label={t("messages.backToConversations")}>
          <Ico.ChevLeft />
        </Link>
        <button type="button" className="dm-who dm-who-group" onClick={() => setInfo(!info)} aria-expanded={info}>
          <GroupAvatar g={g} myId={myId} size={36} />
          <span>
            <b>
              <Username name={name} />
            </b>
            <span className="muted small">{t("messages.people", { count: g.members.length })}</span>
          </span>
        </button>
        <DropdownMenu placement="below" alignment="end" hasChevron={false} menuWidth={210} button={moreButton()}>
          <DropdownMenuItem
            label={info ? t("messages.backToMessages") : t("messages.groupDetails")}
            onClick={() => setInfo(!info)}
          />
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
              {g.title ? t("messages.startOfGroup", { title: g.title }) : t("messages.startOfThisGroup")}
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
                  {!mine && !joined && (
                    <span className="dm-sender muted small">
                      {m.name} <UserLabels name={m.name} />
                    </span>
                  )}
                  <Bubble
                    m={m}
                    mine={mine}
                    myId={myId}
                    who={who}
                    links={`group=${id}`}
                    open={picked === m.id}
                    onToggle={() => setPicked(picked === m.id ? 0 : m.id)}
                    unsendable={Date.now() / 1000 - m.at < d.unsendFor}
                    onUnsend={() => unsend(m)}
                    onReport={() => setReporting(m.id)}
                    canReact={d.can}
                    onReact={(e) => react(m, e)}
                  />
                </li>
              );
            })}
          </ol>
          {typing.length > 0 && (
            <p className="dm-typing muted small" role="status">
              {typingLine(typing)}
            </p>
          )}
        </div>
      )}
      {!info &&
        (d.can ? (
          <Composer
            onSend={send}
            max={d.max}
            typing={{ t: "typing", group: id }}
            placeholder={t("messages.messageTo", { name })}
          />
        ) : (
          <p className="dm-closed muted">{d.why}</p>
        ))}
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
  const makeOwner = (u: DmUser) =>
    confirm.ask({
      title: t("messages.changeOwner"),
      body: t("messages.changeOwnerBody", { name: u.username }),
      action: t("messages.makeOwner"),
      run: async () => apply(await api<DmGroupSent>(`${path}/owner`, { body: { user: u.id } })),
    });
  const remove = (u: DmUser) =>
    act.run(async () => {
      apply(await api<DmGroupSent>(`${path}/members/${u.id}`, { method: "DELETE" }));
    });
  const leave = () =>
    confirm.ask({
      title: t("messages.leaveGroup"),
      body: owner && g.members.length > 1 ? t("messages.leaveBodyOwner") : t("messages.leaveBody"),
      action: t("messages.leave"),
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
        <h2>{t("messages.groupDetails")}</h2>
        <Button kind="link small" type="button" onClick={onDone}>
          {t("messages.done")}
        </Button>
      </div>
      {owner && (
        <form className="dm-info-title" onSubmit={rename}>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("messages.groupName")}
            aria-label={t("messages.groupName")}
          />
          <Button kind="btn small" disabled={title.trim() === g.title}>
            {t("messages.save")}
          </Button>
        </form>
      )}
      <h3>{t("messages.membersOf", { count: g.members.length, size: d.size })}</h3>
      <ul className="dm-members">
        {g.members.map((u) => (
          <li key={u.id}>
            <Avatar user={u} size={32} />
            <Link to={userUrl(u.username)} className="grow">
              <Username user={u} /> <UserLabels name={u.username} />
              {u.id === me!.id && <span className="muted"> {t("messages.youSuffix")}</span>}
            </Link>
            {u.id === g.owner && <span className="badge off">{t("messages.owner")}</span>}
            {owner && u.id !== me!.id && (
              <span className="dm-member-actions">
                <Button kind="link small" type="button" onClick={() => makeOwner(u)}>
                  {t("messages.makeOwner")}
                </Button>
                <Button kind="link small" type="button" onClick={() => remove(u)}>
                  {t("messages.remove")}
                </Button>
              </span>
            )}
          </li>
        ))}
      </ul>
      {owner && g.members.length < d.size && <AddPeople groupId={g.id} onAdd={apply} />}
      {act.note}
      <Button kind="btn ghost" type="button" onClick={leave}>
        {t("messages.leaveGroup")}
      </Button>
      {confirm.dialog}
    </div>
  );
}

function AddPeople({ groupId, onAdd }: { groupId: number; onAdd: (r: DmGroupSent) => void }) {
  const q = useApi<DmGroupCandidates>(`/dm/group/candidates?group=${groupId}`);
  const act = useAction();
  const add = (u: DmUser) =>
    act.run(async () => {
      onAdd(await api<DmGroupSent>(`${groupPath(groupId)}/members`, { body: { user: u.id } }));
      q.reload();
    });
  const users = q.data?.users ?? [];
  return (
    <>
      <h3>{t("messages.addPeople")}</h3>
      {q.data && !users.length && <p className="muted small">{t("messages.addPeopleNone")}</p>}
      <ul className="dm-members">
        {users.map((u) => (
          <li key={u.id}>
            <Avatar user={u} size={32} plain />
            <span className="grow">
              <Username user={u} /> <UserLabels name={u.username} />
            </span>
            <Button kind="link small" type="button" onClick={() => add(u)}>
              {t("messages.add")}
            </Button>
          </li>
        ))}
      </ul>
      {act.note}
    </>
  );
}

function PersonRow({ user, onPick }: { user: DmUser; onPick: (u: DmUser) => void }) {
  return (
    <li>
      <button type="button" className="dm-suggest" onClick={() => onPick(user)}>
        <Avatar user={user} size={32} plain />
        <span className="grow">
          <Username user={user} /> <UserLabels name={user.username} />
        </span>
      </button>
    </li>
  );
}

function FoundPeople({ term, skip, onPick }: { term: string; skip: Set<number>; onPick: (u: DmUser) => void }) {
  const q = useApi<SearchResults>(`/search${qs({ q: term, type: "users" })}`);
  const users = (q.data?.users ?? []).filter((u) => !skip.has(u.id));
  return users.map((u) => <PersonRow key={u.id} user={u} onPick={onPick} />);
}

function Compose() {
  const q = useApi<DmGroupCandidates>("/dm/group/candidates");
  const { me } = useAuth();
  const nav = useNavigate();
  const act = useAction();
  const [picked, setPicked] = useState<DmUser[]>([]);
  const [find, setFind] = useState("");
  const [term, setTerm] = useState("");
  const [naming, setNaming] = useState(false);
  const [title, setTitle] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setTerm(find.trim()), 250);
    return () => clearTimeout(timer);
  }, [find]);
  if (q.error) {
    return (
      <div className="dm-blank muted">
        <p>{q.error.message}</p>
        <Link to="/messages">{t("messages.backToMessages")}</Link>
      </div>
    );
  }
  const d = q.data;
  if (!d) return null;

  const contacts = new Set(d.users.map((u) => u.id));
  const stranger = picked.find((u) => !contacts.has(u.id));
  const full = picked.length >= d.size - 1;
  const skip = new Set([me!.id, ...picked.map((u) => u.id)]);
  const needle = term.toLowerCase();
  const local = d.users.filter(
    (u) =>
      !skip.has(u.id) &&
      (!needle || u.username.toLowerCase().includes(needle) || u.realname.toLowerCase().includes(needle))
  );
  const searchAll = !!term && !picked.length;

  const pick = (u: DmUser) => {
    setPicked((list) => [...list, u]);
    setFind("");
    setTerm("");
  };
  const drop = (id: number) => setPicked((list) => list.filter((u) => u.id !== id));
  const next = () => {
    if (picked.length === 1) nav(`/messages/to/${encodeURIComponent(picked[0].username)}`);
    else setNaming(true);
  };
  const create = (e: FormEvent) => {
    e.preventDefault();
    act.run(async () => {
      const r = await api<DmGroupSent>("/dm/group", { body: { title, users: picked.map((u) => u.id) } });
      placeGroup(r.group);
      nav(`/messages/g/${r.group.id}`, { replace: true });
    });
  };

  const tags = (removable: boolean) => (
    <ul className="dm-tags">
      {picked.map((u) => (
        <li key={u.id}>
          <Avatar user={u} size={20} plain />
          {u.username}
          {removable && (
            <button
              type="button"
              aria-label={t("messages.removeUser", { name: u.username })}
              onClick={() => drop(u.id)}
            >
              <Ico.X />
            </button>
          )}
        </li>
      ))}
    </ul>
  );

  if (naming) {
    return (
      <>
        <header className="dm-head">
          <button
            type="button"
            className="dm-back dm-back-step"
            aria-label={t("messages.backToPeople")}
            onClick={() => setNaming(false)}
          >
            <Ico.ChevLeft />
          </button>
          <span className="dm-who">
            <b>{t("messages.newGroup")}</b>
          </span>
        </header>
        <form className="dm-scroll dm-info" onSubmit={create}>
          {tags(false)}
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("messages.groupNameOptional")}
            aria-label={t("messages.groupName")}
          />
          <p className="muted small">{t("messages.ownerNote")}</p>
          {act.note}
          <Button kind="btn" loading={act.busy}>
            {t("messages.startGroup")}
          </Button>
        </form>
      </>
    );
  }

  let hint = "";
  if (stranger) hint = t("messages.strangerNoGroup", { name: stranger.username });
  else if (full) hint = t("messages.groupFull", { count: d.size });
  else if (picked.length === 1) hint = t("messages.addMoreForGroup");

  return (
    <>
      <header className="dm-head">
        <Link to="/messages" className="dm-back" aria-label={t("messages.backToConversations")}>
          <Ico.ChevLeft />
        </Link>
        <span className="dm-who">
          <b>{t("messages.newMessage")}</b>
        </span>
        <Button kind="btn ghost small" type="button" disabled={!picked.length} onClick={next}>
          {t("messages.next")}
        </Button>
      </header>
      <div className="dm-scroll dm-info">
        {!stranger && !full && (
          <Input
            type="search"
            autoFocus
            value={find}
            onChange={(e) => setFind(e.target.value)}
            placeholder={t("messages.searchPeople")}
            aria-label={t("messages.to")}
          />
        )}
        {picked.length > 0 && tags(true)}
        {hint && <p className="muted small">{hint}</p>}
        {!stranger && !full && (
          <ul className="dm-members">
            {local.map((u) => (
              <PersonRow key={u.id} user={u} onPick={pick} />
            ))}
            {searchAll && (
              <Suspense fallback={null}>
                <FoundPeople term={term} skip={new Set([...skip, ...local.map((u) => u.id)])} onPick={pick} />
              </Suspense>
            )}
          </ul>
        )}
        {needle && !searchAll && !local.length && (
          <p className="muted small">{t("messages.noMatch", { query: term })}</p>
        )}
      </div>
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
        <Link to="/messages">{t("messages.backToMessages")}</Link>
      </div>
    );
  }
  const d = q.data;
  if (!d) return null;
  if (d.threadId) return <Navigate to={`/messages/${d.threadId}`} replace />;
  const username = d.user.username;

  const send = async (body: string, turnstile?: string) => {
    const r = await api<DmSent>("/dm/send", { body: { to: username, body, turnstile } });
    mutate<DmWith>(path, (x) => ({ ...x, threadId: r.thread.id }));
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
    intro = d.request ? t("messages.requestIntro", { name: username }) : t("messages.sayHello", { name: username });
  }

  return (
    <>
      <Head user={d.user} back="/messages" />
      <div className="dm-scroll">{!d.blocked && <p className="dm-start muted small">{intro}</p>}</div>
      {d.blocked && <Blocked name={username} onUnblock={unblock} />}
      {d.can &&
        (d.human ? (
          <HumanComposer onSend={send} name={username} />
        ) : (
          <Composer onSend={send} max={2000} placeholder={t("messages.messageTo", { name: username })} />
        ))}
    </>
  );
}

// First messages to someone who doesn't follow you need the robot check.
function HumanComposer({
  onSend,
  name,
}: {
  onSend: (body: string, turnstile?: string) => Promise<void>;
  name: string;
}) {
  const robot = useTurnstile("dm");
  const send = async (body: string) => onSend(body, (await robot.check()) || undefined);
  return (
    <>
      {robot.view}
      <Composer onSend={send} max={2000} placeholder={t("messages.messageTo", { name })} />
    </>
  );
}
import { Username } from "../ui/username";
