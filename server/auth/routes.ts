// HTTP routes for signing up, logging in and out, and asking who is signed in.
import { bad, ipOf, limit, Router, tokenOf } from "../http";
import { need } from "../guards";
import { disconnect } from "../realtime";
import { clean } from "../util";
import { confirmEmail, requestReset, resetPassword, sendVerification } from "./email";
import { endSession, hashPassword, logIn, me, MIN_PASSWORD, signUp, startSession, validEmail } from "./service";
import { checkTurnstile, turnstileSiteKey } from "./turnstile";
import type { AuthConfig, MeResponse, Ok, Session } from "../../shared/auth";

export const router = new Router();

// Last.fm clients send people to /api/auth to approve a token; hand that to the consent page of the app.
const toConsent = (c: { url: URL }) => Response.redirect(`/connect${c.url.search}`, 302);
router.get("/api/auth", toConsent);
router.get("/api/auth/", toConsent);

router.get<MeResponse>("/api/me", async c => ({ user: c.user ? await me(c.user) : null }));

router.get<AuthConfig>("/api/auth/config", () => ({ turnstile: turnstileSiteKey() }));

router.post<Session>("/api/auth/signup", async c => {
  await limit(`signup:${ipOf(c.req)}`, 5, 3600, "Too many sign-ups from here. Try again later.");
  await checkTurnstile(c.body.turnstile, ipOf(c.req), "signup");
  const u = await signUp(clean(c.body.username, 15), clean(c.body.email, 200).toLowerCase(), String(c.body.password || ""));
  await sendVerification(u);
  await startSession(c.headers, u.id);
  return { user: await me(u) };
});

router.post<Session>("/api/auth/login", async c => {
  await limit(`login:${ipOf(c.req)}`, 10, 300);
  await limit(`login-as:${String(c.body.username || "").trim().toLowerCase()}`, 30, 3600);
  await checkTurnstile(c.body.turnstile, ipOf(c.req), "login");
  const u = await logIn(String(c.body.username || ""), String(c.body.password || ""));
  await startSession(c.headers, u.id);
  return { user: await me(u) };
});

// ---------- by email ----------
router.post<Ok>("/api/auth/forgot", async c => {
  const email = clean(c.body.email, 200).toLowerCase();
  if (!validEmail(email)) bad("Enter a valid email address");
  await limit(`forgot:${ipOf(c.req)}`, 5, 3600, "Too many reset requests from here. Try again later.");
  await checkTurnstile(c.body.turnstile, ipOf(c.req), "forgot");
  // the same answer whether or not an account uses the address; a second request for one address within the hour is dropped quietly
  await limit(`forgot-to:${email}`, 2, 3600).then(() => requestReset(email), () => {});
  return { ok: true };
});

router.post<Session>("/api/auth/reset", async c => {
  await limit(`reset:${ipOf(c.req)}`, 10, 3600);
  const password = String(c.body.password || "");
  if (password.length < MIN_PASSWORD) bad("Passwords need at least 8 characters");
  const u = await resetPassword(c.body.token, await hashPassword(password));
  await startSession(c.headers, u.id);
  return { user: await me(u) };
});

router.post<Ok>("/api/auth/verify", async c => {
  await limit(`verify:${ipOf(c.req)}`, 20, 3600);
  await confirmEmail(c.body.token);
  return { ok: true };
});

router.post<Ok>("/api/me/verify", async c => {
  const u = need(c);
  if (u.emailVerifiedAt) bad("Your email is already confirmed");
  await limit(`verify-send:${u.id}`, 3, 3600, "We already sent a few links. Check your spam folder, or try again in an hour.");
  await sendVerification(u);
  return { ok: true };
});

router.post<Ok>("/api/auth/logout", async c => {
  await endSession(c.headers, tokenOf(c.req));
  if (c.user) disconnect(c.user.id); // live sockets end with the session; other tabs reconnect if still signed in
  return { ok: true };
});
