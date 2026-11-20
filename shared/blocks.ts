// Types shared by the server and the browser for blocking.
import type { PublicUser } from "./users";

/** GET /api/blocks: the people the signed-in user has blocked, newest first. */
export type Blocks = { items: (PublicUser & { blockedAt: number })[] };
/** POST /api/block */
export type BlockResult = { blocked: boolean };
