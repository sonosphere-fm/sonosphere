import { confirmed, need, poster } from "../guards";
import { bad, missing, paging, Router, throttle, type Body, type Ctx } from "../http";
import { findById, publicUser } from "../users/repo";
import { requireUser } from "../users/service";
import { clean } from "../util";
import * as repo from "./repo";
import type { JournalDeleted, JournalList, JournalPost, JournalSaved, JournalSummary } from "../../shared/journals";

export const router = new Router();

const EXCERPT = 320;

const summary = async (j: repo.Journal): Promise<JournalSummary> => ({
  id: j.id,
  title: j.title,
  createdAt: j.createdAt,
  updatedAt: j.updatedAt,
  comments: await repo.commentCount(j.id),
});

// Cut at a word boundary.
function excerpt(body: string): string {
  if (body.length <= EXCERPT) return body;
  return body.slice(0, EXCERPT).replace(/\s+\S*$/, "") + "…";
}

function textOf(b: Body): repo.JournalText {
  const title = clean(b.title, 120);
  const body = String(b.body || "").trim().slice(0, 20000);
  if (!title) bad("Give the post a title");
  if (body.length < 10) bad("Posts need at least 10 characters");
  return { title, body };
}

const own = async (c: Ctx): Promise<repo.Journal> =>
  (await repo.findOwnJournal(Number(c.params[0]), need(c).id)) ?? missing("Post");

router.get<JournalList>("/api/user/journal", async c => {
  const u = await requireUser(c.q.get("name"));
  const pg = paging(c.q, 10, 50);
  const items: JournalList["items"] = [];
  for (const j of await repo.journalsOf(u.id, pg.limit, pg.offset)) {
    items.push({ ...(await summary(j)), excerpt: excerpt(j.body) });
  }
  return { items, total: await repo.journalCount(u.id), ...pg };
});

router.get<JournalPost>("/api/journal/:id", async c => {
  const j = (await repo.findJournal(Number(c.params[0]))) ?? missing("Post");
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

// need() rather than poster(): suspended accounts may still take their own posts down.
router.delete<JournalDeleted>("/api/journal/:id", async c => {
  const j = await own(c);
  await repo.dropJournal(j.id);
  return { ok: true };
});
