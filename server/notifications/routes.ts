// Notifications API: the signed-in user's latest notifications, and marking them all read.
import { need } from "../guards";
import { Router } from "../http";
import * as repo from "./repo";
import type { Notifications, NotificationsRead } from "../../shared/notifications";

export const router = new Router();

/** The details stored with a notification. They are always written as a JSON object (see `notify`). */
function details(json: string): Record<string, unknown> {
  const v: unknown = JSON.parse(json);
  // `as`: an array is an object too and has always been passed through as it is
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};
}

router.get<Notifications>("/api/notifications", async c => ({
  items: (await repo.latestFor(need(c).id)).map(n => ({
    id: n.id, type: n.type, data: details(n.data), read: n.read, createdAt: n.createdAt, actor: { username: n.username, image: n.image },
  })),
}));

router.post<NotificationsRead>("/api/notifications/read", async c => {
  await repo.markAllRead(need(c).id);
  return { ok: true };
});
