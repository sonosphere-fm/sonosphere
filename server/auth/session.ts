import { and, eq, gt } from "drizzle-orm";
import { db } from "../db/client";
import { sessions, users } from "../db/schema";
import { digest, now } from "../util";
import { isAdmin, isStaff } from "../site/roles";
import { findById, type User } from "../users/repo";
import { SITE_URL } from "../mail";

const cookieOf = (req: Request, name: string) =>
  new RegExp(`(?:^|;\\s*)${name}=([^;]*)`).exec(req.headers.get("cookie") || "")?.[1] ?? "";
export const hexCookie = (req: Request, name: string) => {
  const v = cookieOf(req, name);
  return /^[a-f0-9]+$/.test(v) ? v : "";
};
export const tokenOf = (req: Request) => hexCookie(req, "sid");
const actAsOf = (req: Request) => Number(cookieOf(req, "act_as")) || null;

export async function sessionUser(token: string) {
  if (!token) return null;
  const [row] = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(eq(sessions.token, digest(token)), eq(users.banned, false), gt(sessions.createdAt, now() - SESSION_LIFE))
    )
    .limit(1);
  return row?.user ?? null;
}

// local development runs over plain http, where a Secure cookie would never be sent back
export const HTTPS = SITE_URL.startsWith("https:");
export const SECURE = HTTPS ? "; Secure" : "";

export const SESSION_LIFE = 60 * 60 * 24 * 365;
export const sessionCookie = (token: string, maxAge = SESSION_LIFE) =>
  `sid=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${SECURE}`;
export const actAsCookie = (id: number) => `act_as=${id}; Path=/; HttpOnly; SameSite=Lax${SECURE}`;
export const clearActAsCookie = () => `act_as=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${SECURE}`;

export const impersonating = (user: User | null, actor: User | null) => !!user && !!actor && user.id !== actor.id;

export async function viewerOf(req: Request): Promise<{ user: User | null; actor: User | null }> {
  const actor = await sessionUser(tokenOf(req));
  const id = actAsOf(req);
  if (!actor || !id || !isAdmin(actor) || id === actor.id) return { user: actor, actor };
  const target = await findById(id);
  return { user: target && !target.banned && !isStaff(target) ? target : actor, actor };
}
