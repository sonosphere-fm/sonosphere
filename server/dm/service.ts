// A message to someone who doesn't follow you starts a request: capped, link-free, with no read receipts, and
// declining it is silent. Messages are not end-to-end encrypted; staff reads are audited.
import { fail, HttpError } from "../http";
import { tr } from "../i18n";
import type { Locale } from "../../shared/i18n/core";
import { push } from "../realtime";
import { blockedEither, findById, hasBlocked, type User } from "../users/repo";
import { now } from "../util";
import { mailMessage } from "../notifications/email";
import { onProbation, PROBATION } from "../trust/service";
import * as repo from "./repo";
import { checkReaction, reactionsOf, toggle } from "./reactions";
import { softDeleteTx as softDeleteGroupTx, unreadGroups, memberIds, type GroupRemoved } from "./groups.repo";
import type { Flag, Message, Thread, Tx } from "./repo";
import type {
  DmAccepted,
  DmCounts,
  DmDone,
  DmEvent,
  DmList,
  DmMessage,
  DmPolicy,
  DmReacted,
  DmReaction,
  DmSent,
  DmThread,
  DmThreadPage,
  DmUnsent,
  DmWith,
} from "../../shared/dm";

export const DM = {
  MAX_LENGTH: 2000,
  UNSEND_WINDOW: 15 * 60,
  REQUEST_CAP: 3,
  PER_MINUTE: 20,
  PER_DAY: 500,
  NEW_THREADS_PER_DAY: 15,
  COPIES: 4,
};

export const POLICIES = ["everyone", "requests", "following", "nobody"] as const satisfies readonly DmPolicy[];
const policyOf = (u: Pick<User, "dmPolicy">): DmPolicy => POLICIES.find((p) => p === u.dmPolicy) ?? "requests";

const emit = (userId: number, event: DmEvent) => push(userId, event);
const side = (t: Thread, userId: number): repo.Side => (t.userLo === userId ? "lo" : "hi");
const otherId = (t: Thread, userId: number) => (t.userLo === userId ? t.userHi : t.userLo);
const notFound = (): never => fail(404, "conversationNotFound");

// Non-participants get the same 404 as for a thread that doesn't exist.
async function myThread(id: unknown, userId: number): Promise<Thread> {
  const t = await repo.threadFor(Number(id) || 0, userId);
  if (!t) return notFound();
  // a declined request no longer exists for the person who declined it
  if (t.status === "declined" && t.requesterId !== userId) return notFound();
  return t;
}

const hasLink = (s: string) =>
  /(https?:\/\/|www\.)\S|\b[a-z0-9-]+\.(com|net|org|io|ru|xyz|top|gg|me|co|link|app|ly)\b/i.test(s);

export function tidy(input: unknown): string {
  return String(input ?? "")
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F​-‏‪-‮⁠-⁤﻿]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function canPost(from: User): void {
  if (from.suspended) fail(403, "accountSuspendedFromPosting");
  if (from.dmMuted) fail(403, "messagingTurnedOffAccount");
}

// Returns how a new thread would begin, or throws.
export async function gate(from: User, to: User): Promise<"active" | "request"> {
  if (from.id === to.id) fail(400, "cantMessageYourself");
  canPost(from);
  // one answer for every kind of refusal, so the sender can't tell whether they were blocked
  if (to.banned || (await blockedEither(from.id, to.id))) fail(403, "cantMessageUser");
  if (from.isAdmin) return "active";
  const policy = policyOf(to);
  const known = await repo.isFollowing(to.id, from.id);
  if (policy === "nobody" || (policy === "following" && !known)) fail(403, "cantMessageUser");
  return policy === "everyone" || known ? "active" : "request";
}

type Allowed = { can: boolean; why: string; blocked: boolean; opens: "active" | "request" };

// `blocked` is only the sender's own block: they may know about that one, so the page can offer to undo it.
async function allowed(locale: Locale, from: User, to: User | null): Promise<Allowed> {
  if (!to) return { can: false, why: tr(locale, "errors.accountNoLongerExists"), blocked: false, opens: "active" };
  if (await hasBlocked(from.id, to.id)) {
    return {
      can: false,
      why: tr(locale, "errors.youBlockedUser", { username: to.username }),
      blocked: true,
      opens: "active",
    };
  }
  try {
    return { can: true, why: "", blocked: false, opens: await gate(from, to) };
  } catch (e) {
    if (e instanceof HttpError)
      return { can: false, why: tr(locale, `errors.${e.key}`, e.params), blocked: false, opens: "active" };
    throw e;
  }
}

export async function dmLimits(from: User) {
  if (await onProbation(from)) {
    return {
      perMinute: PROBATION.DM_PER_MINUTE,
      perDay: PROBATION.DM_PER_DAY,
      newThreads: PROBATION.NEW_THREADS_PER_DAY,
      copies: PROBATION.COPIES,
    };
  }
  return { perMinute: DM.PER_MINUTE, perDay: DM.PER_DAY, newThreads: DM.NEW_THREADS_PER_DAY, copies: DM.COPIES };
}

// The refusal rolls the transaction back, so flags are collected here and written by the caller afterwards.
async function throttle(tx: Tx, from: User, body: string, startsThread: boolean, flags: Flag[]): Promise<void> {
  const t = now();
  const flag = (kind: string, detail: string) => {
    flags.push({ userId: from.id, kind, detail, sample: body });
  };
  const lim = await dmLimits(from);
  if ((await repo.sentSinceTx(tx, from.id, t - 60)) >= lim.perMinute) {
    fail(429, "youreSendingMessagesTooQuickly");
  }
  if ((await repo.sentSinceTx(tx, from.id, t - 86400)) >= lim.perDay) {
    flag("volume", `${lim.perDay} messages in a day`);
    fail(429, "youveReachedTodaysMessageLimit");
  }
  if (startsThread && !from.isAdmin) {
    const started = await repo.startedSinceTx(tx, from.id, t - 86400);
    if (started >= lim.newThreads) {
      flag("new-conversations", `${started} new conversations in a day`);
      fail(429, "youveStartedLotNewConversations");
    }
  }
  if (body.length >= 20 && !from.isAdmin) {
    const copies = await repo.copiesSinceTx(tx, from.id, t - 3600, body);
    if (copies >= lim.copies) {
      flag("copy-paste", `The same message to ${copies} people within an hour`);
      fail(429, "duplicateMessageBlocked");
    }
  }
}

const messageShape = (m: Message, reactions: DmReaction[] = []): DmMessage => ({
  id: m.id,
  from: m.senderId,
  body: m.deletedAt ? "" : m.body,
  at: m.createdAt,
  deleted: !!m.deletedAt,
  reactions: m.deletedAt ? [] : reactions,
});

// Null when the other account is gone.
async function shapeOrNull(t: Thread, userId: number): Promise<DmThread | null> {
  const lo = t.userLo === userId;
  const cleared = lo ? t.loCleared : t.hiCleared;
  const read = lo ? t.loRead : t.hiRead;
  const theirRead = lo ? t.hiRead : t.loRead;
  const mine = t.requesterId === userId;
  const pending = t.status !== "active";
  const user = await repo.person(otherId(t, userId));
  if (!user) return null;
  const last = await repo.lastMessage(t.id, cleared);
  const left = pending && mine ? Math.max(0, DM.REQUEST_CAP - (await repo.sentIn(t.id, userId))) : null;
  return {
    id: t.id,
    user,
    // a declined request looks, to the person who sent it, exactly like one still waiting
    status: pending ? "request" : "active",
    incoming: pending && !mine,
    last: last ? messageShape(last) : null,
    at: t.lastAt,
    unread: await repo.unreadIn(t.id, Math.max(read, cleared), userId),
    seen: pending ? 0 : theirRead,
    left,
  };
}

const threadShape = async (t: Thread, userId: number): Promise<DmThread> =>
  (await shapeOrNull(t, userId)) ?? notFound();

export async function dmCounts(userId: number): Promise<DmCounts> {
  const counts = await repo.unreadCounts(userId);
  return { ...counts, unread: counts.unread + (await unreadGroups(userId)) };
}

export async function send(from: User, to: User, rawBody: unknown): Promise<DmSent> {
  const body = tidy(rawBody);
  if (!body) fail(400, "writeMessageFirst");
  if (body.length > DM.MAX_LENGTH) fail(400, "messageTooLong", { max: DM.MAX_LENGTH });
  const opening = await gate(from, to);
  const flags: Flag[] = [];
  let out: { message: Message; thread: Thread; accepted: boolean };
  try {
    out = await repo.atomically(async (tx) => {
      let t = await repo.threadOfTx(tx, from.id, to.id);
      let accepted = false;
      const pendingMine = !!t && t.status !== "active" && t.requesterId === from.id;
      if (t && t.status !== "active" && !pendingMine) {
        // answering a request accepts it
        await repo.setStatusTx(tx, t.id, "active");
        t = { ...t, status: "active" };
        accepted = true;
      } else if (t && pendingMine && opening === "active" && t.status === "request") {
        // they followed the sender since the request was made
        await repo.setStatusTx(tx, t.id, "active");
        t = { ...t, status: "active" };
      } else if (t && pendingMine) {
        if ((await repo.sentInTx(tx, t.id, from.id)) >= DM.REQUEST_CAP) fail(403, "waitReplyBeforeSendingMore");
      }
      if ((!t || t.status !== "active") && opening === "request" && hasLink(body)) {
        fail(400, "linksNeedAcceptedRequest");
      }
      await throttle(tx, from, body, !t, flags);
      const at = now();
      const thread = t ?? (await repo.createThreadTx(tx, from.id, to.id, opening, at));
      const added = await repo.addMessageTx(tx, thread, from.id, body, at);
      return { ...added, accepted };
    });
  } finally {
    for (const f of flags) await repo.raiseFlag(f, now());
  }
  const { thread, accepted } = out;
  const message = messageShape(out.message);
  // a declined request is delivered nowhere
  if (thread.status !== "declined") {
    emit(to.id, { t: "dm", thread: await threadShape(thread, to.id), message, counts: await dmCounts(to.id) });
    await mailMessage(to, from.username, thread.id, thread.status === "request", body);
  }
  emit(from.id, {
    t: "dm",
    thread: await threadShape(thread, from.id),
    message,
    counts: await dmCounts(from.id),
    accepted,
  });
  return { message, thread: await threadShape(thread, from.id) };
}

async function removeMessage(messageId: number, byUserId: number): Promise<void> {
  const removed = await repo.softDeleteTx(repo.connection, messageId, byUserId, now());
  if (removed) await announceRemoved([removed]);
}

// Pass the result to announceRemoved once the transaction commits.
export const removeGroupMessageTx = (tx: Tx, messageId: number, byUserId: number): Promise<GroupRemoved | null> =>
  softDeleteGroupTx(tx, messageId, byUserId, now());

export const removeMessageTx = (tx: Tx, messageId: number, byUserId: number): Promise<repo.Removed | null> =>
  repo.softDeleteTx(tx, messageId, byUserId, now());

export async function announceRemoved(removed: readonly (repo.Removed | GroupRemoved | null)[]): Promise<void> {
  for (const m of removed) {
    if (!m) continue;
    if ("groupId" in m) {
      for (const uid of await memberIds(m.groupId)) {
        emit(uid, { t: "dm-group-deleted", groupId: m.groupId, id: m.id, counts: await dmCounts(uid) });
      }
      continue;
    }
    for (const uid of [m.userLo, m.userHi]) {
      emit(uid, { t: "dm-deleted", threadId: m.threadId, id: m.id, counts: await dmCounts(uid) });
    }
  }
}

export async function list(me: User, box: "inbox" | "requests"): Promise<Omit<DmList, "groups">> {
  const items: DmThread[] = [];
  for (const t of await repo.listThreads(me.id, box)) {
    const s = await shapeOrNull(t, me.id);
    if (s) items.push(s);
  }
  return { items, counts: await dmCounts(me.id), policy: policyOf(me) };
}

// A first message to a stranger needs the robot check.
export async function firstContact(from: User, to: User): Promise<boolean> {
  if (from.isAdmin || from.id === to.id) return false;
  if (await repo.threadOf(from.id, to.id)) return false;
  return !(await repo.isFollowing(to.id, from.id));
}

export async function withUser(locale: Locale, me: User, to: User): Promise<DmWith> {
  const t = await repo.threadOf(me.id, to.id);
  const visible = t && !(t.status === "declined" && t.requesterId !== me.id) ? t : null;
  const { can, why, blocked, opens } = await allowed(locale, me, to);
  return {
    user: (await repo.person(to.id)) ?? fail(404, "userNotFound"),
    threadId: visible?.id ?? null,
    can,
    why,
    blocked,
    request: !visible && opens === "request",
    human: await firstContact(me, to),
  };
}

export async function page(locale: Locale, me: User, threadId: unknown, before: number): Promise<DmThreadPage> {
  const t = await myThread(threadId, me.id);
  const cleared = side(t, me.id) === "lo" ? t.loCleared : t.hiCleared;
  const rows = (await repo.messagesBetween(t.id, cleared, before, 51)).reverse();
  const shown = rows.slice(-50);
  const reactions = await reactionsOf(
    "dm",
    shown.map((m) => m.id)
  );
  const { can, why, blocked } = await allowed(locale, me, await findById(otherId(t, me.id)));
  return {
    thread: await threadShape(t, me.id),
    messages: shown.map((m) => messageShape(m, reactions.get(m.id))),
    more: rows.length > 50,
    can,
    why,
    blocked,
    max: DM.MAX_LENGTH,
    unsendFor: DM.UNSEND_WINDOW,
  };
}

export async function sendToThread(me: User, threadId: unknown, body: unknown): Promise<DmSent> {
  const t = await myThread(threadId, me.id);
  const to = (await findById(otherId(t, me.id))) ?? fail(404, "accountNoLongerExists");
  return send(me, to, body);
}

export async function read(me: User, threadId: unknown): Promise<DmDone> {
  const t = await myThread(threadId, me.id);
  const s = side(t, me.id);
  const top = await repo.topMessageId(t.id);
  if (top > (s === "lo" ? t.loRead : t.hiRead)) {
    await repo.markRead(t.id, s, top);
    // no read receipts for requests
    if (t.status === "active") emit(otherId(t, me.id), { t: "dm-read", threadId: t.id, seen: top });
    emit(me.id, { t: "dm-counts", counts: await dmCounts(me.id) });
  }
  return { ok: true, counts: await dmCounts(me.id) };
}

export async function accept(me: User, threadId: unknown): Promise<DmAccepted> {
  let t = await myThread(threadId, me.id);
  if (t.status === "request" && t.requesterId !== me.id) {
    await repo.setStatus(t.id, "active");
    t = { ...t, status: "active" };
    emit(t.requesterId, { t: "dm-thread", thread: await threadShape(t, t.requesterId) });
  }
  return { thread: await threadShape(t, me.id), counts: await dmCounts(me.id) };
}

export async function decline(me: User, threadId: unknown): Promise<DmDone> {
  const t = await myThread(threadId, me.id);
  if (t.status !== "request" || t.requesterId === me.id) fail(400, "isntPendingRequest");
  await repo.setStatus(t.id, "declined");
  return { ok: true, counts: await dmCounts(me.id) };
}

export async function clear(me: User, threadId: unknown): Promise<DmDone> {
  const t = await myThread(threadId, me.id);
  await repo.clearFor(t.id, side(t, me.id), await repo.topMessageId(t.id));
  return { ok: true, counts: await dmCounts(me.id) };
}

export async function unsend(me: User, messageId: unknown): Promise<DmUnsent> {
  const m = (await repo.ownMessage(Number(messageId) || 0, me.id)) ?? fail(404, "messageNotFound");
  await myThread(m.threadId, me.id);
  if (!m.deletedAt && now() - m.createdAt > DM.UNSEND_WINDOW) fail(403, "messagesOnlyUnsent15Minutes");
  await removeMessage(m.id, me.id);
  return { ok: true };
}

// Reactions are only for accepted conversations, so reacting can't reveal that a request was seen.
export async function react(me: User, messageId: unknown, emoji: unknown): Promise<DmReacted> {
  const m = (await repo.findMessage(Number(messageId) || 0)) ?? fail(404, "messageNotFound");
  const t = await myThread(m.threadId, me.id);
  const cleared = side(t, me.id) === "lo" ? t.loCleared : t.hiCleared;
  if (m.id <= cleared) fail(404, "messageNotFound");
  canPost(me);
  const closed = t.status !== "active" || m.deletedAt || (await blockedEither(t.userLo, t.userHi));
  if (closed) fail(403, "cantReactMessage");
  const reactions = await toggle("dm", m.id, me.id, await checkReaction(me.id, emoji));
  for (const uid of [t.userLo, t.userHi]) emit(uid, { t: "dm-react", threadId: t.id, id: m.id, reactions });
  return { reactions };
}

// Typing indicators are only relayed inside an accepted conversation.
export async function relayTyping(userId: number, threadId: number): Promise<void> {
  const t = await repo.activeThreadFor(threadId, userId);
  if (!t || (await blockedEither(t.userLo, t.userHi))) return;
  emit(otherId(t, userId), { t: "dm-typing", threadId: t.id });
}
