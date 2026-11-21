import type { Paged } from "./catalog";
import type { PublicUser } from "./users";

export type Shout = { id: number; body: string; createdAt: number; author: PublicUser };
export type ShoutList = Paged<Shout> & { enabled: boolean; canModerate: boolean };
export type ShoutPosted = { id: number };
export type ShoutDeleted = { ok: true };
