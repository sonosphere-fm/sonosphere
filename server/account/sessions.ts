import { and, desc, eq, gt, ne } from "drizzle-orm";
import { db } from "../db/client";
import { sessions } from "../db/schema";
import { owner } from "../guards";
import { bad, missing, Router, throttle, tokenOf } from "../http";
import { SESSION_LIFE } from "../auth/session";
import { digest, now } from "../util";
import { disconnect } from "../realtime";
import type { ActiveSessions } from "../../shared/sessions";
import type { Ok } from "../../shared/auth";

export const router = new Router({ jsonOnly: true });
router.get<ActiveSessions>("/api/me/sessions", async (c) => {
  const u = owner(c);
  const rows = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.userId, u.id), gt(sessions.createdAt, now() - SESSION_LIFE)))
    .orderBy(desc(sessions.lastSeenAt));
  return {
    items: rows.map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      ip: s.ip,
      createdAt: s.createdAt,
      lastSeenAt: s.lastSeenAt || s.createdAt,
      current: s.token === digest(tokenOf(c.req)),
    })),
  };
});
router.post<Ok>("/api/me/sessions/revoke", async (c) => {
  const u = owner(c);
  await throttle(`session-revoke:${u.id}`, 30, 300);
  const current = digest(tokenOf(c.req));
  if (c.body.others === true) {
    await db.delete(sessions).where(and(eq(sessions.userId, u.id), ne(sessions.token, current)));
  } else {
    if (typeof c.body.id !== "string" || !/^[a-f0-9]{32}$/.test(c.body.id)) bad("invalidNumber");
    const rows = await db
      .delete(sessions)
      .where(and(eq(sessions.userId, u.id), eq(sessions.id, c.body.id as string), ne(sessions.token, current)))
      .returning({ id: sessions.id });
    if (!rows.length) missing("notFound");
  }
  disconnect(u.id);
  return { ok: true };
});
