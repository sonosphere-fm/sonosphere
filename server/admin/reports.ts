// Staff API: the report queue. Any staff member can read it and resolve reports: dismiss, remove the content,
// or also suspend (or, for a direct message, mute) its author. Every decision is audited.
import { bad, missing, oneOf, Router } from "../http";
import { staff } from "../guards";
import { configAdmins, isAdmin, isStaff } from "../site/roles";
import { findById } from "../users/repo";
import { idList, note, paging } from "./common";
import { reportTarget, snapshotOf } from "../moderation/repo";
import * as repo from "./reports.repo";
import type { ReportResolved, ReportsClosed, StaffReport, StaffReportList } from "../../shared/admin";

export const router = new Router({ jsonOnly: true });

const STATUSES = ["open", "closed", "all"] as const;
const REASONS = ["spam", "abuse", "inappropriate", "impersonation", "other"] as const, TYPES = ["shout", "wiki", "journal", "user", "dm"] as const;
const DECISIONS = ["dismiss", "remove", "suspend", "mute"] as const;

router.get<StaffReportList>("/api/admin/reports", async c => {
  const me = staff(c), status = oneOf(c.q.get("status"), STATUSES) ?? "open", pg = paging(c.q);
  const { rows, total } = await repo.listReports({ status, type: oneOf(c.q.get("type"), TYPES), reason: oneOf(c.q.get("reason"), REASONS) }, pg.limit, pg.offset);
  const items: StaffReport[] = [];
  for (const r of rows) {
    const live = await reportTarget(r.targetType, r.targetId), snap = snapshotOf(r.snapshot);
    const author = live?.authorId ? await findById(live.authorId) : null;
    items.push({
      id: r.id, type: r.targetType, targetId: r.targetId, reason: r.reason, detail: r.detail, status: r.status, outcome: r.outcome, note: r.resolutionNote,
      reporter: r.reporter, resolver: r.resolver, createdAt: r.createdAt, resolvedAt: r.resolvedAt, exists: !!live,
      author: author?.username ?? snap.author ?? null, authorSuspended: !!author?.suspended, authorBanned: !!author?.banned, authorStaff: isStaff(author),
      text: (live?.text ?? snap.text ?? "").slice(0, 2000), where: live?.where ?? snap.where ?? "",
      // a direct message: the transcript link is for admins only (the server checks too), and a removed message still exists for staff
      link: r.targetType === "dm" ? (live && isAdmin(me) ? live.link : null) : live?.link ?? null,
      others: await repo.otherOpen(r),
      ...(r.targetType === "dm" ? { threadId: live?.threadId ?? null, authorMuted: !!author?.dmMuted, removed: await repo.messageRemoved(r.targetId) } : {}),
    });
  }
  return { items, total, ...pg, open: await repo.openCount(), byType: await repo.facet(status, "type"), byReason: await repo.facet(status, "reason") };
});

router.post<ReportsClosed>("/api/admin/reports/bulk", async c => {
  const me = staff(c), ids = idList(c.body.ids, 200);
  if (!ids.length) bad("Pick at least one report");
  return { closed: await repo.dismissAll(me, ids, note(c)) };
});

router.post<ReportResolved>("/api/admin/reports/:id", async c => {
  const me = staff(c), r = (await repo.findReport(Number(c.params[0]))) ?? missing("Report");
  const action = oneOf(String(c.body.action), DECISIONS) ?? bad("Unknown action");
  if (r.status !== "open") bad("That report is already resolved");
  return { ok: true, closed: await repo.resolve(me, r, action, note(c), await configAdmins()) };
});
