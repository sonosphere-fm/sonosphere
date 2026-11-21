// A message to someone who doesn't follow you starts a request: capped, link-free, with no read receipts, and
// declining it is silent. Messages are not end-to-end encrypted; staff reads are audited.
import { fail, HttpError } from "../http";
import { onClientMessage, push, type ClientMessage } from "../realtime";
import { blockedEither, findById, hasBlocked, type User } from "../users/repo";
import { now } from "../util";
import { mailMessage } from "../notifications/email";
import * as repo from "./repo";
import type { Flag, Message, Thread, Tx } from "./repo";
import type { DmAccepted, DmCounts, DmDone, DmEvent, DmList, DmMessage, DmPolicy, DmSent, DmThread, DmThreadPage, DmUnsent, DmWith } from "../../shared/dm";

const DM = {
  MAX_LENGTH: 2000,
  UNSEND_WINDOW: 15 * 60,
  REQUEST_CAP: 3,
  PER_MINUTE: 20,
  PER_DAY: 500,
  NEW_THREADS_PER_DAY: 15,
  NEW_THREADS_NEW_ACCOUNT: 4,
  COPIES: 4,
};

export const POLICIES = ["everyone", "requests", "following", "nobody"] as const satisfies readonly DmPolicy[];
const policyOf = (u: Pick<User, "dmPolicy">): DmPolicy => POLICIES.find(p => p === u.dmPolicy) ?? "requests";

const GONE = "This account no longer exists";
const emit = (userId: number, event: DmEvent) => push(userId, event);
const side = (t: Thread, userId: number): repo.Side => (t.userLo === userId ? "lo" : "hi");
const otherId = (t: Thread, userId: number) => (t.userLo === userId ? t.userHi : t.userLo);
const notFound = (): never => fail(404, "Conversation not found");

// Non-participants get the same 404 as for a thread that doesn't exist.
async function myThread(id: unknown, userId: number): Promise<Thread> {
  const t = await repo.threadFor(Number(id) || 0, userId);
  if (!t) return notFound();
  // a declined request no longer exists for the person who declined it
  if (t.status === "declined" && t.requesterId !== userId) return notFound();
  return t;
}

const hasLink = (s: string) => /(https?:\/\/|www\.)\S|\b[a-z0-9-]+\.(com|net|org|io|ru|xyz|top|gg|me|co|link|app|ly)\b/i.test(s);

function tidy(input: unknown): string {
  return String(input ?? "")
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F​-‏‪-‮⁠-⁤﻿]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Returns how a new thread would begin, or throws.
async function gate(from: User, to: User): Promise<"active" | "request"> {
  if (from.id === to.id) fail(400, "You can't message yourself");
  if (from.suspended) fail(403, "Your account is suspended from posting");
  if (from.dmMuted) fail(403, "Messaging has been turned off for your account");
  // one answer for every kind of refusal, so the sender can't tell whether they were blocked
  if (to.banned || (await blockedEither(from.id, to.id))) fail(403, "You can't message this user");
  if (from.isAdmin) return "active";
  const policy = policyOf(to);
  const known = await repo.isFollowing(to.id, from.id);
  if (policy === "nobody" || (policy === "following" && !known)) fail(403, "You can't message this user");
  return policy === "everyone" || known ? "active" : "request";
}

type Allowed = { can: boolean; why: string; blocked: boolean; opens: "active" | "request" };

// `blocked` is only the sender's own block: they may know about that one, so the page can offer to undo it.
async function allowed(from: User, to: User | null): Promise<Allowed> {
  if (!to) return { can: false, why: GONE, blocked: false, opens: "active" };
  if (await hasBlocked(from.id, to.id)) {
    return { can: false, why: `You blocked ${to.username}.`, blocked: true, opens: "active" };
  }
  try {
    return { can: true, why: "", blocked: false, opens: await gate(from, to) };
  } catch (e) {
    if (e instanceof HttpError) return { can: false, why: e.message, blocked: false, opens: "active" };
    throw e;
  }
}

// The refusal rolls the transaction back, so flags are collected here and written by the caller afterwards.
async function throttle(tx: Tx, from: User, body: string, startsThread: boolean, flags: Flag[]): Promise<void> {
  const t = now();
  const flag = (kind: string, detail: string) => {
    flags.push({ userId: from.id, kind, detail, sample: body });
  };
  if ((await repo.sentSinceTx(tx, from.id, t - 60)) >= DM.PER_MINUTE) {
    fail(429, "You're sending messages too quickly. Wait a moment and try again.");
  }
  if ((await repo.sentSinceTx(tx, from.id, t - 86400)) >= DM.PER_DAY) {
    flag("volume", `${DM.PER_DAY} messages in a day`);
    fail(429, "You've reached today's message limit.");
  }
  if (startsThread && !from.isAdmin) {
    const limit = t - from.registeredAt < 86400 ? DM.NEW_THREADS_NEW_ACCOUNT : DM.NEW_THREADS_PER_DAY;
    const started = await repo.startedSinceTx(tx, from.id, t - 86400);
    if (started >= limit) {
      flag("new-conversations", `${started} new conversations in a day`);
      fail(429, "You've started a lot of new conversations today. Try again tomorrow.");
    }
  }
  if (body.length >= 20 && !from.isAdmin) {
    const copies = await repo.copiesSinceTx(tx, from.id, t - 3600, body);
    if (copies >= DM.COPIES) {
      flag("copy-paste", `The same message to ${copies} people within an hour`);
      fail(429, "That looks like the same message sent to many people. It wasn't sent.");
    }
  }
}

const messageShape = (m: Message): DmMessage => ({
  id: m.id,
  from: m.senderId,
  body: m.deletedAt ? "" : m.body,
  at: m.createdAt,
  deleted: !!m.deletedAt,
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

const threadShape = async (t: Thread, userId: number): Promise<DmThread> => (await shapeOrNull(t, userId)) ?? notFound();

export const dmCounts = (userId: number): Promise<DmCounts> => repo.unreadCounts(userId);

export async function send(from: User, to: User, rawBody: unknown): Promise<DmSent> {
  const body = tidy(rawBody);
  if (!body) fail(400, "Write a message first");
  if (body.length > DM.MAX_LENGTH) fail(400, `Messages can be up to ${DM.MAX_LENGTH} characters`);
  const opening = await gate(from, to);
  const flags: Flag[] = [];
  let out: { message: Message; thread: Thread; accepted: boolean };
  try {
    out = await repo.atomically(async tx => {
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
        if ((await repo.sentInTx(tx, t.id, from.id)) >= DM.REQUEST_CAP) fail(403, "Wait for a reply before sending more messages");
      }
      if ((!t || t.status !== "active") && opening === "request" && hasLink(body)) {
        fail(400, "Links can't be sent until your message request is accepted");
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
  emit(from.id, { t: "dm", thread: await threadShape(thread, from.id), message, counts: await dmCounts(from.id), accepted });
  return { message, thread: await threadShape(thread, from.id) };
}

async function removeMessage(messageId: number, byUserId: number): Promise<void> {
  const removed = await repo.softDeleteTx(repo.connection, messageId, byUserId, now());
  if (removed) await announceRemoved([removed]);
}

// Pass the result to announceRemoved once the transaction commits.
export const removeMessageTx = (tx: Tx, messageId: number, byUserId: number): Promise<repo.Removed | null> =>
  repo.softDeleteTx(tx, messageId, byUserId, now());

export async function announceRemoved(removed: readonly (repo.Removed | null)[]): Promise<void> {
  for (const m of removed) {
    if (!m) continue;
    for (const uid of [m.userLo, m.userHi]) {
      emit(uid, { t: "dm-deleted", threadId: m.threadId, id: m.id, counts: await dmCounts(uid) });
    }
  }
}

export async function list(me: User, box: "inbox" | "requests"): Promise<DmList> {
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

export async function withUser(me: User, to: User): Promise<DmWith> {
  const t = await repo.threadOf(me.id, to.id);
  const visible = t && !(t.status === "declined" && t.requesterId !== me.id) ? t : null;
  const { can, why, blocked, opens } = await allowed(me, to);
  return {
    user: (await repo.person(to.id)) ?? fail(404, "User not found"),
    threadId: visible?.id ?? null,
    can,
    why,
    blocked,
    request: !visible && opens === "request",
    human: await firstContact(me, to),
  };
}

export async function page(me: User, threadId: unknown, before: number): Promise<DmThreadPage> {
  const t = await myThread(threadId, me.id);
  const cleared = side(t, me.id) === "lo" ? t.loCleared : t.hiCleared;
  const rows = await repo.messagesBetween(t.id, cleared, before, 51);
  const { can, why, blocked } = await allowed(me, await findById(otherId(t, me.id)));
  return {
    thread: await threadShape(t, me.id),
    messages: rows.slice(0, 50).reverse().map(messageShape),
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
  const to = (await findById(otherId(t, me.id))) ?? fail(404, GONE);
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
  if (t.status !== "request" || t.requesterId === me.id) fail(400, "That isn't a pending request");
  await repo.setStatus(t.id, "declined");
  return { ok: true, counts: await dmCounts(me.id) };
}

export async function clear(me: User, threadId: unknown): Promise<DmDone> {
  const t = await myThread(threadId, me.id);
  await repo.clearFor(t.id, side(t, me.id), await repo.topMessageId(t.id));
  return { ok: true, counts: await dmCounts(me.id) };
}

export async function unsend(me: User, messageId: unknown): Promise<DmUnsent> {
  const m = (await repo.ownMessage(Number(messageId) || 0, me.id)) ?? fail(404, "Message not found");
  await myThread(m.threadId, me.id);
  if (!m.deletedAt && now() - m.createdAt > DM.UNSEND_WINDOW) fail(403, "Messages can only be unsent for 15 minutes");
  await removeMessage(m.id, me.id);
  return { ok: true };
}

// Typing indicators are only relayed inside an accepted conversation.
async function relayTyping(userId: number, msg: ClientMessage): Promise<void> {
  if (msg.t !== "typing") return;
  const t = await repo.activeThreadFor(Number(msg.thread) || 0, userId);
  if (!t || (await blockedEither(t.userLo, t.userHi))) return;
  emit(otherId(t, userId), { t: "dm-typing", threadId: t.id });
}

export function startDm(): void {
  onClientMessage((userId, msg) => {
    relayTyping(userId, msg).catch(e => console.error(e));
  });
}
