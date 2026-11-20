// Blocking API: the signed-in user's block list, and blocking or unblocking someone.
import { need } from "../guards";
import { bad, Router } from "../http";
import { requireUser } from "../users/service";
import * as repo from "./repo";
import type { BlockResult, Blocks } from "../../shared/blocks";

export const router = new Router();

router.get<Blocks>("/api/blocks", async c => ({ items: await repo.blockedBy(need(c).id) }));

// `block: false` in the body unblocks; anything else blocks.
router.post<BlockResult>("/api/block", async c => {
  const u = need(c), t = await requireUser(typeof c.body.username === "string" ? c.body.username : null);
  if (t.id === u.id) bad("You can't block yourself");
  const blocked = c.body.block !== false;
  if (blocked) await repo.block(u.id, t.id); else await repo.unblock(u.id, t.id);
  return { blocked };
});
