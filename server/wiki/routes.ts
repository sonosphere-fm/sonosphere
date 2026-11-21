// Wiki routes: an item's wiki history, and saving a new version.
import { requireItem } from "../catalog/service";
import { confirmed, poster } from "../guards";
import { Router } from "../http";
import type { WikiHistory, WikiSaved } from "../../shared/wiki";
import * as repo from "./repo";
import { edit } from "./service";

/** What can have a wiki. */
const WITH_WIKI = ["artist", "album", "track", "tag"] as const;
export const router = new Router();

router.get<WikiHistory>("/api/wiki", async c => {
  const it = await requireItem(c.q.get("type"), c.q.get("id"), WITH_WIKI);
  return { versions: await repo.wikiHistory(it.type, it.row.id), locked: !!(await repo.wikiLock(it.type, it.row.id)) };
});

router.post<WikiSaved>("/api/wiki", async c => {
  const u = confirmed(poster(c));
  const it = await requireItem(c.body.type, c.body.id, WITH_WIKI);
  return { wiki: await edit(u, it.type, it.row.id, c.body.content) };
});
