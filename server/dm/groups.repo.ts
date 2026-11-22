import {
  and,
  asc,
  between,
  count,
  desc,
  eq,
  exists,
  getTableColumns,
  gt,
  isNotNull,
  isNull,
  lt,
  max,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, type Conn, type Tx } from "../db/client";
import { dmGroupMembers, dmGroupMessages, dmGroups, dmThreads, users } from "../db/schema";
import { first } from "../util";
import type { DmUser, ReportedMessage } from "../../shared/dm";

export type Group = typeof dmGroups.$inferSelect;
export type Member = typeof dmGroupMembers.$inferSelect;
export type GroupMessage = typeof dmGroupMessages.$inferSelect & { name: string };
export type GroupRemoved = { id: number; groupId: number };

const personColumns = { id: users.id, username: users.username, realname: users.realname, image: users.imageId };
const messageColumns = { ...getTableColumns(dmGroupMessages), name: users.username };
const membership = (groupId: number, userId: number) =>
  and(eq(dmGroupMembers.groupId, groupId), eq(dmGroupMembers.userId, userId));

export async function groupFor(id: number, userId: number): Promise<{ group: Group; member: Member } | null> {
  const row = await first(
    db
      .select({ group: dmGroups, member: dmGroupMembers })
      .from(dmGroups)
      .innerJoin(dmGroupMembers, eq(dmGroupMembers.groupId, dmGroups.id))
      .where(and(eq(dmGroups.id, id), eq(dmGroupMembers.userId, userId)))
      .limit(1)
  );
  return row;
}

export const members = (groupId: number): Promise<DmUser[]> =>
  db
    .select(personColumns)
    .from(dmGroupMembers)
    .innerJoin(users, eq(users.id, dmGroupMembers.userId))
    .where(eq(dmGroupMembers.groupId, groupId))
    .orderBy(asc(dmGroupMembers.joinedAt), asc(users.id));

export async function memberIds(groupId: number): Promise<number[]> {
  const rows = await db
    .select({ id: dmGroupMembers.userId })
    .from(dmGroupMembers)
    .where(eq(dmGroupMembers.groupId, groupId));
  return rows.map((r) => r.id);
}

export const listGroups = (userId: number): Promise<{ group: Group; member: Member }[]> =>
  db
    .select({ group: dmGroups, member: dmGroupMembers })
    .from(dmGroups)
    .innerJoin(dmGroupMembers, eq(dmGroupMembers.groupId, dmGroups.id))
    .where(eq(dmGroupMembers.userId, userId))
    .orderBy(desc(dmGroups.lastAt))
    .limit(200);

// The people someone has an accepted conversation with, which is who they may add to a group.
export function contacts(userId: number): Promise<DmUser[]> {
  const other = sql`case when ${dmThreads.userLo} = ${userId} then ${dmThreads.userHi} else ${dmThreads.userLo} end`;
  return db
    .select(personColumns)
    .from(dmThreads)
    .innerJoin(users, eq(users.id, other))
    .where(and(or(eq(dmThreads.userLo, userId), eq(dmThreads.userHi, userId)), eq(dmThreads.status, "active")))
    .orderBy(desc(dmThreads.lastAt))
    .limit(200);
}

export async function hasActiveThread(a: number, b: number): Promise<boolean> {
  const row = await first(
    db
      .select({ one: sql`1` })
      .from(dmThreads)
      .where(
        and(eq(dmThreads.userLo, Math.min(a, b)), eq(dmThreads.userHi, Math.max(a, b)), eq(dmThreads.status, "active"))
      )
      .limit(1)
  );
  return !!row;
}

export const lastMessage = (groupId: number, afterId: number): Promise<GroupMessage | null> =>
  first(
    db
      .select(messageColumns)
      .from(dmGroupMessages)
      .innerJoin(users, eq(users.id, dmGroupMessages.senderId))
      .where(and(eq(dmGroupMessages.groupId, groupId), gt(dmGroupMessages.id, afterId)))
      .orderBy(desc(dmGroupMessages.id))
      .limit(1)
  );

export const messageById = (id: number): Promise<GroupMessage> =>
  db
    .select(messageColumns)
    .from(dmGroupMessages)
    .innerJoin(users, eq(users.id, dmGroupMessages.senderId))
    .where(eq(dmGroupMessages.id, id))
    .then((rows) => rows[0]);

const unseen = (groupId: number, afterId: number, userId: number) =>
  and(
    eq(dmGroupMessages.groupId, groupId),
    gt(dmGroupMessages.id, afterId),
    ne(dmGroupMessages.senderId, userId),
    isNull(dmGroupMessages.deletedAt),
    isNull(dmGroupMessages.event)
  );

export const unreadIn = async (groupId: number, afterId: number, userId: number): Promise<number> =>
  (
    await db
      .select({ c: count() })
      .from(dmGroupMessages)
      .where(unseen(groupId, afterId, userId))
  )[0].c;

export async function unreadGroups(userId: number): Promise<number> {
  const g = alias(dmGroupMembers, "g");
  const m = alias(dmGroupMessages, "m");
  const waiting = db
    .select({ one: sql`1` })
    .from(m)
    .where(
      and(
        eq(m.groupId, g.groupId),
        gt(m.id, g.readId),
        gt(m.id, g.clearedId),
        ne(m.senderId, userId),
        isNull(m.deletedAt),
        isNull(m.event)
      )
    );
  return (
    await db
      .select({ c: count() })
      .from(g)
      .where(and(eq(g.userId, userId), exists(waiting)))
  )[0].c;
}

export async function unreadSince(userId: number, since: number): Promise<{ messages: number; people: number }> {
  const rows = await db
    .select({ sender: dmGroupMessages.senderId, c: count() })
    .from(dmGroupMessages)
    .innerJoin(dmGroupMembers, eq(dmGroupMembers.groupId, dmGroupMessages.groupId))
    .where(
      and(
        eq(dmGroupMembers.userId, userId),
        ne(dmGroupMessages.senderId, userId),
        isNull(dmGroupMessages.deletedAt),
        isNull(dmGroupMessages.event),
        gt(dmGroupMessages.createdAt, since),
        gt(dmGroupMessages.id, dmGroupMembers.readId),
        gt(dmGroupMessages.id, dmGroupMembers.clearedId)
      )
    )
    .groupBy(dmGroupMessages.senderId);
  return { messages: rows.reduce((n, r) => n + r.c, 0), people: rows.length };
}

const topIn = async (conn: Conn, groupId: number): Promise<number> =>
  (
    await conn
      .select({ top: max(dmGroupMessages.id) })
      .from(dmGroupMessages)
      .where(eq(dmGroupMessages.groupId, groupId))
  )[0].top ?? 0;

export const topMessageId = (groupId: number): Promise<number> => topIn(db, groupId);

export const messagesBetween = (
  groupId: number,
  afterId: number,
  beforeId: number,
  limit: number
): Promise<GroupMessage[]> =>
  db
    .select(messageColumns)
    .from(dmGroupMessages)
    .innerJoin(users, eq(users.id, dmGroupMessages.senderId))
    .where(and(eq(dmGroupMessages.groupId, groupId), gt(dmGroupMessages.id, afterId), lt(dmGroupMessages.id, beforeId)))
    .orderBy(desc(dmGroupMessages.id))
    .limit(limit);

export async function markRead(groupId: number, userId: number, messageId: number): Promise<void> {
  await db.update(dmGroupMembers).set({ readId: messageId }).where(membership(groupId, userId));
}

export const ownMessage = (id: number, senderId: number) =>
  first(
    db
      .select()
      .from(dmGroupMessages)
      .where(and(eq(dmGroupMessages.id, id), eq(dmGroupMessages.senderId, senderId), isNull(dmGroupMessages.event)))
      .limit(1)
  );

export async function createTx(tx: Tx, ownerId: number, title: string, at: number): Promise<Group> {
  const [group] = await tx.insert(dmGroups).values({ title, ownerId, createdAt: at, lastAt: at }).returning();
  await tx.insert(dmGroupMembers).values({ groupId: group.id, userId: ownerId, joinedAt: at });
  return group;
}

export async function addMemberTx(tx: Tx, groupId: number, userId: number, at: number): Promise<void> {
  const top = await topIn(tx, groupId);
  await tx.insert(dmGroupMembers).values({ groupId, userId, joinedAt: at, readId: top, clearedId: top });
}

export async function removeMemberTx(tx: Tx, groupId: number, userId: number): Promise<void> {
  await tx.delete(dmGroupMembers).where(membership(groupId, userId));
}

export async function isMemberTx(tx: Tx, groupId: number, userId: number): Promise<boolean> {
  return (await tx.select({ one: sql`1` }).from(dmGroupMembers).where(membership(groupId, userId))).length > 0;
}

export async function updateTx(tx: Tx, groupId: number, set: { title?: string; ownerId?: number }): Promise<Group> {
  const [group] = await tx.update(dmGroups).set(set).where(eq(dmGroups.id, groupId)).returning();
  return group;
}

export async function dropTx(tx: Tx, groupId: number): Promise<void> {
  await tx.delete(dmGroups).where(eq(dmGroups.id, groupId));
}

export async function longestMemberTx(tx: Tx, groupId: number): Promise<{ id: number; username: string } | null> {
  const rows = await tx
    .select({ id: users.id, username: users.username })
    .from(dmGroupMembers)
    .innerJoin(users, eq(users.id, dmGroupMembers.userId))
    .where(eq(dmGroupMembers.groupId, groupId))
    .orderBy(asc(dmGroupMembers.joinedAt), asc(dmGroupMembers.userId))
    .limit(1);
  return rows[0] ?? null;
}

// Run before deleting a user: their groups pass to the longest-standing other member, or go if no one is left.
export async function handOffGroupsTx(tx: Tx, userId: number): Promise<void> {
  const heir = sql`(SELECT m.user_id FROM ${dmGroupMembers} m WHERE m.group_id = ${dmGroups.id} AND m.user_id <> ${userId}
    ORDER BY m.joined_at, m.user_id LIMIT 1)`;
  await tx
    .update(dmGroups)
    .set({ ownerId: sql`coalesce(${heir}, ${dmGroups.ownerId})` })
    .where(eq(dmGroups.ownerId, userId));
  await tx.delete(dmGroups).where(eq(dmGroups.ownerId, userId));
}

// Also moves the group to the top and marks it read for the sender.
export async function addMessageTx(
  tx: Tx,
  groupId: number,
  senderId: number,
  body: string,
  event: string | null,
  at: number
): Promise<number> {
  const [m] = await tx
    .insert(dmGroupMessages)
    .values({ groupId, senderId, body, event, createdAt: at })
    .returning({ id: dmGroupMessages.id });
  await tx.update(dmGroups).set({ lastAt: at }).where(eq(dmGroups.id, groupId));
  await tx.update(dmGroupMembers).set({ readId: m.id }).where(membership(groupId, senderId));
  return m.id;
}

export const sentSinceTx = async (tx: Tx, userId: number, since: number): Promise<number> =>
  (
    await tx
      .select({ c: count() })
      .from(dmGroupMessages)
      .where(
        and(eq(dmGroupMessages.senderId, userId), gt(dmGroupMessages.createdAt, since), isNull(dmGroupMessages.event))
      )
  )[0].c;

export const createdSinceTx = async (tx: Tx, userId: number, since: number): Promise<number> =>
  (
    await tx
      .select({ c: count() })
      .from(dmGroupMessages)
      .where(
        and(
          eq(dmGroupMessages.senderId, userId),
          gt(dmGroupMessages.createdAt, since),
          eq(dmGroupMessages.event, "created")
        )
      )
  )[0].c;

export async function softDeleteTx(conn: Conn, id: number, byUserId: number, at: number): Promise<GroupRemoved | null> {
  const [m] = await conn
    .update(dmGroupMessages)
    .set({ deletedAt: at, deletedBy: byUserId })
    .where(and(eq(dmGroupMessages.id, id), isNull(dmGroupMessages.deletedAt), isNull(dmGroupMessages.event)))
    .returning({ id: dmGroupMessages.id, groupId: dmGroupMessages.groupId });
  return m ?? null;
}

export async function removed(id: number): Promise<boolean> {
  const row = await first(
    db
      .select({ one: sql`1` })
      .from(dmGroupMessages)
      .where(and(eq(dmGroupMessages.id, id), isNotNull(dmGroupMessages.deletedAt)))
      .limit(1)
  );
  return !!row;
}

export async function reportedMessageTx(conn: Conn, id: number): Promise<ReportedMessage | null> {
  const m = (
    await conn
      .select({ ...messageColumns, title: dmGroups.title })
      .from(dmGroupMessages)
      .innerJoin(users, eq(users.id, dmGroupMessages.senderId))
      .innerJoin(dmGroups, eq(dmGroups.id, dmGroupMessages.groupId))
      .where(and(eq(dmGroupMessages.id, id), isNull(dmGroupMessages.event)))
  )[0];
  if (!m) return null;
  const near = await conn
    .select(messageColumns)
    .from(dmGroupMessages)
    .innerJoin(users, eq(users.id, dmGroupMessages.senderId))
    .where(and(eq(dmGroupMessages.groupId, m.groupId), between(dmGroupMessages.id, m.id - 200, m.id + 200)))
    .orderBy(asc(dmGroupMessages.id));
  const at = near.findIndex((x) => x.id === m.id);
  const lines = near.slice(Math.max(0, at - 5), at + 6).map((x) => {
    const marker = x.id === m.id ? ">> " : "";
    return x.event ? `${marker}(${x.body})` : `${marker}${x.name}: ${x.body}`;
  });
  const people = await conn
    .select({ id: dmGroupMembers.userId, username: users.username })
    .from(dmGroupMembers)
    .innerJoin(users, eq(users.id, dmGroupMembers.userId))
    .where(eq(dmGroupMembers.groupId, m.groupId));
  const title = m.title ? `"${m.title}"` : "a group chat";
  return {
    authorId: m.senderId,
    author: m.name,
    participants: people.map((p) => p.id),
    threadId: m.groupId,
    text: `${m.body}\n\n--- conversation around it ---\n${lines.join("\n")}`,
    where: `Message in ${title} with ${people.map((p) => p.username).join(", ")}`,
    link: null,
  };
}
