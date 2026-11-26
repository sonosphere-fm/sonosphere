import { and, asc, eq, inArray, like as likeOp, ne, or, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { db } from "../db/client";
import { auditLog, users } from "../db/schema";
import { like } from "../util";
import { auditRows, auditSubject } from "../site/repo";
import { AUTOMATIC_ACTOR, RUN_GAP, type AuditRow } from "../../shared/admin";

// Empty strings mean "any". `action` is an exact action ("user.ban") or a group ("user").
// Automatic entries are left out unless `automatic` is set or an actor is picked.
export type AuditFilter = { actor: string; action: string; subject: string; term: string; automatic: boolean };

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
    f.automatic || f.actor ? undefined : ne(auditLog.actorName, AUTOMATIC_ACTOR),
    action,
    f.subject ? bySubject : undefined,
    f.term ? or(contains(auditLog.targetLabel, f.term), contains(auditLog.note, f.term)) : undefined
  );
}

// Pages count runs (see sameRun), so a run is never split and every page shows as many lines.
export async function entries(
  f: AuditFilter,
  pg: { limit: number; offset: number }
): Promise<{ items: AuditRow[]; total: number }> {
  const rows = await db.execute<{ id: number | null; runs: number }>(sql`
    with t as (
      select ${auditLog.id} as id, ${auditLog.createdAt} as at,
        case when lag(${auditLog.actorName}) over w = ${auditLog.actorName}
          and lag(${auditLog.action}) over w = ${auditLog.action}
          and lag(${auditLog.note}) over w = ${auditLog.note}
          and lag(${auditLog.createdAt}) over w - ${auditLog.createdAt} <= ${RUN_GAP}
        then 0 else 1 end as starts
      from ${auditLog}
      left join ${users} ${auditSubject} on ${auditSubject.id} = ${auditLog.subjectId}
      ${where(f) ? sql`where ${where(f)}` : sql``}
      window w as (order by ${auditLog.createdAt} desc, ${auditLog.id} desc)
    ), r as (
      select id, (sum(starts) over (order by at desc, id desc))::int - 1 as run from t
    )
    select r.id, n.runs from (select (coalesce(max(run), -1) + 1)::int as runs from r) n
    left join r on r.run >= ${pg.offset} and r.run < ${pg.offset + pg.limit}
  `);
  const ids = rows.flatMap((r) => (r.id === null ? [] : [r.id]));
  const items = ids.length ? await auditRows(inArray(auditLog.id, ids), ids.length, 0) : [];
  return { items, total: rows[0]!.runs };
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
