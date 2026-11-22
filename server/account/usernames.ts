import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import type { UsernameStatus } from "../../shared/account";
import { db, transact, type Conn } from "../db/client";
import { usernameHistory, users } from "../db/schema";
import { bad, fail, missing } from "../http";
import { auditTx } from "../site/audit";
import { first, norm, now } from "../util";
import { canUndoUsername, USERNAME, USERNAME_COOLDOWN, USERNAME_RESERVATION } from "./username-policy";

// Registration and renames share a lock: current names and unexpired aliases form one namespace.
export const lockUsernameClaims = (conn: Conn) => conn.execute(sql`SELECT pg_advisory_xact_lock(727002)`);

const reservation = (name: string, at: number) =>
  and(
    eq(usernameHistory.previousNorm, norm(name)),
    gt(usernameHistory.reservedUntil, at),
    isNull(usernameHistory.releasedAt)
  );

export async function usernameUnavailable(name: string, conn: Conn = db, at = now()) {
  const current = await first(
    conn
      .select({ id: users.id })
      .from(users)
      .where(eq(users.usernameNorm, norm(name)))
      .limit(1)
  );
  if (current) return true;
  return !!(await first(
    conn.select({ id: usernameHistory.id }).from(usernameHistory).where(reservation(name, at)).limit(1)
  ));
}

export async function aliasUser(name: string) {
  const row = await first(
    db
      .select({ user: users })
      .from(usernameHistory)
      .innerJoin(users, eq(users.id, usernameHistory.userId))
      .where(reservation(name, now()))
      .orderBy(desc(usernameHistory.id))
      .limit(1)
  );
  return row?.user ?? null;
}

const latestChange = (conn: Conn, id: number) =>
  first(
    conn.select().from(usernameHistory).where(eq(usernameHistory.userId, id)).orderBy(desc(usernameHistory.id)).limit(1)
  );

export async function usernameStatus(userId: number): Promise<UsernameStatus> {
  const user = (await first(db.select().from(users).where(eq(users.id, userId)).limit(1))) ?? missing("User");
  const latest = await latestChange(db, userId);
  return {
    username: user.username,
    changeAfter: user.usernameChangeAfter,
    undo:
      canUndoUsername(latest, now()) && latest ? { username: latest.previous, expiresAt: latest.reservedUntil } : null,
  };
}

export async function changeUsername(
  userId: number,
  actor: { id: number; username: string },
  requested: unknown,
  undo = false
) {
  return transact(async (tx) => {
    await lockUsernameClaims(tx);
    const user = (await first(tx.select().from(users).where(eq(users.id, userId)).for("update"))) ?? missing("User");
    const at = now();
    const latest = await latestChange(tx, userId);
    let next: string;
    if (undo) {
      if (!canUndoUsername(latest, at) || !latest) return bad("This username change can no longer be undone");
      next = latest.previous;
      await tx.update(usernameHistory).set({ releasedAt: at, undoneAt: at }).where(eq(usernameHistory.id, latest.id));
    } else {
      if (user.usernameChangeAfter > at) return fail(429, "You can change your username once every 7 days");
      if (typeof requested !== "string" || !USERNAME.test(requested))
        return bad("Usernames are 2–15 characters: letters, numbers, - and _, starting with a letter");
      next = requested;
    }
    if (norm(next) === user.usernameNorm) return bad("Choose a different username");
    if (await usernameUnavailable(next, tx, at)) return bad("That username is taken or temporarily reserved");

    await tx.insert(usernameHistory).values({
      userId,
      previous: user.username,
      previousNorm: user.usernameNorm,
      next,
      createdAt: at,
      reservedUntil: at + USERNAME_RESERVATION,
      isUndo: undo,
    });
    const [updated] = await tx
      .update(users)
      .set({ username: next, usernameNorm: norm(next), usernameChangeAfter: at + USERNAME_COOLDOWN })
      .where(eq(users.id, userId))
      .returning();
    await auditTx(tx, actor, {
      action: undo ? "user.username.undo" : "user.username.change",
      targetType: "user",
      targetId: userId,
      subjectId: userId,
      label: next,
      data: { previous: user.username, next },
    });
    return updated!;
  });
}
