import {
  and,
  between,
  count,
  countDistinct,
  desc,
  eq,
  exists,
  getTableColumns,
  gt,
  isNull,
  lt,
  max,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, transact, type Conn, type Tx } from "../db/client";
import { dmFlags, dmMessages, dmThreads, follows, users } from "../db/schema";
import { first } from "../util";
import type { DmCounts, DmUser, ReportedMessage } from "../../shared/dm";

export type Thread = typeof dmThreads.$inferSelect;
export type Message = typeof dmMessages.$inferSelect;
export type { Tx };
export type Side = "lo" | "hi";
export type Flag = { userId: number; kind: string; detail: string; sample: string };

export const connection: Conn = db;
export const atomically = <T>(fn: (tx: Tx) => Promise<T>): Promise<T> => transact(fn);

const pair = (a: number, b: number) => and(eq(dmThreads.userLo, Math.min(a, b)), eq(dmThreads.userHi, Math.max(a, b)));
const sentBy = (threadId: number, userId: number) =>
  and(eq(dmMessages.threadId, threadId), eq(dmMessages.senderId, userId));

export const person = (id: number): Promise<DmUser | null> =>
  first(
    db
      .select({ id: users.id, username: users.username, realname: users.realname, image: users.imageId })
      .from(users)
      .where(eq(users.id, id))
      .limit(1)
  );

export async function isFollowing(follower: number, followee: number): Promise<boolean> {
  const row = await first(
    db
      .select({ one: sql`1` })
      .from(follows)
      .where(and(eq(follows.followerId, follower), eq(follows.followeeId, followee)))
      .limit(1)
  );
  return !!row;
}

export const threadOf = (a: number, b: number): Promise<Thread | null> =>
  first(db.select().from(dmThreads).where(pair(a, b)).limit(1));

export const threadFor = (id: number, userId: number): Promise<Thread | null> =>
  first(
    db
      .select()
      .from(dmThreads)
      .where(and(eq(dmThreads.id, id), or(eq(dmThreads.userLo, userId), eq(dmThreads.userHi, userId))))
      .limit(1)
  );

export const activeThreadFor = (id: number, userId: number): Promise<Thread | null> =>
  first(
    db
      .select()
      .from(dmThreads)
      .where(
        and(
          eq(dmThreads.id, id),
          or(eq(dmThreads.userLo, userId), eq(dmThreads.userHi, userId)),
          eq(dmThreads.status, "active")
        )
      )
      .limit(1)
  );

// Threads someone cleared that have had nothing since are left out.
export function listThreads(userId: number, box: "inbox" | "requests"): Promise<Thread[]> {
  const t = alias(dmThreads, "t");
  const m = alias(dmMessages, "m");
  const which =
    box === "requests"
      ? and(eq(t.status, "request"), ne(t.requesterId, userId))
      : or(eq(t.status, "active"), eq(t.requesterId, userId));
  const kept = db
    .select({ one: sql`1` })
    .from(m)
    .where(
      and(
        eq(m.threadId, t.id),
        or(and(eq(t.userLo, userId), gt(m.id, t.loCleared)), and(ne(t.userLo, userId), gt(m.id, t.hiCleared)))
      )
    );
  return db
    .select()
    .from(t)
    .where(and(or(eq(t.userLo, userId), eq(t.userHi, userId)), which, exists(kept)))
    .orderBy(desc(t.lastAt))
    .limit(200);
}

export async function unreadCounts(userId: number): Promise<DmCounts> {
  const t = alias(dmThreads, "t");
  const m = alias(dmMessages, "m");
  const unseen = db
    .select({ one: sql`1` })
    .from(m)
    .where(
      and(
        eq(m.threadId, t.id),
        ne(m.senderId, userId),
        isNull(m.deletedAt),
        or(
          and(eq(t.userLo, userId), gt(m.id, t.loRead), gt(m.id, t.loCleared)),
          and(ne(t.userLo, userId), gt(m.id, t.hiRead), gt(m.id, t.hiCleared))
        )
      )
    );
  const [row] = await db
    .select({
      unread: sql<number>`coalesce(sum(case when ${t.status} = 'active' then 1 else 0 end), 0)`,
      requests: sql<number>`coalesce(sum(case when ${t.status} = 'request' and ${t.requesterId} <> ${userId} then 1 else 0 end), 0)`,
    })
    .from(t)
    .where(and(or(eq(t.userLo, userId), eq(t.userHi, userId)), exists(unseen)));
  return { unread: row?.unread ?? 0, requests: row?.requests ?? 0 };
}

export async function unreadSince(userId: number, since: number): Promise<{ messages: number; people: number }> {
  const t = alias(dmThreads, "t");
  const m = alias(dmMessages, "m");
  const [row] = await db
    .select({ messages: sql<number>`count(*)::int`, people: sql<number>`count(distinct ${m.senderId})::int` })
    .from(m)
    .innerJoin(t, eq(t.id, m.threadId))
    .where(
      and(
        or(eq(t.userLo, userId), eq(t.userHi, userId)),
        ne(m.senderId, userId),
        isNull(m.deletedAt),
        gt(m.createdAt, since),
        ne(t.status, "declined"),
        or(
          and(eq(t.userLo, userId), gt(m.id, t.loRead), gt(m.id, t.loCleared)),
          and(ne(t.userLo, userId), gt(m.id, t.hiRead), gt(m.id, t.hiCleared))
        )
      )
    );
  return { messages: row?.messages ?? 0, people: row?.people ?? 0 };
}

export const setStatus = async (threadId: number, status: "active" | "declined"): Promise<void> => {
  await db.update(dmThreads).set({ status }).where(eq(dmThreads.id, threadId));
};
export const markRead = async (threadId: number, side: Side, messageId: number): Promise<void> => {
  await db
    .update(dmThreads)
    .set(side === "lo" ? { loRead: messageId } : { hiRead: messageId })
    .where(eq(dmThreads.id, threadId));
};
export const clearFor = async (threadId: number, side: Side, messageId: number): Promise<void> => {
  const set = side === "lo" ? { loCleared: messageId, loRead: messageId } : { hiCleared: messageId, hiRead: messageId };
  await db.update(dmThreads).set(set).where(eq(dmThreads.id, threadId));
};

export const lastMessage = (threadId: number, afterId: number): Promise<Message | null> =>
  first(
    db
      .select()
      .from(dmMessages)
      .where(and(eq(dmMessages.threadId, threadId), gt(dmMessages.id, afterId)))
      .orderBy(desc(dmMessages.id))
      .limit(1)
  );

export const unreadIn = async (threadId: number, afterId: number, userId: number): Promise<number> =>
  (
    await db
      .select({ c: count() })
      .from(dmMessages)
      .where(
        and(
          eq(dmMessages.threadId, threadId),
          gt(dmMessages.id, afterId),
          ne(dmMessages.senderId, userId),
          isNull(dmMessages.deletedAt)
        )
      )
  )[0]?.c ?? 0;

export const sentIn = async (threadId: number, userId: number): Promise<number> =>
  (await db.select({ c: count() }).from(dmMessages).where(sentBy(threadId, userId)))[0]?.c ?? 0;

export const topMessageId = async (threadId: number): Promise<number> =>
  (
    await db
      .select({ top: max(dmMessages.id) })
      .from(dmMessages)
      .where(eq(dmMessages.threadId, threadId))
  )[0]?.top ?? 0;

export const messagesBetween = (
  threadId: number,
  afterId: number,
  beforeId: number,
  limit: number
): Promise<Message[]> =>
  db
    .select()
    .from(dmMessages)
    .where(and(eq(dmMessages.threadId, threadId), gt(dmMessages.id, afterId), lt(dmMessages.id, beforeId)))
    .orderBy(desc(dmMessages.id))
    .limit(limit);

export const ownMessage = (id: number, senderId: number): Promise<Message | null> =>
  first(
    db
      .select()
      .from(dmMessages)
      .where(and(eq(dmMessages.id, id), eq(dmMessages.senderId, senderId)))
      .limit(1)
  );

export type Removed = { id: number; threadId: number; userLo: number; userHi: number };
export async function softDeleteTx(conn: Conn, id: number, byUserId: number, at: number): Promise<Removed | null> {
  const m = (
    await conn
      .select({
        id: dmMessages.id,
        threadId: dmMessages.threadId,
        deletedAt: dmMessages.deletedAt,
        userLo: dmThreads.userLo,
        userHi: dmThreads.userHi,
      })
      .from(dmMessages)
      .innerJoin(dmThreads, eq(dmThreads.id, dmMessages.threadId))
      .where(eq(dmMessages.id, id))
  )[0];
  if (!m || m.deletedAt) return null;
  await conn.update(dmMessages).set({ deletedAt: at, deletedBy: byUserId }).where(eq(dmMessages.id, id));
  return { id: m.id, threadId: m.threadId, userLo: m.userLo, userHi: m.userHi };
}

export async function reportedMessageTx(conn: Conn, id: number): Promise<ReportedMessage | null> {
  const m = (
    await conn
      .select({ ...getTableColumns(dmMessages), userLo: dmThreads.userLo, userHi: dmThreads.userHi })
      .from(dmMessages)
      .innerJoin(dmThreads, eq(dmThreads.id, dmMessages.threadId))
      .where(eq(dmMessages.id, id))
  )[0];
  if (!m) return null;
  const names = new Map<number, string>();
  const name = async (uid: number) => {
    const cached = names.get(uid);
    if (cached) return cached;
    const row = (await conn.select({ username: users.username }).from(users).where(eq(users.id, uid)))[0];
    const known = row?.username ?? "(deleted)";
    names.set(uid, known);
    return known;
  };
  // the 11 newest messages near it, narrowed to five either side of where it sits among them
  const near = (
    await conn
      .select()
      .from(dmMessages)
      .where(and(eq(dmMessages.threadId, m.threadId), between(dmMessages.id, m.id - 200, m.id + 200)))
      .orderBy(desc(dmMessages.id))
      .limit(11)
  ).reverse();
  const at = near.findIndex((x) => x.id === m.id);
  const lines: string[] = [];
  for (const [i, x] of near.entries()) {
    if (Math.abs(at - i) > 5) continue;
    const marker = x.id === m.id ? ">> " : "";
    lines.push(`${marker}${await name(x.senderId)}: ${x.body}`);
  }
  return {
    authorId: m.senderId,
    author: await name(m.senderId),
    participants: [m.userLo, m.userHi],
    threadId: m.threadId,
    text: `${m.body}\n\n--- conversation around it ---\n${lines.join("\n")}`,
    where: `Direct message between ${await name(m.userLo)} and ${await name(m.userHi)}`,
    link: `/admin/messages/${m.threadId}`,
  };
}

export const threadOfTx = async (tx: Tx, a: number, b: number): Promise<Thread | null> =>
  (await tx.select().from(dmThreads).where(pair(a, b)))[0] ?? null;

export async function setStatusTx(tx: Tx, threadId: number, status: "active"): Promise<void> {
  await tx.update(dmThreads).set({ status }).where(eq(dmThreads.id, threadId));
}
export const sentInTx = async (tx: Tx, threadId: number, userId: number): Promise<number> =>
  (await tx.select({ c: count() }).from(dmMessages).where(sentBy(threadId, userId)))[0]?.c ?? 0;

export const sentSinceTx = async (tx: Tx, userId: number, since: number): Promise<number> =>
  (
    await tx
      .select({ c: count() })
      .from(dmMessages)
      .where(and(eq(dmMessages.senderId, userId), gt(dmMessages.createdAt, since)))
  )[0]?.c ?? 0;

export const startedSinceTx = async (tx: Tx, userId: number, since: number): Promise<number> =>
  (
    await tx
      .select({ c: count() })
      .from(dmThreads)
      .where(and(eq(dmThreads.requesterId, userId), gt(dmThreads.createdAt, since)))
  )[0]?.c ?? 0;

export const copiesSinceTx = async (tx: Tx, userId: number, since: number, body: string): Promise<number> =>
  (
    await tx
      .select({ c: countDistinct(dmMessages.threadId) })
      .from(dmMessages)
      .where(and(eq(dmMessages.senderId, userId), gt(dmMessages.createdAt, since), eq(dmMessages.body, body)))
  )[0]?.c ?? 0;

export async function createThreadTx(
  tx: Tx,
  from: number,
  to: number,
  status: "active" | "request",
  at: number
): Promise<Thread> {
  const values = {
    userLo: Math.min(from, to),
    userHi: Math.max(from, to),
    status,
    requesterId: from,
    createdAt: at,
    lastAt: at,
  };
  return (await tx.insert(dmThreads).values(values).returning())[0];
}

// Also moves the thread to the top and marks it read for the sender.
export async function addMessageTx(
  tx: Tx,
  thread: Thread,
  senderId: number,
  body: string,
  at: number
): Promise<{ message: Message; thread: Thread }> {
  const message = (
    await tx.insert(dmMessages).values({ threadId: thread.id, senderId, body, createdAt: at }).returning()
  )[0];
  const read = thread.userLo === senderId ? { loRead: message.id } : { hiRead: message.id };
  const [updated] = await tx
    .update(dmThreads)
    .set({ lastAt: at, ...read })
    .where(eq(dmThreads.id, thread.id))
    .returning();
  return { message, thread: updated };
}

// Skipped when the account already has an open flag of the same kind.
export async function raiseFlag(f: Flag, at: number): Promise<void> {
  const open = await first(
    db
      .select({ one: sql`1` })
      .from(dmFlags)
      .where(and(eq(dmFlags.userId, f.userId), eq(dmFlags.kind, f.kind), isNull(dmFlags.resolvedAt)))
      .limit(1)
  );
  if (open) return;
  await db
    .insert(dmFlags)
    .values({ userId: f.userId, kind: f.kind, detail: f.detail, sample: f.sample.slice(0, 500), createdAt: at });
}
