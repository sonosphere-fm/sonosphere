// Types shared by the server and the browser for wikis.
/** The current text of an item's wiki. `author` is a username, or null once that account is gone. */
export type WikiVersion = { content: string; version: number; createdAt: number; author: string | null };

/** One entry in a wiki's history. */
export type WikiRevision = { id: number; version: number; content: string; createdAt: number; author: string | null };
/** GET /api/wiki: the newest versions first, and whether staff have locked the wiki. */
export type WikiHistory = { versions: WikiRevision[]; locked: boolean };
/** POST /api/wiki: the wiki as it now stands. */
export type WikiSaved = { wiki: WikiVersion | null };
