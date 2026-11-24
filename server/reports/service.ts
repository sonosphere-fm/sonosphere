import { reportTarget } from "../moderation/repo";
import { bad, fail, missing, oneOf, type Viewer } from "../http";
import { audit } from "../site/audit";
import { now } from "../util";
import * as repo from "./repo";
import type { ReportReason } from "../../shared/reports";

const REASONS: readonly ReportReason[] = ["spam", "abuse", "inappropriate", "impersonation", "other"];
const HOURLY_LIMIT = 20;

type NewReport = { type: string; id: number; reason: string; detail: string };

// Updates the reporter's own open report of the same thing if there is one.
export async function fileReport(reporter: Viewer, r: NewReport): Promise<void> {
  if (!oneOf(r.reason, REASONS)) bad("pickReason");
  const t = (await reportTarget(r.type, r.id)) ?? missing("contentNotFound");
  // a direct message can only be reported by someone who is in that conversation
  if ((r.type === "dm" || r.type === "group") && !t.participants?.includes(reporter.id)) missing("contentNotFound");
  if (t.authorId === reporter.id) bad("cantReportOwnContent");
  const filed = await repo.filedSince(reporter.id, now() - 3600);
  if (filed >= HOURLY_LIMIT) fail(429, "thatsLotReportsHourTry");
  // the snapshot keeps what was reported readable after the content itself is gone
  const snapshot = JSON.stringify({ author: t.author, text: t.text.slice(0, 2000), where: t.where, link: t.link });
  const filing = { reason: r.reason, detail: r.detail, snapshot };
  const mine = await repo.openReportBy(reporter.id, r.type, r.id);
  if (mine) await repo.amendReport(mine, filing);
  else await repo.addReport(reporter.id, r.type, r.id, filing);
}

export async function suspend(
  moderator: Viewer,
  target: { id: number; username: string; isAdmin: boolean },
  suspended: boolean
): Promise<void> {
  if (suspended && target.isAdmin) bad("moderatorsCantSuspended");
  await repo.setSuspended(target.id, suspended);
  await audit(moderator, {
    action: suspended ? "user.suspend" : "user.unsuspend",
    targetType: "user",
    targetId: target.id,
    label: target.username,
    subjectId: target.id,
  });
}
