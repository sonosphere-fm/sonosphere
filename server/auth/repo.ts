// Data access for signing in: sessions, the account lookups sign-up and log-in need, and the counts shown to the signed-in account.
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
/** Signs an account out everywhere, except on the session `keep` if given. */
export async function deleteSessionsOf(userId: number, keep = ""): Promise<void> {
  await db.delete(sessions).where(and(eq(sessions.userId, userId), ne(sessions.token, keep && digest(keep))));
}

/** The account that logs in with this (already normalised) username or email address. */
export const findByLogin = (ident: string): Promise<User | null> =>
  first(db.select().from(users).where(or(eq(users.usernameNorm, ident), eq(users.email, ident))).limit(1));

export const usernameTaken = async (username: string): Promise<boolean> =>
  !!(await first(db.select({ one: sql`1` }).from(users).where(eq(users.usernameNorm, norm(username))).limit(1)));
/** True when an account other than `exceptId` already uses this email address. */
export const emailTaken = async (email: string, exceptId = 0): Promise<boolean> =>
  !!(await first(db.select({ one: sql`1` }).from(users).where(and(eq(users.email, email), ne(users.id, exceptId))).limit(1)));

/** Adds an account and returns its id. */
export async function createUser(username: string, email: string, passwordHash: string): Promise<number> {
  const [row] = await db.insert(users).values({ username, usernameNorm: norm(username), email, passwordHash, registeredAt: now() }).returning({ id: users.id });
  if (!row) throw new Error("The new account was not stored");
  return row.id;
}

// The two counts below read other domains' tables (moderation, notifications) and should move there.
/** Reports waiting for staff. */
export const openReportCount = async (): Promise<number> =>
  (await first(db.select({ c: count() }).from(reports).where(eq(reports.status, "open"))))?.c ?? 0;
/** Notifications this account has not read yet. */
export const unreadCount = async (userId: number): Promise<number> =>
  (await first(db.select({ c: count() }).from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.read, false)))))?.c ?? 0;
