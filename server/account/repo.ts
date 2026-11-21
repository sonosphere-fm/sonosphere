// Data access for account settings: the profile fields an account can edit, its password, and deleting it.
import { and, eq, inArray, type SQL } from "drizzle-orm";
import { db } from "../db/client";
import { journals, modNotes, shouts, users } from "../db/schema";

/** The profile fields an account may change about itself. */
export type ProfileFields = Partial<Pick<typeof users.$inferInsert, "realname" | "about" | "country" | "website" | "hideRecent" | "privateListening" | "shoutsEnabled" | "dmPolicy" | "emailNotify" | "emailMuted" | "digestAt" | "theme">>;

export async function updateProfile(userId: number, fields: ProfileFields): Promise<void> {
  await db.update(users).set(fields).where(eq(users.id, userId));
}
export async function setPasswordHash(userId: number, passwordHash: string): Promise<void> {
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
}
/**
 * Removes the account and what is personal to it (sessions, scrobbles, posts, playlists... by cascade). What it gave
 * the catalogue stays: wiki versions and events show "a deleted user", uploaded artwork stays
 * with its artist or album. The profile picture, now unused, leaves storage with the next sweep (images/repo.ts).
 * `onlyIf` is an extra condition the account must still meet (e.g. "still unconfirmed"); returns whether it went.
 */
export async function deleteAccount(userId: number, onlyIf?: SQL): Promise<boolean> {
  return db.transaction(async tx => {
    // lock the row and check the condition first, so nothing is touched for an account that no longer qualifies
    const [row] = await tx.select({ id: users.id }).from(users).where(and(eq(users.id, userId), onlyIf)).for("update");
    if (!row) return false;
    // posts aimed at the profile or its journal point at it by type and id, so they don't cascade on their own
    // (cleared before the account, while its journal posts still exist to find them by)
    await tx.delete(shouts).where(and(eq(shouts.targetType, "journal"), inArray(shouts.targetId, tx.select({ id: journals.id }).from(journals).where(eq(journals.userId, userId)))));
    await tx.delete(shouts).where(and(eq(shouts.targetType, "user"), eq(shouts.targetId, userId)));
    await tx.delete(modNotes).where(eq(modNotes.userId, userId));
    await tx.delete(users).where(eq(users.id, userId));
    return true;
  });
}
