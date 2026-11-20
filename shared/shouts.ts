// Types shared by the server and the browser for shouts: the short posts people leave on a page.
import type { Paged } from "./catalog";
import type { PublicUser } from "./users";

export type Shout = { id: number; body: string; createdAt: number; author: PublicUser };
/** GET /api/shouts. `enabled` is false on a profile whose owner turned their wall off; `canModerate` lets the viewer delete any post here. */
export type ShoutList = Paged<Shout> & { enabled: boolean; canModerate: boolean };
/** POST /api/shouts */
export type ShoutPosted = { id: number };
/** DELETE /api/shouts/:id */
export type ShoutDeleted = { ok: true };
