// Data access for reports of content, and for suspending accounts. The staff portal settles reports (server/admin).
import { and, count, eq, gt } from "drizzle-orm";
import { db } from "../db/client";
import { reports, users } from "../db/schema";
import { first, now } from "../util";

export type Report = typeof reports.$inferSelect;

const total = async (rows: PromiseLike<{ c: number }[]>) => (await rows)[0]?.c ?? 0;

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

// ---------- suspending ----------
export async function setSuspended(userId: number, suspended: boolean): Promise<void> {
  await db.update(users).set({ suspended }).where(eq(users.id, userId));
}

