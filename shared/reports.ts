// Types shared by the server and the browser for reports of content and what moderators do about them.
import type { Paging, PublicUser } from "./users";

export type ReportReason = "spam" | "abuse" | "inappropriate" | "impersonation" | "other";
export type ReportAction = "dismiss" | "remove" | "suspend";
/** Every write that only confirms it happened answers with this. */
export type ReportOk = { ok: true };

/**
 * A report in the moderation queue. `type` is what was reported (shout, wiki, journal, dm or user). `text`, `where`
 * and `author` describe it as it is now, or as it was when reported if it has since gone (`exists` false).
 */
export type ModReport = {
  id: number; type: string; reason: string; detail: string; status: string; outcome: string;
  reporter: string | null; resolver: string | null; createdAt: number; resolvedAt: number | null;
  exists: boolean; author: string | null; authorSuspended: boolean; authorIsAdmin: boolean;
  text: string; where: string; link: string | null;
};
/** GET /api/mod/reports: one page of open or closed reports, the number still open, and every suspended account. */
export type ModReports = { items: ModReport[]; total: number; open: number; suspended: PublicUser[] } & Paging;
/** POST /api/mod/suspend */
export type SuspendResult = { suspended: boolean };
