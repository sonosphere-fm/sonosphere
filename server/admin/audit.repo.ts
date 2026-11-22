import { and, asc, count, eq, like as likeOp, or, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { db } from "../db/client";
import { auditLog } from "../db/schema";
import { like } from "../util";
import { auditRows, auditSubject } from "../site/repo";
import type { AuditRow } from "../../shared/admin";

// Empty strings mean "any". `action` is an exact action ("user.ban") or a group ("user").
export type AuditFilter = { actor: string; action: string; subject: string; term: string };

const contains = (column: AnyColumn, term: string) => sql`${column} LIKE ${like(term)} ESCAPE '\\'`;

function where(f: AuditFilter): SQL | undefined {
  const subject = f.subject.toLowerCase();
  let action: SQL | undefined;
  if (f.action)
    action = f.action.includes(".") ? eq(auditLog.action, f.action) : likeOp(auditLog.action, `${f.action}.%`);
  const bySubject = or(
    sql`lower(${auditSubject.username}) = ${subject}`,
    and(eq(auditLog.targetType, "user"), sql`lower(${auditLog.targetLabel}) = ${subject}`)
  );
  return and(
    f.actor ? sql`lower(${auditLog.actorName}) = ${f.actor.toLowerCase()}` : undefined,
    action,
    f.subject ? bySubject : undefined,
    f.term ? or(contains(auditLog.targetLabel, f.term), contains(auditLog.note, f.term)) : undefined
  );
}

export const entries = (f: AuditFilter, pg: { limit: number; offset: number }): Promise<AuditRow[]> =>
  auditRows(where(f), pg.limit, pg.offset);

export async function entryCount(f: AuditFilter): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(auditLog)
    .leftJoin(auditSubject, eq(auditSubject.id, auditLog.subjectId))
    .where(where(f));
  return row?.c ?? 0;
}

export async function actors(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ n: auditLog.actorName, k: sql`lower(${auditLog.actorName})` })
    .from(auditLog)
    .orderBy(sql`2`);
  return rows.map((r) => r.n);
}

export async function actions(): Promise<string[]> {
  const rows = await db.selectDistinct({ n: auditLog.action }).from(auditLog).orderBy(asc(auditLog.action));
  return rows.map((r) => r.n);
}
