import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { sessions, users } from "../db/schema";
import { digest } from "../util";

export async function sessionUser(token: string) {
  if (!token) return null;
  const [row] = await db.select({ user: users }).from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.token, digest(token)), eq(users.banned, false)))
    .limit(1);
  return row?.user ?? null;
}

const YEAR = 60 * 60 * 24 * 365;
export const sessionCookie = (token: string, maxAge = YEAR) => `sid=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
