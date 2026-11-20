// What moderation works with, shared by the public report queue and the staff portal: where a piece of content
// lives, what a report points at, removing reported content and closing reports.
// The Tx-suffixed functions are synchronous and take `db` or an open transaction.
import { and, eq } from "drizzle-orm";
import { db, type Conn, type Tx } from "../db/client";
import { albums, artists, events, journals, reports, shouts, tags, tracks, users, wikis } from "../db/schema";
import { reportedMessageTx, softDeleteTx, type Removed } from "../dm/repo";
import { dropJournalTx } from "../journals/repo";
import { parseObject } from "../site/repo";
import { now } from "../util";
import type { PageRef } from "../../shared/admin";

const text = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
/** What a report recorded about its target when it was filed, for when the target is gone. */
export function snapshotOf(json: string | null): { text?: string; where?: string; author?: string } {
  const s = parseObject(json);
  return { text: text(s.text), where: text(s.where), author: text(s.author) };
}

// ---------- pages ----------
const urlPart = (s: string) => encodeURIComponent(s.replace(/[%+]/g, x => encodeURIComponent(x))).replace(/%20/g, "+");
/** The name and address of the page for an item (a profile, an artist, a journal post...), or null if it is gone. */
export function pageOfTx(conn: Conn, type: string, id: number): PageRef | null {
  if (type === "user") {
    const u = conn.select({ username: users.username }).from(users).where(eq(users.id, id)).get();
    return u ? { label: `${u.username}'s profile`, link: `/user/${encodeURIComponent(u.username)}` } : null;
  }
  if (type === "artist") {
    const a = conn.select({ name: artists.name }).from(artists).where(eq(artists.id, id)).get();
    return a ? { label: a.name, link: `/music/${urlPart(a.name)}` } : null;
  }
  if (type === "album") {
    const a = conn.select({ title: albums.title, name: artists.name }).from(albums).innerJoin(artists, eq(artists.id, albums.artistId)).where(eq(albums.id, id)).get();
    return a ? { label: `${a.title} by ${a.name}`, link: `/music/${urlPart(a.name)}/${urlPart(a.title)}` } : null;
  }
  if (type === "track") {
    const t = conn.select({ title: tracks.title, name: artists.name }).from(tracks).innerJoin(artists, eq(artists.id, tracks.artistId)).where(eq(tracks.id, id)).get();
    return t ? { label: `${t.title} by ${t.name}`, link: `/music/${urlPart(t.name)}/_/${urlPart(t.title)}` } : null;
  }
  if (type === "tag") {
    const g = conn.select({ name: tags.name }).from(tags).where(eq(tags.id, id)).get();
    return g ? { label: `the ${g.name} tag`, link: `/tag/${urlPart(g.name)}` } : null;
  }
  if (type === "event") {
    const e = conn.select({ title: events.title }).from(events).where(eq(events.id, id)).get();
    return e ? { label: e.title, link: `/event/${id}` } : null;
  }
  if (type === "journal") {
    const j = conn.select({ title: journals.title, username: users.username }).from(journals).innerJoin(users, eq(users.id, journals.userId)).where(eq(journals.id, id)).get();
    return j ? { label: `“${j.title}”`, link: `/user/${encodeURIComponent(j.username)}/journal/${id}` } : null;
  }
  return null;
}
export const pageOf = async (type: string, id: number): Promise<PageRef | null> => pageOfTx(db, type, id);

// ---------- what a report or a removal is aimed at ----------
/** A piece of content as it stands now: who wrote it, what it says and where it lives. `participants` and `threadId` are set for a direct message. */
export type ReportTarget = { authorId: number | null; author: string | null; text: string; where: string; link: string | null; participants?: number[]; threadId?: number };

/** The content of the given type ("shout", "wiki", "journal", "dm" or "user") and id, or null once it is gone. */
export function reportTargetTx(conn: Conn, type: string, id: number): ReportTarget | null {
  const name = (uid: number | null) => (uid ? conn.select({ username: users.username }).from(users).where(eq(users.id, uid)).get()?.username ?? null : null);
  if (type === "shout") {
    const s = conn.select().from(shouts).where(eq(shouts.id, id)).get();
    if (!s) return null;
    const page = pageOfTx(conn, s.targetType, s.targetId);
    const box = s.targetType === "user" ? "/shoutbox" : s.targetType === "artist" ? "/+shoutbox" : "";
    return { authorId: s.authorId, author: name(s.authorId), text: s.body, where: page ? `Shout on ${page.label}` : "Shout", link: page ? page.link + box : null };
  }
  if (type === "wiki") {
    const w = conn.select().from(wikis).where(eq(wikis.id, id)).get();
    if (!w) return null;
    const page = pageOfTx(conn, w.itemType, w.itemId);
    return { authorId: w.authorId, author: name(w.authorId), text: w.content, where: `Wiki for ${page?.label ?? "a deleted page"}, version ${w.version}`, link: page ? `${page.link}/+wiki` : null };
  }
  if (type === "journal") {
    const j = conn.select().from(journals).where(eq(journals.id, id)).get();
    if (!j) return null;
    return { authorId: j.userId, author: name(j.userId), text: `${j.title}\n\n${j.body}`, where: "Journal post", link: pageOfTx(conn, "journal", id)?.link ?? null };
  }
  if (type === "dm") {
    const m = reportedMessageTx(conn, id);
    return m ? { authorId: m.authorId, author: m.author, text: m.text, where: m.where, link: m.link, participants: m.participants, threadId: m.threadId } : null;
  }
  if (type === "user") {
    const u = conn.select().from(users).where(eq(users.id, id)).get();
    if (!u) return null;
    return { authorId: u.id, author: u.username, text: [u.realname, u.about, u.website].filter(Boolean).join("\n") || "(empty profile)", where: "Profile", link: pageOfTx(conn, "user", id)?.link ?? null };
  }
  return null;
}
export const reportTarget = async (type: string, id: number): Promise<ReportTarget | null> => reportTargetTx(db, type, id);

/**
 * Deletes a shout, a wiki version or a journal post (with its comments), or hides a direct message (kept for staff).
 * For a message it returns who to tell: pass that to `announceRemoved` from server/dm/service.ts after commit.
 */
export function removeContentTx(tx: Tx, type: string, id: number, by: number): Removed | null {
  if (type === "shout") tx.delete(shouts).where(eq(shouts.id, id)).run();
  else if (type === "wiki") tx.delete(wikis).where(eq(wikis.id, id)).run();
  else if (type === "journal") dropJournalTx(tx, id);
  else if (type === "dm") return softDeleteTx(tx, id, by, now());
  return null;
}

/** Closes every open report about one thing with the given outcome. Returns how many were open. */
export function closeReportsTx(conn: Conn, type: string, id: number, outcome: string, by: number, why = ""): number {
  return conn.update(reports).set({ status: "closed", outcome, resolvedBy: by, resolvedAt: now(), resolutionNote: why })
    .where(and(eq(reports.status, "open"), eq(reports.targetType, type), eq(reports.targetId, id))).returning({ id: reports.id }).all().length;
}
