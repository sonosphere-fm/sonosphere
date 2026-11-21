import { need } from "../guards";
import { Router } from "../http";
import * as repo from "./repo";
import type { Notifications, NotificationsRead } from "../../shared/notifications";

export const router = new Router();

function details(json: string): Record<string, unknown> {
  const v: unknown = JSON.parse(json);
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};
}

router.get<Notifications>("/api/notifications", async c => {
  const rows = await repo.latestFor(need(c).id);
  const items = rows.map(n => ({
    id: n.id,
    type: n.type,
    data: details(n.data),
    read: n.read,
    createdAt: n.createdAt,
    actor: { username: n.username, image: n.image },
  }));
  return { items };
});

router.post<NotificationsRead>("/api/notifications/read", async c => {
  await repo.markAllRead(need(c).id);
  return { ok: true };
});
