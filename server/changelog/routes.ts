import type {
  Changelog,
  ChangelogCommits,
  ChangelogDeleted,
  ChangelogPost,
  ChangelogSaved,
  ChangelogText,
} from "../../shared/changelog";
import { adminOnly } from "../guards";
import { note } from "../admin/common";
import { bad, fail, missing, paging, Router, throttle, type Body } from "../http";
import { getHistory } from "./history";
import * as repo from "./repo";

export const router = new Router({ jsonOnly: true });

router.get<Changelog>("/api/changelog", async (c) => {
  const pg = paging(c.q, 10, 30);
  return { items: await repo.posts(pg.limit, pg.offset), total: await repo.postCount(), limit: pg.limit };
});

router.get<ChangelogCommits>("/api/admin/changelog/commits", async (c) => {
  adminOnly(c);
  let entries;
  try {
    entries = await getHistory();
  } catch (error) {
    console.error("Unable to read changelog history", error);
    return fail(503, "Changelog is unavailable. Please try again later.");
  }
  return { items: entries.slice(0, 30) };
});

router.get<ChangelogPost>("/api/admin/changelog/:id", async (c) => {
  adminOnly(c);
  return (await repo.findPost(postId(c.params[0]!))) ?? missing("Changelog post");
});

function postId(value: string) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) bad("Invalid post");
  return id;
}

function textOf(body: Body): ChangelogText {
  if (typeof body.title !== "string" || typeof body.body !== "string") return bad("Enter a title and post");
  const title = body.title.trim();
  const text = body.body.trim();
  if (!title || title.length > 120) bad("Use a title between 1 and 120 characters");
  if (text.length < 10 || text.length > 20000) bad("Posts need between 10 and 20,000 characters");
  return { title, body: text };
}

router.post<ChangelogSaved>("/api/admin/changelog", async (c) => {
  const user = adminOnly(c);
  await throttle(`changelog-write:${user.id}`, 60, 3600);
  return (await repo.savePost(c.actor ?? user, textOf(c.body)))!;
});

router.patch<ChangelogSaved>("/api/admin/changelog/:id", async (c) => {
  const user = adminOnly(c);
  await throttle(`changelog-write:${user.id}`, 60, 3600);
  return (await repo.savePost(c.actor ?? user, textOf(c.body), postId(c.params[0]!))) ?? missing("Changelog post");
});

router.post<ChangelogDeleted>("/api/admin/changelog/:id/delete", async (c) => {
  const user = adminOnly(c);
  const post = (await repo.findPost(postId(c.params[0]!))) ?? missing("Changelog post");
  await repo.deletePost(c.actor ?? user, post, note(c));
  return { ok: true };
});
