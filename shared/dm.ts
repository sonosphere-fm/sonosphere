export type DmPolicy = "everyone" | "requests" | "following" | "nobody";
export type DmUser = { id: number; username: string; realname: string; image: string | null };
export type DmMessage = { id: number; from: number; body: string; at: number; deleted: boolean };
export type DmCounts = { unread: number; requests: number };

// `seen`: last message id the other person read (0 until accepted).
// `left`: messages the reader may still send while their own request is pending, else null.
export type DmThread = {
  id: number; user: DmUser; status: "request" | "active"; incoming: boolean; last: DmMessage | null; at: number;
  unread: number; seen: number; left: number | null;
};

export type DmList = { items: DmThread[]; counts: DmCounts; policy: DmPolicy };
export type DmWith = { user: DmUser; threadId: number | null; can: boolean; why: string; blocked: boolean; request: boolean; human: boolean };
export type DmThreadPage = { thread: DmThread; messages: DmMessage[]; more: boolean; can: boolean; why: string; blocked: boolean; max: number; unsendFor: number };
export type DmSent = { message: DmMessage; thread: DmThread };
export type DmDone = { ok: true; counts: DmCounts };
export type DmAccepted = { thread: DmThread; counts: DmCounts };
export type DmUnsent = { ok: true };

export type DmEvent =
  | { t: "dm"; thread: DmThread; message: DmMessage; counts: DmCounts; accepted?: boolean }
  | { t: "dm-thread"; thread: DmThread }
  | { t: "dm-deleted"; threadId: number; id: number; counts: DmCounts }
  | { t: "dm-read"; threadId: number; seen: number }
  | { t: "dm-counts"; counts: DmCounts }
  | { t: "dm-typing"; threadId: number };
export type DmClientMessage = { t: "typing"; thread: number };

export type ReportedMessage = { authorId: number; author: string; participants: number[]; threadId: number; text: string; where: string; link: string };
