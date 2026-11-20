// Reports API: reporting content, and suspending an account from its profile. Staff settle reports in the portal.
import { need } from "../guards";
import { fail, Router, type Ctx, type Viewer } from "../http";
import { requireUser } from "../users/service";
import * as service from "./service";
import type { ReportOk, SuspendResult } from "../../shared/reports";

export const router = new Router();

/** Signed in and flagged as staff. These routes have always answered "Moderators only" rather than the portal's "Staff only". */
const moderator = (c: Ctx): Viewer => { const u = need(c); return u.isAdmin ? u : fail(403, "Moderators only"); };

router.post<ReportOk>("/api/reports", async c => {
  const u = need(c);
  await service.fileReport(u, { type: String(c.body.type), id: Number(c.body.id), reason: String(c.body.reason), detail: String(c.body.detail || "").trim().slice(0, 1000) });
  return { ok: true };
});

// `suspended: false` in the body lifts a suspension; anything else suspends.
router.post<SuspendResult>("/api/mod/suspend", async c => {
  const m = moderator(c), t = await requireUser(typeof c.body.username === "string" ? c.body.username : null);
  const suspended = c.body.suspended !== false;
  await service.suspend(m, t, suspended);
  return { suspended };
});
