// Data access for the report queue of the staff API: listing reports with their counts, and resolving them
// (dismiss, remove the content, suspend or mute its author), which closes every open report about the same thing.
import { and, count, desc, eq, ne, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, transact, type Tx } from "../db/client";
import { dmMessages, reports, users } from "../db/schema";
import { bad } from "../http";
import { first } from "../util";
import type { User } from "../users/repo";
import { checkCanAct } from "./common";
import { closeReportsTx, removeContentTx, reportTargetTx, snapshotOf } from "../moderation/repo";
import { auditTx } from "../site/audit";
import { announceRemoved } from "../dm/service";
import type { Removed } from "../dm/repo";

export type ReportRow = typeof reports.$inferSelect;
export type ReportStatus = "open" | "closed" | "all";
export type ReportFilter = { status: ReportStatus; type: string | null; reason: string | null };

const inStatus = (status: ReportStatus): SQL | undefined => (status === "all" ? undefined : eq(reports.status, status));

/** One page of the queue (closed reports by when they were resolved, otherwise by when they were filed), plus how many match. */
export async function listReports(f: ReportFilter, limit: number, offset: number): Promise<{ rows: (ReportRow & { reporter: string | null; resolver: string | null })[]; total: number }> {
  const reporter = alias(users, "reporter"), resolver = alias(users, "resolver");
  const where = and(inStatus(f.status), f.type ? eq(reports.targetType, f.type) : undefined, f.reason ? eq(reports.reason, f.reason) : undefined);
  const rows = await db.select({ report: reports, reporter: reporter.username, resolver: resolver.username }).from(reports)
    .leftJoin(reporter, eq(reporter.id, reports.reporterId)).leftJoin(resolver, eq(resolver.id, reports.resolvedBy))
    .where(where).orderBy(desc(f.status === "closed" ? reports.resolvedAt : reports.createdAt), desc(reports.id)).limit(limit).offset(offset);
  return { rows: rows.map(r => ({ ...r.report, reporter: r.reporter, resolver: r.resolver })), total: await db.$count(reports, where) };
}
/** How many reports with the given status there are for each target type or each reason. */
export async function facet(status: ReportStatus, by: "type" | "reason"): Promise<Record<string, number>> {
  const column = by === "type" ? reports.targetType : reports.reason;
  const rows = await db.select({ k: column, c: count() }).from(reports).where(inStatus(status)).groupBy(column);
  return Object.fromEntries(rows.map(r => [r.k, r.c]));
}
export const openCount = (): Promise<number> => db.$count(reports, eq(reports.status, "open"));
/** Other open reports about the same thing. */
export const otherOpen = (r: ReportRow): Promise<number> =>
  db.$count(reports, and(eq(reports.status, "open"), eq(reports.targetType, r.targetType), eq(reports.targetId, r.targetId), ne(reports.id, r.id)));
/** True when a direct message has been removed (it still exists for staff). */
export const messageRemoved = async (id: number): Promise<boolean> =>
  !!(await first(db.select({ deletedAt: dmMessages.deletedAt }).from(dmMessages).where(eq(dmMessages.id, id)).limit(1)))?.deletedAt;
export const findReport = (id: number): Promise<ReportRow | null> => first(db.select().from(reports).where(eq(reports.id, id)).limit(1));

// ---------- resolving ----------
export type Decision = "dismiss" | "remove" | "suspend" | "mute";
const OUTCOME: Record<Decision, string> = { dismiss: "dismissed", remove: "content removed", suspend: "author suspended", mute: "author muted" };

/**
 * Carries out a decision on one report and closes every open report about the same thing; returns how many that was.
 * Anything but a dismissal also removes the content if it still exists. A removed direct message is added to
 * `removed`, so both people's open tabs can be told once the transaction commits.
 */
async function decideTx(tx: Tx, me: User, r: ReportRow, action: Decision, why: string, configured: string[], removed: Removed[]): Promise<number> {
  const t = (await reportTargetTx(tx, r.targetType, r.targetId));
  const author = t?.authorId ? (await tx.select().from(users).where(eq(users.id, t.authorId)))[0] ?? null : null;
  if (action !== "dismiss" && t) {
    if (action === "suspend") {
      if (!author) return bad("The author's account no longer exists");
      checkCanAct(me, author, "suspend", configured);
      await tx.update(users).set({ suspended: true }).where(eq(users.id, author.id));
      await auditTx(tx, me, { action: "user.suspend", targetType: "user", targetId: author.id, label: author.username, subjectId: author.id, note: why || `From report #${r.id}` });
    }
    if (action === "mute") {
      if (r.targetType !== "dm") bad("Muting is only for reported messages");
      if (!author) return bad("The author's account no longer exists");
      checkCanAct(me, author, "mute", configured);
      await tx.update(users).set({ dmMuted: true }).where(eq(users.id, author.id));
      await auditTx(tx, me, { action: "dm.mute", targetType: "user", targetId: author.id, label: author.username, subjectId: author.id, note: why || `From report #${r.id}` });
    }
    if (r.targetType === "user" && action === "remove") bad("A profile can't be removed: suspend the account or dismiss the report");
    const gone = (await removeContentTx(tx, r.targetType, r.targetId, me.id));
    if (gone) removed.push(gone);
  }
  const closed = (await closeReportsTx(tx, r.targetType, r.targetId, OUTCOME[action], me.id, why));
  await auditTx(tx, me, {
    action: `report.${action}`, targetType: r.targetType, targetId: r.targetId, label: (t?.where ?? snapshotOf(r.snapshot).where ?? "") + (t?.author ? ` by ${t.author}` : ""),
    subjectId: author?.id ?? null, note: why, data: { report: r.id, closed, reason: r.reason },
  });
  return closed;
}

/** Resolves one report, all or nothing. `configured` is the list from configAdmins(). Returns how many reports it closed. */
export async function resolve(me: User, r: ReportRow, action: Decision, why: string, configured: string[]): Promise<number> {
  const removed: Removed[] = [];
  const closed = (await transact(async tx => (await decideTx(tx, me, r, action, why, configured, removed))));
  await announceRemoved(removed);
  return closed;
}
/** Dismisses each of the given reports that is still open, all or nothing. Returns how many reports were closed. */
export async function dismissAll(me: User, ids: number[], why: string): Promise<number> {
  return (await transact(async tx => {
    let closed = 0;
    for (const id of ids) {
      const r = (await tx.select().from(reports).where(and(eq(reports.id, id), eq(reports.status, "open"))))[0];
      if (r) closed += (await decideTx(tx, me, r, "dismiss", why, [], []));
    }
    return closed;
  }));
}
