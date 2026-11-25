import { bad, fail, missing, oneOf, Router } from "../http";
import { adminOnly, staff } from "../guards";
import { adminCount, configAdmins, isAdmin, isStaff, roleOf, setRole } from "../site/roles";
import { audit } from "../site/audit";
import { like, norm, now } from "../util";
import { disconnect } from "../realtime";
import { canAct, note, paging } from "./common";
import { requireUser } from "../users/service";
import { pageOf } from "../moderation/repo";
import * as repo from "./users.repo";
import { setProbation, standing } from "../trust/service";
import { me } from "../auth/service";
import { actAsCookie } from "../auth/session";
import { changeUsername, heldUsernames, manageUsernames, usernameStatus } from "../account/usernames";
import type { AdminUsernameStatus } from "../../shared/account";
import type { MeResponse } from "../../shared/auth";
import type {
  BanResult,
  NoteAdded,
  Ok,
  ProbationResult,
  RoleResult,
  SessionsResult,
  StaffUserList,
  StaffUserPage,
  SuspendResult,
  VerifyResult,
} from "../../shared/admin";

export const router = new Router({ jsonOnly: true });

router.get<AdminUsernameStatus>("/api/admin/users/:name/username", async (c) => {
  adminOnly(c);
  const target = await requireUser(c.params[0]!);
  return { ...(await usernameStatus(target.id)), held: await heldUsernames(target.id) };
});

router.post<{ username: string }>("/api/admin/users/:name/username", async (c) => {
  const actor = adminOnly(c);
  const target = await requireUser(c.params[0]!);
  const updated = await changeUsername(target.id, actor, c.body.username, false, true, note(c));
  return { username: updated.username };
});

router.post<Ok>("/api/admin/users/:name/username/release", async (c) => {
  const actor = adminOnly(c);
  const target = await requireUser(c.params[0]!);
  await manageUsernames(target.id, actor, "release", note(c));
  return { ok: true };
});

router.post<Ok>("/api/admin/users/:name/username/cooldown", async (c) => {
  const actor = adminOnly(c);
  const target = await requireUser(c.params[0]!);
  await manageUsernames(target.id, actor, "cooldown", note(c));
  return { ok: true };
});

const placeholder = (u: { email: string }) => u.email.endsWith(".invalid");
const unconfirmed = (u: { email: string; emailVerifiedAt: number | null }) => !u.emailVerifiedAt && !placeholder(u);

const FILTERS = [
  "all",
  "staff",
  "admins",
  "moderators",
  "suspended",
  "banned",
  "reported",
  "unconfirmed",
  "probation",
] as const;
const SORTS = ["username", "registered", "scrobbles", "reports", "login"] as const;
const ROLES = ["user", "moderator", "admin"] as const;

const userAction = (
  action: string,
  t: { id: number; username: string },
  note: string,
  data?: Record<string, unknown>
) => ({
  action,
  targetType: "user",
  targetId: t.id,
  label: t.username,
  subjectId: t.id,
  note,
  ...(data ? { data } : {}),
});

router.post<MeResponse>("/api/admin/users/:name/impersonate", async (c) => {
  const actor = adminOnly(c);
  const target = await requireUser(c.params[0]!);
  await canAct(actor, target, "impersonate");
  if (target.banned) bad("cantActBannedAccount");
  const user = await me(target, actor);
  await audit(actor, userAction("user.impersonate", target, note(c)));
  c.headers.append("Set-Cookie", actAsCookie(target.id));
  return { user };
});

router.get<StaffUserList>("/api/admin/users", async (c) => {
  const me = staff(c);
  const pg = paging(c.q);
  const term = (c.q.get("q") || "").trim();
  const admin = isAdmin(me);
  const { rows, total } = await repo.listUsers({
    filter: oneOf(c.q.get("filter"), FILTERS) ?? "all",
    sort: oneOf(c.q.get("sort"), SORTS) ?? "registered",
    ascending: c.q.get("dir") === "asc",
    pattern: term ? like(norm(term)) : null,
    searchEmail: admin,
    limit: pg.limit,
    offset: pg.offset,
  });
  const items = rows.map((u) => ({
    ...userAppearance(u),
    id: u.id,
    username: u.username,
    realname: u.realname,
    image: u.imageId,
    email: admin ? u.email : undefined,
    registeredAt: u.registeredAt,
    role: roleOf(u),
    suspended: u.suspended,
    banned: u.banned,
    unconfirmed: unconfirmed(u),
    probation: u.probation,
    scrobbles: u.scrobbles,
    openReports: u.openReports,
    lastLogin: u.lastLogin,
  }));
  return { items, total, ...pg };
});

router.get<StaffUserPage>("/api/admin/users/:name", async (c) => {
  const me = staff(c);
  const u = await requireUser(c.params[0]!);
  const id = u.id;
  const shouts = await repo.recentShouts(id, 5);
  const recentShouts = await Promise.all(
    shouts.map(async (s) => ({
      id: s.id,
      body: s.body,
      createdAt: s.createdAt,
      where: await pageOf(s.targetType, s.targetId),
    }))
  );
  return {
    user: {
      ...userAppearance(u),
      id,
      username: u.username,
      realname: u.realname,
      email: isAdmin(me) ? u.email : undefined,
      country: u.country,
      about: u.about,
      image: u.imageId,
      registeredAt: u.registeredAt,
      role: roleOf(u),
      suspended: u.suspended,
      banned: u.banned,
      bannedAt: u.bannedAt,
      banReason: u.banReason,
      hideRecent: u.hideRecent,
      emailVerifiedAt: u.emailVerifiedAt,
      placeholder: placeholder(u),
      unconfirmed: unconfirmed(u),
      configAdmin: (await configAdmins()).includes(u.usernameNorm),
      self: id === me.id,
    },
    counts: await repo.userCounts(id),
    lastLogin: await repo.lastLoginOf(id),
    lastScrobble: await repo.lastScrobbleOf(id),
    reportsAgainst: await repo.reportsAgainst(u),
    reportsBy: await repo.reportsBy(id),
    recentShouts,
    history: await repo.userHistory(id, 50),
    dm: await repo.dmActivity(u, now()),
    trust: await standing(u),
    notes: await repo.notesOn(id),
  };
});

router.post<SuspendResult>("/api/admin/users/:name/suspend", async (c) => {
  const me = staff(c);
  const t = await requireUser(c.params[0]!);
  const suspended = c.body.suspended !== false;
  if (suspended) await canAct(me, t, "suspend");
  else if (t.id === me.id) bad("cantChangeOwnSuspension");
  await repo.setSuspended(t.id, suspended);
  await audit(me, userAction(suspended ? "user.suspend" : "user.unsuspend", t, note(c)));
  return { suspended };
});

router.post<BanResult>("/api/admin/users/:name/ban", async (c) => {
  const me = adminOnly(c);
  const t = await requireUser(c.params[0]!);
  const banned = c.body.banned !== false;
  if (banned) await canAct(me, t, "ban");
  else if (t.id === me.id) bad("cantChangeOwnBan");
  await repo.setBanned(me, t.id, banned, note(c), userAction(banned ? "user.ban" : "user.unban", t, note(c)));
  // live sockets close now, not at the next session sweep
  if (banned) disconnect(t.id);
  return { banned };
});

router.post<ProbationResult>("/api/admin/users/:name/probation", async (c) => {
  const me = staff(c);
  const t = await requireUser(c.params[0]!);
  const probation = c.body.probation !== false;
  if (isStaff(t)) bad("staffNeverProbation");
  await setProbation(t, probation, me);
  await audit(me, userAction(probation ? "user.probation" : "user.release", t, note(c)));
  return { probation };
});

router.post<RoleResult>("/api/admin/users/:name/role", async (c) => {
  const me = adminOnly(c);
  const t = await requireUser(c.params[0]!);
  const role = oneOf(String(c.body.role), ROLES) ?? bad("unknownRole");
  await canAct(me, t, "role");
  if (t.banned) bad("liftBanBeforeGivingAccount");
  const was = roleOf(t);
  if (was === role) return { role };
  if (was === "admin" && (await adminCount()) <= 1) bad("thatsLastAdminPromoteSomeone");
  await setRole(t.id, role);
  await audit(me, userAction("user.role", t, note(c), { from: was, to: role }));
  return { role };
});

router.post<VerifyResult>("/api/admin/users/:name/verify", async (c) => {
  const me = adminOnly(c);
  const t = await requireUser(c.params[0]!);
  if (t.emailVerifiedAt) return { verifiedAt: t.emailVerifiedAt };
  if (placeholder(t)) bad("placeholderAddressCantConfirm");
  const at = now();
  await repo.setVerified(t.id, at);
  await audit(me, userAction("user.verify", t, note(c)));
  return { verifiedAt: at };
});

router.post<SessionsResult>("/api/admin/users/:name/sessions", async (c) => {
  const me = adminOnly(c);
  const t = await requireUser(c.params[0]!);
  await canAct(me, t, "sessions");
  const revoked = await repo.revokeSessions(t.id);
  await audit(me, userAction("user.sessions", t, note(c), { revoked }));
  disconnect(t.id);
  return { revoked };
});

router.post<Ok>("/api/admin/users/:name/delete", async (c) => {
  const me = adminOnly(c);
  const t = await requireUser(c.params[0]!);
  await canAct(me, t, "delete");
  if (String(c.body.confirm ?? "") !== t.username) bad("typeUsernameToConfirm", { username: t.username });
  const stats = await repo.contentCounts(t.id);
  await repo.deleteAccount(me, t, userAction("user.delete", t, note(c), stats));
  disconnect(t.id);
  return { ok: true };
});

router.post<NoteAdded>("/api/admin/users/:name/notes", async (c) => {
  const me = staff(c);
  const t = await requireUser(c.params[0]!);
  const body = String(c.body.body ?? "")
    .trim()
    .slice(0, 2000);
  if (!body) bad("writeNoteFirst");
  const id = await repo.addNote(t.id, me.id, body);
  await audit(me, userAction("note.add", t, body.slice(0, 200)));
  return { id };
});

router.delete<Ok>("/api/admin/notes/:id", async (c) => {
  const me = staff(c);
  const n = (await repo.findNote(Number(c.params[0]))) ?? missing("noteNotFound");
  if (n.authorId !== me.id && !isAdmin(me)) fail(403, "onlyNotesAuthorAdminDelete");
  await repo.deleteNote(n.id);
  await audit(me, userAction("note.delete", { id: n.userId, username: n.username }, n.body.slice(0, 200)));
  return { ok: true };
});
import { userAppearance } from "../users/appearance";
