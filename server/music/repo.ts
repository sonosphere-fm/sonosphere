import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { jellyfinLinks, subsonicLinks } from "../db/schema";
import type { MusicKind } from "../../shared/music";

export type Active =
  | { kind: "subsonic"; link: typeof subsonicLinks.$inferSelect }
  | { kind: "jellyfin"; link: typeof jellyfinLinks.$inferSelect };

/** A listener has one music server: whichever of the two link rows was saved last. */
export async function findActive(userId: number): Promise<Active | null> {
  const [subsonic, jellyfin] = await Promise.all([
    db.select().from(subsonicLinks).where(eq(subsonicLinks.userId, userId)).limit(1),
    db.select().from(jellyfinLinks).where(eq(jellyfinLinks.userId, userId)).limit(1),
  ]);
  const sub = subsonic[0];
  const jel = jellyfin[0];
  if (sub && jel) {
    return sub.createdAt >= jel.createdAt ? { kind: "subsonic", link: sub } : { kind: "jellyfin", link: jel };
  }
  if (sub) return { kind: "subsonic", link: sub };
  if (jel) return { kind: "jellyfin", link: jel };
  return null;
}

export async function removeOther(userId: number, kept: MusicKind): Promise<void> {
  if (kept === "subsonic") await db.delete(jellyfinLinks).where(eq(jellyfinLinks.userId, userId));
  else await db.delete(subsonicLinks).where(eq(subsonicLinks.userId, userId));
}
