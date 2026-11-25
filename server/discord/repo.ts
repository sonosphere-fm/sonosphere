import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "../db/client";
import { discordPresence, oauthAccounts, scrobbles, spotifyLinks, users } from "../db/schema";
import { now } from "../util";

export type Optin = typeof discordPresence.$inferSelect;
export type Watched = { discordId: string; userId: number; spotify: boolean };

export async function discordIdOf(userId: number): Promise<string | null> {
  const [row] = await db
    .select({ subject: oauthAccounts.subject })
    .from(oauthAccounts)
    .where(and(eq(oauthAccounts.userId, userId), eq(oauthAccounts.provider, "discord")));
  return row?.subject ?? null;
}

export async function findOptin(userId: number): Promise<Optin | null> {
  const [row] = await db.select().from(discordPresence).where(eq(discordPresence.userId, userId));
  return row ?? null;
}

export async function setOptin(userId: number, on: boolean) {
  if (!on) await db.delete(discordPresence).where(eq(discordPresence.userId, userId));
  else await db.insert(discordPresence).values({ userId, createdAt: now() }).onConflictDoNothing();
}

export async function watched(): Promise<Watched[]> {
  return db
    .select({
      discordId: oauthAccounts.subject,
      userId: discordPresence.userId,
      spotify: sql<boolean>`${spotifyLinks.userId} is not null and ${spotifyLinks.broken} is null`,
    })
    .from(discordPresence)
    .innerJoin(users, eq(users.id, discordPresence.userId))
    .innerJoin(
      oauthAccounts,
      and(eq(oauthAccounts.userId, discordPresence.userId), eq(oauthAccounts.provider, "discord"))
    )
    .leftJoin(spotifyLinks, eq(spotifyLinks.userId, discordPresence.userId))
    .where(and(eq(users.banned, false), eq(users.suspended, false)));
}

export async function sentAround(userId: number, at: number, within: number) {
  return db
    .select({ artist: scrobbles.sentArtist, track: scrobbles.sentTrack })
    .from(scrobbles)
    .where(
      and(eq(scrobbles.userId, userId), gte(scrobbles.playedAt, at - within), lte(scrobbles.playedAt, at + within))
    );
}

export async function counted(userId: number) {
  await db
    .update(discordPresence)
    .set({ lastPlayAt: now() })
    .where(eq(discordPresence.userId, userId));
}
