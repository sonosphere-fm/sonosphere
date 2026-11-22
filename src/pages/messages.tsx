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
import { cn } from "../ui/tw";

/** A row in the conversation list; the open one is marked `active`, unread ones `unread`. */
// as in the old stylesheet, a row that is its list item's only link takes the base link colour
const dmThread = "dm-thread flex gap-3 items-center px-[18px] py-2.5 text-ink [li>&:only-child]:text-link [li>&:only-child]:hover:text-ink hover:bg-fill hover:text-ink hover:no-underline";
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
      <div className="m-auto text-center p-6 [&_.ico]:size-11 [&_.ico]:text-edge [&_p]:my-2 text-muted">
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
    <div className="dm-page w-full max-w-[1180px] mx-auto px-5 pt-5 pb-5 max-[801px]:p-0 [&_h2]:tracking-[-.015em] [&_h2]:font-bold">
      <div className={cn(
        "dm grid grid-cols-[340px_minmax(0,1fr)] h-[calc(100dvh-150px)] min-h-[440px] bg-card max-[801px]:grid-cols-[minmax(0,1fr)] max-[801px]:h-[calc(100dvh-56px)]",
        // phones show one pane: the open conversation, or the list
        open ? "dm-open max-[801px]:[&>aside]:hidden" : "max-[801px]:[&>section]:hidden",
      )}>
        <aside className="flex flex-col min-h-0 bg-panel" aria-label="Conversations">
          <div className="flex items-center justify-between gap-2 pr-3.5">
            <h1 className="text-2xl m-0 pl-[18px] pr-0 pt-[18px] pb-1.5">Messages</h1>
            <Button kind="btn ghost small" className="mt-3" href="/messages/new-group"><Ico.Plus /> New group</Button>
          </div>
          <nav className="tabs flex flex-wrap gap-0.5 *:h-auto *:rounded-none *:m-0 *:border-0 *:bg-transparent *:px-2.5 *:py-1.5 *:text-base *:font-medium *:text-ink-2 *:hover:bg-tint *:hover:text-ink *:hover:no-underline *:current:bg-sun *:current:text-on-sun *:current:font-bold max-md:flex-nowrap max-md:overflow-x-auto max-md:[scrollbar-width:none] max-md:gap-x-[22px] max-md:gap-y-0 max-md:[&::-webkit-scrollbar]:hidden max-md:*:flex-none max-md:*:whitespace-nowrap m-0 px-[18px] [&_.dot]:ml-2 [&_.dot]:inline-block">
            <Link to="/messages" className={requests ? "" : "active"}>
              Inbox{counts.unread > 0 && <b className="dot inline-block text-xs min-w-5 h-5 leading-5 text-center rounded-[10px] px-[5px] bg-accent text-on-accent">{counts.unread}</b>}
            </Link>
            <Link to="/messages/requests" className={requests ? "active" : ""}>
              Requests{counts.requests > 0 && <b className="dot inline-block text-xs min-w-5 h-5 leading-5 text-center rounded-[10px] px-[5px] bg-accent text-on-accent">{counts.requests}</b>}
            </Link>
          </nav>
          {requests && (
            <p className="text-muted text-[13px] m-0 px-[18px] pt-3 pb-1">Messages from users you don't follow appear here. Read receipts will not be sent until you accept.</p>
          )}
          {list.error ? (
            <p className="form-error font-semibold m-0 text-bad">{list.error.message}</p>
          ) : (
            <ul className="[scrollbar-width:thin] [scrollbar-color:var(--scroll-thin)_transparent] list-none m-0 py-2 overflow-y-auto flex-1 min-h-0">
              {rows.map(r => (r.kind === "thread" ? (
                <ThreadRow key={`t${r.t.id}`} t={r.t} requests={requests} current={view === "thread" && currentId === r.t.id} myId={me!.id} />
              ) : (
                <GroupRow key={`g${r.g.id}`} g={r.g} current={view === "group" && currentId === r.g.id} myId={me!.id} />
              )))}
              {list.data && !rows.length && (
                <li className="p-[18px] text-muted">
                  {requests ? "No message requests." : "No conversations yet. You can start one from someone's profile."}
                </li>
              )}
            </ul>
          )}
        </aside>
        <section className="flex flex-col min-w-0 min-h-0">
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
        className={cn(dmThread, current && "active bg-card", t.unread > 0 && "unread")}
      >
        <Avatar user={t.user} size={44} plain />
        <span className="item-text flex-1 min-w-0">
          <span className="flex justify-between gap-2 items-baseline [&_b]:truncate [&_b]:font-semibold"><b>{t.user.username} <UserLabels name={t.user.username} /></b><span className="text-muted text-[13px] whitespace-nowrap">{ago(t.at)}</span></span>
          <span className="block text-muted text-sm truncate [.unread_&]:text-ink [.unread_&]:font-semibold">{preview}</span>
        </span>
        {t.unread > 0 && <b className="dot inline-block text-xs min-w-5 h-5 leading-5 text-center rounded-[10px] px-[5px] bg-accent text-on-accent" aria-label={`${t.unread} unread`}>{t.unread}</b>}
      </Link>
    </li>
  );
}

function GroupAvatar({ g, myId, size }: { g: DmGroup; myId: number; size: number }) {
  const [a, b] = g.members.filter(m => m.id !== myId);
  if (!b) return <Avatar user={a ?? g.members[0]} size={size} plain />;
  return (
    <span className="relative inline-block flex-none [&>:first-child]:absolute [&>:first-child]:top-0 [&>:first-child]:left-0 [&>:last-child]:absolute [&>:last-child]:right-0 [&>:last-child]:bottom-0 [&>:last-child]:shadow-[0_0_0_2px_var(--panel)] [&>:last-child]:rounded-full" style={{ width: size, height: size }} aria-hidden>
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
      <Link to={`/messages/g/${g.id}`} className={cn(dmThread, current && "active bg-card", g.unread > 0 && "unread")}>
        <GroupAvatar g={g} myId={myId} size={44} />
        <span className="item-text flex-1 min-w-0">
          <span className="flex justify-between gap-2 items-baseline [&_b]:truncate [&_b]:font-semibold"><b>{groupName(g, myId)}</b><span className="text-muted text-[13px] whitespace-nowrap">{ago(g.at)}</span></span>
          <span className="block text-muted text-sm truncate [.unread_&]:text-ink [.unread_&]:font-semibold">{preview}</span>
        </span>
        {g.unread > 0 && <b className="dot inline-block text-xs min-w-5 h-5 leading-5 text-center rounded-[10px] px-[5px] bg-accent text-on-accent" aria-label={`${g.unread} unread`}>{g.unread}</b>}
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
    <form className="dm-composer px-[18px] pt-2.5 pb-3.5 bg-card shadow-[0_-1px_0_var(--line)] [&_.form-error]:m-0 [&_.form-error]:mb-2 [&_textarea]:flex-1 [&_textarea]:min-w-0 [&_textarea]:resize-none [&_textarea]:[font-family:inherit] [&_textarea]:[font-style:inherit] [&_textarea]:[font-size:inherit] [&_textarea]:[font-weight:inherit] [&_textarea]:py-[9px] [&_textarea]:px-3 [&_textarea]:rounded [&_textarea]:text-ink [&_textarea]:leading-[1.4] [&_textarea]:max-h-40 [&_textarea]:min-h-11 [&_textarea]:focus:outline-none [&>div>button]:h-11 [&>div>button]:min-h-11 [&>div>button]:m-0 [&>div>button]:flex-none" onSubmit={submit}>
      {error && <p className="form-error font-semibold m-0 text-bad" role="alert">{error}</p>}
      {above}
      <div className="flex gap-2 items-end">
        <textarea
          ref={box}
          className="[font:inherit] text-inherit max-w-full rounded-none border border-edge bg-card px-2.5 py-2 shadow-[inset_0_1px_3px_var(--inset)] placeholder:text-muted placeholder:opacity-100 focus:outline-0 focus:border-accent focus:shadow-[inset_0_1px_3px_var(--inset),0_0_0_3px_color-mix(in_srgb,var(--accent)_22%,transparent)]"
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
      {text.length > max - 200 && <span className="text-muted text-[13px]">{max - text.length} characters left</span>}
    </form>
  );
}

function Head({ user, back, children }: { user: Thread["user"]; back: string; children?: ReactNode }) {
  return (
    <header className="flex items-center gap-2.5 px-[18px] py-3 bg-card shadow-[0_1px_0_var(--line)] relative z-1">
      <Link to={back} className="hidden text-ink p-1.5 -ml-2 max-[801px]:inline-flex" aria-label="Back to conversations"><Ico.ChevLeft /></Link>
      <Link to={userUrl(user.username)} className="flex items-center gap-2.5 text-ink flex-1 min-w-0 hover:text-link hover:no-underline [&>span:last-child]:flex [&>span:last-child]:flex-col [&>span:last-child]:leading-[1.2] [&>span:last-child]:min-w-0">
        <Avatar user={user} size={36} plain />
        <span><b>{user.username} <UserLabels name={user.username} /></b>{user.realname && <span className="text-muted text-[13px]">{user.realname}</span>}</span>
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
  if (m.deleted) return <div className="max-w-[min(78%,560px)] px-[13px] py-2 border-0 rounded-2xl bg-fill text-ink [font:inherit] text-left whitespace-pre-wrap wrap-anywhere cursor-pointer [.mine_&]:bg-accent [.mine_&]:text-on-accent gone:bg-transparent! gone:text-muted! gone:italic gone:shadow-[inset_0_0_0_1px_var(--line)] gone:cursor-default focus:outline-none hover:bg-[color-mix(in_srgb,var(--fill)_88%,var(--ink))] [.mine_&:hover]:bg-[color-mix(in_srgb,var(--accent)_82%,#000)]">Message deleted</div>;
  let action = null;
  if (!mine) action = <Button kind="small" className="bg-transparent border-0 p-0 text-link font-semibold hover:underline" type="button" onClick={onReport}>Report</Button>;
  else if (unsendable) action = <Button kind="small" className="bg-transparent border-0 p-0 text-link font-semibold hover:underline" type="button" onClick={onUnsend}>Unsend</Button>;
  return (
    <>
      <button type="button" className="max-w-[min(78%,560px)] px-[13px] py-2 border-0 rounded-2xl bg-fill text-ink [font:inherit] text-left whitespace-pre-wrap wrap-anywhere cursor-pointer [.mine_&]:bg-accent [.mine_&]:text-on-accent gone:bg-transparent! gone:text-muted! gone:italic gone:shadow-[inset_0_0_0_1px_var(--line)] gone:cursor-default focus:outline-none hover:bg-[color-mix(in_srgb,var(--fill)_88%,var(--ink))] [.mine_&:hover]:bg-[color-mix(in_srgb,var(--accent)_82%,#000)]" title={clock(m.at)} aria-expanded={open} onClick={onToggle}>
        {m.body}
      </button>
      {open && (
        <div className="flex gap-1.5 items-center px-1.5 py-0.5 leading-[1.3] [&_button]:text-[13px] [&_button]:font-medium [&_button]:p-0 [&_button]:min-h-0 [&_button]:h-auto [&_button]:leading-[1.3] text-muted text-[13px]">
          {clock(m.at)}
          {action && (
            <>
              <span className="opacity-60" aria-hidden>·</span>
              {action}
            </>
          )}
        </div>
      )}
    </>
  );
}

const DayDivider = ({ prev, at }: { prev: Msg | undefined; at: number }) =>
  !prev || !sameDay(prev.at, at) ? <div className="self-stretch text-center my-2.5 mb-3 [&>span]:text-[13px] [&>span]:text-muted [&>span]:bg-panel [&>span]:py-0.5 [&>span]:px-2.5 [&>span]:rounded-[10px]"><span>{dayLabel(at)}</span></div> : null;

function Older({ more, older, loadOlder }: { more: boolean; older: boolean; loadOlder: () => void }) {
  if (!more) return null;
  return (
    <div className="text-center mb-3">
      <Button kind="small" className="bg-transparent border-0 p-0 text-link font-semibold hover:underline" type="button" onClick={loadOlder}>{older ? "Loading…" : "Show earlier messages"}</Button>
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
      <div className="m-auto text-center p-6 [&_.ico]:size-11 [&_.ico]:text-edge [&_p]:my-2 text-muted">
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
      <div className="px-[18px] pt-3.5 pb-4 bg-accent-tint [&_p]:m-0 [&_p]:mb-2.5">
        <p>
          <b>{other.username} wants to message you.</b>{" "}
          <span className="text-muted">They won't know you've seen this unless you accept. Declining is silent.</span>
        </p>
        <div className="flex gap-2 flex-wrap">
          <Button kind="btn" type="button" onClick={accept}>Accept</Button>
          <Button kind="btn ghost" type="button" onClick={decline}>Decline</Button>
          <Button kind="btn ghost" type="button" onClick={() => decline().then(block)}>Block</Button>
        </div>
      </div>
    );
  } else if (d.blocked) {
    footer = <Blocked name={other.username} onUnblock={unblock} />;
  } else if (!d.can) {
    footer = <p className="m-0 px-[18px] py-3 text-center shadow-[0_-1px_0_var(--line)] [&+.dm-composer]:shadow-none [&+.dm-composer]:pt-0 text-muted">{d.why}</p>;
  } else if (t.left === 0) {
    footer = <p className="m-0 px-[18px] py-3 text-center shadow-[0_-1px_0_var(--line)] [&+.dm-composer]:shadow-none [&+.dm-composer]:pt-0 text-muted">Your message request has been sent. You can write again once {other.username} replies.</p>;
  } else {
    const typingPing = t.status === "active" ? { t: "typing" as const, thread: id } : undefined;
    footer = (
      <>
        {t.left != null && (
          <p className="m-0 px-[18px] py-3 text-center shadow-[0_-1px_0_var(--line)] [&+.dm-composer]:shadow-none [&+.dm-composer]:pt-0 text-muted text-[13px]">
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
      <div className="dm-scroll flex-1 min-h-0 overflow-y-auto px-[18px] py-4 overscroll-contain [scrollbar-width:thin] [scrollbar-color:var(--scroll-thin)_transparent]" ref={scroller}>
        <Older more={d.more} older={older} loadOlder={loadOlder} />
        {!d.more && (
          <p className="text-center max-w-[440px] mx-auto mt-2 mb-5 text-muted text-[13px]">
            This is the start of your conversation with {other.username}. Messages are private between the two of you, but staff may
            review them when investigating a report or abuse.
          </p>
        )}
        <ol className="list-none m-0 p-0 flex flex-col [&>li]:flex [&>li]:flex-col [&>li]:items-start [&>li]:mt-2.5 [&>li.joined]:mt-[3px] [&>li.mine]:items-end [&>li.dm-event]:items-center [&>li.dm-event]:text-center [&>li.dm-event]:my-3 [&>li.dm-event]:mt-3 [&>li.dm-event]:mb-0.5">
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
                {lastMine?.id === m.id && t.status === "active" && t.seen >= m.id && <div className="flex gap-1.5 items-center px-1.5 py-0.5 leading-[1.3] [&_button]:text-[13px] [&_button]:font-medium [&_button]:p-0 [&_button]:min-h-0 [&_button]:h-auto [&_button]:leading-[1.3] text-muted text-[13px]">Seen</div>}
              </li>
            );
          })}
        </ol>
        {typing && <p className="mt-2.5 mx-1 text-muted text-[13px]" role="status">{other.username} is typing…</p>}
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
    <p className="m-0 px-[18px] py-3 text-center shadow-[0_-1px_0_var(--line)] [&+.dm-composer]:shadow-none [&+.dm-composer]:pt-0 text-muted">
      You blocked {name}, so you can't message each other. <Button className="bg-transparent border-0 p-0 text-link font-semibold hover:underline" type="button" loading={busy} onClick={unblock}>Unblock</Button>
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
      <div className="m-auto text-center p-6 [&_.ico]:size-11 [&_.ico]:text-edge [&_p]:my-2 text-muted">
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
      <header className="flex items-center gap-2.5 px-[18px] py-3 bg-card shadow-[0_1px_0_var(--line)] relative z-1">
        <Link to="/messages" className="hidden text-ink p-1.5 -ml-2 max-[801px]:inline-flex" aria-label="Back to conversations"><Ico.ChevLeft /></Link>
        <button type="button" className="flex items-center gap-2.5 text-ink flex-1 min-w-0 hover:text-link hover:no-underline [&>span:last-child]:flex [&>span:last-child]:flex-col [&>span:last-child]:leading-[1.2] [&>span:last-child]:min-w-0 border-0 bg-transparent p-0 [font:inherit] text-left cursor-pointer" onClick={() => setInfo(!info)} aria-expanded={info}>
          <GroupAvatar g={g} myId={myId} size={36} />
          <span><b>{name}</b><span className="text-muted text-[13px]">{g.members.length} people</span></span>
        </button>
        <DropdownMenu placement="below" alignment="end" hasChevron={false} menuWidth={210} button={MoreButton}>
          <DropdownMenuItem label={info ? "Back to messages" : "Group details"} onClick={() => setInfo(!info)} />
        </DropdownMenu>
      </header>
      {info ? (
        <div className="dm-scroll flex-1 min-h-0 overflow-y-auto px-[18px] py-4 overscroll-contain [scrollbar-width:thin] [scrollbar-color:var(--scroll-thin)_transparent]" key="info">
          <GroupInfo d={d} onDone={() => setInfo(false)} />
        </div>
      ) : (
        <div className="dm-scroll flex-1 min-h-0 overflow-y-auto px-[18px] py-4 overscroll-contain [scrollbar-width:thin] [scrollbar-color:var(--scroll-thin)_transparent]" ref={scroller}>
          <Older more={d.more} older={older} loadOlder={loadOlder} />
          {!d.more && (
            <p className="text-center max-w-[440px] mx-auto mt-2 mb-5 text-muted text-[13px]">
              This is the start of {g.title ? `"${g.title}"` : "this group"}. Messages are seen by everyone in the group, but staff
              may review them when investigating a report or abuse.
            </p>
          )}
          <ol className="list-none m-0 p-0 flex flex-col [&>li]:flex [&>li]:flex-col [&>li]:items-start [&>li]:mt-2.5 [&>li.joined]:mt-[3px] [&>li.mine]:items-end [&>li.dm-event]:items-center [&>li.dm-event]:text-center [&>li.dm-event]:my-3 [&>li.dm-event]:mt-3 [&>li.dm-event]:mb-0.5">
            {d.messages.map((m, i) => {
              const prev = d.messages[i - 1];
              if (m.event) {
                return (
                  <li key={m.id} className="dm-event">
                    <DayDivider prev={prev} at={m.at} />
                    <span className="text-muted text-[13px]">{m.body}</span>
                  </li>
                );
              }
              const mine = m.from === myId;
              const joined = prev && !prev.event && prev.from === m.from && m.at - prev.at < 300;
              return (
                <li key={m.id} className={`${mine ? "mine" : "theirs"}${joined ? " joined" : ""}`}>
                  <DayDivider prev={prev} at={m.at} />
                  {!mine && !joined && <span className="px-1.5 pb-[3px] text-muted text-[13px]">{m.name} <UserLabels name={m.name} /></span>}
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
          {typing.length > 0 && <p className="mt-2.5 mx-1 text-muted text-[13px]" role="status">{typingLine(typing)}</p>}
        </div>
      )}
      {!info && (d.can
        ? <Composer onSend={send} max={d.max} typing={{ t: "typing", group: id }} placeholder={`Message ${name}`} />
        : <p className="m-0 px-[18px] py-3 text-center shadow-[0_-1px_0_var(--line)] [&+.dm-composer]:shadow-none [&+.dm-composer]:pt-0 text-muted">{d.why}</p>)}
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
    <div className="flex flex-col gap-3 max-w-[520px] mx-auto w-full [&_p]:m-0 [&_h3]:mt-2 [&_h3]:mb-0 [&_h3]:text-[15px] [&>button]:self-start">
      <div className="flex items-center justify-between [&_h2]:m-0 [&_h2]:text-xl">
        <h2>Group details</h2>
        <Button kind="small" className="bg-transparent border-0 p-0 text-link font-semibold hover:underline" type="button" onClick={onDone}>Done</Button>
      </div>
      {owner && (
        <form className="flex gap-2 items-center [&>:first-child]:flex-1 [&>:first-child]:min-w-0" onSubmit={rename}>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Group name" aria-label="Group name" />
          <Button kind="btn small" disabled={title.trim() === g.title}>Save</Button>
        </form>
      )}
      <h3>{g.members.length} of {d.size} people</h3>
      <ul className="list-none m-0 p-0 flex flex-col [&_li]:flex [&_li]:items-center [&_li]:gap-2.5 [&_li]:py-2 [&_li]:shadow-[0_1px_0_var(--line)] [&_li:last-child]:shadow-none [&_.item-text]:flex-1 [&_.item-text]:min-w-0 [&_.item-text]:truncate">
        {g.members.map(u => (
          <li key={u.id}>
            <Avatar user={u} size={32} />
            <Link to={userUrl(u.username)} className="item-text flex-1 min-w-0">{u.username} <UserLabels name={u.username} />{u.id === me!.id && <span className="text-muted"> (you)</span>}</Link>
            {u.id === g.owner && <span className="inline-block text-[11px] uppercase tracking-[.05em] px-1.5 py-px font-medium bg-fill text-muted">Owner</span>}
            {owner && u.id !== me!.id && (
              <span className="flex gap-3">
                <Button kind="small" className="bg-transparent border-0 p-0 text-link font-semibold hover:underline" type="button" onClick={() => makeOwner(u)}>Make owner</Button>
                <Button kind="small" className="bg-transparent border-0 p-0 text-link font-semibold hover:underline" type="button" onClick={() => remove(u)}>Remove</Button>
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
        <p className="text-muted text-[13px]">You can add people you already have a conversation with. There's no one else to add right now.</p>
      )}
      <ul className="list-none m-0 p-0 flex flex-col [&_li]:flex [&_li]:items-center [&_li]:gap-2.5 [&_li]:py-2 [&_li]:shadow-[0_1px_0_var(--line)] [&_li:last-child]:shadow-none [&_.item-text]:flex-1 [&_.item-text]:min-w-0 [&_.item-text]:truncate">
        {users.map(u => (
          <li key={u.id}>
            <Avatar user={u} size={32} plain />
            <span className="item-text flex-1 min-w-0">{u.username} <UserLabels name={u.username} /></span>
            <Button kind="small" className="bg-transparent border-0 p-0 text-link font-semibold hover:underline" type="button" onClick={() => add(u)}>Add</Button>
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
      <div className="m-auto text-center p-6 [&_.ico]:size-11 [&_.ico]:text-edge [&_p]:my-2 text-muted">
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
      <header className="flex items-center gap-2.5 px-[18px] py-3 bg-card shadow-[0_1px_0_var(--line)] relative z-1">
        <Link to="/messages" className="hidden text-ink p-1.5 -ml-2 max-[801px]:inline-flex" aria-label="Back to conversations"><Ico.ChevLeft /></Link>
        <span className="flex items-center gap-2.5 text-ink flex-1 min-w-0 hover:text-link hover:no-underline [&>span:last-child]:flex [&>span:last-child]:flex-col [&>span:last-child]:leading-[1.2] [&>span:last-child]:min-w-0"><b>New group</b></span>
      </header>
      <form className="dm-scroll flex-1 min-h-0 overflow-y-auto px-[18px] py-4 overscroll-contain [scrollbar-width:thin] [scrollbar-color:var(--scroll-thin)_transparent] flex flex-col gap-3 max-w-[520px] mx-auto w-full [&_p]:m-0 [&_h3]:mt-2 [&_h3]:mb-0 [&_h3]:text-[15px] [&>button]:self-start" onSubmit={create}>
        <p className="text-muted text-[13px]">
          You can add people you already have a conversation with, up to {d.size} people including you. You'll be the group's owner.
        </p>
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Group name (optional)" aria-label="Group name" />
        <h3>People</h3>
        {!d.users.length && <p className="text-muted text-[13px]">There's no one you can add yet. Start a conversation with someone first.</p>}
        <ul className="list-none m-0 p-0 flex flex-col [&_li]:flex [&_li]:items-center [&_li]:gap-2.5 [&_li]:py-2 [&_li]:shadow-[0_1px_0_var(--line)] [&_li:last-child]:shadow-none [&_.item-text]:flex-1 [&_.item-text]:min-w-0 [&_.item-text]:truncate">
          {d.users.map(u => {
            const on = picked.includes(u.id);
            return (
              <li key={u.id}>
                <label className="check flex! flex-row! items-start gap-2.5 font-normal! text-[15px] [&_input]:w-4! [&_input]:mt-[3px] [&_input]:flex-none [&_input[type=checkbox]]:h-4! [&_input[type=checkbox]]:min-h-0! [&_input[type=checkbox]]:p-0! dm-pick">
                  <Input
                    type="checkbox"
                    aria-label={`Add ${u.username}`}
                    checked={on}
                    disabled={!on && room <= 0}
                    onChange={e => toggle(u.id, e.target.checked)}
                  />
                  <Avatar user={u} size={32} plain />
                  <span className="item-text flex-1 min-w-0">{u.username} <UserLabels name={u.username} /></span>
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
      <div className="m-auto text-center p-6 [&_.ico]:size-11 [&_.ico]:text-edge [&_p]:my-2 text-muted">
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
      <div className="dm-scroll flex-1 min-h-0 overflow-y-auto px-[18px] py-4 overscroll-contain [scrollbar-width:thin] [scrollbar-color:var(--scroll-thin)_transparent]">{!d.blocked && <p className="text-center max-w-[440px] mx-auto mt-2 mb-5 text-muted text-[13px]">{intro}</p>}</div>
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
  const above = robot.view && <div className="mb-2">{robot.view}</div>;
  return <Composer onSend={send} max={2000} placeholder={`Message ${name}`} above={above} />;
}
