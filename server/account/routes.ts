// HTTP routes for account settings: editing the profile, changing the password, exporting or clearing plays, and deleting the account.
import { passwordChanged, passwordSet, startEmailChange } from "../auth/email";
import { deleteSessionsOf, emailTaken } from "../auth/repo";
import { confirmedBy, endSession, hashPassword, me, MIN_PASSWORD, passwordMatches, validEmail } from "../auth/service";
import { POLICIES } from "../dm/service";
import { confirmed, need } from "../guards";
import { bad, limit, missing, oneOf, Router, throttle, tokenOf } from "../http";
import { deleteAllScrobbles, exportLoved, exportScrobbles } from "../listening/repo";
import { findById } from "../users/repo";
import { EMAIL_KINDS, EMAIL_MODES } from "../../shared/notifications";
import { clean, now } from "../util";
import * as repo from "./repo";
import type { ProfileSaved, ScrobblesCleared } from "../../shared/account";
import type { Ok } from "../../shared/auth";

export const router = new Router();

router.patch<ProfileSaved>("/api/me", async c => {
  const u = need(c), b = c.body;
  const website = clean(b.website ?? u.website, 200);
  if (website && !/^https?:\/\//i.test(website)) bad("Website must start with http:// or https://");
  // a new address only takes over once a link sent to it is followed (server/auth/email.ts)
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
  const realname = clean(b.realname ?? u.realname, 60), about = String(b.about ?? u.about).trim().slice(0, 2000), country = clean(b.country ?? u.country, 60);
  if (realname !== u.realname || about !== u.about || country !== u.country || website !== u.website) confirmed(u);
  const dmPolicy = b.dmPolicy === undefined ? undefined : oneOf(b.dmPolicy, POLICIES) ?? bad("Pick who can message you");
  const emailNotify = b.emailNotify === undefined ? undefined : oneOf(b.emailNotify, EMAIL_MODES.map(m => m[0])) ?? bad("Pick how often to get emails");
  const emailMuted = Array.isArray(b.emailMuted) ? EMAIL_KINDS.map(k => k[0]).filter(k => (b.emailMuted as unknown[]).includes(k)).join(",") : undefined;
  const theme = b.theme === undefined ? undefined : oneOf(b.theme, ["light", "system", "dark"]) ?? bad("Pick a theme");
  await repo.updateProfile(u.id, {
    realname, about, country,
    website, hideRecent: !!(b.hideRecent ?? u.hideRecent), privateListening: !!(b.privateListening ?? u.privateListening), shoutsEnabled: !!(b.shoutsEnabled ?? u.shoutsEnabled),
    ...(dmPolicy && { dmPolicy }),
    // a digest starts counting from when it was picked, so the first one doesn't cover everything before
    ...(emailNotify && { emailNotify, ...(emailNotify !== u.emailNotify && { digestAt: now() }) }),
    ...(emailMuted !== undefined && { emailMuted }),
    ...(theme && { theme }),
  });
  return { user: await me((await findById(u.id)) ?? missing("User")) };
});

router.post<Ok>("/api/me/password", async c => {
  const u = need(c), next = String(c.body.next || "");
  // an account made through another site sets its first password without one
  if (u.passwordHash && !(await passwordMatches(u, String(c.body.current || "")))) bad("Current password is incorrect");
  if (next.length < MIN_PASSWORD) bad("Passwords need at least 8 characters");
  await repo.setPasswordHash(u.id, await hashPassword(next));
  await deleteSessionsOf(u.id, tokenOf(c.req)); // anyone else signed in with the old password is signed out
  await (u.passwordHash ? passwordChanged(u) : passwordSet(u));
  return { ok: true };
});

router.post<Ok>("/api/me/delete", async c => {
  const u = need(c);
  if (!(await confirmedBy(u, String(c.body.password || "")))) bad(u.passwordHash ? "Password is incorrect" : "That isn't your username");
  await repo.deleteAccount(u.id);
  await endSession(c.headers); // the sessions went with the account; this clears the cookie
  return { ok: true };
});

router.post<ScrobblesCleared>("/api/me/clear-scrobbles", async c => {
  const u = need(c);
  if (!(await confirmedBy(u, String(c.body.password || "")))) bad(u.passwordHash ? "Password is incorrect" : "That isn't your username");
  return { deleted: await deleteAllScrobbles(u.id) };
});

/** A download of every play (or every loved track with ?what=loved), as JSON or with ?format=csv. */
router.get("/api/me/export", async c => {
  const u = need(c);
  await throttle(`export:${u.id}`, 10, 3600, "You have downloaded your data a few times already. Try again in an hour.");
  const loved = c.q.get("what") === "loved", csv = c.q.get("format") === "csv";
  const rows = loved ? await exportLoved(u.id) : await exportScrobbles(u.id);
  const quoted = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const body = csv ? "artist,album,track,timestamp\n" + rows.map(r => [r.artist, r.album, r.track, r.timestamp].map(quoted).join(",")).join("\n")
    : JSON.stringify(rows, null, 1);
  return new Response(body, { headers: {
    "Content-Type": csv ? "text/csv; charset=utf-8" : "application/json",
    "Content-Disposition": `attachment; filename="${u.username}-${loved ? "loved" : "scrobbles"}.${csv ? "csv" : "json"}"`,
  } });
});
