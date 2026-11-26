import type { ItemType, Paged } from "./catalog";
import type { PublicUser } from "./users";

export type ShoutTarget = ItemType | "image";

export type Shout = {
  id: number;
  body: string;
  createdAt: number;
  author: PublicUser;
  parentId: number | null;
  deleted: boolean;
  replyCount: number;
};
export type ShoutList = Paged<Shout> & { enabled: boolean; canModerate: boolean };
export type ShoutPosted = { id: number };
export type ShoutDeleted = { ok: true };
