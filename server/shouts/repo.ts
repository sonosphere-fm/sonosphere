import { and, count, desc, eq, notInArray } from "drizzle-orm";
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
  offset: number
): Promise<Shout[]> {
  const rows = await db
    .select({ shoutId: shouts.id, body: shouts.body, createdAt: shouts.createdAt, ...publicCols })
    .from(shouts)
    .innerJoin(users, eq(users.id, shouts.authorId))
    .where(visible(type, id, viewerId))
    .orderBy(desc(shouts.createdAt), desc(shouts.id))
    .limit(limit)
    .offset(offset);
  return rows.map((r) => ({ id: r.shoutId, body: r.body, createdAt: r.createdAt, author: publicUser(r) }));
}

export const visibleCount = (type: string, id: number, viewerId: number): Promise<number> =>
  single(
    db
      .select({ c: count() })
      .from(shouts)
      .where(visible(type, id, viewerId))
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

export async function addShout(authorId: number, type: string, id: number, body: string): Promise<number> {
  const [row] = await db
    .insert(shouts)
    .values({ authorId, targetType: type, targetId: id, body, createdAt: now() })
    .returning({ id: shouts.id });
  if (!row) throw new Error("The post was not saved");
  return row.id;
}

export async function deleteShout(id: number): Promise<void> {
  await db.delete(shouts).where(eq(shouts.id, id));
}
