// Types shared by the server and the browser for journals: longer posts on a user's profile.
import type { Paging, PublicUser } from "./users";

/** A post without its text. `comments` counts the shouts left under it. */
export type JournalSummary = { id: number; title: string; createdAt: number; updatedAt: number; comments: number };
/** GET /api/user/journal: `excerpt` is the opening of each post. */
export type JournalList = { items: (JournalSummary & { excerpt: string })[]; total: number } & Paging;
/** GET /api/journal/:id */
export type JournalPost = JournalSummary & { body: string; author: PublicUser };
/** POST /api/journal and PATCH /api/journal/:id */
export type JournalSaved = { id: number };
/** DELETE /api/journal/:id */
export type JournalDeleted = { ok: true };
