// Types shared by the server and the browser for reports of content and what moderators do about them.

export type ReportReason = "spam" | "abuse" | "inappropriate" | "impersonation" | "other";
/** Every write that only confirms it happened answers with this. */
export type ReportOk = { ok: true };

/** POST /api/mod/suspend */
export type SuspendResult = { suspended: boolean };
