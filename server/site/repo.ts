// Data access for site administration: staff flags, stored settings, the audit log and the import marker.
import { and, count, desc, eq, ne, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, transact, type Conn } from "../db/client";
import { auditLog, meta, siteSettings, users } from "../db/schema";
import { first } from "../util";
import type { Role } from "../../shared/site";
import type { AuditRow } from "../../shared/admin";

/** A value from the key/value `meta` table, or null. */
export const metaValue = async (key: string): Promise<string | null> =>
  (await first(db.select({ value: meta.value }).from(meta).where(eq(meta.key, key)).limit(1)))?.value ?? null;

// users.is_admin is the "is staff" flag; users.role says which kind.
export async function setRole(userId: number, role: Role): Promise<void> {
  await db.update(users).set({ isAdmin: role !== "user", role }).where(eq(users.id, userId));
}
/** How many admins (not moderators, not banned) there are. */
export const adminCount = async (): Promise<number> =>
  (await first(db.select({ c: count() }).from(users).where(and(eq(users.isAdmin, true), ne(users.role, "moderator"), eq(users.banned, false)))))?.c ?? 0;
/** Flags the accounts with these normalised usernames as staff. */
export async function promote(usernames: string[]): Promise<void> {
  for (const name of usernames) await db.update(users).set({ isAdmin: true }).where(eq(users.usernameNorm, name));
}

/** Every stored setting as its key and JSON text. */
export const storedSettings = (): Promise<{ key: string; value: string }[]> => db.select().from(siteSettings);
/** Writes settings (key and JSON text), replacing any stored value, all or nothing. */
export async function storeSettings(entries: [key: string, value: string][]): Promise<void> {
  await transact(async tx => {
    for (const [key, value] of entries) await tx.insert(siteSettings).values({ key, value }).onConflictDoUpdate({ target: siteSettings.key, set: { value } });
  });
}

export async function insertAudit(row: typeof auditLog.$inferInsert): Promise<void> {
  await db.insert(auditLog).values(row);
}
/** As insertAudit, inside a transaction. */
export async function insertAuditTx(conn: Conn, row: typeof auditLog.$inferInsert): Promise<void> {
  await conn.insert(auditLog).values(row);
}

/** JSON text from the database as an object; anything unreadable is an empty object. */
export function parseObject(json: string | null): Record<string, unknown> {
  try { const v: unknown = JSON.parse(json || "{}"); return v && typeof v === "object" && !Array.isArray(v) ? { ...v } : {}; } catch { return {}; }
}
/** The account an audit entry concerns, as joined by `auditRows`. Conditions passed to it may refer to this. */
export const auditSubject = alias(users, "audit_subject");
/** Audit entries, newest first, with the username of the account each concerns. */
export async function auditRows(where: SQL | undefined, limit: number, offset: number): Promise<AuditRow[]> {
  const rows = await db.select({
    id: auditLog.id, actor: auditLog.actorName, action: auditLog.action, targetType: auditLog.targetType, targetId: auditLog.targetId, label: auditLog.targetLabel,
    subject: auditSubject.username, note: auditLog.note, data: auditLog.data, createdAt: auditLog.createdAt,
  }).from(auditLog).leftJoin(auditSubject, eq(auditSubject.id, auditLog.subjectId)).where(where).orderBy(desc(auditLog.createdAt), desc(auditLog.id)).limit(limit).offset(offset);
  return rows.map(a => ({ ...a, data: parseObject(a.data) }));
}
