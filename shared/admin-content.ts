// Types shared by the server and the browser for the staff portal's content, catalogue, audit log and settings pages.
import type { AuditRow, Ok, Paged, PageRef } from "./admin";
import type { Settings } from "./site";
export type { Ok, Paged, PageRef };

// ---------- content ----------
/** `reports` counts the open reports against the item. */
export type ShoutItem = { id: number; body: string; author: string; createdAt: number; page: PageRef | null; targetType: string; reports: number };
export type JournalItem = { id: number; title: string; excerpt: string; author: string; createdAt: number; updatedAt: number; link?: string; comments: number; reports: number };
/** One version of a wiki. `latest` says whether it is the text currently shown. */
export type WikiItem = {
  id: number; itemType: string; itemId: number; version: number; latest: boolean; excerpt: string; author: string | null;
  createdAt: number; page: PageRef | null; locked: boolean; reports: number;
};
export type ContentList = { items: ShoutItem[] | JournalItem[] | WikiItem[]; total: number } & Paged;

export type WikiRevision = { id: number; version: number; content: string; createdAt: number; author: string | null };
/** A wiki's whole history, newest first. `lock.by` is a username, or null once that account is gone. */
export type WikiHistory = { type: string; id: number; page: PageRef; lock: { by: string | null; reason: string; at: number } | null; versions: WikiRevision[] };
export type WikiReverted = { version: number };
export type WikiLocked = { locked: boolean };
export type WikiLockList = { items: { type: string; id: number; page: PageRef | null; by: string | null; reason: string; at: number }[] };

// ---------- catalogue ----------
export type CatalogueKind = "artist" | "album" | "track";
/** A search hit. Counts that make no sense for the kind are null (an album has no albums). */
export type CatalogueItem = { id: number; name: string; artist: string | null; createdAt: number; tracks: number | null; albums: number | null; scrobbles: number };
export type CatalogueSearch = { items: CatalogueItem[]; total: number } & Paged;
export type DuplicateArtist = { id: number; name: string; scrobbles: number; tracks: number; albums: number };
/** Artists whose names differ only in accents, punctuation, "the" or "&", most played first in each group. */
export type CatalogueDuplicates = { groups: DuplicateArtist[][] };
/** Merging artists also reports how many of the source's albums and tracks were merged into a twin or moved over. */
export type CatalogueMerged = { ok: true; merged?: number; moved?: number };
export type OrphanItem = { id: number; name: string; artist: string | null; createdAt: number; basePlaycount: number };
export type OrphanList = { items: OrphanItem[]; total: number };
export type OrphansDeleted = { deleted: number; skipped: number };
/** `imported` counts taggings that came with imported data rather than from a person. */
export type AdminTag = { id: number; name: string; uses: number; users: number; imported: number | null };
export type AdminTagList = { items: AdminTag[]; total: number } & Paged;
export type TagDeleted = { ok: true; uses: number };

// ---------- audit log ----------
/** `actors` and `actions` list every value in the log, for the filter menus. */
export type AuditList = { items: AuditRow[] } & Paged & { total: number; actors: string[]; actions: string[] };

// ---------- settings ----------
export type AdminSettings = Settings;
