import { and, asc, count, desc, eq, gt, gte, inArray, isNull, max, ne, notLike, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, transact } from "../db/client";
import {
  apiSessions, apiTokens, auditLog, blocks, dmFlags, emailTokens, dmMessages, dmThreads, follows, journals, lovedTracks, modNotes, nowPlaying, playlists,
  reports, scrobbles, sessions, shouts, taggings, userArtists, users, wikis,
} from "../db/schema";
import { jsonField, matches } from "../db/dialect";
import { first, now } from "../util";
import type { User } from "../users/repo";
import type { AuditEntry } from "../site/audit";
import { snapshotOf } from "../moderation/repo";
import { auditRows } from "../site/repo";
import { auditTx } from "../site/audit";
import { handOffGroupsTx } from "../dm/groups.repo";
import { probationSql } from "../trust/repo";
import type { AuditRow, ModNote, ReportBrief, StaffUserPage } from "../../shared/admin";

const DAY = 86400;
type Actor = { id: number; username: string };

// A report is "against" an account when it reports the profile itself or something the account wrote.
const against = (userId: SQL | typeof users.id, username: SQL | typeof users.username) =>
  or(and(eq(reports.targetType, "user"), eq(reports.targetId, userId)), eq(jsonField(reports.snapshot, "author"), username));
const lastLogin = sql<number | null>`(SELECT MAX(${sessions.createdAt}) FROM ${sessions} WHERE ${sessions.userId} = ${users.id})`;
const openReports = sql<number>`(SELECT COUNT(*) FROM ${reports} WHERE ${reports.status} = 'open' AND ${against(users.id, users.username)})`;

type UserFilter = "all" | "staff" | "admins" | "moderators" | "suspended" | "banned" | "reported" | "unconfirmed" | "probation";
type UserSort = "username" | "registered" | "scrobbles" | "reports" | "login";
const notBanned = eq(users.banned, false);
const FILTERS: Record<UserFilter, SQL | undefined> = {
  all: undefined,
  staff: and(eq(users.isAdmin, true), notBanned),
  admins: and(eq(users.isAdmin, true), ne(users.role, "moderator"), notBanned),
  moderators: and(eq(users.isAdmin, true), eq(users.role, "moderator"), notBanned),
  suspended: and(eq(users.suspended, true), notBanned),
  banned: eq(users.banned, true),
  reported: gt(openReports, 0),
  unconfirmed: and(isNull(users.emailVerifiedAt), notLike(users.email, "%.invalid")),
  probation: and(probationSql, notBanned),
};
type UserQuery = {
  filter: UserFilter;
  sort: UserSort;
  ascending: boolean;
  pattern: string | null;
  searchEmail: boolean;
  limit: number;
  offset: number;
};
type UserListRow = User & { scrobbles: number; openReports: number; lastLogin: number | null; probation: boolean };

export async function listUsers(q: UserQuery): Promise<{ rows: UserListRow[]; total: number }> {
  const plays = db.select({ userId: scrobbles.userId, c: count().as("c") }).from(scrobbles).groupBy(scrobbles.userId).as("s");
  const played = sql<number>`COALESCE(${plays.c}, 0)`;
  const p = q.pattern;
  const search = p === null
    ? undefined
    : or(matches(users.usernameNorm, p), matches(users.realname, p), q.searchEmail ? matches(users.email, p) : undefined);
  const where = and(FILTERS[q.filter], search);
  const sortKeys = { username: users.usernameNorm, registered: users.registeredAt, scrobbles: played, reports: openReports, login: lastLogin };
  const key = sortKeys[q.sort];
  const rows = await db.select({ user: users, scrobbles: played, openReports, lastLogin, probation: probationSql })
    .from(users)
    .leftJoin(plays, eq(plays.userId, users.id))
    .where(where)
    .orderBy(q.ascending ? asc(key) : desc(key), desc(users.id))
    .limit(q.limit)
    .offset(q.offset);
  return {
    rows: rows.map(r => ({ ...r.user, scrobbles: r.scrobbles, openReports: r.openReports, lastLogin: r.lastLogin, probation: r.probation })),
    total: await db.$count(users, where),
  };
}

export async function contentCounts(id: number): Promise<{ scrobbles: number; shouts: number; journals: number }> {
  const plays = await first(db.select({ c: sql<number>`COALESCE(SUM(${userArtists.plays}), 0)` }).from(userArtists).where(eq(userArtists.userId, id)));
  return {
    scrobbles: plays?.c ?? 0,
    shouts: await db.$count(shouts, eq(shouts.authorId, id)),
    journals: await db.$count(journals, eq(journals.userId, id)),
  };
}

export async function userCounts(id: number): Promise<StaffUserPage["counts"]> {
  const c = await contentCounts(id);
  return {
    scrobbles: c.scrobbles,
    loved: await db.$count(lovedTracks, eq(lovedTracks.userId, id)),
    shouts: c.shouts,
    journals: c.journals,
    wikiEdits: await db.$count(wikis, eq(wikis.authorId, id)),
    playlists: await db.$count(playlists, eq(playlists.userId, id)),
    tags: await db.$count(taggings, eq(taggings.userId, id)),
    followers: await db.$count(follows, eq(follows.followeeId, id)),
    following: await db.$count(follows, eq(follows.followerId, id)),
    blockedBy: await db.$count(blocks, eq(blocks.blockedId, id)),
    sessions: await db.$count(sessions, eq(sessions.userId, id)),
    apiSessions: await db.$count(apiSessions, eq(apiSessions.userId, id)),
  };
}

export async function lastLoginOf(id: number): Promise<number | null> {
  const row = await first(db.select({ t: max(sessions.createdAt) }).from(sessions).where(eq(sessions.userId, id)));
  return row?.t ?? null;
}

export async function lastScrobbleOf(id: number): Promise<number | null> {
  const row = await first(db.select({ t: max(scrobbles.playedAt) }).from(scrobbles).where(eq(scrobbles.userId, id)));
  return row?.t ?? null;
}

async function reportList(where: SQL | undefined): Promise<ReportBrief[]> {
  const reporter = alias(users, "reporter");
  const resolver = alias(users, "resolver");
  const profile = alias(users, "profile");
  const rows = await db.select({
    id: reports.id,
    type: reports.targetType,
    reason: reports.reason,
    status: reports.status,
    outcome: reports.outcome,
    createdAt: reports.createdAt,
    reporter: reporter.username,
    resolver: resolver.username,
    snapshot: reports.snapshot,
    profile: profile.username,
  })
    .from(reports)
    .leftJoin(reporter, eq(reporter.id, reports.reporterId))
    .leftJoin(resolver, eq(resolver.id, reports.resolvedBy))
    .leftJoin(profile, and(eq(reports.targetType, "user"), eq(profile.id, reports.targetId)))
    .where(where)
    .orderBy(desc(reports.createdAt))
    .limit(30);
  return rows.map(({ snapshot, profile, ...r }) => {
    const snap = snapshotOf(snapshot);
    return { ...r, where: snap.where ?? "", author: profile ?? snap.author ?? null };
  });
}

export const reportsAgainst = (u: User): Promise<ReportBrief[]> => reportList(against(sql`${u.id}`, sql`${u.username}`));
export const reportsBy = (id: number): Promise<ReportBrief[]> => reportList(eq(reports.reporterId, id));

export const recentShouts = (id: number, limit: number) =>
  db.select({ id: shouts.id, body: shouts.body, targetType: shouts.targetType, targetId: shouts.targetId, createdAt: shouts.createdAt })
    .from(shouts)
    .where(eq(shouts.authorId, id))
    .orderBy(desc(shouts.createdAt))
    .limit(limit);

const threadsOf = (id: number) => or(eq(dmThreads.userLo, id), eq(dmThreads.userHi, id));

// Staff actions on the account, on its profile, or reading its conversations.
export function userHistory(id: number, limit: number): Promise<AuditRow[]> {
  const theirThreads = db.select({ id: dmThreads.id }).from(dmThreads).where(threadsOf(id));
  const where = or(
    eq(auditLog.subjectId, id),
    and(eq(auditLog.targetType, "user"), eq(auditLog.targetId, id)),
    and(eq(auditLog.targetType, "dm_thread"), inArray(auditLog.targetId, theirThreads)),
  );
  return auditRows(where, limit, 0);
}

export async function dmActivity(u: User, t: number): Promise<StaffUserPage["dm"]> {
  const started = (since: number) => db.$count(dmThreads, and(eq(dmThreads.requesterId, u.id), gte(dmThreads.createdAt, since)));
  const reported = await first(db.select({ c: count() }).from(reports)
    .innerJoin(dmMessages, eq(dmMessages.id, reports.targetId))
    .where(and(eq(reports.targetType, "dm"), eq(reports.status, "open"), eq(dmMessages.senderId, u.id))));
  return {
    muted: u.dmMuted,
    policy: u.dmPolicy || "requests",
    threads: await db.$count(dmThreads, threadsOf(u.id)),
    startedDay: await started(t - DAY),
    startedWeek: await started(t - 7 * DAY),
    sent: await db.$count(dmMessages, eq(dmMessages.senderId, u.id)),
    sentWeek: await db.$count(dmMessages, and(eq(dmMessages.senderId, u.id), gte(dmMessages.createdAt, t - 7 * DAY))),
    openFlags: await db.$count(dmFlags, and(eq(dmFlags.userId, u.id), isNull(dmFlags.resolvedAt))),
    openReports: reported?.c ?? 0,
  };
}

export const notesOn = (userId: number): Promise<ModNote[]> =>
  db.select({ id: modNotes.id, body: modNotes.body, createdAt: modNotes.createdAt, author: users.username })
    .from(modNotes)
    .leftJoin(users, eq(users.id, modNotes.authorId))
    .where(eq(modNotes.userId, userId))
    .orderBy(desc(modNotes.createdAt), desc(modNotes.id));

export async function addNote(userId: number, authorId: number, body: string): Promise<number> {
  const [row] = await db.insert(modNotes).values({ userId, authorId, body, createdAt: now() }).returning({ id: modNotes.id });
  return row!.id;
}

export const findNote = (id: number) =>
  first(db.select({ id: modNotes.id, userId: modNotes.userId, authorId: modNotes.authorId, body: modNotes.body, username: users.username })
    .from(modNotes)
    .innerJoin(users, eq(users.id, modNotes.userId))
    .where(eq(modNotes.id, id))
    .limit(1));

export async function deleteNote(id: number): Promise<void> {
  await db.delete(modNotes).where(eq(modNotes.id, id));
}

// Also drops any confirmation link still out.
export async function setVerified(id: number, at: number): Promise<void> {
  await db.transaction(async tx => {
    await tx.update(users).set({ emailVerifiedAt: at }).where(eq(users.id, id));
    await tx.delete(emailTokens).where(and(eq(emailTokens.userId, id), eq(emailTokens.kind, "verify")));
  });
}

export async function setSuspended(id: number, suspended: boolean): Promise<void> {
  await db.update(users).set({ suspended }).where(eq(users.id, id));
}

export async function setDmMuted(id: number, dmMuted: boolean): Promise<void> {
  await db.update(users).set({ dmMuted }).where(eq(users.id, id));
}

export async function setBanned(actor: Actor, id: number, banned: boolean, reason: string, entry: AuditEntry): Promise<void> {
  await transact(async tx => {
    if (banned) {
      await tx.update(users).set({ banned: true, bannedAt: now(), banReason: reason }).where(eq(users.id, id));
      await tx.delete(sessions).where(eq(sessions.userId, id));
      await tx.delete(apiSessions).where(eq(apiSessions.userId, id));
      await tx.delete(apiTokens).where(eq(apiTokens.userId, id));
      await tx.delete(nowPlaying).where(eq(nowPlaying.userId, id));
    } else {
      await tx.update(users).set({ banned: false, bannedAt: null, banReason: "" }).where(eq(users.id, id));
    }
    await auditTx(tx, actor, entry);
  });
}

// Returns how many sessions (site and API) were ended.
export async function revokeSessions(id: number): Promise<number> {
  const site = await db.delete(sessions).where(eq(sessions.userId, id)).returning({ token: sessions.token });
  const api = await db.delete(apiSessions).where(eq(apiSessions.userId, id)).returning({ key: apiSessions.key });
  return site.length + api.length;
}

export async function deleteAccount(actor: Actor, t: User, entry: AuditEntry): Promise<void> {
  await transact(async tx => {
    await tx.update(reports)
      .set({ status: "closed", outcome: "account deleted", resolvedBy: actor.id, resolvedAt: now() })
      .where(and(eq(reports.status, "open"), against(sql`${t.id}`, sql`${t.username}`)));
    // other people's comments on their journal posts and shouts on their profile don't cascade
    const theirJournals = tx.select({ id: journals.id }).from(journals).where(eq(journals.userId, t.id));
    await tx.delete(shouts).where(and(eq(shouts.targetType, "journal"), inArray(shouts.targetId, theirJournals)));
    await tx.delete(shouts).where(and(eq(shouts.targetType, "user"), eq(shouts.targetId, t.id)));
    await tx.delete(modNotes).where(eq(modNotes.userId, t.id));
    await handOffGroupsTx(tx, t.id);
    // everything else cascades; the profile picture goes with the next images sweep
    await tx.delete(users).where(eq(users.id, t.id));
    await auditTx(tx, actor, entry);
  });
}
