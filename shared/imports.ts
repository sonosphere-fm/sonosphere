// Types shared by the server and the browser for imports of past listening, which run in the background.

export type ImportKind = "scrobbles" | "loved" | "lastfm";
export type ImportStatus = "uploading" | "queued" | "running" | "done" | "failed" | "cancelled";
/**
 * An import. `total` is how many rows there are (for Last.fm, the profile's play count, a guess until the last page),
 * `done` how many have been worked through and `accepted` how many were added (the rest were duplicates or unreadable).
 * `phase` says what a Last.fm import is reading now.
 */
export type ImportJob = {
  id: number; kind: ImportKind; status: ImportStatus; lastfmUser: string | null; phase: "scrobbles" | "loved";
  total: number; done: number; accepted: number; error: string | null; createdAt: number; updatedAt: number;
};
/** GET /api/import: the latest import, or null. */
export type ImportState = { job: ImportJob | null };
/** The most rows one import can hold, and how many go in each uploaded chunk. */
export const IMPORT_MAX = 3_000_000;
export const IMPORT_CHUNK = 20_000;
