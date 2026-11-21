import { and, desc, eq, or } from "drizzle-orm";
import { db, transact } from "../db/client";
import { blocks, follows, users } from "../db/schema";
import { publicCols } from "../users/repo";
import { now } from "../util";
import type { Blocks } from "../../shared/blocks";

export const blockedBy = (userId: number): Promise<Blocks["items"]> =>
  db.select({ ...publicCols, blockedAt: blocks.createdAt }).from(blocks)
    .innerJoin(users, eq(users.id, blocks.blockedId))
    .where(eq(blocks.blockerId, userId)).orderBy(desc(blocks.createdAt));

export async function block(blockerId: number, blockedId: number): Promise<void> {
  await transact(async tx => {
    await tx.insert(blocks).values({ blockerId, blockedId, createdAt: now() }).onConflictDoNothing();
    await tx.delete(follows).where(or(
      and(eq(follows.followerId, blockerId), eq(follows.followeeId, blockedId)),
      and(eq(follows.followerId, blockedId), eq(follows.followeeId, blockerId)),
    ));
  });
}

export async function unblock(blockerId: number, blockedId: number): Promise<void> {
  await db.delete(blocks).where(and(eq(blocks.blockerId, blockerId), eq(blocks.blockedId, blockedId)));
}
