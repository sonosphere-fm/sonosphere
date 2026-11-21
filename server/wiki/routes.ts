import { requireItem } from "../catalog/service";
import { confirmed, poster } from "../guards";
import { Router } from "../http";
import type { WikiHistory, WikiSaved } from "../../shared/wiki";
import * as repo from "./repo";
import { edit } from "./service";
import { limit } from "../trust/service";

const WITH_WIKI = ["artist", "album", "track", "tag"] as const;

export const router = new Router();

router.get<WikiHistory>("/api/wiki", async c => {
  const it = await requireItem(c.q.get("type"), c.q.get("id"), WITH_WIKI);
  const versions = await repo.wikiHistory(it.type, it.row.id);
  const locked = !!(await repo.wikiLock(it.type, it.row.id));
  return { versions, locked };
});

router.post<WikiSaved>("/api/wiki", async c => {
  const u = confirmed(poster(c));
  await limit(u, `wiki:${u.id}`, 30, 3600, "That is a lot of wiki edits. Take a break and come back in a while.");
  const it = await requireItem(c.body.type, c.body.id, WITH_WIKI);
  return { wiki: await edit(u, it.type, it.row.id, c.body.content) };
});
