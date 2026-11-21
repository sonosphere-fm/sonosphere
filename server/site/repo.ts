import { and, count, desc, eq, ne, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, transact, type Conn } from "../db/client";
import { auditLog, meta, siteSettings, users } from "../db/schema";
import { first } from "../util";
import type { Role } from "../../shared/site";
import type { AuditRow } from "../../shared/admin";

export async function metaValue(key: string): Promise<string | null> {
  const row = await first(db.select({ value: meta.value }).from(meta).where(eq(meta.key, key)).limit(1));
  return row?.value ?? null;
}

// users.is_admin is the "is staff" flag; users.role says which kind.
export async function setRole(userId: number, role: Role): Promise<void> {
  await db.update(users).set({ isAdmin: role !== "user", role }).where(eq(users.id, userId));
}

export async function adminCount(): Promise<number> {
  const row = await first(db.select({ c: count() }).from(users)
    .where(and(eq(users.isAdmin, true), ne(users.role, "moderator"), eq(users.banned, false))));
  return row?.c ?? 0;
}

// Takes normalised usernames.
export async function promote(usernames: string[]): Promise<void> {
  for (const name of usernames) await db.update(users).set({ isAdmin: true }).where(eq(users.usernameNorm, name));
}

export const storedSettings = (): Promise<{ key: string; value: string }[]> => db.select().from(siteSettings);

export async function storeSettings(entries: [key: string, value: string][]): Promise<void> {
  await transact(async tx => {
    for (const [key, value] of entries) {
      await tx.insert(siteSettings).values({ key, value }).onConflictDoUpdate({ target: siteSettings.key, set: { value } });
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
  const rows = await db.select({
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
  return rows.map(a => ({ ...a, data: parseObject(a.data) }));
}
