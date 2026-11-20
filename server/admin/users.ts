// Staff API: accounts. The account list and one account's page are open to all staff, as are posting suspensions
// and staff notes; bans, roles, signing an account out and deleting it are for admins. Every change is audited.
import { bad, fail, missing, oneOf, Router } from "../http";
import { adminOnly, staff } from "../guards";
import { adminCount, configAdmins, isAdmin, roleOf, setRole } from "../site/roles";
import { audit } from "../site/audit";
import { like, norm, now } from "../util";
import { disconnect } from "../realtime";
import { canAct, note, paging, targetUser } from "./common";
import { pageOf } from "../moderation/repo";
import * as repo from "./users.repo";
import type { BanResult, NoteAdded, Ok, RoleResult, SessionsResult, StaffUserList, StaffUserPage, SuspendResult } from "../../shared/admin";

export const router = new Router({ jsonOnly: true });

const FILTERS = ["all", "staff", "admins", "moderators", "suspended", "banned", "reported"] as const;
const SORTS = ["username", "registered", "scrobbles", "reports", "login"] as const;
const ROLES = ["user", "moderator", "admin"] as const;

router.get<StaffUserList>("/api/admin/users", async c => {
  const me = staff(c), pg = paging(c.q), term = (c.q.get("q") || "").trim(), admin = isAdmin(me);
  const { rows, total } = await repo.listUsers({
    filter: oneOf(c.q.get("filter"), FILTERS) ?? "all", sort: oneOf(c.q.get("sort"), SORTS) ?? "registered", ascending: c.q.get("dir") === "asc",
    pattern: term ? like(norm(term)) : null, searchEmail: admin, limit: pg.limit, offset: pg.offset,
  });
  return {
    items: rows.map(u => ({
      id: u.id, username: u.username, realname: u.realname, image: u.imageId, email: admin ? u.email : undefined, registeredAt: u.registeredAt, role: roleOf(u),
      suspended: u.suspended, banned: u.banned, scrobbles: u.scrobbles, openReports: u.openReports, lastLogin: u.lastLogin,
    })),
    total, ...pg,
  };
});

router.get<StaffUserPage>("/api/admin/users/:name", async c => {
  const me = staff(c), u = await targetUser(c.params[0]!), id = u.id;
  const shouts = await repo.recentShouts(id, 5);
  return {
    user: {
      id, username: u.username, realname: u.realname, email: isAdmin(me) ? u.email : undefined, country: u.country, website: u.website, about: u.about, image: u.imageId,
      registeredAt: u.registeredAt, role: roleOf(u), suspended: u.suspended, banned: u.banned, bannedAt: u.bannedAt, banReason: u.banReason,
      hideRecent: u.hideRecent, configAdmin: (await configAdmins()).includes(u.usernameNorm), self: id === me.id,
    },
    counts: await repo.userCounts(id),
    lastLogin: await repo.lastLoginOf(id),
    lastScrobble: await repo.lastScrobbleOf(id),
    reportsAgainst: await repo.reportsAgainst(u),
    reportsBy: await repo.reportsBy(id),
    recentShouts: await Promise.all(shouts.map(async s => ({ id: s.id, body: s.body, createdAt: s.createdAt, where: await pageOf(s.targetType, s.targetId) }))),
    history: await repo.userHistory(id, 50),
    dm: await repo.dmActivity(u, now()),
    notes: await repo.notesOn(id),
  };
});

router.post<SuspendResult>("/api/admin/users/:name/suspend", async c => {
  const me = staff(c), t = await targetUser(c.params[0]!), suspended = c.body.suspended !== false;
  if (suspended) await canAct(me, t, "suspend"); else if (t.id === me.id) bad("You can't change your own suspension");
  await repo.setSuspended(t.id, suspended);
  await audit(me, { action: suspended ? "user.suspend" : "user.unsuspend", targetType: "user", targetId: t.id, label: t.username, subjectId: t.id, note: note(c) });
  return { suspended };
});

router.post<BanResult>("/api/admin/users/:name/ban", async c => {
  const me = adminOnly(c), t = await targetUser(c.params[0]!), banned = c.body.banned !== false;
  if (banned) await canAct(me, t, "ban"); else if (t.id === me.id) bad("You can't change your own ban");
  await repo.setBanned(me, t.id, banned, note(c), { action: banned ? "user.ban" : "user.unban", targetType: "user", targetId: t.id, label: t.username, subjectId: t.id, note: note(c) });
  if (banned) disconnect(t.id); // live sockets close now, not at the next session sweep
  return { banned };
});

router.post<RoleResult>("/api/admin/users/:name/role", async c => {
  const me = adminOnly(c), t = await targetUser(c.params[0]!), role = oneOf(String(c.body.role), ROLES) ?? bad("Unknown role");
  await canAct(me, t, "role");
  if (t.banned) bad("Lift the ban before giving this account a role");
  const was = roleOf(t);
  if (was === role) return { role };
  if (was === "admin" && (await adminCount()) <= 1) bad("That's the last admin; promote someone else first");
  await setRole(t.id, role);
  await audit(me, { action: "user.role", targetType: "user", targetId: t.id, label: t.username, subjectId: t.id, note: note(c), data: { from: was, to: role } });
  return { role };
});

router.post<SessionsResult>("/api/admin/users/:name/sessions", async c => {
  const me = adminOnly(c), t = await targetUser(c.params[0]!);
  await canAct(me, t, "sessions");
  const revoked = await repo.revokeSessions(t.id);
  await audit(me, { action: "user.sessions", targetType: "user", targetId: t.id, label: t.username, subjectId: t.id, note: note(c), data: { revoked } });
  disconnect(t.id);
  return { revoked };
});

router.post<Ok>("/api/admin/users/:name/delete", async c => {
  const me = adminOnly(c), t = await targetUser(c.params[0]!);
  await canAct(me, t, "delete");
  if (String(c.body.confirm ?? "") !== t.username) bad(`Type ${t.username} exactly to confirm`);
  const stats = await repo.contentCounts(t.id);
  await repo.deleteAccount(me, t, { action: "user.delete", targetType: "user", targetId: t.id, label: t.username, subjectId: t.id, note: note(c), data: stats });
  disconnect(t.id);
  return { ok: true };
});

router.post<NoteAdded>("/api/admin/users/:name/notes", async c => {
  const me = staff(c), t = await targetUser(c.params[0]!), body = String(c.body.body ?? "").trim().slice(0, 2000);
  if (!body) bad("Write a note first");
  const id = await repo.addNote(t.id, me.id, body);
  await audit(me, { action: "note.add", targetType: "user", targetId: t.id, label: t.username, subjectId: t.id, note: body.slice(0, 200) });
  return { id };
});

router.delete<Ok>("/api/admin/notes/:id", async c => {
  const me = staff(c), n = (await repo.findNote(Number(c.params[0]))) ?? missing("Note");
  if (n.authorId !== me.id && !isAdmin(me)) fail(403, "Only the note's author or an admin can delete it");
  await repo.deleteNote(n.id);
  await audit(me, { action: "note.delete", targetType: "user", targetId: n.userId, label: n.username, subjectId: n.userId, note: n.body.slice(0, 200) });
  return { ok: true };
});
