// Data access for the staff content pages: listing shouts, journal posts and wiki versions, removing them, and
// reverting and locking wikis.
import { and, count, desc, eq, exists, max, or, sql, type AnyColumn } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { db, transact } from "../db/client";
import { albums, artists, journals, reports, shouts, tags, tracks, users, wikiLocks, wikis } from "../db/schema";
import { like, norm, now } from "../util";
import type { AuditEntry } from "../site/audit";
import { closeReportsTx, removeContentTx } from "../moderation/repo";
import { auditTx } from "../site/audit";

/** What a content list is narrowed by: the author's username, a search term, and (wikis) only locked pages. */
export type ContentFilter = { author: string; term: string; locked?: boolean };
type Page = { limit: number; offset: number };

const contains = (column: AnyColumn, term: string) => sql`${column} LIKE ${like(term)} ESCAPE '\\'`;
const byAuthor = (f: ContentFilter) => (f.author ? eq(users.usernameNorm, norm(f.author)) : undefined);
/** How many open reports there are against one piece of content. */
const openReports = (type: string, id: AnyColumn) =>
  sql<number>`(SELECT COUNT(*) FROM ${reports} WHERE ${reports.status} = 'open' AND ${reports.targetType} = ${type} AND ${reports.targetId} = ${id})`;
const total = async (rows: PromiseLike<{ c: number }[]>) => (await rows)[0]?.c ?? 0;

// ---------- lists ----------
const shoutWhere = (f: ContentFilter) => and(byAuthor(f), f.term ? contains(shouts.body, f.term) : undefined);
export const shoutRows = (f: ContentFilter, pg: Page) =>
  db.select({ id: shouts.id, body: shouts.body, author: users.username, createdAt: shouts.createdAt, targetType: shouts.targetType, targetId: shouts.targetId, reports: openReports("shout", shouts.id) })
    .from(shouts).innerJoin(users, eq(users.id, shouts.authorId)).where(shoutWhere(f)).orderBy(desc(shouts.createdAt), desc(shouts.id)).limit(pg.limit).offset(pg.offset);
export const shoutCount = (f: ContentFilter) => total(db.select({ c: count() }).from(shouts).innerJoin(users, eq(users.id, shouts.authorId)).where(shoutWhere(f)));

const journalWhere = (f: ContentFilter) => and(byAuthor(f), f.term ? or(contains(journals.title, f.term), contains(journals.body, f.term)) : undefined);
export const journalRows = (f: ContentFilter, pg: Page) =>
  db.select({
    id: journals.id, title: journals.title, body: journals.body, author: users.username, createdAt: journals.createdAt, updatedAt: journals.updatedAt,
    comments: sql<number>`(SELECT COUNT(*) FROM ${shouts} WHERE ${shouts.targetType} = 'journal' AND ${shouts.targetId} = ${journals.id})`,
    reports: openReports("journal", journals.id),
  }).from(journals).innerJoin(users, eq(users.id, journals.userId)).where(journalWhere(f)).orderBy(desc(journals.createdAt), desc(journals.id)).limit(pg.limit).offset(pg.offset);
export const journalCount = (f: ContentFilter) => total(db.select({ c: count() }).from(journals).innerJoin(users, eq(users.id, journals.userId)).where(journalWhere(f)));

const lockOn = (type: AnyColumn, id: AnyColumn) =>
  exists(db.select({ one: sql`1` }).from(wikiLocks).where(and(eq(wikiLocks.itemType, type), eq(wikiLocks.itemId, id))));
const wikiWhere = (f: ContentFilter) => and(byAuthor(f), f.term ? contains(wikis.content, f.term) : undefined, f.locked ? lockOn(wikis.itemType, wikis.itemId) : undefined);
/** Wiki versions, newest first. `top` is the newest version number of the same page. */
export function wikiRows(f: ContentFilter, pg: Page) {
  const other = alias(wikis, "other");
  return db.select({
    id: wikis.id, itemType: wikis.itemType, itemId: wikis.itemId, version: wikis.version, content: wikis.content, author: users.username, createdAt: wikis.createdAt,
    top: sql<number>`(${db.select({ v: max(other.version) }).from(other).where(and(eq(other.itemType, wikis.itemType), eq(other.itemId, wikis.itemId)))})`,
    locked: sql<number>`${lockOn(wikis.itemType, wikis.itemId)}`, reports: openReports("wiki", wikis.id),
  }).from(wikis).leftJoin(users, eq(users.id, wikis.authorId)).where(wikiWhere(f)).orderBy(desc(wikis.createdAt), desc(wikis.id)).limit(pg.limit).offset(pg.offset);
}
export const wikiCount = (f: ContentFilter) => total(db.select({ c: count() }).from(wikis).leftJoin(users, eq(users.id, wikis.authorId)).where(wikiWhere(f)));

// ---------- removing ----------
/**
 * Deletes a shout, journal post or wiki version, closes the open reports about it and records the action, all or
 * nothing. `entry` builds the audit record from the number of reports closed.
 */
export function removeContent(kind: string, id: number, actor: { id: number; username: string }, why: string, entry: (closedReports: number) => AuditEntry): void {
  transact(tx => {
    removeContentTx(tx, kind, id, actor.id);
    auditTx(tx, actor, entry(closeReportsTx(tx, kind, id, "content removed", actor.id, why)));
  });
}

// ---------- wikis ----------
const WIKI_TABLES = { artist: artists, album: albums, track: tracks, tag: tags };
export type WikiType = keyof typeof WIKI_TABLES;
export const isWikiType = (type: string): type is WikiType => type in WIKI_TABLES && Object.hasOwn(WIKI_TABLES, type);
/** Whether the artist, album, track or tag a wiki belongs to exists. */
export async function wikiItemExists(type: WikiType, id: number): Promise<boolean> {
  const table = WIKI_TABLES[type];
  return (await db.select({ id: table.id }).from(table).where(eq(table.id, id)).limit(1)).length > 0;
}
/** Every version of one wiki, newest first. */
export const wikiVersions = (type: string, id: number) =>
  db.select({ id: wikis.id, version: wikis.version, content: wikis.content, createdAt: wikis.createdAt, author: users.username })
    .from(wikis).leftJoin(users, eq(users.id, wikis.authorId)).where(and(eq(wikis.itemType, type), eq(wikis.itemId, id))).orderBy(desc(wikis.version));
export const wikiRevision = async (id: number) => (await db.select().from(wikis).where(eq(wikis.id, id)).limit(1))[0] ?? null;
/** The newest version number of a wiki (0 when it has none). */
export const topVersion = async (type: string, id: number): Promise<number> =>
  (await db.select({ v: max(wikis.version) }).from(wikis).where(and(eq(wikis.itemType, type), eq(wikis.itemId, id))))[0]?.v ?? 0;
export async function addWikiVersion(type: string, id: number, content: string, authorId: number, version: number): Promise<void> {
  await db.insert(wikis).values({ itemType: type, itemId: id, content, authorId, version, createdAt: now() });
}
/** Locks a wiki against edits, replacing any lock already on it. */
export async function lockWiki(type: string, id: number, by: number, reason: string): Promise<void> {
  const lock = { lockedBy: by, reason, createdAt: now() };
  await db.insert(wikiLocks).values({ itemType: type, itemId: id, ...lock }).onConflictDoUpdate({ target: [wikiLocks.itemType, wikiLocks.itemId], set: lock });
}
export async function unlockWiki(type: string, id: number): Promise<void> {
  await db.delete(wikiLocks).where(and(eq(wikiLocks.itemType, type), eq(wikiLocks.itemId, id)));
}
/** Every locked wiki, the most recently locked first. `by` is the username of whoever locked it. */
export const lockRows = () =>
  db.select({ type: wikiLocks.itemType, id: wikiLocks.itemId, by: users.username, reason: wikiLocks.reason, at: wikiLocks.createdAt })
    .from(wikiLocks).leftJoin(users, eq(users.id, wikiLocks.lockedBy)).orderBy(desc(wikiLocks.createdAt));
