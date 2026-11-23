import { findItem } from "../catalog/repo";
import { pageOf } from "../moderation/repo";
import type { Item } from "../catalog/service";
import { bad, fail, missing, type Viewer } from "../http";
import { notify } from "../notifications/repo";
import { audit } from "../site/audit";
import { setting } from "../site/settings";
import { blockedEither } from "../users/repo";
import * as repo from "./repo";

export function ownerOf(it: Item): number | null {
  if (it.type === "user") return it.row.id;
  if (it.type === "journal") return it.row.userId;
  return null;
}

export const wallOpen = (it: Item): boolean => it.type !== "user" || it.row.shoutsEnabled;

export async function post(author: Viewer, it: Item, text: unknown, parentId: number | null = null): Promise<number> {
  const body = String(text || "").trim();
  const max = await setting("maxShoutLength");
  if (!body) bad("Write something first");
  if (body.length > max) bad(`Posts can be at most ${max} characters`);
  const owner = ownerOf(it);
  if (owner && owner !== author.id && (await blockedEither(owner, author.id))) fail(403, "You can't post here");
  if (!wallOpen(it)) fail(403, "This user has turned off their wall");
  const parent = parentId === null ? null : ((await repo.findShout(parentId)) ?? missing("Post"));
  if (parent && (parent.targetType !== it.type || parent.targetId !== it.row.id))
    bad("Reply on the same wall as the post");
  if (parent && (await blockedEither(parent.authorId, author.id))) fail(403, "You can't reply to this post");
  const id = await repo.addShout(author.id, it.type, it.row.id, body, parentId);
  if (it.type === "user") await notify(it.row.id, "shout", author.id, { body: body.slice(0, 140) });
  if (it.type === "journal") {
    await notify(it.row.userId, "comment", author.id, {
      body: body.slice(0, 140),
      journalId: it.row.id,
      title: it.row.title,
    });
  }
  if (parent && parent.authorId !== owner) {
    if (it.type === "user")
      await notify(parent.authorId, "shout", author.id, {
        body: body.slice(0, 140),
        wallUsername: it.row.username,
        reply: true,
      });
    if (it.type === "journal")
      await notify(parent.authorId, "comment", author.id, {
        body: body.slice(0, 140),
        journalId: it.row.id,
        title: it.row.title,
        journalUsername: (await findItem("user", it.row.userId))?.username,
        reply: true,
      });
  }
  return id;
}

// The author or the owner of the profile or journal may delete a post; staff may delete any, and that is audited.
export async function remove(by: Viewer, s: repo.ShoutRow): Promise<void> {
  const mine =
    s.authorId === by.id ||
    (s.targetType === "user" && s.targetId === by.id) ||
    (s.targetType === "journal" && (await findItem("journal", s.targetId))?.userId === by.id);
  if (!mine && !by.isAdmin) fail(403, "You can't delete that post");
  await repo.deleteShout(s.id);
  if (mine) return;
  const page = await pageOf(s.targetType, s.targetId);
  await audit(by, {
    action: "shout.delete",
    targetType: "shout",
    targetId: s.id,
    label: `Shout on ${page?.label ?? "a page"}`,
    subjectId: s.authorId,
    data: { text: s.body.slice(0, 500) },
  });
}
