import { mutate, type LiveEvent } from "./lib";
import type { DmList, DmMessage, DmThread, DmThreadPage } from "../shared/dm";

export type Msg = DmMessage;
export type Thread = DmThread;
export type ThreadReply = DmThreadPage;
export type ListReply = DmList;
export const INBOX = "/dm";
export const REQUESTS = "/dm?box=requests";
export const threadPath = (id: number | string) => `/dm/thread/${id}`;

/** A change made on this tab (after a send or an unsend), applied the same way as the matching server event. */
type LocalChange = { t: "dm"; thread: Thread; message: Msg } | { t: "dm-deleted"; threadId: number; id: number };

/** Put a conversation at the top of the list it belongs in, and take it out of the other. */
export function place(t: Thread | null, id = t?.id) {
  for (const path of [INBOX, REQUESTS]) {
    mutate<ListReply>(path, d => {
      const rest = d.items.filter(x => x.id !== id);
      const belongsHere = t && path === (t.incoming ? REQUESTS : INBOX);
      return { ...d, items: belongsHere ? [t, ...rest] : rest };
    });
  }
}

const updateLists = (fn: (t: Thread) => Thread) => {
  for (const path of [INBOX, REQUESTS]) {
    mutate<ListReply>(path, d => ({ ...d, items: d.items.map(fn) }));
  }
};

export function applyDmEvent(e: LiveEvent | LocalChange) {
  if (e.t === "dm") {
    const { thread, message } = e;
    place(thread);
    mutate<ThreadReply>(threadPath(thread.id), d => {
      const known = d.messages.some(m => m.id === message.id);
      return { ...d, thread, messages: known ? d.messages : [...d.messages, message] };
    });
  } else if (e.t === "dm-thread") {
    const { thread } = e;
    place(thread);
    mutate<ThreadReply>(threadPath(thread.id), d => ({ ...d, thread }));
  } else if (e.t === "dm-deleted") {
    const { id } = e;
    const gone = <M extends Msg | null>(m: M): M => (m && m.id === id ? { ...m, body: "", deleted: true } : m);
    updateLists(t => ({ ...t, last: gone(t.last) }));
    mutate<ThreadReply>(threadPath(e.threadId), d => ({ ...d, messages: d.messages.map(gone) }));
  } else if (e.t === "dm-read") {
    const { threadId, seen } = e;
    mutate<ThreadReply>(threadPath(threadId), d => ({ ...d, thread: { ...d.thread, seen: Math.max(d.thread.seen, seen) } }));
    updateLists(t => (t.id === threadId ? { ...t, seen: Math.max(t.seen, seen) } : t));
  }
}
