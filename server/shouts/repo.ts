import { and, asc, count, desc, eq, isNull, notInArray, sql } from "drizzle-orm";
import { db } from "../db/client";
import { blocks, shouts, users } from "../db/schema";
import { publicCols, publicUser } from "../users/repo";
import { first, now } from "../util";
import type { Shout } from "../../shared/shouts";

export type ShoutRow = typeof shouts.$inferSelect;

function visible(type: string, id: number, viewerId: number) {
  const blocked = db.select({ id: blocks.blockedId }).from(blocks).where(eq(blocks.blockerId, viewerId));
  return and(eq(shouts.targetType, type), eq(shouts.targetId, id), notInArray(shouts.authorId, blocked));
}

const single = async (rows: PromiseLike<{ c: number }[]>) => (await rows)[0]?.c ?? 0;

export async function listShouts(
  type: string,
  id: number,
  viewerId: number,
  limit: number,
  offset: number,
  parentId: number | null = null
): Promise<Shout[]> {
  const rows = await db
    .select({
      shoutId: shouts.id,
      body: shouts.body,
      createdAt: shouts.createdAt,
      parentId: shouts.parentId,
      deleted: shouts.deleted,
      ...publicCols,
      replyCount: sql<number>`(select count(*)::int from shouts replies where replies.parent_id = ${shouts.id} and not exists (select 1 from blocks where blocker_id = ${viewerId} and blocked_id = replies.author_id))`,
    })
    .from(shouts)
    .innerJoin(users, eq(users.id, shouts.authorId))
    .where(
      and(visible(type, id, viewerId), parentId === null ? isNull(shouts.parentId) : eq(shouts.parentId, parentId))
    )
    .orderBy(
      parentId === null ? desc(shouts.createdAt) : asc(shouts.createdAt),
      parentId === null ? desc(shouts.id) : asc(shouts.id)
    )
    .limit(limit)
    .offset(offset);
  return rows.map((r) => ({
    id: r.shoutId,
    body: r.deleted ? "" : r.body,
    createdAt: r.createdAt,
    author: publicUser(r),
    parentId: r.parentId,
    deleted: r.deleted,
    replyCount: r.replyCount,
  }));
}

export const visibleCount = (
  type: string,
  id: number,
  viewerId: number,
  parentId: number | null = null
): Promise<number> =>
  single(
    db
      .select({ c: count() })
      .from(shouts)
      .where(
        and(visible(type, id, viewerId), parentId === null ? isNull(shouts.parentId) : eq(shouts.parentId, parentId))
      )
  );
export const shoutCount = (type: string, id: number): Promise<number> =>
  single(
    db
      .select({ c: count() })
      .from(shouts)
      .where(and(eq(shouts.targetType, type), eq(shouts.targetId, id)))
  );

export const findShout = (id: number): Promise<ShoutRow | null> =>
  first(db.select().from(shouts).where(eq(shouts.id, id)).limit(1));

export async function addShout(
  authorId: number,
  type: string,
  id: number,
  body: string,
  parentId: number | null = null
): Promise<number> {
  const [row] = await db
    .insert(shouts)
    .values({ authorId, targetType: type, targetId: id, body, parentId, createdAt: now() })
    .returning({ id: shouts.id });
  if (!row) throw new Error("The post was not saved");
  return row.id;
}

export async function deleteShout(id: number): Promise<void> {
  // Retain ancestry even if another user replies concurrently with deletion.
  await db.update(shouts).set({ body: "", deleted: true }).where(eq(shouts.id, id));
}
