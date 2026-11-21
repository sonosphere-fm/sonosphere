// Data access for notifications.
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { blocks, notifications, users } from "../db/schema";
import { first, now } from "../util";
import { mailNotice } from "./email";

/**
 * Tells `userId` that `actorId` did something (`type`, with `data` for the details). Nothing is sent for your own
 * actions or when the recipient has blocked the actor.
 */
export async function notify(userId: number, type: string, actorId: number, data: object = {}): Promise<void> {
  if (userId === actorId) return;
  if (await first(db.select({ one: sql`1` }).from(blocks).where(and(eq(blocks.blockerId, userId), eq(blocks.blockedId, actorId))).limit(1))) return;
  await db.insert(notifications).values({ userId, type, actorId, data: JSON.stringify(data), createdAt: now() });
  await mailNotice(userId, type, actorId, data as Record<string, unknown>);
}

/** A stored notification with who caused it. `data` is still JSON text; the actor fields are null once that account is gone. */
export type NotificationRow = { id: number; type: string; data: string; read: boolean; createdAt: number; username: string | null; image: string | null };

/** Someone's newest notifications, read or not. */
export const latestFor = (userId: number, limit = 100): Promise<NotificationRow[]> =>
  db.select({ id: notifications.id, type: notifications.type, data: notifications.data, read: notifications.read, createdAt: notifications.createdAt, username: users.username, image: users.imageId })
    .from(notifications).leftJoin(users, eq(users.id, notifications.actorId))
    .where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(limit);

export async function markAllRead(userId: number): Promise<void> {
  await db.update(notifications).set({ read: true }).where(eq(notifications.userId, userId));
}
