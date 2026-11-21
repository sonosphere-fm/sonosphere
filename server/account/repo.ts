// Data access for account settings: the profile fields an account can edit, its password, and deleting it.
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { users } from "../db/schema";

/** The profile fields an account may change about itself. */
export type ProfileFields = Partial<Pick<typeof users.$inferInsert, "realname" | "about" | "country" | "website" | "hideRecent" | "privateListening" | "shoutsEnabled" | "dmPolicy">>;

export async function updateProfile(userId: number, fields: ProfileFields): Promise<void> {
  await db.update(users).set(fields).where(eq(users.id, userId));
}
export async function setPasswordHash(userId: number, passwordHash: string): Promise<void> {
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
}
/** Removes the account. Everything that belongs to it (sessions, scrobbles, shouts and so on) goes with it. */
export async function deleteAccount(userId: number): Promise<void> {
  await db.delete(users).where(eq(users.id, userId));
}
