import { need } from "../guards";
import { Router } from "../http";
import * as repo from "./repo";
import type { Notifications, NotificationsRead } from "../../shared/notifications";

export const router = new Router();

router.get<Notifications>("/api/notifications", async (c) => {
  const rows = await repo.latestFor(need(c).id);
  return { items: rows.map(repo.shape) };
});

router.post<NotificationsRead>("/api/notifications/read", async (c) => {
  await repo.markAllRead(need(c).id);
  return { ok: true };
});
