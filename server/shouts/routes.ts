import { requireItem } from "../catalog/service";
import { confirmed, need, poster } from "../guards";
import { bad, missing, paging, Router } from "../http";
import type { ShoutDeleted, ShoutList, ShoutPosted } from "../../shared/shouts";
import * as repo from "./repo";
import { ownerOf, post, remove, wallOpen } from "./service";
import { limit } from "../trust/service";
import { blockedEither } from "../users/repo";

export const router = new Router();

router.get<ShoutList>("/api/shouts", async (c) => {
  const it = await requireItem(c.q.get("type"), c.q.get("id"));
  const pg = paging(c.q, 20, 50);
  const viewerId = c.user?.id ?? 0;
  const rawParent = c.q.get("parentId");
  const parentId = rawParent === null ? null : Number(rawParent);
  if (parentId !== null) {
    const parent = Number.isSafeInteger(parentId) ? await repo.findShout(parentId) : null;
    if (!parent || parent.targetType !== it.type || parent.targetId !== it.row.id) return missing("Post");
    if (await blockedEither(parent.authorId, viewerId)) return missing("Post");
  }
  return {
    items: await repo.listShouts(it.type, it.row.id, viewerId, pg.limit, pg.offset, parentId),
    total: await repo.visibleCount(it.type, it.row.id, viewerId, parentId),
    ...pg,
    enabled: wallOpen(it),
    canModerate: !!c.user && (c.user.isAdmin || ownerOf(it) === c.user.id),
  };
});

router.post<ShoutPosted>("/api/shouts", async (c) => {
  const u = confirmed(poster(c));
  await limit(u, `shout:${u.id}`, 10, 300, "Slow down a little before posting again.");
  await limit(u, `shout-h:${u.id}`, 60, 3600, "You have posted a lot in the last hour. Try again later.");
  const it = await requireItem(c.body.type, c.body.id);
  const parentId = c.body.parentId === undefined ? null : Number(c.body.parentId);
  if (parentId !== null && (!Number.isSafeInteger(parentId) || parentId <= 0))
    return bad("Choose a valid post to reply to");
  return { id: await post(u, it, c.body.body, parentId) };
});

router.delete<ShoutDeleted>("/api/shouts/:id", async (c) => {
  const u = need(c);
  const id = Number(c.params[0]);
  const s = (Number.isSafeInteger(id) ? await repo.findShout(id) : null) ?? missing("Post");
  await remove(u, s);
  return { ok: true };
});
