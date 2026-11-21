// Journals API: a user's posts, one post, and writing, editing and deleting your own.
import { confirmed, need, poster } from "../guards";
import { bad, missing, paging, Router, throttle, type Body, type Ctx } from "../http";
import { findById, publicUser } from "../users/repo";
import { requireUser } from "../users/service";
import { clean } from "../util";
import * as repo from "./repo";
import type { JournalDeleted, JournalList, JournalPost, JournalSaved, JournalSummary } from "../../shared/journals";

export const router = new Router();

const EXCERPT = 320;
const summary = async (j: repo.Journal): Promise<JournalSummary> =>
  ({ id: j.id, title: j.title, createdAt: j.createdAt, updatedAt: j.updatedAt, comments: await repo.commentCount(j.id) });
/** The opening of a post, cut at a word boundary. */
const excerpt = (body: string) => (body.length > EXCERPT ? body.slice(0, EXCERPT).replace(/\s+\S*$/, "") + "…" : body);

/** The title and text of a post from a request body, or a 400 saying what is wrong with them. */
function textOf(b: Body): repo.JournalText {
  const title = clean(b.title, 120), body = String(b.body || "").trim().slice(0, 20000);
  if (!title) bad("Give the post a title");
  if (body.length < 10) bad("Posts need at least 10 characters");
  return { title, body };
}
/** The post named in the URL, which must be the signed-in user's own. */
const own = async (c: Ctx): Promise<repo.Journal> => (await repo.findOwnJournal(Number(c.params[0]), need(c).id)) ?? missing("Post");

router.get<JournalList>("/api/user/journal", async c => {
  const u = await requireUser(c.q.get("name")), pg = paging(c.q, 10, 50);
  const items: JournalList["items"] = [];
  for (const j of await repo.journalsOf(u.id, pg.limit, pg.offset)) items.push({ ...(await summary(j)), excerpt: excerpt(j.body) });
  return { items, total: await repo.journalCount(u.id), ...pg };
});

router.get<JournalPost>("/api/journal/:id", async c => {
  const j = (await repo.findJournal(Number(c.params[0]))) ?? missing("Post");
  // a post is deleted along with its author, so the author is always there
  const author = (await findById(j.userId)) ?? missing("Post");
  return { ...(await summary(j)), body: j.body, author: publicUser(author) };
});

router.post<JournalSaved>("/api/journal", async c => {
  const u = confirmed(poster(c));
  await throttle(`journal:${u.id}`, 10, 86_400, "You have written a lot of posts today. Try again tomorrow.");
  return { id: await repo.createJournal(u.id, textOf(c.body)) };
});

router.patch<JournalSaved>("/api/journal/:id", async c => {
  const u = confirmed(poster(c));
  await throttle(`journal-edit:${u.id}`, 60, 3600);
  const j = await own(c);
  await repo.updateJournal(j.id, textOf(c.body));
  return { id: j.id };
});

// Deleting is open to suspended accounts too: they may not post, but they may take their own posts down.
router.delete<JournalDeleted>("/api/journal/:id", async c => {
  await repo.dropJournal((await own(c)).id);
  return { ok: true };
});
