import { bad, ipOf, limit, Router, throttle, tokenOf } from "../http";
import { requestLocale } from "../i18n";
import { need } from "../guards";
import { disconnect } from "../realtime";
import { clean, norm } from "../util";
import { findByLogin } from "./repo";
import { confirmEmail, requestReset, resetPassword, sendVerification } from "./email";
import {
  endSession,
  hashPassword,
  logIn,
  loginKey,
  me,
  MIN_PASSWORD,
  signUp,
  startSession,
  validEmail,
} from "./service";
import { checkTurnstile, turnstileSiteKey } from "./turnstile";
import { oauthProviders } from "./oauth/routes";
import { finishLogin } from "./totp";
import type { LoginResult } from "../../shared/totp";
import { safeNext } from "../../shared/auth";
import type { AuthConfig, MeResponse, Ok, Session } from "../../shared/auth";

export const router = new Router();

// Last.fm clients send people to /api/auth to approve a token.
const toConsent = (c: { url: URL }) => Response.redirect(`/connect${c.url.search}`, 302);
router.get("/api/auth", toConsent);
router.get("/api/auth/", toConsent);

router.get<MeResponse>("/api/me", async (c) => ({ user: c.user ? await me(c.user, c.actor) : null }));

router.get<AuthConfig>("/api/auth/config", () => ({ turnstile: turnstileSiteKey(), oauth: oauthProviders() }));

router.post<Session>("/api/auth/signup", async (c) => {
  await limit(`signup:${ipOf(c.req)}`, 5, 3600, "tooManySignups");
  await throttle(`signup-d:${ipOf(c.req)}`, 15, 86_400, "tooManySignupsToday");
  await checkTurnstile(c.body.turnstile, ipOf(c.req), "signup");
  const username = clean(c.body.username, 15);
  const email = clean(c.body.email, 200).toLowerCase();
  const u = await signUp(username, email, String(c.body.password || ""), requestLocale(c.req), ipOf(c.req));
  await sendVerification(u, requestLocale(c.req));
  await startSession(c.headers, u.id);
  return { user: await me(u) };
});

router.post<LoginResult>("/api/auth/login", async (c) => {
  await limit(`login:${ipOf(c.req)}`, 10, 300);
  const ident = String(c.body.username || "");
  const account = await findByLogin(norm(ident));
  await limit(loginKey(ipOf(c.req), ident, account), 30, 3600);
  await checkTurnstile(c.body.turnstile, ipOf(c.req), "login");
  const u = await logIn(ident, String(c.body.password || ""), ipOf(c.req));
  return finishLogin(c, u, safeNext(c.body.next));
});

router.post<Ok>("/api/auth/forgot", async (c) => {
  const email = clean(c.body.email, 200).toLowerCase();
  if (!validEmail(email)) bad("enterValidEmailAddress");
  await limit(`forgot-m:${ipOf(c.req)}`, 3, 30, "waitBeforeAskingAgain");
  await limit(`forgot:${ipOf(c.req)}`, 20, 3600, "tooManyResetRequestsFrom");
  await checkTurnstile(c.body.turnstile, ipOf(c.req), "forgot");
  // per-address limits fail silently, so nobody can flood an inbox or learn whether the address has an account
  const perAddress = Promise.all([
    limit(`forgot-to-m:${email}`, 1, 30),
    limit(`forgot-to:${email}`, 10, 3600),
    throttle(`forgot-to-d:${email}`, 30, 86_400),
  ]);
  await perAddress.then(
    () => requestReset(email),
    () => {}
  );
  return { ok: true };
});

router.post<LoginResult>("/api/auth/reset", async (c) => {
  await limit(`reset:${ipOf(c.req)}`, 10, 3600);
  const password = String(c.body.password || "");
  if (password.length < MIN_PASSWORD) bad("passwordsNeedLeast8Characters");
  const u = await resetPassword(c.body.token, await hashPassword(password));
  return finishLogin(c, u);
});

router.post<Ok & { approvalPending: boolean }>("/api/auth/verify", async (c) => {
  await limit(`verify:${ipOf(c.req)}`, 20, 3600);
  const { approvalPending } = await confirmEmail(c.body.token);
  return { ok: true, approvalPending };
});

router.post<Ok>("/api/me/verify", async (c) => {
  const u = need(c);
  if (u.emailVerifiedAt) bad("emailAlreadyConfirmed");
  await limit(`verify-send-m:${u.id}`, 1, 30, "verificationJustSent");
  await limit(`verify-send:${u.id}`, 10, 3600, "tooManyLinksSent");
  await throttle(`verify-send-d:${u.id}`, 30, 86_400, "tooManyLinksSentToday");
  await limit(`verify-send-ip:${ipOf(c.req)}`, 30, 3600, "tooManyRequestsFromHere");
  await sendVerification(u, requestLocale(c.req));
  return { ok: true };
});

router.post<Ok>("/api/auth/logout", async (c) => {
  await endSession(c.headers, tokenOf(c.req));
  // other tabs reconnect if still signed in
  if (c.user) disconnect(c.user.id);
  return { ok: true };
});
