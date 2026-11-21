// Shout routes: reading the posts on a page, posting one, deleting one.
import { requireItem } from "../catalog/service";
import { confirmed, need, poster } from "../guards";
import { missing, paging, Router, throttle } from "../http";
import type { ShoutDeleted, ShoutList, ShoutPosted } from "../../shared/shouts";
import * as repo from "./repo";
import { ownerOf, post, remove, wallOpen } from "./service";

export const router = new Router();

router.get<ShoutList>("/api/shouts", async c => {
  const it = await requireItem(c.q.get("type"), c.q.get("id")), pg = paging(c.q, 20, 50), viewerId = c.user?.id ?? 0;
  return {
    items: await repo.listShouts(it.type, it.row.id, viewerId, pg.limit, pg.offset),
    total: await repo.visibleCount(it.type, it.row.id, viewerId), ...pg,
    enabled: wallOpen(it), canModerate: !!c.user && (c.user.isAdmin || ownerOf(it) === c.user.id),
  };
});

router.post<ShoutPosted>("/api/shouts", async c => {
  const u = confirmed(poster(c));
  await throttle(`shout:${u.id}`, 10, 300, "Slow down a little before posting again.");
  await throttle(`shout-h:${u.id}`, 60, 3600, "You have posted a lot in the last hour. Try again later.");
  const it = await requireItem(c.body.type, c.body.id);
  return { id: await post(u, it, c.body.body) };
});

router.delete<ShoutDeleted>("/api/shouts/:id", async c => {
  const u = need(c), id = Number(c.params[0]);
  const s = (Number.isSafeInteger(id) ? await repo.findShout(id) : null) ?? missing("Post");
  await remove(u, s);
  return { ok: true };
});
