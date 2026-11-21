import { and, eq, inArray, type SQL } from "drizzle-orm";
import { db } from "../db/client";
import { journals, modNotes, shouts, users } from "../db/schema";

type ProfileFields = Partial<Pick<typeof users.$inferInsert,
  | "realname" | "pronouns" | "about" | "country" | "website" | "hideRecent" | "privateListening"
  | "shoutsEnabled" | "dmPolicy" | "emailNotify" | "emailMuted" | "digestAt" | "theme"
>>;

export async function updateProfile(userId: number, fields: ProfileFields): Promise<void> {
  await db.update(users).set(fields).where(eq(users.id, userId));
}
export async function setPasswordHash(userId: number, passwordHash: string): Promise<void> {
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
}
// Personal data goes by cascade; catalogue contributions stay. `onlyIf` is an extra condition the row must still meet.
export async function deleteAccount(userId: number, onlyIf?: SQL): Promise<boolean> {
  return db.transaction(async tx => {
    const [row] = await tx.select({ id: users.id }).from(users).where(and(eq(users.id, userId), onlyIf)).for("update");
    if (!row) return false;
    // shouts point at their target by type and id, so they don't cascade; journal ones go while the journals still exist
    const ownJournals = tx.select({ id: journals.id }).from(journals).where(eq(journals.userId, userId));
    await tx.delete(shouts).where(and(eq(shouts.targetType, "journal"), inArray(shouts.targetId, ownJournals)));
    await tx.delete(shouts).where(and(eq(shouts.targetType, "user"), eq(shouts.targetId, userId)));
    await tx.delete(modNotes).where(eq(modNotes.userId, userId));
    await tx.delete(users).where(eq(users.id, userId));
    return true;
  });
}
