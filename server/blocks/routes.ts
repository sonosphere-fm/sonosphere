import { need } from "../guards";
import { bad, Router, throttle } from "../http";
import { requireUser } from "../users/service";
import * as repo from "./repo";
import type { BlockResult, Blocks } from "../../shared/blocks";

export const router = new Router();

router.get<Blocks>("/api/blocks", async (c) => ({ items: await repo.blockedBy(need(c).id) }));

// `block: false` in the body unblocks; anything else blocks.
router.post<BlockResult>("/api/block", async (c) => {
  const u = need(c);
  await throttle(`block:${u.id}`, 60, 3600);
  const t = await requireUser(typeof c.body.username === "string" ? c.body.username : null);
  if (t.id === u.id) bad("You can't block yourself");
  const blocked = c.body.block !== false;
  if (blocked) await repo.block(u.id, t.id);
  else await repo.unblock(u.id, t.id);
  return { blocked };
});
