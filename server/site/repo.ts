import { and, count, desc, eq, inArray, ne, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, transact, type Conn } from "../db/client";
import { auditLog, meta, siteSettings, usernameHistory, users } from "../db/schema";
import { first } from "../util";
import type { Role } from "../../shared/site";
import type { AuditRow } from "../../shared/admin";

export async function metaValue(key: string): Promise<string | null> {
  const row = await first(db.select({ value: meta.value }).from(meta).where(eq(meta.key, key)).limit(1));
  return row?.value ?? null;
}

// users.is_admin is the "is staff" flag; users.role says which kind.
export async function setRole(userId: number, role: Role): Promise<void> {
  await db
    .update(users)
    .set({ isAdmin: role !== "user", role })
    .where(eq(users.id, userId));
}

export async function adminCount(): Promise<number> {
  const row = await first(
    db
      .select({ c: count() })
      .from(users)
      .where(and(eq(users.isAdmin, true), ne(users.role, "moderator"), eq(users.banned, false)))
  );
  return row?.c ?? 0;
}

const ADMIN_CLAIMS = "config_admins";

const userById = (conn: Conn, id: unknown) =>
  typeof id === "number"
    ? first(conn.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1))
    : Promise.resolve(undefined);

// Staff who renamed away from a configured name before claims were recorded.
const renamedStaff = (conn: Conn, name: string) =>
  first(
    conn
      .select({ id: usernameHistory.userId })
      .from(usernameHistory)
      .innerJoin(users, eq(users.id, usernameHistory.userId))
      .where(and(eq(usernameHistory.previousNorm, name), eq(users.isAdmin, true)))
      .orderBy(usernameHistory.id)
      .limit(1)
  );

const holderOf = (conn: Conn, name: string) =>
  first(conn.select({ id: users.id }).from(users).where(eq(users.usernameNorm, name)).limit(1));

// A configured name belongs to the account that held it when first seen, by id, so renames never move it.
// Takes normalised usernames; returns name to user id for the names an account has claimed.
export async function claimAdmins(names: string[], conn: Conn = db): Promise<Map<string, number>> {
  const row = await first(conn.select({ value: meta.value }).from(meta).where(eq(meta.key, ADMIN_CLAIMS)).limit(1));
  const stored = parseObject(row?.value ?? null);
  const claims = new Map<string, number>();
  let changed = false;
  for (const name of names) {
    const kept = await userById(conn, stored[name]);
    const found = kept ?? (await renamedStaff(conn, name)) ?? (await holderOf(conn, name));
    if (!found) continue;
    claims.set(name, found.id);
    if (!kept) changed = true;
  }
  if (changed) {
    const value = JSON.stringify({ ...stored, ...Object.fromEntries(claims) });
    await conn
      .insert(meta)
      .values({ key: ADMIN_CLAIMS, value })
      .onConflictDoUpdate({ target: meta.key, set: { value } });
  }
  return claims;
}

export async function promote(ids: number[]): Promise<void> {
  if (ids.length) await db.update(users).set({ isAdmin: true }).where(inArray(users.id, ids));
}

export const storedSettings = (): Promise<{ key: string; value: string }[]> => db.select().from(siteSettings);

export async function storeSettings(entries: [key: string, value: string][]): Promise<void> {
  await transact(async (tx) => {
    for (const [key, value] of entries) {
      await tx
        .insert(siteSettings)
        .values({ key, value })
        .onConflictDoUpdate({ target: siteSettings.key, set: { value } });
    }
  });
}

export async function insertAudit(row: typeof auditLog.$inferInsert): Promise<void> {
  await db.insert(auditLog).values(row);
}

export async function insertAuditTx(conn: Conn, row: typeof auditLog.$inferInsert): Promise<void> {
  await conn.insert(auditLog).values(row);
}

// Anything unreadable is an empty object.
export function parseObject(json: string | null): Record<string, unknown> {
  try {
    const v: unknown = JSON.parse(json || "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? { ...v } : {};
  } catch {
    return {};
  }
}

// Joined by `auditRows`; conditions passed to it may refer to this.
export const auditSubject = alias(users, "audit_subject");

export async function auditRows(where: SQL | undefined, limit: number, offset: number): Promise<AuditRow[]> {
  const rows = await db
    .select({
      id: auditLog.id,
      actor: auditLog.actorName,
      action: auditLog.action,
      targetType: auditLog.targetType,
      targetId: auditLog.targetId,
      label: auditLog.targetLabel,
      subject: auditSubject.username,
      note: auditLog.note,
      data: auditLog.data,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .leftJoin(auditSubject, eq(auditSubject.id, auditLog.subjectId))
    .where(where)
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
    .limit(limit)
    .offset(offset);
  return rows.map((a) => ({ ...a, data: parseObject(a.data) }));
}
