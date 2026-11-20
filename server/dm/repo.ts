// Data access for direct messages: threads (one per pair of people), their messages, and automatic spam flags.
// Functions ending in Tx run inside a transaction opened with `atomically`; the rest are awaited on their own.
import { and, between, count, countDistinct, desc, eq, exists, getTableColumns, gt, isNull, lt, max, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { db, transact, type Conn, type Tx } from "../db/client";
import { dmFlags, dmMessages, dmThreads, follows, users } from "../db/schema";
import { first } from "../util";
import type { DmCounts, DmUser, ReportedMessage } from "../../shared/dm";

export type Thread = typeof dmThreads.$inferSelect;
export type Message = typeof dmMessages.$inferSelect;
export type { Tx };
/** Which of a thread's two people someone is: the one with the lower user id or the higher. */
export type Side = "lo" | "hi";
/** A spam flag waiting to be written. */
export type Flag = { userId: number; kind: string; detail: string; sample: string };

/** Runs `fn` in a transaction. It must be synchronous and use the Tx functions below; throwing rolls everything back. */
/** The plain connection, for the Tx functions when no transaction is open. */
export const connection: Conn = db;
export const atomically = <T>(fn: (tx: Tx) => T): T => transact(fn);

const pair = (a: number, b: number) => and(eq(dmThreads.userLo, Math.min(a, b)), eq(dmThreads.userHi, Math.max(a, b)));
const sentBy = (threadId: number, userId: number) => and(eq(dmMessages.threadId, threadId), eq(dmMessages.senderId, userId));

// ---------- people ----------
/** The part of an account shown next to a conversation. */
export const person = (id: number): Promise<DmUser | null> =>
  first(db.select({ id: users.id, username: users.username, realname: users.realname, image: users.imageId }).from(users).where(eq(users.id, id)).limit(1));

/** True when `follower` follows `followee`. */
export const isFollowing = async (follower: number, followee: number): Promise<boolean> =>
  !!(await first(db.select({ one: sql`1` }).from(follows).where(and(eq(follows.followerId, follower), eq(follows.followeeId, followee))).limit(1)));

// ---------- threads ----------
/** The thread between two people, if they have one. */
export const threadOf = (a: number, b: number): Promise<Thread | null> => first(db.select().from(dmThreads).where(pair(a, b)).limit(1));

/** A thread by id, but only when `userId` is one of its two people. */
export const threadFor = (id: number, userId: number): Promise<Thread | null> =>
  first(db.select().from(dmThreads).where(and(eq(dmThreads.id, id), or(eq(dmThreads.userLo, userId), eq(dmThreads.userHi, userId)))).limit(1));

/** As threadFor, and only an accepted conversation. */
export const activeThreadFor = (id: number, userId: number): Promise<Thread | null> =>
  first(db.select().from(dmThreads)
    .where(and(eq(dmThreads.id, id), or(eq(dmThreads.userLo, userId), eq(dmThreads.userHi, userId)), eq(dmThreads.status, "active"))).limit(1));

/**
 * Someone's conversations, newest activity first (at most 200): either the requests waiting on them, or everything
 * else they should see (accepted conversations and requests they sent). Threads they cleared and that have had
 * nothing since are left out.
 */
export function listThreads(userId: number, box: "inbox" | "requests"): Promise<Thread[]> {
  const t = alias(dmThreads, "t"), m = alias(dmMessages, "m");
  const which = box === "requests" ? and(eq(t.status, "request"), ne(t.requesterId, userId)) : or(eq(t.status, "active"), eq(t.requesterId, userId));
  const kept = db.select({ one: sql`1` }).from(m)
    .where(and(eq(m.threadId, t.id), or(and(eq(t.userLo, userId), gt(m.id, t.loCleared)), and(ne(t.userLo, userId), gt(m.id, t.hiCleared)))));
  return db.select().from(t).where(and(or(eq(t.userLo, userId), eq(t.userHi, userId)), which, exists(kept))).orderBy(desc(t.lastAt)).limit(200);
}

/** How many accepted conversations, and how many requests from others, hold something `userId` has not read. */
export async function unreadCounts(userId: number): Promise<DmCounts> {
  const t = alias(dmThreads, "t"), m = alias(dmMessages, "m");
  const unseen = db.select({ one: sql`1` }).from(m).where(and(eq(m.threadId, t.id), ne(m.senderId, userId), isNull(m.deletedAt), or(
    and(eq(t.userLo, userId), gt(m.id, t.loRead), gt(m.id, t.loCleared)),
    and(ne(t.userLo, userId), gt(m.id, t.hiRead), gt(m.id, t.hiCleared)))));
  const [row] = await db.select({
    unread: sql<number>`coalesce(sum(case when ${t.status} = 'active' then 1 else 0 end), 0)`,
    requests: sql<number>`coalesce(sum(case when ${t.status} = 'request' and ${t.requesterId} <> ${userId} then 1 else 0 end), 0)`,
  }).from(t).where(and(or(eq(t.userLo, userId), eq(t.userHi, userId)), exists(unseen)));
  return { unread: row?.unread ?? 0, requests: row?.requests ?? 0 };
}

export const setStatus = async (threadId: number, status: "active" | "declined"): Promise<void> => {
  await db.update(dmThreads).set({ status }).where(eq(dmThreads.id, threadId));
};
/** Records the last message one side has seen. */
export const markRead = async (threadId: number, side: Side, messageId: number): Promise<void> => {
  await db.update(dmThreads).set(side === "lo" ? { loRead: messageId } : { hiRead: messageId }).where(eq(dmThreads.id, threadId));
};
/** "Delete conversation" for one side: hides everything up to `messageId` from them, and counts it as read. */
export const clearFor = async (threadId: number, side: Side, messageId: number): Promise<void> => {
  await db.update(dmThreads).set(side === "lo" ? { loCleared: messageId, loRead: messageId } : { hiCleared: messageId, hiRead: messageId }).where(eq(dmThreads.id, threadId));
};

// ---------- messages ----------
/** The newest message in a thread after `afterId`, deleted or not. */
export const lastMessage = (threadId: number, afterId: number): Promise<Message | null> =>
  first(db.select().from(dmMessages).where(and(eq(dmMessages.threadId, threadId), gt(dmMessages.id, afterId))).orderBy(desc(dmMessages.id)).limit(1));

/** Messages from the other person after `afterId` that have not been deleted. */
export const unreadIn = async (threadId: number, afterId: number, userId: number): Promise<number> =>
  (await db.select({ c: count() }).from(dmMessages)
    .where(and(eq(dmMessages.threadId, threadId), gt(dmMessages.id, afterId), ne(dmMessages.senderId, userId), isNull(dmMessages.deletedAt))))[0]?.c ?? 0;

/** How many messages someone has sent in a thread, deleted ones included. */
export const sentIn = async (threadId: number, userId: number): Promise<number> =>
  (await db.select({ c: count() }).from(dmMessages).where(sentBy(threadId, userId)))[0]?.c ?? 0;

/** The highest message id in a thread, or 0 for an empty one. */
export const topMessageId = async (threadId: number): Promise<number> =>
  (await db.select({ top: max(dmMessages.id) }).from(dmMessages).where(eq(dmMessages.threadId, threadId)))[0]?.top ?? 0;

/** Up to `limit` messages with an id between `afterId` and `beforeId` (both exclusive), newest first. */
export const messagesBetween = (threadId: number, afterId: number, beforeId: number, limit: number): Promise<Message[]> =>
  db.select().from(dmMessages).where(and(eq(dmMessages.threadId, threadId), gt(dmMessages.id, afterId), lt(dmMessages.id, beforeId)))
    .orderBy(desc(dmMessages.id)).limit(limit);

/** A message, but only for the person who sent it. */
export const ownMessage = (id: number, senderId: number): Promise<Message | null> =>
  first(db.select().from(dmMessages).where(and(eq(dmMessages.id, id), eq(dmMessages.senderId, senderId))).limit(1));

/** Who saw a removed message: its thread and the thread's two people. */
export type Removed = { id: number; threadId: number; userLo: number; userHi: number };
/** Hides a message inside a transaction (the row is kept for staff). Null when it is gone or already hidden. */
export function softDeleteTx(conn: Conn, id: number, byUserId: number, at: number): Removed | null {
  const m = conn.select({ id: dmMessages.id, threadId: dmMessages.threadId, deletedAt: dmMessages.deletedAt, userLo: dmThreads.userLo, userHi: dmThreads.userHi })
    .from(dmMessages).innerJoin(dmThreads, eq(dmThreads.id, dmMessages.threadId)).where(eq(dmMessages.id, id)).get();
  if (!m || m.deletedAt) return null;
  conn.update(dmMessages).set({ deletedAt: at, deletedBy: byUserId }).where(eq(dmMessages.id, id)).run();
  return { id: m.id, threadId: m.threadId, userLo: m.userLo, userHi: m.userHi };
}

/** What a report of a message shows staff (see ReportedMessage). Synchronous so moderation can read it inside a transaction. */
export function reportedMessageTx(conn: Conn, id: number): ReportedMessage | null {
  const m = conn.select({ ...getTableColumns(dmMessages), userLo: dmThreads.userLo, userHi: dmThreads.userHi }).from(dmMessages)
    .innerJoin(dmThreads, eq(dmThreads.id, dmMessages.threadId)).where(eq(dmMessages.id, id)).get();
  if (!m) return null;
  const names = new Map<number, string>();
  const name = (uid: number) => {
    const known = names.get(uid) ?? conn.select({ username: users.username }).from(users).where(eq(users.id, uid)).get()?.username ?? "(deleted)";
    names.set(uid, known);
    return known;
  };
  // the 11 newest messages near it, narrowed to five either side of where it sits among them
  const near = conn.select().from(dmMessages).where(and(eq(dmMessages.threadId, m.threadId), between(dmMessages.id, m.id - 200, m.id + 200)))
    .orderBy(desc(dmMessages.id)).limit(11).all().reverse();
  const at = near.findIndex(x => x.id === m.id);
  const lines = near.flatMap((x, i) => (Math.abs(at - i) <= 5 ? [`${x.id === m.id ? ">> " : ""}${name(x.senderId)}: ${x.body}`] : []));
  return {
    authorId: m.senderId, author: name(m.senderId), participants: [m.userLo, m.userHi], threadId: m.threadId,
    text: `${m.body}\n\n--- conversation around it ---\n${lines.join("\n")}`,
    where: `Direct message between ${name(m.userLo)} and ${name(m.userHi)}`, link: `/admin/messages/${m.threadId}`,
  };
}

// ---------- sending (inside one transaction) ----------
export const threadOfTx = (tx: Tx, a: number, b: number): Thread | null => tx.select().from(dmThreads).where(pair(a, b)).get() ?? null;

export function setStatusTx(tx: Tx, threadId: number, status: "active"): void {
  tx.update(dmThreads).set({ status }).where(eq(dmThreads.id, threadId)).run();
}
export const sentInTx = (tx: Tx, threadId: number, userId: number): number =>
  tx.select({ c: count() }).from(dmMessages).where(sentBy(threadId, userId)).get()?.c ?? 0;

/** Messages someone has sent to anyone since a moment (Unix seconds, exclusive). */
export const sentSinceTx = (tx: Tx, userId: number, since: number): number =>
  tx.select({ c: count() }).from(dmMessages).where(and(eq(dmMessages.senderId, userId), gt(dmMessages.createdAt, since))).get()?.c ?? 0;

/** Conversations someone has started since a moment. */
export const startedSinceTx = (tx: Tx, userId: number, since: number): number =>
  tx.select({ c: count() }).from(dmThreads).where(and(eq(dmThreads.requesterId, userId), gt(dmThreads.createdAt, since))).get()?.c ?? 0;

/** In how many different conversations someone has sent exactly this text since a moment. */
export const copiesSinceTx = (tx: Tx, userId: number, since: number, body: string): number =>
  tx.select({ c: countDistinct(dmMessages.threadId) }).from(dmMessages)
    .where(and(eq(dmMessages.senderId, userId), gt(dmMessages.createdAt, since), eq(dmMessages.body, body))).get()?.c ?? 0;

export const createThreadTx = (tx: Tx, from: number, to: number, status: "active" | "request", at: number): Thread =>
  tx.insert(dmThreads).values({ userLo: Math.min(from, to), userHi: Math.max(from, to), status, requesterId: from, createdAt: at, lastAt: at }).returning().get();

/** Stores a message, moves the thread to the top and marks it read for its sender. Returns the message and the thread as it now stands. */
export function addMessageTx(tx: Tx, thread: Thread, senderId: number, body: string, at: number): { message: Message; thread: Thread } {
  const message = tx.insert(dmMessages).values({ threadId: thread.id, senderId, body, createdAt: at }).returning().get();
  const read = thread.userLo === senderId ? { loRead: message.id } : { hiRead: message.id };
  return { message, thread: tx.update(dmThreads).set({ lastAt: at, ...read }).where(eq(dmThreads.id, thread.id)).returning().get() };
}

// ---------- spam flags ----------
/** Raises a flag for staff, unless the account already has an open one of the same kind. */
export async function raiseFlag(f: Flag, at: number): Promise<void> {
  if (await first(db.select({ one: sql`1` }).from(dmFlags).where(and(eq(dmFlags.userId, f.userId), eq(dmFlags.kind, f.kind), isNull(dmFlags.resolvedAt))).limit(1))) return;
  await db.insert(dmFlags).values({ userId: f.userId, kind: f.kind, detail: f.detail, sample: f.sample.slice(0, 500), createdAt: at });
}
