// Staff API: the dashboard (GET /api/admin/dashboard). Totals, 30 days of activity, new accounts and recent staff actions.
import { Router } from "../http";
import { staff } from "../guards";
import { now } from "../util";
import { auditRows } from "../site/repo";
import { activity, newestUsers, totals } from "./dashboard.repo";
import type { Dashboard } from "../../shared/admin";

export const router = new Router({ jsonOnly: true });
const DAY = 86400;

router.get<Dashboard>("/api/admin/dashboard", async c => {
  staff(c);
  const t = now(), today = Math.floor(t / DAY) * DAY;
  return { totals: await totals(t), series: await activity(today - 29 * DAY, 30), recentUsers: await newestUsers(8), recentActions: await auditRows(undefined, 10, 0) };
});
