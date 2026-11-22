import { passwordChanged, passwordSet, startEmailChange } from "../auth/email";
import { deleteSessionsOf, emailTaken } from "../auth/repo";
import { confirmedBy, endSession, hashPassword, me, MIN_PASSWORD, passwordMatches, validEmail } from "../auth/service";
import { POLICIES } from "../dm/service";
import { confirmed, need } from "../guards";
import { bad, fail, limit, missing, oneOf, Router, throttle, tokenOf } from "../http";
import { clearActAsCookie } from "../auth/session";
import { isAdmin } from "../site/roles";
import { audit, auditTx } from "../site/audit";
import { deleteAllScrobbles, exportLoved, exportScrobbles } from "../listening/repo";
import { findById } from "../users/repo";
import { EMAIL_KINDS, EMAIL_MODES } from "../../shared/notifications";
import { clean, now } from "../util";
import * as repo from "./repo";
import type { ProfileSaved, ScrobblesCleared } from "../../shared/account";
import type { MeResponse, Ok } from "../../shared/auth";

export const router = new Router();

router.patch<ProfileSaved>("/api/me", async c => {
  const u = need(c);
  const b = c.body;
  const website = clean(b.website ?? u.website, 200);
  if (website && !/^https?:\/\//i.test(website)) bad("Website must start with http:// or https://");
  // a new address only takes over once a link sent to it is followed
  if (b.email !== undefined) {
    const email = clean(b.email, 200).toLowerCase();
    if (!validEmail(email)) bad("Enter a valid email address");
    if (email !== u.email) {
      if (await emailTaken(email, u.id)) bad("That email is already in use");
      await limit(`email-change-m:${u.id}`, 1, 30, "Wait 30 seconds before trying another address.");
      await throttle(`email-change:${u.id}`, 20, 86_400, "Too many email changes today. Try again tomorrow.");
      await startEmailChange(u, email);
    }
  }
  // what others read on the profile waits for a confirmed address; privacy settings and a new email never do
  const realname = clean(b.realname ?? u.realname, 60);
  const pronouns = clean(b.pronouns ?? u.pronouns, 30);
  const about = String(b.about ?? u.about).trim().slice(0, 2000);
  const country = clean(b.country ?? u.country, 60);
  const publicChanged = realname !== u.realname || pronouns !== u.pronouns || about !== u.about
    || country !== u.country || website !== u.website;
  if (publicChanged) confirmed(u);

  const dmPolicy = b.dmPolicy === undefined
    ? undefined
    : oneOf(b.dmPolicy, POLICIES) ?? bad("Pick who can message you");
  const emailNotify = b.emailNotify === undefined
    ? undefined
    : oneOf(b.emailNotify, EMAIL_MODES.map(m => m[0])) ?? bad("Pick how often to get emails");
  let emailMuted: string | undefined;
  if (Array.isArray(b.emailMuted)) {
    const picked: unknown[] = b.emailMuted;
    emailMuted = EMAIL_KINDS.map(k => k[0]).filter(k => picked.includes(k)).join(",");
  }
  const theme = b.theme === undefined
    ? undefined
    : oneOf(b.theme, ["light", "system", "dark"]) ?? bad("Pick a theme");
  await repo.updateProfile(u.id, {
    realname,
    pronouns,
    about,
    country,
    website,
    hideRecent: !!(b.hideRecent ?? u.hideRecent),
    privateListening: !!(b.privateListening ?? u.privateListening),
    shoutsEnabled: !!(b.shoutsEnabled ?? u.shoutsEnabled),
    ...(dmPolicy && { dmPolicy }),
    // a digest starts counting from when it was picked, so the first one doesn't cover everything before
    ...(emailNotify && { emailNotify, ...(emailNotify !== u.emailNotify && { digestAt: now() }) }),
    ...(emailMuted !== undefined && { emailMuted }),
    ...(theme && { theme }),
  });
  return { user: await me((await findById(u.id)) ?? missing("User"), c.actor) };
});

router.post<MeResponse>("/api/me/stop-impersonating", async c => {
  const actor = c.actor ?? fail(401, "You need to log in to do that");
  const user = await me(actor);
  if (isAdmin(actor) && c.user && actor.id !== c.user.id) {
    await audit(actor, {
      action: "user.impersonate.stop", targetType: "user", targetId: c.user.id,
      label: c.user.username, subjectId: c.user.id,
    });
  }
  c.headers.append("Set-Cookie", clearActAsCookie());
  return { user };
});

router.post<Ok>("/api/me/password", async c => {
  const u = need(c);
  const next = String(c.body.next || "");
  // an account made through another site sets its first password without one
  if (u.passwordHash && !(await passwordMatches(u, String(c.body.current || "")))) bad("Current password is incorrect");
  if (next.length < MIN_PASSWORD) bad("Passwords need at least 8 characters");
  await repo.setPasswordHash(u.id, await hashPassword(next));
  await deleteSessionsOf(u.id, tokenOf(c.req));
  await (u.passwordHash ? passwordChanged(u) : passwordSet(u));
  return { ok: true };
});

router.post<Ok>("/api/me/delete", async c => {
  const u = need(c);
  if (!(await confirmedBy(u, String(c.body.password || "")))) bad(u.passwordHash ? "Password is incorrect" : "That isn't your username");
  await repo.deleteAccount(u.id);
  // the sessions went with the account; this only clears the cookie
  await endSession(c.headers);
  return { ok: true };
});

router.post<ScrobblesCleared>("/api/me/clear-scrobbles", async c => {
  const u = need(c);
  const actor = c.actor && isAdmin(c.actor) && c.actor.id !== u.id ? c.actor : null;
  if (!actor && !(await confirmedBy(u, String(c.body.password || "")))) bad(u.passwordHash ? "Password is incorrect" : "That isn't your username");
  const deleted = await deleteAllScrobbles(u.id, actor ? (tx, deleted) => auditTx(tx, actor, {
    action: "user.clear-scrobbles", targetType: "user", targetId: u.id, label: u.username, subjectId: u.id,
    note: "Cleared while acting as this user", data: { deleted },
  }) : undefined);
  return { deleted };
});

router.get("/api/me/export", async c => {
  const u = need(c);
  await throttle(`export:${u.id}`, 10, 3600, "You have downloaded your data a few times already. Try again in an hour.");
  const loved = c.q.get("what") === "loved";
  const csv = c.q.get("format") === "csv";
  const rows = loved ? await exportLoved(u.id) : await exportScrobbles(u.id);
  const quoted = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  let body: string;
  if (csv) {
    const lines = rows.map(r => [r.artist, r.album, r.track, r.timestamp].map(quoted).join(","));
    body = "artist,album,track,timestamp\n" + lines.join("\n");
  } else {
    body = JSON.stringify(rows, null, 1);
  }
  const filename = `${u.username}-${loved ? "loved" : "scrobbles"}.${csv ? "csv" : "json"}`;
  return new Response(body, {
    headers: {
      "Content-Type": csv ? "text/csv; charset=utf-8" : "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});
