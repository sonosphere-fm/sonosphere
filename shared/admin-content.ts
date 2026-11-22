import type { AuditRow, Ok, Paged, PageRef } from "./admin";
import type { Settings } from "./site";
export type { Ok, Paged, PageRef };

export type ShoutItem = {
  id: number;
  body: string;
  author: string;
  createdAt: number;
  page: PageRef | null;
  targetType: string;
  reports: number;
};
export type JournalItem = {
  id: number;
  title: string;
  excerpt: string;
  author: string;
  createdAt: number;
  updatedAt: number;
  link?: string;
  comments: number;
  reports: number;
};
export type WikiItem = {
  id: number;
  itemType: string;
  itemId: number;
  version: number;
  latest: boolean;
  excerpt: string;
  author: string | null;
  createdAt: number;
  page: PageRef | null;
  locked: boolean;
  reports: number;
};
export type ContentList = { items: ShoutItem[] | JournalItem[] | WikiItem[]; total: number } & Paged;

export type WikiRevision = { id: number; version: number; content: string; createdAt: number; author: string | null };
export type WikiHistory = {
  type: string;
  id: number;
  page: PageRef;
  lock: { by: string | null; reason: string; at: number } | null;
  versions: WikiRevision[];
};
export type WikiReverted = { version: number };
export type WikiLocked = { locked: boolean };
export type WikiLockList = {
  items: { type: string; id: number; page: PageRef | null; by: string | null; reason: string; at: number }[];
};

export type CatalogueKind = "artist" | "album" | "track";
export type CatalogueItem = {
  id: number;
  name: string;
  artist: string | null;
  createdAt: number;
  tracks: number | null;
  albums: number | null;
  scrobbles: number;
};
export type TracklistTrack = { id: number; name: string; artist: string };
export type Tracklist = { tracks: TracklistTrack[] };
export type CatalogueDetails = {
  mbid?: string | null;
  spotifyId?: string | null;
  releaseDate?: string | null;
  releaseType?: string | null;
  duration?: number;
};
export type CatalogueSearch = { items: CatalogueItem[]; total: number } & Paged;
export type DuplicateArtist = { id: number; name: string; scrobbles: number; tracks: number; albums: number };
export type CatalogueDuplicates = { groups: DuplicateArtist[][] };
export type CatalogueMerged = { ok: true; merged?: number; moved?: number };
export type OrphanItem = { id: number; name: string; artist: string | null; createdAt: number; basePlaycount: number };
export type OrphanList = { items: OrphanItem[]; total: number };
export type OrphansDeleted = { deleted: number; skipped: number };
export type AdminTag = { id: number; name: string; uses: number; users: number; imported: number | null };
export type AdminTagList = { items: AdminTag[]; total: number } & Paged;
export type TagDeleted = { ok: true; uses: number };

export type AuditList = { items: AuditRow[] } & Paged & { total: number; actors: string[]; actions: string[] };

export type AdminSettings = Settings;
