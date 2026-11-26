import { and, eq, notExists, sql } from "drizzle-orm";
import { db } from "../db/client";
import { discordRichPresence, users } from "../db/schema";
import type { PresencePreferences } from "../../shared/discord";

export type Link = typeof discordRichPresence.$inferSelect;
type NewLink = typeof discordRichPresence.$inferInsert;

export async function findLink(userId: number): Promise<(Link & { banned: boolean }) | null> {
  const [row] = await db
    .select({ link: discordRichPresence, banned: users.banned })
    .from(discordRichPresence)
    .innerJoin(users, eq(users.id, discordRichPresence.userId))
    .where(eq(discordRichPresence.userId, userId));
  return row ? { ...row.link, banned: row.banned } : null;
}

export async function saveLink(row: Omit<NewLink, keyof PresencePreferences>): Promise<void> {
  const { userId, ...grant } = row;
  await db
    .insert(discordRichPresence)
    .values({ userId, ...grant })
    .onConflictDoUpdate({ target: discordRichPresence.userId, set: grant });
}

export async function updateLink(userId: number, set: Partial<Omit<NewLink, "userId">>): Promise<boolean> {
  const result = await db.update(discordRichPresence).set(set).where(eq(discordRichPresence.userId, userId));
  return result.count > 0;
}

export async function dropLink(userId: number): Promise<void> {
  await db.delete(discordRichPresence).where(eq(discordRichPresence.userId, userId));
}

/** Links that should currently show presence: on, working, not banned. */
export const workingLinks = (): Promise<Link[]> =>
  db
    .select()
    .from(discordRichPresence)
    .where(
      and(
        eq(discordRichPresence.on, true),
        eq(discordRichPresence.broken, false),
        notExists(
          db
            .select({ one: sql`1` })
            .from(users)
            .where(and(eq(users.id, discordRichPresence.userId), eq(users.banned, true)))
        )
      )
    );
