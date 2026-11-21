// Tag routes: a tag's page, suggestions for the tag box, and tagging or untagging an item.
import { requireItem, requireTag } from "../catalog/service";
import { confirmed, need } from "../guards";
import { Router } from "../http";
import type { ItemTags, TagPage, TagSuggestions } from "../../shared/tags";
import * as repo from "./repo";
import { namesFrom, suggest, tagPage, tagsOn } from "./service";

/** What can be tagged. */
const TAGGABLE = ["artist", "album", "track"] as const;
export const router = new Router();

router.get<TagPage>("/api/tag", async c => tagPage(await requireTag(c.q.get("name")), c.user?.id));

router.get<TagSuggestions>("/api/tags/suggest", async c => ({ items: await suggest(c.q.get("q") || "", c.user?.id) }));

router.post<ItemTags>("/api/tags", async c => {
  const u = confirmed(need(c));
  const it = await requireItem(c.body.type, c.body.id, TAGGABLE);
  await repo.addTags(u.id, it.type, it.row.id, namesFrom(c.body.tags));
  return tagsOn(u.id, it.type, it.row.id);
});

router.post<ItemTags>("/api/tags/remove", async c => {
  const u = need(c), it = await requireItem(c.body.type, c.body.id, TAGGABLE);
  await repo.removeTag(u.id, it.type, it.row.id, String(c.body.tag || ""));
  return tagsOn(u.id, it.type, it.row.id);
});
