import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { jellyfinLinks } from "../db/schema";

export type Link = typeof jellyfinLinks.$inferSelect;
export type LinkFields = Pick<
  Link,
  "url" | "username" | "password" | "jellyfinUserId" | "deviceId" | "name" | "version" | "createdAt"
>;

export const findLink = async (userId: number): Promise<Link | null> =>
  (await db.select().from(jellyfinLinks).where(eq(jellyfinLinks.userId, userId)).limit(1))[0] ?? null;

export async function saveLink(userId: number, fields: LinkFields): Promise<void> {
  await db
    .insert(jellyfinLinks)
    .values({ userId, ...fields })
    .onConflictDoUpdate({ target: jellyfinLinks.userId, set: fields });
}

export async function removeLink(userId: number): Promise<void> {
  await db.delete(jellyfinLinks).where(eq(jellyfinLinks.userId, userId));
}
