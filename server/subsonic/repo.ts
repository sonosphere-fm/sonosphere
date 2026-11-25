import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { subsonicLinks } from "../db/schema";

export type Link = typeof subsonicLinks.$inferSelect;
export type LinkFields = Pick<
  Link,
  "url" | "username" | "password" | "name" | "version" | "openSubsonic" | "createdAt"
>;

export const findLink = async (userId: number): Promise<Link | null> =>
  (await db.select().from(subsonicLinks).where(eq(subsonicLinks.userId, userId)).limit(1))[0] ?? null;

export async function saveLink(userId: number, fields: LinkFields): Promise<void> {
  await db
    .insert(subsonicLinks)
    .values({ userId, ...fields })
    .onConflictDoUpdate({ target: subsonicLinks.userId, set: fields });
}

export async function removeLink(userId: number): Promise<void> {
  await db.delete(subsonicLinks).where(eq(subsonicLinks.userId, userId));
}
