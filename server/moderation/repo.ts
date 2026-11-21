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
export async function pageOfTx(conn: Conn, type: string, id: number): Promise<PageRef | null> {
  if (type === "user") {
    const u = (await conn.select({ username: users.username }).from(users).where(eq(users.id, id)))[0];
    return u ? { label: `${u.username}'s profile`, link: `/user/${encodeURIComponent(u.username)}` } : null;
  }
  if (type === "artist") {
    const a = (await conn.select({ name: artists.name }).from(artists).where(eq(artists.id, id)))[0];
    return a ? { label: a.name, link: `/music/${urlPart(a.name)}` } : null;
  }
  if (type === "album") {
    const a = (await conn.select({ title: albums.title, name: artists.name }).from(albums).innerJoin(artists, eq(artists.id, albums.artistId)).where(eq(albums.id, id)))[0];
    return a ? { label: `${a.title} by ${a.name}`, link: `/music/${urlPart(a.name)}/${urlPart(a.title)}` } : null;
  }
  if (type === "track") {
    const t = (await conn.select({ title: tracks.title, name: artists.name }).from(tracks).innerJoin(artists, eq(artists.id, tracks.artistId)).where(eq(tracks.id, id)))[0];
    return t ? { label: `${t.title} by ${t.name}`, link: `/music/${urlPart(t.name)}/_/${urlPart(t.title)}` } : null;
  }
  if (type === "tag") {
    const g = (await conn.select({ name: tags.name }).from(tags).where(eq(tags.id, id)))[0];
    return g ? { label: `the ${g.name} tag`, link: `/tag/${urlPart(g.name)}` } : null;
  }
  if (type === "event") {
    const e = (await conn.select({ title: events.title }).from(events).where(eq(events.id, id)))[0];
    return e ? { label: e.title, link: `/event/${id}` } : null;
  }
  if (type === "journal") {
    const j = (await conn.select({ title: journals.title, username: users.username }).from(journals).innerJoin(users, eq(users.id, journals.userId)).where(eq(journals.id, id)))[0];
    return j ? { label: `“${j.title}”`, link: `/user/${encodeURIComponent(j.username)}/journal/${id}` } : null;
  }
  return null;
}
export const pageOf = async (type: string, id: number): Promise<PageRef | null> => (await pageOfTx(db, type, id));

// ---------- what a report or a removal is aimed at ----------
/** A piece of content as it stands now: who wrote it, what it says and where it lives. `participants` and `threadId` are set for a direct message. */
export type ReportTarget = { authorId: number | null; author: string | null; text: string; where: string; link: string | null; participants?: number[]; threadId?: number };

/** The content of the given type ("shout", "wiki", "journal", "dm" or "user") and id, or null once it is gone. */
export async function reportTargetTx(conn: Conn, type: string, id: number): Promise<ReportTarget | null> {
  const name = async (uid: number | null) => (uid ? (await conn.select({ username: users.username }).from(users).where(eq(users.id, uid)))[0]?.username ?? null : null);
  if (type === "shout") {
    const s = (await conn.select().from(shouts).where(eq(shouts.id, id)))[0];
    if (!s) return null;
    const page = (await pageOfTx(conn, s.targetType, s.targetId));
    const box = s.targetType === "user" ? "/shoutbox" : s.targetType === "artist" ? "/+shoutbox" : "";
    return { authorId: s.authorId, author: (await name(s.authorId)), text: s.body, where: page ? `Shout on ${page.label}` : "Shout", link: page ? page.link + box : null };
  }
  if (type === "wiki") {
    const w = (await conn.select().from(wikis).where(eq(wikis.id, id)))[0];
    if (!w) return null;
    const page = (await pageOfTx(conn, w.itemType, w.itemId));
    return { authorId: w.authorId, author: (await name(w.authorId)), text: w.content, where: `Wiki for ${page?.label ?? "a deleted page"}, version ${w.version}`, link: page ? `${page.link}/+wiki` : null };
  }
  if (type === "journal") {
    const j = (await conn.select().from(journals).where(eq(journals.id, id)))[0];
    if (!j) return null;
    return { authorId: j.userId, author: (await name(j.userId)), text: `${j.title}\n\n${j.body}`, where: "Journal post", link: (await pageOfTx(conn, "journal", id))?.link ?? null };
  }
  if (type === "dm") {
    const m = (await reportedMessageTx(conn, id));
    return m ? { authorId: m.authorId, author: m.author, text: m.text, where: m.where, link: m.link, participants: m.participants, threadId: m.threadId } : null;
  }
  if (type === "user") {
    const u = (await conn.select().from(users).where(eq(users.id, id)))[0];
    if (!u) return null;
    return { authorId: u.id, author: u.username, text: [u.realname, u.about, u.website].filter(Boolean).join("\n") || "(empty profile)", where: "Profile", link: (await pageOfTx(conn, "user", id))?.link ?? null };
  }
  return null;
}
export const reportTarget = async (type: string, id: number): Promise<ReportTarget | null> => (await reportTargetTx(db, type, id));

/**
 * Deletes a shout, a wiki version or a journal post (with its comments), or hides a direct message (kept for staff).
 * For a message it returns who to tell: pass that to `announceRemoved` from server/dm/service.ts after commit.
 */
export async function removeContentTx(tx: Tx, type: string, id: number, by: number): Promise<Removed | null> {
  if (type === "shout") await tx.delete(shouts).where(eq(shouts.id, id));
  else if (type === "wiki") await tx.delete(wikis).where(eq(wikis.id, id));
  else if (type === "journal") await dropJournalTx(tx, id);
  else if (type === "dm") return (await softDeleteTx(tx, id, by, now()));
  return null;
}

/** Closes every open report about one thing with the given outcome. Returns how many were open. */
export async function closeReportsTx(conn: Conn, type: string, id: number, outcome: string, by: number, why = ""): Promise<number> {
  return (await conn.update(reports).set({ status: "closed", outcome, resolvedBy: by, resolvedAt: now(), resolutionNote: why })
    .where(and(eq(reports.status, "open"), eq(reports.targetType, type), eq(reports.targetId, id))).returning({ id: reports.id })).length;
}
