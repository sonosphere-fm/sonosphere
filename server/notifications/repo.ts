import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { blocks, notifications, users } from "../db/schema";
import { first, now } from "../util";
import { mailNotice } from "./email";
import { appearanceCols } from "../users/appearance";
import type { UserAppearance } from "../../shared/username-fonts";

export async function notify(userId: number, type: string, actorId: number, data: object = {}): Promise<void> {
  if (userId === actorId) return;
  const blocked = await first(
    db
      .select({ one: sql`1` })
      .from(blocks)
      .where(and(eq(blocks.blockerId, userId), eq(blocks.blockedId, actorId)))
      .limit(1)
  );
  if (blocked) return;
  await db.insert(notifications).values({ userId, type, actorId, data: JSON.stringify(data), createdAt: now() });
  await mailNotice(userId, type, actorId, data as Record<string, unknown>);
}

type NotificationRow = Omit<UserAppearance, "usernameFont"> & { usernameFont: string | null } & {
  id: number;
  type: string;
  data: string;
  read: boolean;
  createdAt: number;
  username: string | null;
  image: string | null;
};

export const latestFor = (userId: number, limit = 100): Promise<NotificationRow[]> =>
  db
    .select({
      id: notifications.id,
      type: notifications.type,
      data: notifications.data,
      read: notifications.read,
      createdAt: notifications.createdAt,
      username: users.username,
      ...appearanceCols,
      image: users.imageId,
    })
    .from(notifications)
    .leftJoin(users, eq(users.id, notifications.actorId))
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);

export async function markAllRead(userId: number): Promise<void> {
  await db.update(notifications).set({ read: true }).where(eq(notifications.userId, userId));
}
