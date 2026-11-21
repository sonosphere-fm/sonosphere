// Data access for direct-message moderation in the staff API: who talks to whom, transcripts (admins, with a
// recorded reason), removing a message, and the automatic spam flags.
import { and, count, desc, eq, gte, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, transact } from "../db/client";
import { auditLog, dmFlags, dmMessages, dmThreads, reports, users } from "../db/schema";
import { matches } from "../db/dialect";
import { first, now } from "../util";
import type { AuditEntry } from "../site/audit";
import { closeReportsTx } from "../moderation/repo";
import { auditTx } from "../site/audit";
import { announceRemoved, removeMessageTx } from "../dm/service";

const DAY = 86400;
export type Thread = typeof dmThreads.$inferSelect;
type Actor = { id: number; username: string };

export const openFlagCount = (): Promise<number> => db.$count(dmFlags, isNull(dmFlags.resolvedAt));

// ---------- conversations ----------
export type ThreadFilter = { userId: number | null; pattern: string | null; status: string | null };
/** One page of conversations, most recently active first, plus how many match. `pattern` matches either person's username. */
export async function listThreads(f: ThreadFilter, limit: number, offset: number): Promise<{ rows: Thread[]; total: number }> {
  const lo = alias(users, "lo"), hi = alias(users, "hi");
  const where = and(
    f.userId === null ? undefined : or(eq(dmThreads.userLo, f.userId), eq(dmThreads.userHi, f.userId)),
    f.pattern === null ? undefined : or(matches(lo.usernameNorm, f.pattern), matches(hi.usernameNorm, f.pattern)),
    f.status === null ? undefined : eq(dmThreads.status, f.status),
  );
  const rows = await db.select({ thread: dmThreads }).from(dmThreads).leftJoin(lo, eq(lo.id, dmThreads.userLo)).leftJoin(hi, eq(hi.id, dmThreads.userHi))
    .where(where).orderBy(desc(dmThreads.lastAt), desc(dmThreads.id)).limit(limit).offset(offset);
  const total = await db.select({ c: count() }).from(dmThreads).leftJoin(lo, eq(lo.id, dmThreads.userLo)).leftJoin(hi, eq(hi.id, dmThreads.userHi)).where(where);
  return { rows: rows.map(r => r.thread), total: total[0]?.c ?? 0 };
}
export const findThread = (id: number): Promise<Thread | null> => first(db.select().from(dmThreads).where(eq(dmThreads.id, id)).limit(1));
/** How many messages a conversation holds, how many of them were removed, and how many open reports point into it. */
export async function threadCounts(id: number): Promise<{ messages: number; deleted: number; reports: number }> {
  const reported = await first(db.select({ c: count() }).from(reports).innerJoin(dmMessages, eq(dmMessages.id, reports.targetId))
    .where(and(eq(reports.targetType, "dm"), eq(reports.status, "open"), eq(dmMessages.threadId, id))));
  return {
    messages: await db.$count(dmMessages, eq(dmMessages.threadId, id)),
    deleted: await db.$count(dmMessages, and(eq(dmMessages.threadId, id), isNotNull(dmMessages.deletedAt))),
    reports: reported?.c ?? 0,
  };
}

/** The newest "dm.read" audit entry this admin wrote for a conversation since `since`: their permission to read it. */
export const recentRead = (actorId: number, threadId: number, since: number) =>
  first(db.select({ createdAt: auditLog.createdAt, note: auditLog.note }).from(auditLog)
    .where(and(gte(auditLog.createdAt, since), eq(auditLog.actorId, actorId), eq(auditLog.action, "dm.read"), eq(auditLog.targetType, "dm_thread"), eq(auditLog.targetId, threadId)))
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id)).limit(1));

/** Messages of a conversation with an id below `before`, newest first, each with who removed it and its open reports. */
export function transcript(threadId: number, before: number, limit: number) {
  const deleter = alias(users, "deleter");
  const reported = sql<number>`(SELECT COUNT(*) FROM ${reports} WHERE ${reports.targetType} = 'dm' AND ${reports.targetId} = ${dmMessages.id} AND ${reports.status} = 'open')`;
  return db.select({ id: dmMessages.id, senderId: dmMessages.senderId, body: dmMessages.body, createdAt: dmMessages.createdAt, deletedAt: dmMessages.deletedAt,
    deletedBy: dmMessages.deletedBy, deleter: deleter.username, reports: reported })
    .from(dmMessages).leftJoin(deleter, eq(deleter.id, dmMessages.deletedBy))
    .where(and(eq(dmMessages.threadId, threadId), lt(dmMessages.id, before))).orderBy(desc(dmMessages.id)).limit(limit);
}

/** A message with the two people of its conversation. */
export const findMessage = (id: number) =>
  first(db.select({ id: dmMessages.id, threadId: dmMessages.threadId, senderId: dmMessages.senderId, deletedAt: dmMessages.deletedAt, userLo: dmThreads.userLo, userHi: dmThreads.userHi })
    .from(dmMessages).innerJoin(dmThreads, eq(dmThreads.id, dmMessages.threadId)).where(eq(dmMessages.id, id)).limit(1));

/**
 * Removes a message for both people: closes the open reports about it, records the removal (`entry` receives the
 * number of reports closed) and hides the message. Returns how many reports were closed.
 */
export async function deleteMessage(actor: Actor, id: number, why: string, entry: (closed: number) => AuditEntry): Promise<number> {
  const { closed, removed } = (await transact(async tx => {
    const n = (await closeReportsTx(tx, "dm", id, "content removed", actor.id, why));
    await auditTx(tx, actor, entry(n));
    return { closed: n, removed: (await removeMessageTx(tx, id, actor.id)) };
  }));
  await announceRemoved([removed]);
  return closed;
}

// ---------- spam flags ----------
export type FlagStatus = "open" | "resolved" | "all";
/** One page of flags with the flagged account and who resolved each, plus how many match. */
export async function listFlags(status: FlagStatus, limit: number, offset: number) {
  const resolver = alias(users, "resolver");
  const where = status === "open" ? isNull(dmFlags.resolvedAt) : status === "resolved" ? isNotNull(dmFlags.resolvedAt) : undefined;
  const rows = await db.select({ flag: dmFlags, user: users, resolver: resolver.username }).from(dmFlags)
    .innerJoin(users, eq(users.id, dmFlags.userId)).leftJoin(resolver, eq(resolver.id, dmFlags.resolvedBy))
    .where(where).orderBy(desc(status === "resolved" ? dmFlags.resolvedAt : dmFlags.createdAt), desc(dmFlags.id)).limit(limit).offset(offset);
  return { rows, total: await db.$count(dmFlags, where) };
}
/** Conversations an account started in the day before `t`. */
export const threadsStartedDay = (userId: number, t: number): Promise<number> =>
  db.$count(dmThreads, and(eq(dmThreads.requesterId, userId), gte(dmThreads.createdAt, t - DAY)));
/** A flag with the username of the account it is on. */
export const findFlag = (id: number) =>
  first(db.select({ id: dmFlags.id, userId: dmFlags.userId, kind: dmFlags.kind, detail: dmFlags.detail, resolvedAt: dmFlags.resolvedAt, username: users.username })
    .from(dmFlags).innerJoin(users, eq(users.id, dmFlags.userId)).where(eq(dmFlags.id, id)).limit(1));
export async function resolveFlag(id: number, by: number): Promise<void> { await db.update(dmFlags).set({ resolvedAt: now(), resolvedBy: by }).where(eq(dmFlags.id, id)); }
