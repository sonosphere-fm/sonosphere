import { bad, fail, type Viewer } from "../http";
import { isStaff } from "../site/roles";
import type { WikiVersion } from "../../shared/wiki";
import * as repo from "./repo";

export async function edit(author: Viewer, type: string, id: number, text: unknown): Promise<WikiVersion | null> {
  const content = String(text || "")
    .trim()
    .slice(0, 20000);
  if (content.length < 10) bad("Wiki text needs at least 10 characters");
  if (!isStaff(author) && (await repo.wikiLock(type, id))) fail(403, "This wiki is locked by a moderator");
  await repo.addWikiVersion(type, id, content, author.id);
  return repo.latestWiki(type, id);
}
