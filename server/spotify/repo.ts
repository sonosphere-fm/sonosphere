import { and, asc, eq, isNull, lt } from "drizzle-orm";
import { db } from "../db/client";
import { spotifyAuth, spotifyLinks } from "../db/schema";

export type Link = typeof spotifyLinks.$inferSelect;
type NewLink = typeof spotifyLinks.$inferInsert;
type PendingAuth = typeof spotifyAuth.$inferSelect;

export async function findLink(userId: number): Promise<Link | null> {
  const [link] = await db.select().from(spotifyLinks).where(eq(spotifyLinks.userId, userId));
  return link ?? null;
}

/** Linking again (same or another Spotify account) replaces the old link and starts importing afresh. */
export async function saveLink(row: NewLink): Promise<void> {
  const { userId: _, ...rest } = row;
  await db.insert(spotifyLinks).values(row).onConflictDoUpdate({ target: spotifyLinks.userId, set: rest });
}

export async function updateLink(userId: number, set: Partial<Omit<NewLink, "userId">>): Promise<void> {
  await db.update(spotifyLinks).set(set).where(eq(spotifyLinks.userId, userId));
}

export async function dropLink(userId: number): Promise<boolean> {
  const gone = await db.delete(spotifyLinks).where(eq(spotifyLinks.userId, userId)).returning({ id: spotifyLinks.userId });
  return gone.length > 0;
}

/** Working links whose recent plays were last fetched before `before`, longest-waiting first. */
export const dueLinks = (before: number, limit: number): Promise<Link[]> =>
  db.select()
    .from(spotifyLinks)
    .where(and(isNull(spotifyLinks.broken), lt(spotifyLinks.recentAt, before)))
    .orderBy(asc(spotifyLinks.recentAt))
    .limit(limit);

export const workingLinks = (): Promise<Link[]> => db.select().from(spotifyLinks).where(isNull(spotifyLinks.broken));

/** Working links whose "now playing" was last checked before `before`. */
export const playingDue = (before: number, limit: number): Promise<Link[]> =>
  db.select()
    .from(spotifyLinks)
    .where(and(isNull(spotifyLinks.broken), lt(spotifyLinks.playingAt, before)))
    .orderBy(asc(spotifyLinks.playingAt))
    .limit(limit);

export async function savePending(row: PendingAuth): Promise<void> {
  await db.insert(spotifyAuth).values(row);
}

export async function findPending(state: string): Promise<PendingAuth | null> {
  const [pending] = await db.select().from(spotifyAuth).where(eq(spotifyAuth.state, state));
  return pending ?? null;
}

/** Each pending sign-in can be used once. */
export async function takePending(state: string): Promise<PendingAuth | null> {
  const [pending] = await db.delete(spotifyAuth).where(eq(spotifyAuth.state, state)).returning();
  return pending ?? null;
}

export async function dropStalePending(before: number): Promise<void> {
  await db.delete(spotifyAuth).where(lt(spotifyAuth.createdAt, before));
}
