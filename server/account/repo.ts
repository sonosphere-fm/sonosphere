import { and, eq, inArray, ne, type SQL } from "drizzle-orm";
import { db } from "../db/client";
import { apiSessions, apiTokens, emailTokens, journals, modNotes, sessions, shouts, users } from "../db/schema";
import { digest } from "../util";
import { bad } from "../http";
import { handOffGroupsTx } from "../dm/groups.repo";

type ProfileFields = Partial<
  Pick<
    typeof users.$inferInsert,
    | "realname"
    | "pronouns"
    | "about"
    | "country"
    | "profileLinks"
    | "hideRecent"
    | "privateListening"
    | "shoutsEnabled"
    | "dmPolicy"
    | "emailNotify"
    | "emailMuted"
    | "digestAt"
    | "theme"
    | "locale"
    | "useProfileTheme"
    | "usernameFont"
    | "profileAccent"
    | "profileAccentEnd"
  >
>;

export async function updateProfile(userId: number, fields: ProfileFields): Promise<void> {
  await db.update(users).set(fields).where(eq(users.id, userId));
}
export async function setPasswordHash(
  userId: number,
  passwordHash: string,
  expectedHash: string,
  keepToken: string
): Promise<void> {
  await db.transaction(async (tx) => {
    const [user] = await tx.select().from(users).where(eq(users.id, userId)).for("update");
    if (!user || user.passwordHash !== expectedHash) bad("credentialsChangedRefreshTryAgain");
    await tx.update(users).set({ passwordHash }).where(eq(users.id, userId));
    await tx.delete(emailTokens).where(eq(emailTokens.userId, userId));
    await tx.delete(sessions).where(and(eq(sessions.userId, userId), ne(sessions.token, digest(keepToken))));
    await tx.delete(apiSessions).where(eq(apiSessions.userId, userId));
    await tx.delete(apiTokens).where(eq(apiTokens.userId, userId));
  });
}
// Personal data goes by cascade; catalogue contributions stay. `onlyIf` is an extra condition the row must still meet.
export async function deleteAccount(userId: number, onlyIf?: SQL): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, userId), onlyIf))
      .for("update");
    if (!row) return false;
    // shouts point at their target by type and id, so they don't cascade; journal ones go while the journals still exist
    const ownJournals = tx.select({ id: journals.id }).from(journals).where(eq(journals.userId, userId));
    await tx.delete(shouts).where(and(eq(shouts.targetType, "journal"), inArray(shouts.targetId, ownJournals)));
    await tx.delete(shouts).where(and(eq(shouts.targetType, "user"), eq(shouts.targetId, userId)));
    await tx.delete(modNotes).where(eq(modNotes.userId, userId));
    await handOffGroupsTx(tx, userId);
    await tx.delete(users).where(eq(users.id, userId));
    return true;
  });
}
