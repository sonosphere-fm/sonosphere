import { and, desc, eq, sql } from "drizzle-orm";
import { db, transact } from "../db/client";
import { users, wikiLocks, wikis } from "../db/schema";
import { first, now } from "../util";
import type { WikiRevision, WikiVersion } from "../../shared/wiki";

type WikiLock = {
  itemType: string;
  itemId: number;
  lockedById: number | null;
  lockedBy: string | null;
  reason: string;
  createdAt: number;
};

export const latestWiki = (type: string, id: number): Promise<WikiVersion | null> =>
  first(
    db
      .select({ content: wikis.content, version: wikis.version, createdAt: wikis.createdAt, author: users.username })
      .from(wikis)
      .leftJoin(users, eq(users.id, wikis.authorId))
      .where(and(eq(wikis.itemType, type), eq(wikis.itemId, id)))
      .orderBy(desc(wikis.version))
      .limit(1)
  );

export const wikiLock = (type: string, id: number): Promise<WikiLock | null> =>
  first(
    db
      .select({
        itemType: wikiLocks.itemType,
        itemId: wikiLocks.itemId,
        lockedById: wikiLocks.lockedBy,
        lockedBy: users.username,
        reason: wikiLocks.reason,
        createdAt: wikiLocks.createdAt,
      })
      .from(wikiLocks)
      .leftJoin(users, eq(users.id, wikiLocks.lockedBy))
      .where(and(eq(wikiLocks.itemType, type), eq(wikiLocks.itemId, id)))
      .limit(1)
  );

export async function wikiHistory(type: string, id: number, limit = 50): Promise<WikiRevision[]> {
  return db
    .select({
      id: wikis.id,
      version: wikis.version,
      content: wikis.content,
      createdAt: wikis.createdAt,
      author: users.username,
    })
    .from(wikis)
    .leftJoin(users, eq(users.id, wikis.authorId))
    .where(and(eq(wikis.itemType, type), eq(wikis.itemId, id)))
    .orderBy(desc(wikis.version))
    .limit(limit);
}

export async function addWikiVersion(type: string, id: number, content: string, authorId: number): Promise<void> {
  await transact(async (tx) => {
    const [row] = await tx
      .select({ v: sql<number>`COALESCE(MAX(${wikis.version}), 0) + 1` })
      .from(wikis)
      .where(and(eq(wikis.itemType, type), eq(wikis.itemId, id)));
    const next = row?.v ?? 1;
    await tx.insert(wikis).values({ itemType: type, itemId: id, content, authorId, version: next, createdAt: now() });
  });
}
