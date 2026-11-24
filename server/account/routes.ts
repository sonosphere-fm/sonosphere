import { passwordChanged, passwordSet, startEmailChange } from "../auth/email";
import { emailTaken } from "../auth/repo";
import { confirmedBy, endSession, hashPassword, me, MIN_PASSWORD, passwordMatches, validEmail } from "../auth/service";
import { POLICIES } from "../dm/service";
import { confirmed, need, owner, poster } from "../guards";
import { recordChange } from "./history";
import { changeUsername, usernameStatus } from "./usernames";
import type { UsernameStatus } from "../../shared/account";
import { countryName } from "../../shared/countries";
import { isLocale } from "../../shared/i18n/core";
import { profileLinks } from "../../shared/profile-links";
import { isUsernameFont } from "../../shared/username-fonts";
import { profileColors } from "./profile-accent";
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

router.get<UsernameStatus>("/api/me/username", (c) => usernameStatus(need(c).id));

router.post<MeResponse>("/api/me/username", async (c) => {
  const user = confirmed(poster(c));
  await throttle(`username-change:${user.id}`, 20, 3600);
  const updated = await changeUsername(user.id, c.actor ?? user, c.body.username);
  return { user: await me(updated, c.actor?.id === user.id ? updated : c.actor) };
});

router.post<MeResponse>("/api/me/username/undo", async (c) => {
  const user = confirmed(poster(c));
  await throttle(`username-change:${user.id}`, 20, 3600);
  const updated = await changeUsername(user.id, c.actor ?? user, undefined, true);
  return { user: await me(updated, c.actor?.id === user.id ? updated : c.actor) };
});

router.patch<ProfileSaved>("/api/me", async (c) => {
  const u = need(c);
  const b = c.body;
  if (b.useProfileTheme !== undefined && typeof b.useProfileTheme !== "boolean") bad("chooseWhetherUseProfileTheme");
  const usernameFont = b.usernameFont === undefined ? u.usernameFont : b.usernameFont;
  const profileAccent = b.profileAccent === undefined ? u.profileAccent : b.profileAccent;
  const profileAccentEnd = b.profileAccentEnd === undefined ? u.profileAccentEnd : b.profileAccentEnd;
  if (!isUsernameFont(usernameFont)) return bad("chooseUsernameFontFromList");
  const colors = profileColors(profileAccent, profileAccentEnd);
  const links =
    b.links === undefined ? u.profileLinks : JSON.stringify(profileLinks(b.links) ?? bad("invalidProfileLinks"));
  // a new address only takes over once a link sent to it is followed
  if (b.email !== undefined) {
    const email = clean(b.email, 200).toLowerCase();
    if (!validEmail(email)) bad("enterValidEmailAddress");
    if (email !== u.email) {
      owner(c);
      if (await emailTaken(email, u.id)) bad("emailAlreadyUse");
      await limit(`email-change-m:${u.id}`, 1, 30, "waitBeforeAnotherAddress");
      await throttle(`email-change:${u.id}`, 20, 86_400, "tooManyEmailChangesToday");
      await startEmailChange(u, email);
    }
  }
  // what others read on the profile waits for a confirmed address; privacy settings and a new email never do
  const realname = clean(b.realname ?? u.realname, 60);
  const pronouns = clean(b.pronouns ?? u.pronouns, 30);
  const about = String(b.about ?? u.about)
    .trim()
    .slice(0, 2000);
  // a country saved before the list existed stays until it's changed
  const givenCountry = clean(b.country ?? u.country, 60);
  const country =
    givenCountry === u.country || !givenCountry
      ? givenCountry
      : countryName(givenCountry) || bad("pickCountryFromList");
  const publicChanged =
    realname !== u.realname ||
    pronouns !== u.pronouns ||
    about !== u.about ||
    country !== u.country ||
    links !== u.profileLinks ||
    usernameFont !== u.usernameFont ||
    profileAccent !== u.profileAccent ||
    profileAccentEnd !== u.profileAccentEnd;
  if (publicChanged) confirmed(poster(c));

  const dmPolicy = b.dmPolicy === undefined ? undefined : (oneOf(b.dmPolicy, POLICIES) ?? bad("pickWhoMessage"));
  const emailNotify =
    b.emailNotify === undefined
      ? undefined
      : (oneOf(
          b.emailNotify,
          EMAIL_MODES.map((m) => m[0])
        ) ?? bad("pickHowOftenGetEmails"));
  let emailMuted: string | undefined;
  if (Array.isArray(b.emailMuted)) {
    const picked: unknown[] = b.emailMuted;
    emailMuted = EMAIL_KINDS.map((k) => k[0])
      .filter((k) => picked.includes(k))
      .join(",");
  }
  const theme = b.theme === undefined ? undefined : (oneOf(b.theme, ["light", "system", "dark"]) ?? bad("pickTheme"));
  const locale = b.locale === undefined || b.locale === "" || isLocale(b.locale) ? b.locale : bad("pickLanguage");
  await repo.updateProfile(u.id, {
    useProfileTheme: b.useProfileTheme === undefined ? u.useProfileTheme : (b.useProfileTheme as boolean),
    usernameFont,
    ...colors,
    realname,
    pronouns,
    about,
    country,
    profileLinks: links,
    hideRecent: !!(b.hideRecent ?? u.hideRecent),
    privateListening: !!(b.privateListening ?? u.privateListening),
    shoutsEnabled: !!(b.shoutsEnabled ?? u.shoutsEnabled),
    ...(dmPolicy && { dmPolicy }),
    // a digest starts counting from when it was picked, so the first one doesn't cover everything before
    ...(emailNotify && { emailNotify, ...(emailNotify !== u.emailNotify && { digestAt: now() }) }),
    ...(emailMuted !== undefined && { emailMuted }),
    ...(theme && { theme }),
    ...(locale !== undefined && { locale }),
  });
  await recordChange(u.id, "realname", u.realname, realname);
  return { user: await me((await findById(u.id)) ?? missing("userNotFound"), c.actor) };
});

router.post<MeResponse>("/api/me/stop-impersonating", async (c) => {
  const actor = c.actor ?? fail(401, "needLogin");
  const user = await me(actor);
  if (isAdmin(actor) && c.user && actor.id !== c.user.id) {
    await audit(actor, {
      action: "user.impersonate.stop",
      targetType: "user",
      targetId: c.user.id,
      label: c.user.username,
      subjectId: c.user.id,
    });
  }
  c.headers.append("Set-Cookie", clearActAsCookie());
  return { user };
});

router.post<Ok>("/api/me/password", async (c) => {
  const u = owner(c);
  const next = String(c.body.next || "");
  // an account made through another site sets its first password without one
  if (u.passwordHash && !(await passwordMatches(u, String(c.body.current || "")))) bad("currentPasswordIncorrect");
  if (next.length < MIN_PASSWORD) bad("passwordsNeedLeast8Characters");
  await repo.setPasswordHash(u.id, await hashPassword(next), u.passwordHash, tokenOf(c.req));
  await (u.passwordHash ? passwordChanged(u) : passwordSet(u));
  return { ok: true };
});

router.post<Ok>("/api/me/delete", async (c) => {
  const u = need(c);
  if (!(await confirmedBy(u, String(c.body.password || ""))))
    bad(u.passwordHash ? "passwordIncorrect" : "notYourUsername");
  await repo.deleteAccount(u.id);
  // the sessions went with the account; this only clears the cookie
  await endSession(c.headers);
  return { ok: true };
});

router.post<ScrobblesCleared>("/api/me/clear-scrobbles", async (c) => {
  const u = need(c);
  const actor = c.actor && isAdmin(c.actor) && c.actor.id !== u.id ? c.actor : null;
  if (!actor && !(await confirmedBy(u, String(c.body.password || ""))))
    bad(u.passwordHash ? "passwordIncorrect" : "notYourUsername");
  const deleted = await deleteAllScrobbles(
    u.id,
    actor
      ? (tx, deleted) =>
          auditTx(tx, actor, {
            action: "user.clear-scrobbles",
            targetType: "user",
            targetId: u.id,
            label: u.username,
            subjectId: u.id,
            note: "Cleared while acting as this user",
            data: { deleted },
          })
      : undefined
  );
  return { deleted };
});

router.get("/api/me/export", async (c) => {
  const u = need(c);
  await throttle(`export:${u.id}`, 10, 3600, "tooManyDataDownloads");
  const loved = c.q.get("what") === "loved";
  const csv = c.q.get("format") === "csv";
  const rows = loved ? await exportLoved(u.id) : await exportScrobbles(u.id);
  const quoted = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  let body: string;
  if (csv) {
    const lines = rows.map((r) => [r.artist, r.album, r.track, r.timestamp].map(quoted).join(","));
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
