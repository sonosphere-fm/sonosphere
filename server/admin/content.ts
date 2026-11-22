import { Router, bad, missing } from "../http";
import { staff } from "../guards";
import { audit } from "../site/audit";
import { wikiLock } from "../wiki/repo";
import { note, paging } from "./common";
import { pageOf, reportTarget } from "../moderation/repo";
import * as repo from "./content.repo";
import type {
  ContentList,
  JournalItem,
  Ok,
  PageRef,
  ShoutItem,
  WikiHistory,
  WikiItem,
  WikiLocked,
  WikiLockList,
  WikiReverted,
} from "../../shared/admin-content";

export const router = new Router({ jsonOnly: true });

const excerpt = (s: string, n = 280) => (s.length > n ? s.slice(0, n).replace(/\s+\S*$/, "") + "…" : s);

router.get<ContentList>("/api/admin/content", async (c) => {
  staff(c);
  const kind = c.q.get("kind") || "shouts";
  const pg = paging(c.q, 25);
  const filter: repo.ContentFilter = {
    author: (c.q.get("user") || "").trim(),
    term: (c.q.get("q") || "").trim(),
    locked: c.q.get("locked") === "1",
  };
  if (kind === "shouts") {
    const items: ShoutItem[] = [];
    for (const s of await repo.shoutRows(filter, pg)) {
      items.push({
        id: s.id,
        body: s.body,
        author: s.author,
        createdAt: s.createdAt,
        page: await pageOf(s.targetType, s.targetId),
        targetType: s.targetType,
        reports: s.reports,
      });
    }
    return { items, total: await repo.shoutCount(filter), ...pg };
  }
  if (kind === "journals") {
    const items: JournalItem[] = [];
    for (const j of await repo.journalRows(filter, pg)) {
      items.push({
        id: j.id,
        title: j.title,
        excerpt: excerpt(j.body),
        author: j.author,
        createdAt: j.createdAt,
        updatedAt: j.updatedAt,
        link: (await pageOf("journal", j.id))?.link,
        comments: j.comments,
        reports: j.reports,
      });
    }
    return { items, total: await repo.journalCount(filter), ...pg };
  }
  if (kind === "wikis") {
    const items: WikiItem[] = [];
    for (const w of await repo.wikiRows(filter, pg)) {
      items.push({
        id: w.id,
        itemType: w.itemType,
        itemId: w.itemId,
        version: w.version,
        latest: w.version === w.top,
        excerpt: excerpt(w.content),
        author: w.author,
        createdAt: w.createdAt,
        page: await pageOf(w.itemType, w.itemId),
        locked: !!w.locked,
        reports: w.reports,
      });
    }
    return { items, total: await repo.wikiCount(filter), ...pg };
  }
  return bad("Unknown content kind");
});

router.post<Ok>("/api/admin/content/delete", async (c) => {
  const me = staff(c);
  const kind = String(c.body.kind);
  const id = Number(c.body.id);
  const why = note(c);
  if (!["shout", "journal", "wiki"].includes(kind)) bad("Unknown content kind");
  const t = (await reportTarget(kind, id)) ?? missing("That content");
  await repo.removeContent(kind, id, me, why, (closedReports) => ({
    action: `${kind}.delete`,
    targetType: kind,
    targetId: id,
    label: t.author ? `${t.where} by ${t.author}` : t.where,
    subjectId: t.authorId,
    note: why,
    data: { text: t.text.slice(0, 500), closedReports },
  }));
  return { ok: true };
});

async function wikiPage(type: string, id: number): Promise<PageRef> {
  if (!repo.isWikiType(type)) return bad("Invalid wiki type");
  if (!(await repo.wikiItemExists(type, id))) return missing("Page");
  return (await pageOf(type, id)) ?? missing("Page");
}

router.get<WikiHistory>("/api/admin/wiki", async (c) => {
  staff(c);
  const type = c.q.get("type") || "";
  const id = Number(c.q.get("id"));
  const page = await wikiPage(type, id);
  const lock = await wikiLock(type, id);
  return {
    type,
    id,
    page,
    lock: lock ? { by: lock.lockedBy, reason: lock.reason, at: lock.createdAt } : null,
    versions: await repo.wikiVersions(type, id),
  };
});

router.post<WikiReverted>("/api/admin/wiki/revert", async (c) => {
  const me = staff(c);
  const w = (await repo.wikiRevision(Number(c.body.revision))) ?? missing("Revision");
  const page = await wikiPage(w.itemType, w.itemId);
  const top = await repo.topVersion(w.itemType, w.itemId);
  if (top === w.version) bad("That's already the current version");
  await repo.addWikiVersion(w.itemType, w.itemId, w.content, me.id, top + 1);
  await audit(me, {
    action: "wiki.revert",
    targetType: w.itemType,
    targetId: w.itemId,
    label: `Wiki for ${page.label}`,
    note: note(c),
    data: { toVersion: w.version, newVersion: top + 1 },
  });
  return { version: top + 1 };
});

router.post<WikiLocked>("/api/admin/wiki/lock", async (c) => {
  const me = staff(c);
  const type = String(c.body.type);
  const id = Number(c.body.id);
  const page = await wikiPage(type, id);
  const locked = c.body.locked !== false;
  if (locked) await repo.lockWiki(type, id, me.id, note(c));
  else await repo.unlockWiki(type, id);
  await audit(me, {
    action: locked ? "wiki.lock" : "wiki.unlock",
    targetType: type,
    targetId: id,
    label: `Wiki for ${page.label}`,
    note: note(c),
  });
  return { locked };
});

router.get<WikiLockList>("/api/admin/wiki/locks", async (c) => {
  staff(c);
  const items: WikiLockList["items"] = [];
  for (const l of await repo.lockRows()) {
    items.push({ type: l.type, id: l.id, page: await pageOf(l.type, l.id), by: l.by, reason: l.reason, at: l.at });
  }
  return { items };
});
