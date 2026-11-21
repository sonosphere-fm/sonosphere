import { and, count, countDistinct, desc, eq, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, transact, type Tx } from "../db/client";
import { artists, taggings, tags, userArtists } from "../db/schema";
import { norm, now } from "../util";
import type { TagCount, TaggedArtist } from "../../shared/tags";

export async function topTags(type: string, id: number, limit = 10): Promise<TagCount[]> {
  const weight = sql<number>`SUM(${taggings.weight})`.as("count");
  return db.select({ name: tags.name, count: weight }).from(taggings)
    .innerJoin(tags, eq(tags.id, taggings.tagId))
    .where(and(eq(taggings.itemType, type), eq(taggings.itemId, id)))
    .groupBy(tags.id)
    .orderBy(desc(weight), tags.name)
    .limit(limit);
}

// Tags are stored in their normalised form.
export async function getOrCreateTagTx(tx: Tx, name: string): Promise<number> {
  const n = norm(name);
  const [row] = await tx.select({ id: tags.id }).from(tags).where(eq(tags.nameNorm, n));
  if (row) return row.id;
  const [created] = await tx.insert(tags).values({ name: n, nameNorm: n }).returning({ id: tags.id });
  return created.id;
}

export async function myTags(userId: number | undefined, type: string, id: number): Promise<string[]> {
  if (!userId) return [];
  const rows = await db.select({ name: tags.name }).from(taggings)
    .innerJoin(tags, eq(tags.id, taggings.tagId))
    .where(and(eq(taggings.userId, userId), eq(taggings.itemType, type), eq(taggings.itemId, id)));
  return rows.map(r => r.name);
}

export async function addTags(userId: number, type: string, id: number, names: string[]): Promise<void> {
  await transact(async tx => {
    for (const name of names) {
      const tagId = await getOrCreateTagTx(tx, name);
      await tx.insert(taggings)
        .values({ userId, tagId, itemType: type, itemId: id, createdAt: now() })
        .onConflictDoNothing();
    }
  });
}

export async function removeTag(userId: number, type: string, id: number, name: string): Promise<void> {
  const tagId = db.select({ id: tags.id }).from(tags).where(eq(tags.nameNorm, norm(name)));
  await db.delete(taggings).where(and(
    eq(taggings.userId, userId),
    eq(taggings.itemType, type),
    eq(taggings.itemId, id),
    eq(taggings.tagId, tagId),
  ));
}

const single = async (rows: PromiseLike<{ c: number }[]>) => (await rows)[0]?.c ?? 0;

export async function taggedArtists(tagId: number, limit: number): Promise<TaggedArtist[]> {
  const tagCount = sql<number>`SUM(${taggings.weight})`.as("tagCount");
  const listeners = sql<number>`((SELECT COUNT(*) FROM ${userArtists} WHERE ${userArtists.artistId} = ${artists.id}) + ${artists.baseListeners})`.as("listeners");
  const playcount = sql<number>`((SELECT COALESCE(SUM(${userArtists.plays}), 0) FROM ${userArtists} WHERE ${userArtists.artistId} = ${artists.id}) + ${artists.basePlaycount})`.as("playcount");
  return db.select({ id: artists.id, name: artists.name, image: artists.imageId, tagCount, listeners, playcount })
    .from(taggings)
    .innerJoin(artists, eq(artists.id, taggings.itemId))
    .where(and(eq(taggings.tagId, tagId), eq(taggings.itemType, "artist")))
    .groupBy(artists.id)
    .orderBy(desc(tagCount), desc(listeners))
    .limit(limit);
}

export const taggingCount = (tagId: number): Promise<number> =>
  single(db.select({ c: count() }).from(taggings).where(eq(taggings.tagId, tagId)));

export const taggerCount = (tagId: number): Promise<number> =>
  single(db.select({ c: countDistinct(taggings.userId) }).from(taggings).where(eq(taggings.tagId, tagId)));

// Tags most often found on the same items as this one.
export async function relatedTags(tagId: number, limit: number): Promise<TagCount[]> {
  const x = alias(taggings, "x");
  const y = alias(taggings, "y");
  const shared = count().as("count");
  return db.select({ name: tags.name, count: shared }).from(x)
    .innerJoin(y, and(eq(y.itemType, x.itemType), eq(y.itemId, x.itemId), ne(y.tagId, x.tagId)))
    .innerJoin(tags, eq(tags.id, y.tagId))
    .where(eq(x.tagId, tagId))
    .groupBy(tags.id)
    .orderBy(desc(shared))
    .limit(limit);
}

// Inside the subquery `taggings` is its own scope, so `tag_id` is always the
// subquery's column and `id` the outer tag's, whether Drizzle qualifies the names (joins) or not (single-table selects).
const uses = sql<number>`(SELECT COUNT(*) FROM ${taggings} WHERE ${taggings.tagId} = ${tags.id})`;

// An exact match first, then names starting with `q`, then the most used.
export async function matchingTags(q: string, limit: number): Promise<TagCount[]> {
  const esc = q.replace(/[\\%_]/g, m => "\\" + m);
  const n = uses.as("count");
  const contains = sql`${tags.nameNorm} LIKE ${`%${esc}%`} ESCAPE '\\'`;
  const starts = sql`${tags.nameNorm} LIKE ${`${esc}%`} ESCAPE '\\'`;
  return db.select({ name: tags.name, count: n }).from(tags)
    .where(contains)
    .orderBy(desc(sql`(${eq(tags.nameNorm, q)})`), desc(sql`(${starts})`), desc(n), tags.name)
    .limit(limit);
}

export async function recentTags(userId: number, limit: number): Promise<TagCount[]> {
  return db.select({ name: tags.name, count: uses }).from(taggings)
    .innerJoin(tags, eq(tags.id, taggings.tagId))
    .where(eq(taggings.userId, userId))
    .groupBy(tags.id)
    .orderBy(desc(sql`MAX(${taggings.createdAt})`))
    .limit(limit);
}

export async function popularTags(limit: number): Promise<TagCount[]> {
  const n = uses.as("count");
  return db.select({ name: tags.name, count: n }).from(tags).orderBy(desc(n), tags.name).limit(limit);
}
