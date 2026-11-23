import type { UserAppearance } from "./username-fonts";

export type DmPolicy = "everyone" | "requests" | "following" | "nobody";
export type DmUser = UserAppearance & { id: number; username: string; realname: string; image: string | null };
export const DM_REACTIONS = ["❤️", "😂", "😮", "😢", "👍", "🔥"] as const;
export type DmReaction = { emoji: string; users: number[] };
export type DmMessage = {
  id: number;
  from: number;
  body: string;
  at: number;
  deleted: boolean;
  reactions: DmReaction[];
};
export type DmCounts = { unread: number; requests: number };

// `seen`: last message id the other person read (0 until accepted).
// `left`: messages the reader may still send while their own request is pending, else null.
export type DmThread = {
  id: number;
  user: DmUser;
  status: "request" | "active";
  incoming: boolean;
  last: DmMessage | null;
  at: number;
  unread: number;
  seen: number;
  left: number | null;
};

// `event` is set on lines about membership or the title rather than messages.
export type DmGroupMessage = DmMessage & { name: string; event: string | null };
export type DmGroup = {
  id: number;
  title: string;
  owner: number;
  members: DmUser[];
  last: DmGroupMessage | null;
  at: number;
  unread: number;
};

export type DmList = { items: DmThread[]; groups: DmGroup[]; counts: DmCounts; policy: DmPolicy };
export type DmWith = {
  user: DmUser;
  threadId: number | null;
  can: boolean;
  why: string;
  blocked: boolean;
  request: boolean;
  human: boolean;
};
export type DmThreadPage = {
  thread: DmThread;
  messages: DmMessage[];
  more: boolean;
  can: boolean;
  why: string;
  blocked: boolean;
  max: number;
  unsendFor: number;
};
export type DmSent = { message: DmMessage; thread: DmThread };
export type DmDone = { ok: true; counts: DmCounts };
export type DmAccepted = { thread: DmThread; counts: DmCounts };
export type DmUnsent = { ok: true };
export type DmReacted = { reactions: DmReaction[] };
export type DmGroupPage = {
  group: DmGroup;
  messages: DmGroupMessage[];
  more: boolean;
  can: boolean;
  why: string;
  max: number;
  unsendFor: number;
  size: number;
};
export type DmGroupSent = { group: DmGroup; message: DmGroupMessage };
export type DmGroupCandidates = { users: DmUser[]; size: number };

export type DmEvent =
  | { t: "dm"; thread: DmThread; message: DmMessage; counts: DmCounts; accepted?: boolean }
  | { t: "dm-thread"; thread: DmThread }
  | { t: "dm-deleted"; threadId: number; id: number; counts: DmCounts }
  | { t: "dm-read"; threadId: number; seen: number }
  | { t: "dm-counts"; counts: DmCounts }
  | { t: "dm-typing"; threadId: number }
  | { t: "dm-react"; threadId: number; id: number; reactions: DmReaction[] }
  | { t: "dm-group-react"; groupId: number; id: number; reactions: DmReaction[] }
  | { t: "dm-group"; group: DmGroup; message: DmGroupMessage; counts: DmCounts }
  | { t: "dm-group-gone"; groupId: number; counts: DmCounts }
  | { t: "dm-group-deleted"; groupId: number; id: number; counts: DmCounts }
  | { t: "dm-group-typing"; groupId: number; name: string };
export type DmClientMessage = { t: "typing"; thread: number } | { t: "typing"; group: number };

export type ReportedMessage = {
  authorId: number;
  author: string;
  participants: number[];
  threadId: number;
  text: string;
  where: string;
  link: string | null;
};
