import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { blocks, notifications, users } from "../db/schema";
import { first, now } from "../util";
import { mailNotice } from "./email";
import { appearanceCols, userAppearance } from "../users/appearance";
import { unreadCount } from "../auth/repo";
import { push } from "../realtime";
import type { Notification, NotificationEvent } from "../../shared/notifications";
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
  const [row] = await db
    .insert(notifications)
    .values({ userId, type, actorId, data: JSON.stringify(data), createdAt: now() })
    .returning({ id: notifications.id });
  const [added] = await rows().where(eq(notifications.id, row!.id));
  if (added) {
    const event: NotificationEvent = {
      t: "notification",
      notification: shape(added),
      unread: await unreadCount(userId),
    };
    push(userId, event);
  }
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

const rows = () =>
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
    .$dynamic();

export const latestFor = (userId: number, limit = 100): Promise<NotificationRow[]> =>
  rows().where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(limit);

function details(json: string): Record<string, unknown> {
  const v: unknown = JSON.parse(json);
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};
}

export const shape = (n: NotificationRow): Notification => ({
  id: n.id,
  type: n.type,
  data: details(n.data),
  read: n.read,
  createdAt: n.createdAt,
  actor: { ...userAppearance(n), username: n.username, image: n.image },
});

export async function markAllRead(userId: number): Promise<void> {
  await db.update(notifications).set({ read: true }).where(eq(notifications.userId, userId));
}
