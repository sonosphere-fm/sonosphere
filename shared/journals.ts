import type { Paging, PublicUser } from "./users";

export type JournalSummary = { id: number; title: string; createdAt: number; updatedAt: number; comments: number };
export type JournalList = { items: (JournalSummary & { excerpt: string })[]; total: number } & Paging;
export type JournalPost = JournalSummary & { body: string; author: PublicUser };
export type JournalSaved = { id: number };
export type JournalDeleted = { ok: true };
