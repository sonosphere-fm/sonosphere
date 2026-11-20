// Data access for linked Spotify accounts and sign-ins in progress.
import { and, asc, eq, isNull, lt } from "drizzle-orm";
import { db } from "../db/client";
import { spotifyAuth, spotifyLinks } from "../db/schema";

export type Link = typeof spotifyLinks.$inferSelect;
export type NewLink = typeof spotifyLinks.$inferInsert;
export type PendingAuth = typeof spotifyAuth.$inferSelect;

export const findLink = async (userId: number): Promise<Link | null> =>
  (await db.select().from(spotifyLinks).where(eq(spotifyLinks.userId, userId)).get()) ?? null;

/** Linking again (same or another Spotify account) replaces the old link and starts importing afresh. */
export async function saveLink(row: NewLink): Promise<void> {
  const { userId: _, ...rest } = row;
  await db.insert(spotifyLinks).values(row).onConflictDoUpdate({ target: spotifyLinks.userId, set: rest });
}

export async function updateLink(userId: number, set: Partial<Omit<NewLink, "userId">>): Promise<void> {
  await db.update(spotifyLinks).set(set).where(eq(spotifyLinks.userId, userId));
}

export async function dropLink(userId: number): Promise<boolean> {
  return (await db.delete(spotifyLinks).where(eq(spotifyLinks.userId, userId)).returning({ id: spotifyLinks.userId })).length > 0;
}

/** Working links whose recent plays were last fetched before `before`, longest-waiting first. */
export const dueLinks = (before: number, limit: number): Promise<Link[]> =>
  db.select().from(spotifyLinks).where(and(isNull(spotifyLinks.broken), lt(spotifyLinks.recentAt, before))).orderBy(asc(spotifyLinks.recentAt)).limit(limit);

/** Working links whose "now playing" was last checked before `before`. */
export const playingDue = (before: number, limit: number): Promise<Link[]> =>
  db.select().from(spotifyLinks).where(and(isNull(spotifyLinks.broken), lt(spotifyLinks.playingAt, before))).orderBy(asc(spotifyLinks.playingAt)).limit(limit);

export async function savePending(row: PendingAuth): Promise<void> {
  await db.insert(spotifyAuth).values(row);
}

export const findPending = async (state: string): Promise<PendingAuth | null> =>
  (await db.select().from(spotifyAuth).where(eq(spotifyAuth.state, state)).get()) ?? null;

/** Takes a pending sign-in (each can be used once). */
export async function takePending(state: string): Promise<PendingAuth | null> {
  return (await db.delete(spotifyAuth).where(eq(spotifyAuth.state, state)).returning().get()) ?? null;
}

export async function dropStalePending(before: number): Promise<void> {
  await db.delete(spotifyAuth).where(lt(spotifyAuth.createdAt, before));
}
