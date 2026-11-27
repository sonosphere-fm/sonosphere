import { and, count, desc, eq, isNotNull, min, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../db/client";
import { invites, userArtists, users } from "../db/schema";
import { first, now } from "../util";
import { findById, publicCols, publicUser } from "../users/repo";
import type { InviteLeader } from "../../shared/invites";

const invitee = alias(users, "invitee");

// Only accounts someone actually uses count, so a pile of throwaway sign-ups climbs nothing.
const counted = and(
  eq(invitee.banned, false),
  eq(invitee.suspended, false),
  isNotNull(invitee.emailVerifiedAt),
  sql`EXISTS (SELECT 1 FROM ${userArtists} WHERE ${userArtists.userId} = ${invitee.id})`
);

const tallies = () =>
  db
    .select({ inviterId: invites.inviterId, n: count().as("n"), since: min(invites.createdAt).as("since") })
    .from(invites)
    .innerJoin(invitee, eq(invitee.id, invites.userId))
    .where(counted)
    .groupBy(invites.inviterId)
    .as("t");

export async function credit(userId: number, inviterId: number) {
  const inviter = await findById(inviterId);
  if (!inviter || inviter.banned || inviter.id === userId) return;
  await db.insert(invites).values({ userId, inviterId, createdAt: now() }).onConflictDoNothing();
}

export async function inviteCount(inviterId: number): Promise<number> {
  const row = await first(
    db
      .select({ n: count() })
      .from(invites)
      .innerJoin(invitee, eq(invitee.id, invites.userId))
      .where(and(eq(invites.inviterId, inviterId), counted))
  );
  return row?.n ?? 0;
}

export async function leaders(limit: number): Promise<InviteLeader[]> {
  const t = tallies();
  const rows = await db
    .select({ ...publicCols, invited: t.n })
    .from(t)
    .innerJoin(users, eq(users.id, t.inviterId))
    .where(and(eq(users.banned, false), eq(users.suspended, false)))
    .orderBy(desc(t.n), t.since)
    .limit(limit);
  return rows.map((r) => ({ ...publicUser(r), invited: r.invited }));
}

export async function inviteCounts(): Promise<Map<number, number>> {
  const t = tallies();
  const rows = await db.select({ inviterId: t.inviterId, n: t.n }).from(t);
  return new Map(rows.map((r) => [r.inviterId, r.n]));
}

export async function inviterNames(): Promise<{ name: string; invited: number }[]> {
  const t = tallies();
  return db
    .select({ name: users.username, invited: t.n })
    .from(t)
    .innerJoin(users, eq(users.id, t.inviterId))
    .where(and(eq(users.banned, false), eq(users.suspended, false)));
}
