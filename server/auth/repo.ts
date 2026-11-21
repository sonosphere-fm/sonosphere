import { and, count, eq, ne, or, sql } from "drizzle-orm";
import { db } from "../db/client";
import { notifications, reports, sessions, users } from "../db/schema";
import { digest, first, norm, now } from "../util";
import type { User } from "../users/repo";

export async function createSession(token: string, userId: number): Promise<void> {
  await db.insert(sessions).values({ token: digest(token), userId, createdAt: now() });
}
export async function deleteSession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.token, digest(token)));
}
export async function deleteSessionsOf(userId: number, keep = ""): Promise<void> {
  await db.delete(sessions).where(and(eq(sessions.userId, userId), ne(sessions.token, keep && digest(keep))));
}

export const findByLogin = (ident: string): Promise<User | null> =>
  first(db.select().from(users).where(or(eq(users.usernameNorm, ident), eq(users.email, ident))).limit(1));

export async function usernameTaken(username: string): Promise<boolean> {
  const row = await first(db.select({ one: sql`1` }).from(users).where(eq(users.usernameNorm, norm(username))).limit(1));
  return !!row;
}

export async function emailTaken(email: string, exceptId = 0): Promise<boolean> {
  const row = await first(db.select({ one: sql`1` }).from(users).where(and(eq(users.email, email), ne(users.id, exceptId))).limit(1));
  return !!row;
}

export async function createUser(username: string, email: string, passwordHash: string, emailVerified = false): Promise<number> {
  const [row] = await db.insert(users).values({
    username,
    usernameNorm: norm(username),
    email,
    passwordHash,
    registeredAt: now(),
    emailVerifiedAt: emailVerified ? now() : null,
  }).returning({ id: users.id });
  if (!row) throw new Error("The new account was not stored");
  return row.id;
}

export const openReportCount = async (): Promise<number> =>
  (await first(db.select({ c: count() }).from(reports).where(eq(reports.status, "open"))))?.c ?? 0;
export async function unreadCount(userId: number): Promise<number> {
  const row = await first(db.select({ c: count() }).from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false))));
  return row?.c ?? 0;
}
