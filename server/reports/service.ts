// Rules for reporting content and for what moderators do with a report: what a reported thing is and where it
// lives, who may report it, and what dismissing, removing or suspending means for each kind of content.
import { announceRemoved } from "../dm/service";
import { reportTarget, snapshotOf } from "../moderation/repo";
import { bad, fail, missing, oneOf, type Viewer } from "../http";
import { audit } from "../site/audit";
import { findById } from "../users/repo";
import { now } from "../util";
import * as repo from "./repo";
import type { ModReport, ReportAction, ReportReason } from "../../shared/reports";

export const REASONS: readonly ReportReason[] = ["spam", "abuse", "inappropriate", "impersonation", "other"];
export const ACTIONS: readonly ReportAction[] = ["dismiss", "remove", "suspend"];
/** Reports one person may file in an hour. */
const HOURLY_LIMIT = 20;

// ---------- filing ----------
/** A report as it arrives: nothing but the types has been checked. */
export type NewReport = { type: string; id: number; reason: string; detail: string };

/** Files a report, or updates the reporter's own open report of the same thing. */
export async function fileReport(reporter: Viewer, r: NewReport): Promise<void> {
  if (!oneOf(r.reason, REASONS)) bad("Pick a reason");
  const t = (await reportTarget(r.type, r.id)) ?? missing("That content");
  // a direct message can only be reported by someone who is in that conversation
  if (r.type === "dm" && !t.participants?.includes(reporter.id)) missing("That content");
  if (t.authorId === reporter.id) bad("You can't report your own content");
  if (await repo.filedSince(reporter.id, now() - 3600) >= HOURLY_LIMIT) fail(429, "That's a lot of reports in an hour. Try again later.");
  // the snapshot keeps what was reported readable after the content itself is gone
  const filing = { reason: r.reason, detail: r.detail, snapshot: JSON.stringify({ author: t.author, text: t.text.slice(0, 2000), where: t.where, link: t.link }) };
  const mine = await repo.openReportBy(reporter.id, r.type, r.id);
  if (mine) await repo.amendReport(mine, filing); else await repo.addReport(reporter.id, r.type, r.id, filing);
}

// ---------- the moderation queue ----------
/** A queued report with the reported thing as it is now, falling back to the snapshot where it has gone. */
async function described(r: repo.QueuedReport): Promise<ModReport> {
  const live = await reportTarget(r.targetType, r.targetId), snap = snapshotOf(r.snapshot);
  const author = live?.authorId ? await findById(live.authorId) : null;
  return {
    id: r.id, type: r.targetType, reason: r.reason, detail: r.detail, status: r.status, outcome: r.outcome, reporter: r.reporter, resolver: r.resolver,
    createdAt: r.createdAt, resolvedAt: r.resolvedAt, exists: !!live, author: author?.username ?? snap.author ?? null,
    authorSuspended: !!author?.suspended, authorIsAdmin: !!author?.isAdmin,
    text: (live?.text ?? snap.text ?? "").slice(0, 2000), where: live?.where ?? snap.where ?? "", link: live?.link ?? null,
  };
}

export async function queue(open: boolean, limit: number, offset: number): Promise<ModReport[]> {
  const out: ModReport[] = [];
  for (const r of await repo.reportQueue(open, limit, offset)) out.push(await described(r));
  return out;
}

const OUTCOMES: Record<ReportAction, string> = { dismiss: "dismissed", suspend: "author suspended", remove: "content removed" };

/**
 * Settles a report. "remove" deletes the content; "suspend" does that and also suspends its author from posting
 * (a profile cannot be removed, only suspended). If the content is already gone the report is simply closed.
 */
export async function resolve(moderator: Viewer, reportId: number, wanted: string): Promise<void> {
  const r = (await repo.findReport(reportId)) ?? missing("Report");
  const action = oneOf(wanted, ACTIONS) ?? bad("Unknown action");
  const t = await reportTarget(r.targetType, r.targetId);
  const acting = action !== "dismiss" && !!t;
  let suspendUserId: number | null = null;
  if (acting && action === "suspend") {
    suspendUserId = t.authorId || bad("The author's account no longer exists");
    if ((await findById(suspendUserId))?.isAdmin) bad("Moderators can't be suspended");
  }
  const removable = ["shout", "wiki", "journal", "dm"].includes(r.targetType);
  if (acting && action === "remove" && !removable) bad("A profile can't be removed: suspend the account or dismiss the report");
  const removed = repo.settle({
    targetType: r.targetType, targetId: r.targetId, moderator, outcome: OUTCOMES[action], suspendUserId, remove: acting,
    audit: {
      action: `report.${action}`, targetType: r.targetType, targetId: r.targetId,
      label: t ? `${t.where}${t.author ? ` by ${t.author}` : ""}` : snapshotOf(r.snapshot).where ?? "",
      subjectId: t?.authorId ?? null, data: { report: r.id, reason: r.reason },
    },
  });
  await announceRemoved([removed]);
}

/** Suspends an account from posting, or lifts the suspension. Staff cannot be suspended. */
export async function suspend(moderator: Viewer, target: { id: number; username: string; isAdmin: boolean }, suspended: boolean): Promise<void> {
  if (suspended && target.isAdmin) bad("Moderators can't be suspended");
  await repo.setSuspended(target.id, suspended);
  await audit(moderator, { action: suspended ? "user.suspend" : "user.unsuspend", targetType: "user", targetId: target.id, label: target.username, subjectId: target.id });
}
