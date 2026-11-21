import type { PublicUser } from "./users";

export type Blocks = { items: (PublicUser & { blockedAt: number })[] };
export type BlockResult = { blocked: boolean };
