import { and, desc, eq, gt, isNull, ne, sql } from "drizzle-orm";
import type { UsernameStatus } from "../../shared/account";
import { db, transact, type Conn } from "../db/client";
import { usernameHistory, users } from "../db/schema";
import { bad, fail, missing } from "../http";
import { auditTx } from "../site/audit";
import { configAdminClaims, configAdmins } from "../site/roles";
import { first, norm, now } from "../util";
import { shortestUsername } from "../../shared/invites";
import { inviteCount } from "../invites/repo";
import { canUndoUsername, checkUsername, USERNAME_COOLDOWN, USERNAME_RESERVATION } from "./username-policy";

// Registration and renames share a lock: current names and unexpired aliases form one namespace.
export const lockUsernameClaims = (conn: Conn) => conn.execute(sql`SELECT pg_advisory_xact_lock(727002)`);

const reservation = (name: string, at: number) =>
  and(
    eq(usernameHistory.previousNorm, norm(name)),
    gt(usernameHistory.reservedUntil, at),
    isNull(usernameHistory.releasedAt)
  );

// A user's own name and reserved names stay open to them.
export async function usernameUnavailable(name: string, conn: Conn = db, at = now(), self?: number) {
  const others = (column: typeof users.id | typeof usernameHistory.userId) =>
    self === undefined ? undefined : ne(column, self);
  const current = await first(
    conn
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.usernameNorm, norm(name)), others(users.id)))
      .limit(1)
  );
  if (current) return true;
  return !!(await first(
    conn
      .select({ id: usernameHistory.id })
      .from(usernameHistory)
      .where(and(reservation(name, at), others(usernameHistory.userId)))
      .limit(1)
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

// ADMIN_USERS grants staff by name, so only the account already holding a configured name may rename into it.
async function adminNameOfOther(name: string, userId: number, conn: Conn) {
  if (!(await configAdmins()).includes(norm(name))) return false;
  return (await configAdminClaims(conn)).get(norm(name)) !== userId;
}

const latestChange = (conn: Conn, id: number) =>
  first(
    conn.select().from(usernameHistory).where(eq(usernameHistory.userId, id)).orderBy(desc(usernameHistory.id)).limit(1)
  );

export async function usernameStatus(userId: number): Promise<UsernameStatus> {
  const user = (await first(db.select().from(users).where(eq(users.id, userId)).limit(1))) ?? missing("userNotFound");
  const latest = await latestChange(db, userId);
  return {
    username: user.username,
    changeAfter: user.usernameChangeAfter,
    shortest: shortestUsername(await inviteCount(userId)),
    undo:
      canUndoUsername(latest, now()) && latest ? { username: latest.previous, expiresAt: latest.reservedUntil } : null,
  };
}

export async function changeUsername(
  userId: number,
  actor: { id: number; username: string },
  requested: unknown,
  undo = false,
  adminOverride = false,
  note = ""
) {
  return transact(async (tx) => {
    await lockUsernameClaims(tx);
    const user =
      (await first(tx.select().from(users).where(eq(users.id, userId)).for("update"))) ?? missing("userNotFound");
    const at = now();
    const latest = await latestChange(tx, userId);
    let next: string;
    if (undo) {
      if (!canUndoUsername(latest, at) || !latest) return bad("usernameChangeNoLongerUndone");
      next = latest.previous;
      await tx.update(usernameHistory).set({ releasedAt: at, undoneAt: at }).where(eq(usernameHistory.id, latest.id));
    } else {
      if (!adminOverride && user.usernameChangeAfter > at) return fail(429, "changeUsernameOnceEvery7");
      checkUsername(requested, adminOverride ? 1 : shortestUsername(await inviteCount(userId)));
      next = requested;
    }
    if (next === user.username) return bad("chooseDifferentUsername");
    if (await usernameUnavailable(next, tx, at, userId)) return bad("usernameTakenTemporarilyReserved");
    if (await adminNameOfOther(next, userId, tx)) return bad("usernameTakenTemporarilyReserved");

    await tx
      .update(usernameHistory)
      .set({ releasedAt: at })
      .where(and(reservation(next, at), eq(usernameHistory.userId, userId)));
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
      note,
    });
    return updated!;
  });
}

export async function heldUsernames(userId: number) {
  return db
    .select({ username: usernameHistory.previous, expiresAt: usernameHistory.reservedUntil })
    .from(usernameHistory)
    .where(
      and(
        eq(usernameHistory.userId, userId),
        gt(usernameHistory.reservedUntil, now()),
        isNull(usernameHistory.releasedAt)
      )
    );
}

export async function manageUsernames(
  userId: number,
  actor: { id: number; username: string },
  action: "release" | "cooldown",
  note: string
) {
  return transact(async (tx) => {
    await lockUsernameClaims(tx);
    const user =
      (await first(tx.select().from(users).where(eq(users.id, userId)).for("update"))) ?? missing("userNotFound");
    const at = now();
    let released: string[] = [];
    if (action === "release") {
      const rows = await tx
        .update(usernameHistory)
        .set({ releasedAt: at })
        .where(
          and(
            eq(usernameHistory.userId, userId),
            gt(usernameHistory.reservedUntil, at),
            isNull(usernameHistory.releasedAt)
          )
        )
        .returning({ username: usernameHistory.previous });
      released = rows.map((row) => row.username);
    } else {
      await tx.update(users).set({ usernameChangeAfter: 0 }).where(eq(users.id, userId));
    }
    await auditTx(tx, actor, {
      action: `user.username.${action}`,
      targetType: "user",
      targetId: userId,
      subjectId: userId,
      label: user.username,
      note,
      data: action === "release" ? { released } : { previous: user.usernameChangeAfter },
    });
  });
}
