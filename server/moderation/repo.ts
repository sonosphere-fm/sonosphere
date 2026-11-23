import { and, eq } from "drizzle-orm";
import { db, type Conn, type Tx } from "../db/client";
import { albums, artists, events, journals, reports, shouts, tags, tracks, users, wikis } from "../db/schema";
import { reportedMessageTx, softDeleteTx, type Removed } from "../dm/repo";
import {
  reportedMessageTx as reportedGroupMessageTx,
  softDeleteTx as softDeleteGroupTx,
  type GroupRemoved,
} from "../dm/groups.repo";
import { dropJournalTx } from "../journals/repo";
import { parseObject } from "../site/repo";
import { now } from "../util";
import type { PageRef } from "../../shared/admin";
import { storedProfileLinks } from "../../shared/profile-links";

const text = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

// What a report recorded about its target when it was filed, for when the target is gone.
export function snapshotOf(json: string | null): { text?: string; where?: string; author?: string } {
  const s = parseObject(json);
  return { text: text(s.text), where: text(s.where), author: text(s.author) };
}

const urlPart = (s: string) =>
  encodeURIComponent(s.replace(/[%+]/g, (x) => encodeURIComponent(x))).replace(/%20/g, "+");

async function pageOfTx(conn: Conn, type: string, id: number): Promise<PageRef | null> {
  if (type === "user") {
    const [u] = await conn.select({ username: users.username }).from(users).where(eq(users.id, id));
    return u ? { label: `${u.username}'s profile`, link: `/user/${encodeURIComponent(u.username)}` } : null;
  }
  if (type === "artist") {
    const [a] = await conn.select({ name: artists.name }).from(artists).where(eq(artists.id, id));
    return a ? { label: a.name, link: `/music/${urlPart(a.name)}` } : null;
  }
  if (type === "album") {
    const [a] = await conn
      .select({ title: albums.title, name: artists.name })
      .from(albums)
      .innerJoin(artists, eq(artists.id, albums.artistId))
      .where(eq(albums.id, id));
    return a ? { label: `${a.title} by ${a.name}`, link: `/music/${urlPart(a.name)}/${urlPart(a.title)}` } : null;
  }
  if (type === "track") {
    const [t] = await conn
      .select({ title: tracks.title, name: artists.name })
      .from(tracks)
      .innerJoin(artists, eq(artists.id, tracks.artistId))
      .where(eq(tracks.id, id));
    return t ? { label: `${t.title} by ${t.name}`, link: `/music/${urlPart(t.name)}/_/${urlPart(t.title)}` } : null;
  }
  if (type === "tag") {
    const [g] = await conn.select({ name: tags.name }).from(tags).where(eq(tags.id, id));
    return g ? { label: `the ${g.name} tag`, link: `/tag/${urlPart(g.name)}` } : null;
  }
  if (type === "event") {
    const [e] = await conn.select({ title: events.title }).from(events).where(eq(events.id, id));
    return e ? { label: e.title, link: `/event/${id}` } : null;
  }
  if (type === "journal") {
    const [j] = await conn
      .select({ title: journals.title, username: users.username })
      .from(journals)
      .innerJoin(users, eq(users.id, journals.userId))
      .where(eq(journals.id, id));
    return j ? { label: `“${j.title}”`, link: `/user/${encodeURIComponent(j.username)}/journal/${id}` } : null;
  }
  return null;
}

export const pageOf = (type: string, id: number): Promise<PageRef | null> => pageOfTx(db, type, id);

// `participants` and `threadId` are set for a direct message.
type ReportTarget = {
  authorId: number | null;
  author: string | null;
  text: string;
  where: string;
  link: string | null;
  participants?: number[];
  threadId?: number;
};

export async function reportTargetTx(conn: Conn, type: string, id: number): Promise<ReportTarget | null> {
  const name = async (uid: number | null) => {
    if (!uid) return null;
    const [u] = await conn.select({ username: users.username }).from(users).where(eq(users.id, uid));
    return u?.username ?? null;
  };
  if (type === "shout") {
    const [s] = await conn.select().from(shouts).where(eq(shouts.id, id));
    if (!s) return null;
    const page = await pageOfTx(conn, s.targetType, s.targetId);
    let box = "";
    if (s.targetType === "user") box = "/shoutbox";
    else if (s.targetType === "artist") box = "/+shoutbox";
    return {
      authorId: s.authorId,
      author: await name(s.authorId),
      text: s.body,
      where: page ? `Shout on ${page.label}` : "Shout",
      link: page ? page.link + box : null,
    };
  }
  if (type === "wiki") {
    const [w] = await conn.select().from(wikis).where(eq(wikis.id, id));
    if (!w) return null;
    const page = await pageOfTx(conn, w.itemType, w.itemId);
    return {
      authorId: w.authorId,
      author: await name(w.authorId),
      text: w.content,
      where: `Wiki for ${page?.label ?? "a deleted page"}, version ${w.version}`,
      link: page ? `${page.link}/+wiki` : null,
    };
  }
  if (type === "journal") {
    const [j] = await conn.select().from(journals).where(eq(journals.id, id));
    if (!j) return null;
    const page = await pageOfTx(conn, "journal", id);
    return {
      authorId: j.userId,
      author: await name(j.userId),
      text: `${j.title}\n\n${j.body}`,
      where: "Journal post",
      link: page?.link ?? null,
    };
  }
  if (type === "dm" || type === "group") {
    const m = type === "dm" ? await reportedMessageTx(conn, id) : await reportedGroupMessageTx(conn, id);
    if (!m) return null;
    return {
      authorId: m.authorId,
      author: m.author,
      text: m.text,
      where: m.where,
      link: m.link,
      participants: m.participants,
      threadId: m.threadId,
    };
  }
  if (type === "user") {
    const [u] = await conn.select().from(users).where(eq(users.id, id));
    if (!u) return null;
    const page = await pageOfTx(conn, "user", id);
    const links = storedProfileLinks(u.profileLinks).map((l) => (l.label ? `${l.label}: ${l.url}` : l.url));
    const profile = [u.realname, u.about, ...links].filter(Boolean).join("\n");
    return {
      authorId: u.id,
      author: u.username,
      text: profile || "(empty profile)",
      where: "Profile",
      link: page?.link ?? null,
    };
  }
  return null;
}

export const reportTarget = (type: string, id: number): Promise<ReportTarget | null> => reportTargetTx(db, type, id);

// For a direct message it hides rather than deletes, and returns who to tell: pass that to
// `announceRemoved` from server/dm/service.ts after commit.
export async function removeContentTx(
  tx: Tx,
  type: string,
  id: number,
  by: number
): Promise<Removed | GroupRemoved | null> {
  if (type === "shout") await tx.update(shouts).set({ body: "", deleted: true }).where(eq(shouts.id, id));
  else if (type === "wiki") await tx.delete(wikis).where(eq(wikis.id, id));
  else if (type === "journal") await dropJournalTx(tx, id);
  else if (type === "dm") return softDeleteTx(tx, id, by, now());
  else if (type === "group") return softDeleteGroupTx(tx, id, by, now());
  return null;
}

// Returns how many reports were open.
export async function closeReportsTx(
  conn: Conn,
  type: string,
  id: number,
  outcome: string,
  by: number,
  why = ""
): Promise<number> {
  const closed = await conn
    .update(reports)
    .set({ status: "closed", outcome, resolvedBy: by, resolvedAt: now(), resolutionNote: why })
    .where(and(eq(reports.status, "open"), eq(reports.targetType, type), eq(reports.targetId, id)))
    .returning({ id: reports.id });
  return closed.length;
}
