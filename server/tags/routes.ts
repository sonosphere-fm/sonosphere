import { requireItem, requireTag } from "../catalog/service";
import { confirmed, need } from "../guards";
import { Router } from "../http";
import type { ItemTags, TagPage, TagSuggestions } from "../../shared/tags";
import * as repo from "./repo";
import { namesFrom, suggest, tagPage, tagsOn } from "./service";
import { limit } from "../trust/service";

const TAGGABLE = ["artist", "album", "track"] as const;

export const router = new Router();

router.get<TagPage>("/api/tag", async (c) => {
  const tag = await requireTag(c.q.get("name"));
  return tagPage(tag, c.user?.id);
});

router.get<TagSuggestions>("/api/tags/suggest", async (c) => {
  const items = await suggest(c.q.get("q") || "", c.user?.id);
  return { items };
});

router.post<ItemTags>("/api/tags", async (c) => {
  const u = confirmed(need(c));
  await limit(u, `tag:${u.id}`, 100, 3600, "tooManyTagEdits");
  const it = await requireItem(c.body.type, c.body.id, TAGGABLE);
  await repo.addTags(u.id, it.type, it.row.id, namesFrom(c.body.tags));
  return tagsOn(u.id, it.type, it.row.id);
});

router.post<ItemTags>("/api/tags/remove", async (c) => {
  const u = need(c);
  const it = await requireItem(c.body.type, c.body.id, TAGGABLE);
  await repo.removeTag(u.id, it.type, it.row.id, String(c.body.tag || ""));
  return tagsOn(u.id, it.type, it.row.id);
});
