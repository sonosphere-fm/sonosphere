import { bad, missing, oneOf, Router } from "../http";
import { staff } from "../guards";
import { configAdmins, isAdmin, isStaff } from "../site/roles";
import { findById } from "../users/repo";
import { idList, note, paging } from "./common";
import { reportTarget, snapshotOf } from "../moderation/repo";
import * as repo from "./reports.repo";
import { removed as groupMessageRemoved } from "../dm/groups.repo";
import type { ReportResolved, ReportsClosed, StaffReport, StaffReportList } from "../../shared/admin";

export const router = new Router({ jsonOnly: true });

const STATUSES = ["open", "closed", "all"] as const;
const REASONS = ["spam", "abuse", "inappropriate", "impersonation", "other"] as const;
const TYPES = ["shout", "wiki", "journal", "event", "playlist", "obsession", "user", "dm", "group"] as const;
const DECISIONS = ["dismiss", "remove", "suspend", "mute"] as const;

router.get<StaffReportList>("/api/admin/reports", async (c) => {
  const me = staff(c);
  const status = oneOf(c.q.get("status"), STATUSES) ?? "open";
  const pg = paging(c.q);
  const filter = { status, type: oneOf(c.q.get("type"), TYPES), reason: oneOf(c.q.get("reason"), REASONS) };
  const { rows, total } = await repo.listReports(filter, pg.limit, pg.offset);
  const items: StaffReport[] = [];
  for (const r of rows) {
    const live = await reportTarget(r.targetType, r.targetId);
    const snap = snapshotOf(r.snapshot);
    const author = live?.authorId ? await findById(live.authorId) : null;
    const isDm = r.targetType === "dm" || r.targetType === "group";
    // transcript links are for admins only (the server checks too)
    let link = live?.link ?? null;
    if (isDm) link = live && isAdmin(me) ? live.link : null;
    const dmExtra = isDm
      ? {
          threadId: live?.threadId ?? null,
          authorMuted: !!author?.dmMuted,
          removed:
            r.targetType === "dm" ? await repo.messageRemoved(r.targetId) : await groupMessageRemoved(r.targetId),
        }
      : {};
    items.push({
      id: r.id,
      type: r.targetType,
      targetId: r.targetId,
      reason: r.reason,
      detail: r.detail,
      status: r.status,
      outcome: r.outcome,
      note: r.resolutionNote,
      reporter: r.reporter,
      resolver: r.resolver,
      createdAt: r.createdAt,
      resolvedAt: r.resolvedAt,
      exists: !!live,
      author: author?.username ?? snap.author ?? null,
      authorSuspended: !!author?.suspended,
      authorBanned: !!author?.banned,
      authorStaff: isStaff(author),
      text: (live?.text ?? snap.text ?? "").slice(0, 2000),
      where: live?.where ?? snap.where ?? "",
      link,
      others: await repo.otherOpen(r),
      ...dmExtra,
    });
  }
  return {
    items,
    total,
    ...pg,
    open: await repo.openCount(),
    byType: await repo.facet(status, "type"),
    byReason: await repo.facet(status, "reason"),
  };
});

router.post<ReportsClosed>("/api/admin/reports/bulk", async (c) => {
  const me = staff(c);
  const ids = idList(c.body.ids, 200);
  if (!ids.length) bad("pickLeastOneReport");
  return { closed: await repo.dismissAll(me, ids, note(c)) };
});

router.post<ReportResolved>("/api/admin/reports/:id", async (c) => {
  const me = staff(c);
  const r = (await repo.findReport(Number(c.params[0]))) ?? missing("reportNotFound");
  const action = oneOf(String(c.body.action), DECISIONS) ?? bad("unknownAction");
  if (r.status !== "open") bad("reportAlreadyResolved");
  return { ok: true, closed: await repo.resolve(me, r, action, note(c), await configAdmins()) };
});
