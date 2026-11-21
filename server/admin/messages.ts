// Staff API: direct messages. Private conversations can only be read by admins (moderators work from reports,
// which carry the reported message and a few around it). Opening a transcript needs a reason and writes a
// "dm.read" audit entry. One entry covers the same admin paging through the same conversation for READ_WINDOW;
// after that the transcript locks again and asks for a reason before it shows anything. Spam flags and DM mutes
// are open to all staff, like reports and suspensions.
import { bad, missing, oneOf, Router } from "../http";
import { adminOnly, staff } from "../guards";
import { isAdmin, roleOf } from "../site/roles";
import { audit } from "../site/audit";
import { findById, findByName } from "../users/repo";
import { like, norm, now } from "../util";
import { canAct, note, paging, targetUser } from "./common";
import * as repo from "./messages.repo";
import { setDmMuted } from "./users.repo";
import type { DmFlagList, DmMessageDeleted, DmMuteResult, DmPerson, DmSummary, DmThreadHead, DmThreadList, DmTranscript, Ok } from "../../shared/admin";

export const router = new Router({ jsonOnly: true });

const READ_WINDOW = 30 * 60;
const DM_STATUSES = ["request", "active", "declined"] as const, FLAG_STATUSES = ["open", "resolved", "all"] as const;

const nameOf = async (id: number | null): Promise<string | null> => (id ? (await findById(id))?.username ?? null : null);
const threadOr404 = async (id: number): Promise<repo.Thread> => (await repo.findThread(id)) ?? missing("Conversation");
const pairLabel = async (t: { userLo: number; userHi: number }) => `Conversation between ${(await nameOf(t.userLo)) ?? "(deleted)"} and ${(await nameOf(t.userHi)) ?? "(deleted)"}`;
async function person(id: number): Promise<DmPerson> {
  const u = await findById(id);
  return u ? { id: u.id, username: u.username, image: u.imageId, role: roleOf(u), suspended: u.suspended, banned: u.banned, dmMuted: u.dmMuted } : { id, username: null };
}
/** A conversation without its text: who, since when, and how much of it there is. */
const threadHead = async (t: repo.Thread): Promise<DmThreadHead> => ({
  id: t.id, status: t.status, requester: await nameOf(t.requesterId), createdAt: t.createdAt, lastAt: t.lastAt, users: [await person(t.userLo), await person(t.userHi)],
  ...(await repo.threadCounts(t.id)),
});

router.get<DmSummary>("/api/admin/dm/summary", async c => { staff(c); return { openFlags: await repo.openFlagCount() }; });

/** Who talks to whom (no message text). Admins only: even the list of conversations is private. */
router.get<DmThreadList>("/api/admin/dm/threads", async c => {
  adminOnly(c);
  const pg = paging(c.q), term = (c.q.get("q") || "").trim(), who = (c.q.get("user") || "").trim();
  const u = who ? await findByName(who) : null;
  const { rows, total } = await repo.listThreads({ userId: who ? u?.id ?? 0 : null, pattern: term ? like(norm(term)) : null, status: oneOf(c.q.get("status"), DM_STATUSES) }, pg.limit, pg.offset);
  const items: DmThreadHead[] = [];
  for (const t of rows) items.push(await threadHead(t));
  return { items, total, user: who ? u?.username ?? who : null, ...pg };
});

/** A transcript, newest page first; `before` pages back. Locked (participants and status only) until the admin gives a reason. */
router.get<DmTranscript>("/api/admin/dm/threads/:id", async c => {
  const me = adminOnly(c), t = await threadOr404(Number(c.params[0])), head = await threadHead(t), read = await repo.recentRead(me.id, t.id, now() - READ_WINDOW);
  if (!read) return { thread: head, locked: true, window: READ_WINDOW };
  const rows = await repo.transcript(t.id, Number(c.q.get("before")) || 2 ** 31 - 1, 51);
  return {
    thread: head, locked: false, window: READ_WINDOW, openedAt: read.createdAt, reason: read.note, more: rows.length > 50,
    messages: rows.slice(0, 50).reverse().map(m => ({ id: m.id, from: m.senderId, body: m.body, at: m.createdAt, deletedAt: m.deletedAt,
      deletedBy: m.deleter ?? (m.deletedBy ? "(deleted account)" : null), bySender: m.deletedBy === m.senderId, reports: m.reports })),
  };
});

router.post<Ok>("/api/admin/dm/threads/:id/open", async c => {
  const me = adminOnly(c), t = await threadOr404(Number(c.params[0])), why = note(c);
  if (why.length < 3) bad("Say why you need to read this conversation");
  await audit(me, { action: "dm.read", targetType: "dm_thread", targetId: t.id, label: await pairLabel(t), note: why,
    data: { users: [await nameOf(t.userLo), await nameOf(t.userHi)], ids: [t.userLo, t.userHi] } });
  return { ok: true };
});

/** Remove one message for both people. Admins only, since only they see transcripts; reported messages are removed from the queue. */
router.post<DmMessageDeleted>("/api/admin/dm/messages/:id/delete", async c => {
  const me = adminOnly(c), m = (await repo.findMessage(Number(c.params[0]))) ?? missing("Message");
  if (m.deletedAt) bad("That message is already deleted");
  const label = await pairLabel(m), why = note(c);
  // the text stays out of the log: moderators can read the audit log but not conversations
  const closed = await repo.deleteMessage(me, m.id, why, n =>
    ({ action: "dm.delete", targetType: "dm", targetId: m.id, label, subjectId: m.senderId, note: why, data: { thread: m.threadId, closedReports: n } }));
  return { ok: true, closedReports: closed };
});

/** Turn messaging off (or back on) for an account. The send gate in the messaging code refuses anything they try to send. */
router.post<DmMuteResult>("/api/admin/users/:name/dm-mute", async c => {
  const me = staff(c), t = await targetUser(c.params[0]!), muted = c.body.muted !== false;
  if (muted) await canAct(me, t, "mute"); else if (t.id === me.id) bad("You can't change your own messaging");
  await setDmMuted(t.id, muted);
  await audit(me, { action: muted ? "dm.mute" : "dm.unmute", targetType: "user", targetId: t.id, label: t.username, subjectId: t.id, note: note(c) });
  return { muted };
});

router.get<DmFlagList>("/api/admin/dm/flags", async c => {
  const me = staff(c), pg = paging(c.q), status = oneOf(c.q.get("status"), FLAG_STATUSES) ?? "open", t = now();
  const { rows, total } = await repo.listFlags(status, pg.limit, pg.offset);
  const items: DmFlagList["items"] = [];
  for (const { flag: f, user: u, resolver } of rows) items.push({
    id: f.id, kind: f.kind, detail: f.detail, sample: f.sample, createdAt: f.createdAt, resolvedAt: f.resolvedAt, resolver,
    user: { username: u.username, role: roleOf(u), suspended: u.suspended, banned: u.banned, dmMuted: u.dmMuted },
    threadsDay: await repo.threadsStartedDay(f.userId, t),
  });
  return { items, total, open: await repo.openFlagCount(), canRead: isAdmin(me), ...pg };
});

router.post<Ok>("/api/admin/dm/flags/:id/resolve", async c => {
  const me = staff(c), f = (await repo.findFlag(Number(c.params[0]))) ?? missing("Flag");
  if (f.resolvedAt) bad("That flag is already resolved");
  await repo.resolveFlag(f.id, me.id);
  await audit(me, { action: "dm.resolve", targetType: "user", targetId: f.userId, label: f.username, subjectId: f.userId, note: note(c), data: { flag: f.id, kind: f.kind, detail: f.detail } });
  return { ok: true };
});
