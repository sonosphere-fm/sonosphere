import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, lte, notInArray, notLike, or } from "drizzle-orm";
import { db } from "../db/client";
import { notifications, users } from "../db/schema";
import { unreadSince } from "../dm/repo";
import { unreadSince as groupUnreadSince } from "../dm/groups.repo";
import { attempt } from "../kv";
import { send, SITE_URL } from "../mail";
import { digestMail, noticeMail, type NoticeLine } from "../mail/templates";
import { findById, type User } from "../users/repo";
import { now } from "../util";
import * as Sentry from "@sentry/bun";
import type { EmailKind } from "../../shared/notifications";

const userPage = (name: string) => `${SITE_URL}/user/${encodeURIComponent(name)}`;
const str = (v: unknown) => (typeof v === "string" ? v : "");
const muted = (u: User) => new Set(u.emailMuted.split(",").filter(Boolean));
const reachable = (u: User) => !!u.emailVerifiedAt && !u.banned && !u.email.endsWith(".invalid");
const wantsNow = (u: User, kind: EmailKind) => reachable(u) && u.emailNotify === "instant" && !muted(u).has(kind);

function describe(
  to: User,
  type: string,
  actor: string | null,
  data: Record<string, unknown>
): (NoticeLine & { button: string }) | null {
  const who = actor ?? "Someone";
  const quote = str(data.body) || undefined;
  if (type === "follow") {
    return { line: `${who} started following you`, url: userPage(actor ?? to.username), button: "See their profile" };
  }
  if (type === "shout") {
    return {
      line: data.reply ? `${who} replied to your wall post` : `${who} wrote on your wall`,
      quote,
      url: `${userPage(str(data.wallUsername) || to.username)}/wall`,
      button: "See the wall",
    };
  }
  if (type === "comment") {
    const title = str(data.title) || "your journal post";
    const url = `${userPage(str(data.journalUsername) || to.username)}/journal/${Number(data.journalId)}`;
    return { line: `${who} commented on “${title}”`, quote, url, button: "See the comment" };
  }
  return null;
}

export async function mailNotice(
  userId: number,
  type: string,
  actorId: number,
  data: Record<string, unknown>
): Promise<void> {
  try {
    const to = await findById(userId);
    if (!to || !wantsNow(to, type as EmailKind)) return;
    const actor = await findById(actorId);
    const n = describe(to, type, actor?.username ?? null, data);
    // at most 10 an hour; anything past that still shows in the inbox
    if (n && (await attempt(`mail-notice:${userId}`, 10, 3600_000))) await send(noticeMail(to.email, n));
  } catch (e) {
    console.error("notification mail:", e);
    Sentry.captureException(e);
  }
}

// At most once an hour per conversation.
export async function mailMessage(
  to: User,
  from: string,
  threadId: number | string,
  request: boolean,
  body: string
): Promise<void> {
  try {
    if (!wantsNow(to, "message")) return;
    if (!(await attempt(`mail-dm:${to.id}:${threadId}`, 1, 3600_000))) return;
    if (request) {
      await send(
        noticeMail(to.email, {
          line: `${from} sent you a message request`,
          url: `${SITE_URL}/messages/requests`,
          button: "See the request",
        })
      );
    } else {
      const quote = body.length > 200 ? `${body.slice(0, 200)}…` : body;
      await send(
        noticeMail(to.email, {
          line: `${from} sent you a message`,
          quote,
          url: `${SITE_URL}/messages`,
          button: "Read it",
        })
      );
    }
  } catch (e) {
    console.error("message mail:", e);
    Sentry.captureException(e);
  }
}

const PERIOD = { daily: 86400, weekly: 7 * 86400 };
const MAX_LINES = 25;

export async function sendDigests(): Promise<void> {
  const t = now();
  const isDue = or(
    isNull(users.digestAt),
    and(eq(users.emailNotify, "daily"), lte(users.digestAt, t - PERIOD.daily)),
    and(eq(users.emailNotify, "weekly"), lte(users.digestAt, t - PERIOD.weekly))
  );
  const due = await db
    .select()
    .from(users)
    .where(
      and(
        inArray(users.emailNotify, ["daily", "weekly"]),
        isNotNull(users.emailVerifiedAt),
        eq(users.banned, false),
        notLike(users.email, "%.invalid"),
        isDue
      )
    )
    .orderBy(asc(users.digestAt))
    .limit(200);
  for (const u of due) {
    const since = u.digestAt;
    await db.update(users).set({ digestAt: t }).where(eq(users.id, u.id));
    // first pass after picking a digest: start counting from now
    if (since === null) continue;
    const off = [...muted(u)];
    const rows = await db
      .select({ type: notifications.type, data: notifications.data, actor: users.username })
      .from(notifications)
      .leftJoin(users, eq(users.id, notifications.actorId))
      .where(
        and(
          eq(notifications.userId, u.id),
          gt(notifications.createdAt, since),
          eq(notifications.read, false),
          off.length ? notInArray(notifications.type, off) : undefined
        )
      )
      .orderBy(desc(notifications.createdAt))
      .limit(200);
    const lines = rows
      .map((r) => describe(u, r.type, r.actor, JSON.parse(r.data) as Record<string, unknown>))
      .filter((x) => x !== null);
    if (!off.includes("message")) {
      const direct = await unreadSince(u.id, since);
      const group = await groupUnreadSince(u.id, since);
      const dm = { messages: direct.messages + group.messages, people: direct.people + group.people };
      if (dm.messages) {
        const messages = `${dm.messages} new message${dm.messages === 1 ? "" : "s"}`;
        const people = `${dm.people} ${dm.people === 1 ? "person" : "people"}`;
        lines.unshift({ line: `${messages} from ${people}`, url: `${SITE_URL}/messages`, button: "" });
      }
    }
    if (!lines.length) continue;
    const more = Math.max(0, lines.length - MAX_LINES);
    await send(digestMail(u.email, u.username, u.emailNotify === "weekly", lines.slice(0, MAX_LINES), more));
  }
}
