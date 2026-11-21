// Data access for accounts at other sites linked to accounts here.
import { and, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { oauthAccounts } from "../../db/schema";
import { first, now } from "../../util";

export type Link = typeof oauthAccounts.$inferSelect;

/** The account here that this person at `provider` signs in to. */
export const findLink = (provider: string, subject: string): Promise<Link | null> =>
  first(db.select().from(oauthAccounts).where(and(eq(oauthAccounts.provider, provider), eq(oauthAccounts.subject, subject))).limit(1));
/** The `provider` account linked to this account here, if any. */
export const linkOf = (userId: number, provider: string): Promise<Link | null> =>
  first(db.select().from(oauthAccounts).where(and(eq(oauthAccounts.userId, userId), eq(oauthAccounts.provider, provider))).limit(1));
export const linksOf = (userId: number): Promise<Link[]> => db.select().from(oauthAccounts).where(eq(oauthAccounts.userId, userId));

export async function addLink(provider: string, subject: string, userId: number, name: string): Promise<void> {
  await db.insert(oauthAccounts).values({ provider, subject, userId, name: name.slice(0, 100), createdAt: now() });
}
/** Keeps the handle shown in settings current when someone renames themselves there. */
export async function renameLink(provider: string, subject: string, name: string): Promise<void> {
  await db.update(oauthAccounts).set({ name: name.slice(0, 100) }).where(and(eq(oauthAccounts.provider, provider), eq(oauthAccounts.subject, subject)));
}
export async function removeLink(userId: number, provider: string): Promise<void> {
  await db.delete(oauthAccounts).where(and(eq(oauthAccounts.userId, userId), eq(oauthAccounts.provider, provider)));
}
