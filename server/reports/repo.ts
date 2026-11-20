// Data access for reports of content, and for the moderation queue built from them.
import { and, count, desc, eq, gt, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { db, transact } from "../db/client";
import { reports, users } from "../db/schema";
import type { Removed } from "../dm/repo";
import { closeReportsTx, removeContentTx } from "../moderation/repo";
import { auditTx, type AuditEntry } from "../site/audit";
import { publicCols } from "../users/repo";
import { first, now } from "../util";
import type { PublicUser } from "../../shared/users";

export type Report = typeof reports.$inferSelect;
/** A report with the usernames of who filed it and who settled it (null when unsettled or the account is gone). */
export type QueuedReport = Report & { reporter: string | null; resolver: string | null };

const total = async (rows: PromiseLike<{ c: number }[]>) => (await rows)[0]?.c ?? 0;
/** Open reports, or every report that is not. */
const inState = (open: boolean) => (open ? eq(reports.status, "open") : ne(reports.status, "open"));

// ---------- filing ----------
/** How many reports someone has filed since a time. */
export const filedSince = (reporterId: number, since: number): Promise<number> =>
  total(db.select({ c: count() }).from(reports).where(and(eq(reports.reporterId, reporterId), gt(reports.createdAt, since))));

/** The id of someone's report of a thing that is still open, or null. */
export const openReportBy = async (reporterId: number, targetType: string, targetId: number): Promise<number | null> =>
  (await first(db.select({ id: reports.id }).from(reports)
    .where(and(eq(reports.reporterId, reporterId), eq(reports.targetType, targetType), eq(reports.targetId, targetId), eq(reports.status, "open"))).limit(1)))?.id ?? null;

export type Filing = { reason: string; detail: string; snapshot: string };
export async function addReport(reporterId: number, targetType: string, targetId: number, filing: Filing): Promise<void> {
  await db.insert(reports).values({ reporterId, targetType, targetId, ...filing, createdAt: now() });
}
export async function amendReport(id: number, filing: Filing): Promise<void> {
  await db.update(reports).set(filing).where(eq(reports.id, id));
}

// ---------- the queue ----------
export const findReport = (id: number): Promise<Report | null> => first(db.select().from(reports).where(eq(reports.id, id)).limit(1));

/** One page of open reports (newest first) or of settled ones (most recently settled first). */
export async function reportQueue(open: boolean, limit: number, offset: number): Promise<QueuedReport[]> {
  const reporter = alias(users, "u"), resolver = alias(users, "m");
  const rows = await db.select({ report: reports, reporter: reporter.username, resolver: resolver.username }).from(reports)
    .leftJoin(reporter, eq(reporter.id, reports.reporterId)).leftJoin(resolver, eq(resolver.id, reports.resolvedBy))
    .where(inState(open)).orderBy(desc(open ? reports.createdAt : reports.resolvedAt)).limit(limit).offset(offset);
  return rows.map(r => ({ ...r.report, reporter: r.reporter, resolver: r.resolver }));
}
export const reportCount = (open: boolean): Promise<number> => total(db.select({ c: count() }).from(reports).where(inState(open)));

/** Every account that is suspended from posting, by name. */
export const suspendedUsers = (): Promise<PublicUser[]> => db.select(publicCols).from(users).where(eq(users.suspended, true)).orderBy(users.usernameNorm);

// ---------- acting on reports ----------
export async function setSuspended(userId: number, suspended: boolean): Promise<void> {
  await db.update(users).set({ suspended }).where(eq(users.id, userId));
}

/** A moderator's decision on a reported thing. */
export type Decision = {
  targetType: string; targetId: number; moderator: { id: number; username: string }; outcome: string;
  /** The account to suspend from posting, if any. */
  suspendUserId: number | null;
  /** Whether to delete (or, for a message, hide) the reported thing. */
  remove: boolean;
  audit: AuditEntry;
};

/**
 * Carries out a decision in one transaction, audit record included. Every open report about the same thing is
 * settled by it. Returns the removed message, if one was, for `announceRemoved`.
 */
export function settle(d: Decision): Removed | null {
  return transact(tx => {
    if (d.suspendUserId) tx.update(users).set({ suspended: true }).where(eq(users.id, d.suspendUserId)).run();
    const removed = d.remove ? removeContentTx(tx, d.targetType, d.targetId, d.moderator.id) : null;
    closeReportsTx(tx, d.targetType, d.targetId, d.outcome, d.moderator.id);
    auditTx(tx, d.moderator, d.audit);
    return removed;
  });
}
