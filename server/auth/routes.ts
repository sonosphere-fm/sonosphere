// HTTP routes for signing up, logging in and out, and asking who is signed in.
import { ipOf, limit, Router, tokenOf } from "../http";
import { disconnect } from "../realtime";
import { clean } from "../util";
import { endSession, logIn, me, signUp, startSession } from "./service";
import type { MeResponse, Ok, Session } from "../../shared/auth";

export const router = new Router();

// Last.fm clients send people to /api/auth to approve a token; hand that to the consent page of the app.
const toConsent = (c: { url: URL }) => Response.redirect(`/connect${c.url.search}`, 302);
router.get("/api/auth", toConsent);
router.get("/api/auth/", toConsent);

router.get<MeResponse>("/api/me", async c => ({ user: c.user ? await me(c.user) : null }));

router.post<Session>("/api/auth/signup", async c => {
  await limit(`signup:${ipOf(c.req)}`, 5, 3600, "Too many sign-ups from here. Try again later.");
  const u = await signUp(clean(c.body.username, 15), clean(c.body.email, 200).toLowerCase(), String(c.body.password || ""));
  await startSession(c.headers, u.id);
  return { user: await me(u) };
});

router.post<Session>("/api/auth/login", async c => {
  await limit(`login:${ipOf(c.req)}`, 10, 300);
  await limit(`login-as:${String(c.body.username || "").trim().toLowerCase()}`, 30, 3600);
  const u = await logIn(String(c.body.username || ""), String(c.body.password || ""));
  await startSession(c.headers, u.id);
  return { user: await me(u) };
});

router.post<Ok>("/api/auth/logout", async c => {
  await endSession(c.headers, tokenOf(c.req));
  if (c.user) disconnect(c.user.id); // live sockets end with the session; other tabs reconnect if still signed in
  return { ok: true };
});
