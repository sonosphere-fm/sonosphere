import { and, asc, eq, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "../db/client";
import { blocks, dmFlags, dmMessages, dmThreads, follows, lovedTracks, reports, scrobbles, users, userTrust } from "../db/schema";
import { first } from "../util";
import type { User } from "../users/repo";

export type Trust = typeof userTrust.$inferSelect;
export type Signals = {
  listeningDays: number;
  trustedFollowers: number;
  acceptedRequests: number;
  reachedOut: number;
  loved: number;
  declined: number;
  blockedBy: number;
  reported: number;
  flagged: number;
};

export const trustOf = (userId: number): Promise<Trust | null> =>
  first(db.select().from(userTrust).where(eq(userTrust.userId, userId)).limit(1));

const trusted = (id: SQL) =>
  sql`EXISTS (SELECT 1 FROM ${users} tu LEFT JOIN ${userTrust} tt ON tt.user_id = tu.id
    WHERE tu.id = ${id} AND NOT tu.banned AND (tu.is_admin OR tt.cleared_at IS NOT NULL))`;

const tally = async (q: SQL): Promise<number> => Number((await db.execute<{ n: number }>(q))[0]?.n ?? 0);

export async function signals(u: User): Promise<Signals> {
  const other = sql`CASE WHEN ${dmThreads.userLo} = ${u.id} THEN ${dmThreads.userHi} ELSE ${dmThreads.userLo} END`;
  const mine = or(eq(dmThreads.userLo, u.id), eq(dmThreads.userHi, u.id));
  return {
    listeningDays: await tally(sql`SELECT COUNT(DISTINCT ${scrobbles.playedAt} / 86400) AS n FROM ${scrobbles}
      WHERE ${scrobbles.userId} = ${u.id} AND ${scrobbles.source} <> 'import' AND ${scrobbles.playedAt} >= ${u.registeredAt}`),
    trustedFollowers: await db.$count(follows, and(eq(follows.followeeId, u.id), trusted(sql`${follows.followerId}`))),
    acceptedRequests: await db.$count(dmThreads, and(eq(dmThreads.requesterId, u.id), eq(dmThreads.status, "active"), trusted(other))),
    reachedOut: await db.$count(dmThreads, and(mine, sql`${dmThreads.requesterId} <> ${u.id}`, trusted(sql`${dmThreads.requesterId}`))),
    loved: await db.$count(lovedTracks, eq(lovedTracks.userId, u.id)),
    declined: await db.$count(dmThreads, and(eq(dmThreads.requesterId, u.id), eq(dmThreads.status, "declined"))),
    blockedBy: await db.$count(blocks, eq(blocks.blockedId, u.id)),
    reported: await tally(sql`SELECT COUNT(*) AS n FROM ${reports} WHERE ${reports.outcome} <> 'dismissed' AND (
      (${reports.targetType} = 'user' AND ${reports.targetId} = ${u.id})
      OR (${reports.targetType} = 'dm' AND ${reports.targetId} IN (SELECT ${dmMessages.id} FROM ${dmMessages} WHERE ${dmMessages.senderId} = ${u.id})))`),
    flagged: await db.$count(dmFlags, eq(dmFlags.userId, u.id)),
  };
}

// Accounts old enough to leave probation, least recently checked first.
export const probationDue = (registeredBefore: number, limit: number): Promise<User[]> =>
  db.select({ user: users })
    .from(users)
    .leftJoin(userTrust, eq(userTrust.userId, users.id))
    .where(and(
      isNull(userTrust.clearedAt),
      or(isNull(userTrust.held), eq(userTrust.held, false)),
      eq(users.isAdmin, false),
      eq(users.banned, false),
      lte(users.registeredAt, registeredBefore),
    ))
    .orderBy(sql`${userTrust.checkedAt} ASC NULLS FIRST`, asc(users.id))
    .limit(limit)
    .then(rows => rows.map(r => r.user));

export async function saveTrust(userId: number, row: Partial<Omit<Trust, "userId">>): Promise<void> {
  await db.insert(userTrust).values({ userId, ...row }).onConflictDoUpdate({ target: userTrust.userId, set: row });
}

export const probationSql = sql<boolean>`NOT ${users.isAdmin} AND NOT EXISTS (
  SELECT 1 FROM ${userTrust} WHERE ${userTrust.userId} = ${users.id} AND ${userTrust.clearedAt} IS NOT NULL)`;
