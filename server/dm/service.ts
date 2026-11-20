// The rules of direct messages between two users.
//
// Model: one thread per pair of users, holding messages.
//   - A message to someone who doesn't follow you starts a REQUEST: it waits in their "Requests" box until they
//     accept (or simply reply). While it waits the sender may send at most REQUEST_CAP messages, none with links,
//     and learns nothing about whether it was seen. Declining is silent.
//   - Blocks, suspensions, a staff "DM mute" and each user's "who can message me" setting are enforced on every send.
//   - Anti-spam: per-minute and per-day send limits, a daily cap on new conversations (lower for new accounts),
//     and copy-paste detection across recipients, which also raises a flag for staff.
//   - Messages are NOT end-to-end encrypted: staff can review them from the admin portal, and every such read is
//     written to the audit log. A message its sender deletes disappears for both users but the text is kept for
//     moderation.
// Delivery to open tabs goes through server/realtime.ts.
import { fail, HttpError } from "../http";
import { onClientMessage, push, type ClientMessage } from "../realtime";
import { blockedEither, findById, type User } from "../users/repo";
import { now } from "../util";
import * as repo from "./repo";
import type { Flag, Message, Thread, Tx } from "./repo";
import type { DmAccepted, DmCounts, DmDone, DmEvent, DmList, DmMessage, DmPolicy, DmSent, DmThread, DmThreadPage, DmUnsent, DmWith, ReportedMessage } from "../../shared/dm";

export const DM = {
  MAX_LENGTH: 2000,
  UNSEND_WINDOW: 15 * 60, // seconds after sending during which the sender can take a message back
  REQUEST_CAP: 3,          // messages allowed in a request before the other person answers
  PER_MINUTE: 20,
  PER_DAY: 500,
  NEW_THREADS_PER_DAY: 15,
  NEW_THREADS_NEW_ACCOUNT: 4, // accounts younger than a day
  COPIES: 4,               // the same text to this many different people within an hour is spam
};
export const POLICIES = ["everyone", "requests", "following", "nobody"] as const satisfies readonly DmPolicy[];
/** An account's "who can message me" setting. Anything unrecognised counts as the default. */
export const policyOf = (u: Pick<User, "dmPolicy">): DmPolicy => POLICIES.find(p => p === u.dmPolicy) ?? "requests";

const GONE = "This account no longer exists";
const emit = (userId: number, event: DmEvent) => push(userId, event);
const side = (t: Thread, userId: number): repo.Side => (t.userLo === userId ? "lo" : "hi");
const otherId = (t: Thread, userId: number) => (t.userLo === userId ? t.userHi : t.userLo);
const notFound = (): never => fail(404, "Conversation not found");

/** A thread, but only for one of its two participants. Anyone else gets the same 404 as for a thread that doesn't exist. */
async function myThread(id: unknown, userId: number): Promise<Thread> {
  const t = await repo.threadFor(Number(id) || 0, userId);
  // a declined request no longer exists for the person who declined it
  return !t || (t.status === "declined" && t.requesterId !== userId) ? notFound() : t;
}
const hasLink = (s: string) => /(https?:\/\/|www\.)\S|\b[a-z0-9-]+\.(com|net|org|io|ru|xyz|top|gg|me|co|link|app|ly)\b/i.test(s);
/** Message text: line breaks are kept, control characters and runs of blank lines are not. */
export function tidy(input: unknown): string {
  return String(input ?? "").normalize("NFC").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B-\u001F\u007F​-‏‪-‮⁠-⁤﻿]/g, "")
    .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Can `from` start (or continue) a conversation with `to`? Returns how a new thread would begin, or throws. */
async function gate(from: User, to: User): Promise<"active" | "request"> {
  if (from.id === to.id) fail(400, "You can't message yourself");
  if (from.suspended) fail(403, "Your account is suspended from posting");
  if (from.dmMuted) fail(403, "Messaging has been turned off for your account");
  // one answer for "blocked you", "you blocked them" and "doesn't take messages": the sender shouldn't be able to tell which
  if (to.banned || (await blockedEither(from.id, to.id))) fail(403, "You can't message this user");
  if (from.isAdmin) return "active"; // staff notices always arrive
  const policy = policyOf(to), known = await repo.isFollowing(to.id, from.id);
  if (policy === "nobody" || (policy === "following" && !known)) fail(403, "You can't message this user");
  return policy === "everyone" || known ? "active" : "request";
}
/** Whether a message would be allowed, as the pages show it: yes, or no with the reason. */
async function allowed(from: User, to: User | null): Promise<{ can: boolean; why: string; opens: "active" | "request" }> {
  if (!to) return { can: false, why: GONE, opens: "active" };
  try { return { can: true, why: "", opens: await gate(from, to) }; }
  catch (e) { if (e instanceof HttpError) return { can: false, why: e.message, opens: "active" }; throw e; }
}

/**
 * The anti-spam limits, checked inside the send transaction. A refusal that staff should know about adds to `flags`:
 * the transaction is rolled back by the refusal, so the caller writes them afterwards.
 */
function throttle(tx: Tx, from: User, body: string, startsThread: boolean, flags: Flag[]): void {
  const t = now(), flag = (kind: string, detail: string) => { flags.push({ userId: from.id, kind, detail, sample: body }); };
  if (repo.sentSinceTx(tx, from.id, t - 60) >= DM.PER_MINUTE) fail(429, "You're sending messages too quickly. Wait a moment and try again.");
  if (repo.sentSinceTx(tx, from.id, t - 86400) >= DM.PER_DAY) { flag("volume", `${DM.PER_DAY} messages in a day`); fail(429, "You've reached today's message limit."); }
  if (startsThread && !from.isAdmin) {
    const limit = t - from.registeredAt < 86400 ? DM.NEW_THREADS_NEW_ACCOUNT : DM.NEW_THREADS_PER_DAY;
    const started = repo.startedSinceTx(tx, from.id, t - 86400);
    if (started >= limit) { flag("new-conversations", `${started} new conversations in a day`); fail(429, "You've started a lot of new conversations today. Try again tomorrow."); }
  }
  if (body.length >= 20 && !from.isAdmin) { // the same text pasted to several people
    const copies = repo.copiesSinceTx(tx, from.id, t - 3600, body);
    if (copies >= DM.COPIES) { flag("copy-paste", `The same message to ${copies} people within an hour`); fail(429, "That looks like the same message sent to many people. It wasn't sent."); }
  }
}

const messageShape = (m: Message): DmMessage => ({ id: m.id, from: m.senderId, body: m.deletedAt ? "" : m.body, at: m.createdAt, deleted: !!m.deletedAt });
/** A thread as `userId` sees it, or null when the other account is gone. */
async function shapeOrNull(t: Thread, userId: number): Promise<DmThread | null> {
  const lo = t.userLo === userId, cleared = lo ? t.loCleared : t.hiCleared, read = lo ? t.loRead : t.hiRead, theirRead = lo ? t.hiRead : t.loRead;
  const mine = t.requesterId === userId, pending = t.status !== "active";
  const user = await repo.person(otherId(t, userId));
  if (!user) return null;
  const last = await repo.lastMessage(t.id, cleared);
  return {
    id: t.id, user,
    // a declined request looks, to the person who sent it, exactly like one still waiting
    status: pending ? "request" : "active", incoming: pending && !mine,
    last: last ? messageShape(last) : null, at: t.lastAt,
    unread: await repo.unreadIn(t.id, Math.max(read, cleared), userId),
    seen: pending ? 0 : theirRead, // read receipts only once the conversation is accepted
    left: pending && mine ? Math.max(0, DM.REQUEST_CAP - (await repo.sentIn(t.id, userId))) : null,
  };
}
const threadShape = async (t: Thread, userId: number): Promise<DmThread> => (await shapeOrNull(t, userId)) ?? notFound();

/** Unread counts for the header badge. */
export const dmCounts = (userId: number): Promise<DmCounts> => repo.unreadCounts(userId);

/** Send a message. `from` and `to` are full user rows. Returns the stored message and the thread as the sender sees it. */
export async function send(from: User, to: User, rawBody: unknown): Promise<DmSent> {
  const body = tidy(rawBody);
  if (!body) fail(400, "Write a message first");
  if (body.length > DM.MAX_LENGTH) fail(400, `Messages can be up to ${DM.MAX_LENGTH} characters`);
  const opening = await gate(from, to), flags: Flag[] = [];
  let out: { message: Message; thread: Thread; accepted: boolean };
  try {
    out = repo.atomically(tx => {
      let t = repo.threadOfTx(tx, from.id, to.id), accepted = false;
      const pendingMine = !!t && t.status !== "active" && t.requesterId === from.id;
      if (t && t.status !== "active" && !pendingMine) { // answering a request accepts it
        repo.setStatusTx(tx, t.id, "active"); t = { ...t, status: "active" }; accepted = true;
      } else if (t && pendingMine && opening === "active" && t.status === "request") { // they followed you since, or opened their inbox
        repo.setStatusTx(tx, t.id, "active"); t = { ...t, status: "active" };
      } else if (t && pendingMine) {
        if (repo.sentInTx(tx, t.id, from.id) >= DM.REQUEST_CAP) fail(403, "Wait for a reply before sending more messages");
      }
      if ((!t || t.status !== "active") && opening === "request" && hasLink(body)) fail(400, "Links can't be sent until your message request is accepted");
      throttle(tx, from, body, !t, flags);
      const at = now();
      return { ...repo.addMessageTx(tx, t ?? repo.createThreadTx(tx, from.id, to.id, opening, at), from.id, body, at), accepted };
    });
  } finally {
    for (const f of flags) await repo.raiseFlag(f, now());
  }
  const { thread, accepted } = out, message = messageShape(out.message);
  // a declined request is delivered nowhere; everything else reaches the other side's open tabs at once
  if (thread.status !== "declined") emit(to.id, { t: "dm", thread: await threadShape(thread, to.id), message, counts: await dmCounts(to.id) });
  emit(from.id, { t: "dm", thread: await threadShape(thread, from.id), message, counts: await dmCounts(from.id), accepted });
  return { message, thread: await threadShape(thread, from.id) };
}

/** Hide a message from both participants (its sender, or staff). The row is kept for moderation. False when there was nothing to hide. */
export async function removeMessage(messageId: number, byUserId: number): Promise<boolean> {
  const removed = repo.softDeleteTx(repo.connection, messageId, byUserId, now());
  if (removed) await announceRemoved([removed]);
  return !!removed;
}
/** Hides a message as part of a larger transaction (moderation). Pass what it returns to announceRemoved after commit. */
export const removeMessageTx = (tx: Tx, messageId: number, byUserId: number): repo.Removed | null => repo.softDeleteTx(tx, messageId, byUserId, now());
/** Tells both people's open tabs that messages disappeared. Call after the transaction that removed them commits. */
export async function announceRemoved(removed: readonly (repo.Removed | null)[]): Promise<void> {
  for (const m of removed) if (m) for (const uid of [m.userLo, m.userHi]) emit(uid, { t: "dm-deleted", threadId: m.threadId, id: m.id, counts: await dmCounts(uid) });
}

/** What a report of a message shows staff: the message, who wrote it, and the few messages around it. */
export const reportedMessage = async (id: number): Promise<ReportedMessage | null> => repo.reportedMessageTx(repo.connection, id);
export const reportedMessageTx = repo.reportedMessageTx;

// ---------- what the HTTP routes do ----------
/** The inbox (accepted conversations and requests I sent) or the requests waiting on me. */
export async function list(me: User, box: "inbox" | "requests"): Promise<DmList> {
  const items: DmThread[] = [];
  for (const t of await repo.listThreads(me.id, box)) { const s = await shapeOrNull(t, me.id); if (s) items.push(s); }
  return { items, counts: await dmCounts(me.id), policy: policyOf(me) };
}

/** Opening a conversation from a profile: the existing thread if there is one, and whether a message would be allowed. */
export async function withUser(me: User, to: User): Promise<DmWith> {
  const t = await repo.threadOf(me.id, to.id);
  const visible = t && !(t.status === "declined" && t.requesterId !== me.id) ? t : null;
  const { can, why, opens } = await allowed(me, to);
  return { user: (await repo.person(to.id)) ?? fail(404, "User not found"), threadId: visible?.id ?? null, can, why, request: !visible && opens === "request" };
}

/** One page of a conversation: up to 50 messages older than `before`, oldest first. */
export async function page(me: User, threadId: unknown, before: number): Promise<DmThreadPage> {
  const t = await myThread(threadId, me.id), cleared = side(t, me.id) === "lo" ? t.loCleared : t.hiCleared;
  const rows = await repo.messagesBetween(t.id, cleared, before, 51);
  const { can, why } = await allowed(me, await findById(otherId(t, me.id)));
  return { thread: await threadShape(t, me.id), messages: rows.slice(0, 50).reverse().map(messageShape), more: rows.length > 50, can, why, max: DM.MAX_LENGTH, unsendFor: DM.UNSEND_WINDOW };
}

/** Send into an existing conversation. */
export async function sendToThread(me: User, threadId: unknown, body: unknown): Promise<DmSent> {
  const t = await myThread(threadId, me.id);
  return send(me, (await findById(otherId(t, me.id))) ?? fail(404, GONE), body);
}

/** Mark everything in a conversation as read. The other person is told only in an accepted conversation. */
export async function read(me: User, threadId: unknown): Promise<DmDone> {
  const t = await myThread(threadId, me.id), s = side(t, me.id), top = await repo.topMessageId(t.id);
  if (top > (s === "lo" ? t.loRead : t.hiRead)) {
    await repo.markRead(t.id, s, top);
    if (t.status === "active") emit(otherId(t, me.id), { t: "dm-read", threadId: t.id, seen: top }); // no receipts for requests
    emit(me.id, { t: "dm-counts", counts: await dmCounts(me.id) });
  }
  return { ok: true, counts: await dmCounts(me.id) };
}

/** Accept a request sent to me. Anything else is left as it is. */
export async function accept(me: User, threadId: unknown): Promise<DmAccepted> {
  let t = await myThread(threadId, me.id);
  if (t.status === "request" && t.requesterId !== me.id) {
    await repo.setStatus(t.id, "active"); t = { ...t, status: "active" };
    emit(t.requesterId, { t: "dm-thread", thread: await threadShape(t, t.requesterId) });
  }
  return { thread: await threadShape(t, me.id), counts: await dmCounts(me.id) };
}

/** Decline a request. The sender is not told. */
export async function decline(me: User, threadId: unknown): Promise<DmDone> {
  const t = await myThread(threadId, me.id);
  if (t.status !== "request" || t.requesterId === me.id) fail(400, "That isn't a pending request");
  await repo.setStatus(t.id, "declined");
  return { ok: true, counts: await dmCounts(me.id) };
}

/** Delete the conversation from my side only. A later message starts it afresh for me. */
export async function clear(me: User, threadId: unknown): Promise<DmDone> {
  const t = await myThread(threadId, me.id);
  await repo.clearFor(t.id, side(t, me.id), await repo.topMessageId(t.id));
  return { ok: true, counts: await dmCounts(me.id) };
}

/** Unsend one of my own messages. */
export async function unsend(me: User, messageId: unknown): Promise<DmUnsent> {
  const m = (await repo.ownMessage(Number(messageId) || 0, me.id)) ?? fail(404, "Message not found");
  await myThread(m.threadId, me.id);
  if (!m.deletedAt && now() - m.createdAt > DM.UNSEND_WINDOW) fail(403, "Messages can only be unsent for 15 minutes");
  await removeMessage(m.id, me.id);
  return { ok: true };
}

// ---------- the socket ----------
/** "typing..." is the one thing a client may say over the socket. Only relayed inside an accepted conversation. */
async function relayTyping(userId: number, msg: ClientMessage): Promise<void> {
  if (msg.t !== "typing") return;
  const t = await repo.activeThreadFor(Number(msg.thread) || 0, userId);
  if (!t || (await blockedEither(t.userLo, t.userHi))) return;
  emit(otherId(t, userId), { t: "dm-typing", threadId: t.id });
}
/** Starts listening for what clients say over the socket. Call once at startup. */
export function startDm(): void {
  onClientMessage((userId, msg) => { relayTyping(userId, msg).catch(e => console.error(e)); });
}
