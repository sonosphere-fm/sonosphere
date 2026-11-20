// Data access for tags.
import { and, count, countDistinct, desc, eq, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { db, transact, type Tx } from "../db/client";
import { artists, taggings, tags, userArtists } from "../db/schema";
import { norm, now } from "../util";
import type { TagCount, TaggedArtist } from "../../shared/tags";

/** The strongest tags on an item. */
export async function topTags(type: string, id: number, limit = 10): Promise<TagCount[]> {
  const weight = sql<number>`SUM(${taggings.weight})`.as("count");
  return db.select({ name: tags.name, count: weight }).from(taggings).innerJoin(tags, eq(tags.id, taggings.tagId))
    .where(and(eq(taggings.itemType, type), eq(taggings.itemId, id))).groupBy(taggings.tagId).orderBy(desc(weight), tags.name).limit(limit);
}

/** The id of a tag, adding it if it is new. Tags are stored in their normalised form. */
export function getOrCreateTagTx(tx: Tx, name: string): number {
  const n = norm(name);
  const row = tx.select({ id: tags.id }).from(tags).where(eq(tags.nameNorm, n)).get();
  return row ? row.id : tx.insert(tags).values({ name: n, nameNorm: n }).returning({ id: tags.id }).get().id;
}
export const getOrCreateTag = async (name: string): Promise<number> => transact(tx => getOrCreateTagTx(tx, name));

// ---------- one person's tags ----------
/** The names of the tags a person has put on an item. Nobody (no user id) has none. */
export async function myTags(userId: number | undefined, type: string, id: number): Promise<string[]> {
  if (!userId) return [];
  const rows = await db.select({ name: tags.name }).from(taggings).innerJoin(tags, eq(tags.id, taggings.tagId))
    .where(and(eq(taggings.userId, userId), eq(taggings.itemType, type), eq(taggings.itemId, id)));
  return rows.map(r => r.name);
}

/** Puts tags on an item for a person, adding tags that are new. Ones they had already applied are left alone. */
export async function addTags(userId: number, type: string, id: number, names: string[]): Promise<void> {
  transact(tx => {
    for (const name of names) {
      tx.insert(taggings).values({ userId, tagId: getOrCreateTagTx(tx, name), itemType: type, itemId: id, createdAt: now() }).onConflictDoNothing().run();
    }
  });
}

/** Takes a person's tag off an item. */
export async function removeTag(userId: number, type: string, id: number, name: string): Promise<void> {
  await db.delete(taggings).where(and(eq(taggings.userId, userId), eq(taggings.itemType, type), eq(taggings.itemId, id),
    eq(taggings.tagId, db.select({ id: tags.id }).from(tags).where(eq(tags.nameNorm, norm(name))))));
}

// ---------- a tag's page ----------
const single = async (rows: PromiseLike<{ c: number }[]>) => (await rows)[0]?.c ?? 0;

/** The artists a tag applies to most strongly, with their site-wide totals. */
export async function taggedArtists(tagId: number, limit: number): Promise<TaggedArtist[]> {
  const tagCount = sql<number>`SUM(${taggings.weight})`.as("tagCount");
  const listeners = sql<number>`((SELECT COUNT(*) FROM ${userArtists} WHERE ${userArtists.artistId} = ${artists.id}) + ${artists.baseListeners})`.as("listeners");
  const playcount = sql<number>`((SELECT COALESCE(SUM(${userArtists.plays}), 0) FROM ${userArtists} WHERE ${userArtists.artistId} = ${artists.id}) + ${artists.basePlaycount})`.as("playcount");
  return db.select({ id: artists.id, name: artists.name, image: artists.imageId, tagCount, listeners, playcount })
    .from(taggings).innerJoin(artists, eq(artists.id, taggings.itemId))
    .where(and(eq(taggings.tagId, tagId), eq(taggings.itemType, "artist"))).groupBy(artists.id).orderBy(desc(tagCount), desc(listeners)).limit(limit);
}

/** How many times a tag has been applied. */
export const taggingCount = (tagId: number): Promise<number> => single(db.select({ c: count() }).from(taggings).where(eq(taggings.tagId, tagId)));
/** How many people have applied a tag. */
export const taggerCount = (tagId: number): Promise<number> => single(db.select({ c: countDistinct(taggings.userId) }).from(taggings).where(eq(taggings.tagId, tagId)));

/** Tags most often found on the same items as this one. */
export async function relatedTags(tagId: number, limit: number): Promise<TagCount[]> {
  const x = alias(taggings, "x"), y = alias(taggings, "y"), shared = count().as("count");
  return db.select({ name: tags.name, count: shared }).from(x)
    .innerJoin(y, and(eq(y.itemType, x.itemType), eq(y.itemId, x.itemId), ne(y.tagId, x.tagId))).innerJoin(tags, eq(tags.id, y.tagId))
    .where(eq(x.tagId, tagId)).groupBy(tags.id).orderBy(desc(shared)).limit(limit);
}

// ---------- suggestions ----------
// Selected next to a tag: how many times it has been applied. Inside the subquery `taggings` is its own scope, so `tag_id` is always the
// subquery's column and `id` the outer tag's, whether Drizzle qualifies the names (joins) or not (single-table selects).
const uses = sql<number>`(SELECT COUNT(*) FROM ${taggings} WHERE ${taggings.tagId} = ${tags.id})`;

/** Tags whose name contains `q` (already normalised): an exact match first, then names starting with it, then the most used. */
export async function matchingTags(q: string, limit: number): Promise<TagCount[]> {
  const esc = q.replace(/[\\%_]/g, m => "\\" + m), n = uses.as("count");
  const contains = sql`${tags.nameNorm} LIKE ${`%${esc}%`} ESCAPE '\\'`, starts = sql`${tags.nameNorm} LIKE ${`${esc}%`} ESCAPE '\\'`;
  return db.select({ name: tags.name, count: n }).from(tags).where(contains)
    .orderBy(desc(sql`(${eq(tags.nameNorm, q)})`), desc(sql`(${starts})`), desc(n), tags.name).limit(limit);
}

/** The tags a person has applied, most recently used first. */
export async function recentTags(userId: number, limit: number): Promise<TagCount[]> {
  return db.select({ name: tags.name, count: uses }).from(taggings).innerJoin(tags, eq(tags.id, taggings.tagId))
    .where(eq(taggings.userId, userId)).groupBy(tags.id).orderBy(desc(sql`MAX(${taggings.createdAt})`)).limit(limit);
}

/** The most used tags on the site. */
export async function popularTags(limit: number): Promise<TagCount[]> {
  const n = uses.as("count");
  return db.select({ name: tags.name, count: n }).from(tags).orderBy(desc(n), tags.name).limit(limit);
}
