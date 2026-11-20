// Types shared by the server and the browser for direct messages: the conversation lists, an open conversation,
// and the live events that keep both current over the socket.

/** Who may write to an account: anyone, anyone but strangers land in Requests, only people it follows, or no one. */
export type DmPolicy = "everyone" | "requests" | "following" | "nobody";
/** The other person in a conversation. `image` is an image id. */
export type DmUser = { id: number; username: string; realname: string; image: number | null };
/** One message. A message that was unsent or removed keeps its place but has an empty body. */
export type DmMessage = { id: number; from: number; body: string; at: number; deleted: boolean };
/** Unread conversations for the header badge: accepted ones, and requests waiting for an answer. */
export type DmCounts = { unread: number; requests: number };

/**
 * A conversation as one of its two people sees it.
 * `incoming` is true for a request waiting on the reader. `seen` is the last message id the other person has read
 * (always 0 until the conversation is accepted). `left` is how many more messages the reader may send while their
 * own request is waiting, otherwise null.
 */
export type DmThread = {
  id: number; user: DmUser; status: "request" | "active"; incoming: boolean; last: DmMessage | null; at: number;
  unread: number; seen: number; left: number | null;
};

/** GET /api/dm and /api/dm?box=requests */
export type DmList = { items: DmThread[]; counts: DmCounts; policy: DmPolicy };
/** GET /api/dm/with: the existing conversation with someone, if any, and whether a message would be allowed. */
export type DmWith = { user: DmUser; threadId: number | null; can: boolean; why: string; blocked: boolean; request: boolean };
/** GET /api/dm/thread/:id. `max` is the longest message allowed, `unsendFor` the seconds a message can be taken back. */
export type DmThreadPage = { thread: DmThread; messages: DmMessage[]; more: boolean; can: boolean; why: string; blocked: boolean; max: number; unsendFor: number };
/** POST /api/dm/send */
export type DmSent = { message: DmMessage; thread: DmThread };
/** POST /api/dm/thread/:id/read, POST .../decline and DELETE /api/dm/thread/:id */
export type DmDone = { ok: true; counts: DmCounts };
/** POST /api/dm/thread/:id/accept */
export type DmAccepted = { thread: DmThread; counts: DmCounts };
/** DELETE /api/dm/message/:id */
export type DmUnsent = { ok: true };

/** What the server pushes to open tabs. `accepted` is only present on the sender's copy of a new message. */
export type DmEvent =
  | { t: "dm"; thread: DmThread; message: DmMessage; counts: DmCounts; accepted?: boolean }
  | { t: "dm-thread"; thread: DmThread }
  | { t: "dm-deleted"; threadId: number; id: number; counts: DmCounts }
  | { t: "dm-read"; threadId: number; seen: number }
  | { t: "dm-counts"; counts: DmCounts }
  | { t: "dm-typing"; threadId: number };
/** The one thing a tab may send over the socket. */
export type DmClientMessage = { t: "typing"; thread: number };

/** A reported message as staff see it: the text with the conversation around it, and where it came from. */
export type ReportedMessage = { authorId: number; author: string; participants: number[]; threadId: number; text: string; where: string; link: string };
