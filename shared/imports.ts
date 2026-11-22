export type ImportKind = "scrobbles" | "loved" | "lastfm";
export type ImportStatus = "uploading" | "queued" | "running" | "done" | "failed" | "cancelled";
export type ImportJob = {
  id: number;
  kind: ImportKind;
  status: ImportStatus;
  lastfmUser: string | null;
  phase: "scrobbles" | "loved";
  total: number;
  done: number;
  accepted: number;
  error: string | null;
  createdAt: number;
  updatedAt: number;
};
export type ImportState = { job: ImportJob | null };
export const IMPORT_MAX = 3_000_000;
export const IMPORT_CHUNK = 20_000;
