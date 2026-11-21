// Data access for the staff view of the audit log: filtering it, counting it and listing who and what appears in it.
import { and, asc, count, eq, like as likeOp, or, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { db } from "../db/client";
import { auditLog } from "../db/schema";
import { like } from "../util";
import { auditRows, auditSubject } from "../site/repo";
import type { AuditRow } from "../../shared/admin";

/** What the log is narrowed by. Empty strings mean "any". */
export type AuditFilter = {
  /** The staff member who acted (username, any case). */
  actor: string;
  /** An exact action ("user.ban") or a whole group of them ("user"). */
  action: string;
  /** The account the action concerned (username, any case). */
  subject: string;
  /** Text to look for in the label or the note. */
  term: string;
};

const contains = (column: AnyColumn, term: string) => sql`${column} LIKE ${like(term)} ESCAPE '\\'`;
function where(f: AuditFilter): SQL | undefined {
  const subject = f.subject.toLowerCase();
  return and(
    f.actor ? sql`lower(${auditLog.actorName}) = ${f.actor.toLowerCase()}` : undefined,
    f.action ? (f.action.includes(".") ? eq(auditLog.action, f.action) : likeOp(auditLog.action, `${f.action}.%`)) : undefined,
    f.subject ? or(sql`lower(${auditSubject.username}) = ${subject}`, and(eq(auditLog.targetType, "user"), sql`lower(${auditLog.targetLabel}) = ${subject}`)) : undefined,
    f.term ? or(contains(auditLog.targetLabel, f.term), contains(auditLog.note, f.term)) : undefined,
  );
}

/** Matching entries, newest first. */
export const entries = (f: AuditFilter, pg: { limit: number; offset: number }): Promise<AuditRow[]> => auditRows(where(f), pg.limit, pg.offset);
export const entryCount = async (f: AuditFilter): Promise<number> =>
  (await db.select({ c: count() }).from(auditLog).leftJoin(auditSubject, eq(auditSubject.id, auditLog.subjectId)).where(where(f)))[0]?.c ?? 0;
/** Everyone who appears in the log as the one who acted. */
export const actors = async (): Promise<string[]> =>
  (await db.selectDistinct({ n: auditLog.actorName, k: sql`lower(${auditLog.actorName})` }).from(auditLog).orderBy(sql`2`)).map(r => r.n);
/** Every kind of action in the log. */
export const actions = async (): Promise<string[]> => (await db.selectDistinct({ n: auditLog.action }).from(auditLog).orderBy(asc(auditLog.action))).map(r => r.n);
