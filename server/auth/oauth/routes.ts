// A provider email that belongs to an existing account is refused rather than linked, so nobody can take over an
// account by showing up with the same address; the owner connects the provider from settings instead.
import { recordChange } from "../../account/history";
import { need, owner } from "../../guards";
import { isStaff } from "../../site/roles";
import { bad, ipOf, limit, Router, type Ctx, type Viewer } from "../../http";
import { requestLocale } from "../../i18n";
import { getJson, setJson, takeJson } from "../../kv";
import { SITE_URL } from "../../mail";
import { hexCookie, SECURE } from "../session";
import { findById } from "../../users/repo";
import { clean, digest, rid } from "../../util";
import * as Sentry from "@sentry/bun";
import { loginBanned } from "../ips";
import { emailTaken } from "../repo";
import { checkNewAccount, createAccount, me, startSession, USERNAME } from "../service";
import { PROVIDERS, providerById, providerLabel, type Provider } from "./providers";
import { finishLogin } from "../totp";
import * as repo from "./repo";
import { creditInvite } from "../../invites/routes";
import { syncRoles } from "../../discord/roles";
import { safeNext, type Logins, type OAuthCreated, type OAuthPending, type Ok } from "../../../shared/auth";

export const router = new Router();

type State = { provider: string; intent: "login" | "link"; userId: number; next: string; verifier: string };
type Pending = { provider: string; subject: string; name: string; email: string; next: string };

const STATE_LIFE = 10 * 60;
const PENDING_LIFE = 30 * 60;
const cookie = (name: string, value: string, maxAge: number) =>
  `${name}=${value}; Path=/api/auth/oauth; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${SECURE}`;

const redirectUri = (p: Provider) => `${SITE_URL}/api/auth/oauth/${p.id}/callback`;
const b64url = (b: ArrayBuffer) => Buffer.from(b).toString("base64url");

// Keeps the cookies set on this request (a session, cleared one-time cookies).
function go(c: Ctx, to: string): Response {
  const h = new Headers({ Location: to, "Cache-Control": "no-store" });
  for (const v of c.headers.getSetCookie()) h.append("Set-Cookie", v);
  return new Response(null, { status: 302, headers: h });
}
// an unconfirmed account may belong to whoever typed the address, so it can't gain a second way in
const canLink = (u: Viewer) => Boolean(u.emailVerifiedAt) || isStaff(u);

// Errors go back as a code the page turns into words, never as text from the URL.
function failTo(c: Ctx, intent: State["intent"], code: string): Response {
  return go(c, intent === "link" ? `/settings/account?oauth=${code}` : `/login?oauth=${code}`);
}

router.get("/api/auth/oauth/:provider/start", async (c) => {
  const p = providerById(c.params[0]!);
  const intent = c.q.get("intent") === "link" ? "link" : "login";
  if (!p) return failTo(c, intent, "off");
  await limit(`oauth:${ipOf(c.req)}`, 30, 3600);
  if (intent === "link" && !c.user) return go(c, `/login?next=${encodeURIComponent("/settings/account")}`);
  if (intent === "link") owner(c);
  if (intent === "link" && !canLink(c.user!)) return failTo(c, "link", "confirm");
  const state = rid(16);
  const verifier = p.pkce ? rid(32) : "";
  const saved: State = { provider: p.id, intent, userId: c.user?.id ?? 0, next: safeNext(c.q.get("next")), verifier };
  await setJson(`oauth:state:${digest(state)}`, saved, STATE_LIFE * 1000);
  c.headers.append("Set-Cookie", cookie("oauth_state", state, STATE_LIFE));
  const u = new URL(p.authorizeUrl);
  u.search = new URLSearchParams({
    client_id: p.clientId,
    redirect_uri: redirectUri(p),
    response_type: "code",
    scope: p.scope,
    state,
    ...p.params,
  }).toString();
  if (verifier) {
    const challenge = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    u.searchParams.set("code_challenge", b64url(challenge));
    u.searchParams.set("code_challenge_method", "S256");
  }
  return go(c, u.toString());
});

router.get("/api/auth/oauth/:provider/callback", async (c) => {
  // the state has to come back to the browser that set off, once, within ten minutes
  const sent = c.q.get("state") || "";
  const mine = hexCookie(c.req, "oauth_state");
  c.headers.append("Set-Cookie", cookie("oauth_state", "", 0));
  const st = sent && sent === mine ? await takeJson<State>(`oauth:state:${digest(sent)}`) : null;
  if (!st || st.provider !== c.params[0]) return failTo(c, c.user ? "link" : "login", "expired");
  const p = providerById(st.provider);
  if (!p) return failTo(c, st.intent, "off");
  if (c.q.get("error") || !c.q.get("code")) return failTo(c, st.intent, "cancelled");

  let who;
  try {
    const token = await exchange(p, c.q.get("code")!, st.verifier);
    who = await p.profile(token);
  } catch (e) {
    console.error(`oauth ${p.id}:`, e instanceof Error ? e.message : e);
    Sentry.captureException(e);
    return failTo(c, st.intent, "failed");
  }
  if (!who.email || !who.emailVerified) return failTo(c, st.intent, "unverified");
  const link = await repo.findLink(p.id, who.subject);

  if (st.intent === "link") {
    if (!c.user || c.user.id !== st.userId) return failTo(c, "link", "expired");
    owner(c);
    if (!canLink(c.user)) return failTo(c, "link", "confirm");
    if (link && link.userId !== c.user.id) return failTo(c, "link", "taken");
    if (!link) {
      if (await repo.linkOf(c.user.id, p.id)) return failTo(c, "link", "already");
      await repo.addLink(p.id, who.subject, c.user.id, who.name);
      if (p.id === "discord") syncRoles().catch((e) => console.error("Discord roles:", e));
    }
    return go(c, `/settings/account?linked=${p.id}`);
  }

  if (link) {
    const u = await findById(link.userId);
    if (!u) return failTo(c, "login", "failed");
    if (u.banned || (await loginBanned(u, ipOf(c.req)))) return failTo(c, "login", "banned");
    if (link.name !== who.name) {
      await repo.renameLink(p.id, who.subject, who.name);
      await recordChange(u.id, `${p.id} name`, link.name, who.name);
    }
    const result = await finishLogin(c, u, st.next);
    if ("twoFactor" in result) return go(c, "/login?twoFactor=1");
    return go(c, st.next);
  }
  if (await emailTaken(who.email)) return failTo(c, "login", "email");
  // a new account picks a username first; the pending sign-up is keyed by a one-time cookie
  const ticket = rid(16);
  const pending: Pending = { provider: p.id, subject: who.subject, name: who.name, email: who.email, next: st.next };
  await setJson(`oauth:pending:${digest(ticket)}`, pending, PENDING_LIFE * 1000);
  c.headers.append("Set-Cookie", cookie("oauth_ticket", ticket, PENDING_LIFE));
  return go(c, "/join/oauth");
});

async function exchange(p: Provider, code: string, verifier: string): Promise<string> {
  const form = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(p),
    client_id: p.clientId,
    client_secret: p.clientSecret,
  });
  if (verifier) form.set("code_verifier", verifier);
  const r = await fetch(p.tokenUrl, {
    method: "POST",
    body: form,
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  const j = (await r.json().catch(() => ({}))) as { access_token?: string; error?: string };
  if (!r.ok || !j.access_token) throw new Error(`token exchange answered ${r.status} ${j.error ?? ""}`);
  return j.access_token;
}

async function pendingOf(c: Ctx): Promise<Pending | null> {
  const t = hexCookie(c.req, "oauth_ticket");
  return t ? getJson<Pending>(`oauth:pending:${digest(t)}`) : null;
}

// Their handle at the provider, cut down to what usernames here allow.
function suggest(name: string): string {
  const s = name
    .split("@")[0]!
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .replace(/^[^a-zA-Z]+/, "")
    .slice(0, 15);
  return USERNAME.test(s) ? s : "";
}

router.get<OAuthPending>("/api/auth/oauth/pending", async (c) => {
  const pd = (await pendingOf(c)) ?? bad("signUpExpiredStartAgain");
  return { provider: providerLabel(pd.provider), username: suggest(pd.name), email: pd.email };
});

router.post<OAuthCreated>("/api/auth/oauth/complete", async (c) => {
  await limit(`signup:${ipOf(c.req)}`, 5, 3600, "tooManySignups");
  const t = hexCookie(c.req, "oauth_ticket");
  const key = `oauth:pending:${digest(t)}`;
  const pd = (t && (await getJson<Pending>(key))) || bad("signUpExpiredStartAgain");
  const username = clean(c.body.username, 15);
  await checkNewAccount(username, pd.email, ipOf(c.req));
  if (await repo.findLink(pd.provider, pd.subject)) {
    bad("providerAlreadyConnected", { provider: providerLabel(pd.provider) });
  }
  if (!(await takeJson<Pending>(key))) bad("signUpExpiredStartAgain");
  // the provider confirmed the address, so it counts as confirmed here
  const u = await createAccount(username, pd.email, "", requestLocale(c.req), true);
  await repo.addLink(pd.provider, pd.subject, u.id, pd.name);
  await creditInvite(c, u.id);
  if (pd.provider === "discord") syncRoles().catch((e) => console.error("Discord roles:", e));
  c.headers.append("Set-Cookie", cookie("oauth_ticket", "", 0));
  await startSession(c.headers, u.id, c.req);
  return { user: await me(u), next: pd.next };
});

router.get<Logins>("/api/me/logins", async (c) => {
  const u = need(c);
  const links = await repo.linksOf(u.id);
  const ids = [...new Set([...PROVIDERS.map((p) => p.id), ...links.map((l) => l.provider)])];
  const providers = ids.map((id) => {
    const l = links.find((x) => x.provider === id);
    return { id, label: providerLabel(id), connected: l ? { name: l.name, since: l.createdAt } : null };
  });
  return { hasPassword: !!u.passwordHash, providers };
});

router.post<Ok>("/api/me/logins/unlink", async (c) => {
  const u = owner(c);
  const provider = String(c.body.provider || "");
  const links = await repo.linksOf(u.id);
  if (!links.some((l) => l.provider === provider)) bad("isntConnected");
  if (!u.passwordHash && links.length === 1) bad("setPasswordFirstWontAble");
  await repo.removeLink(u.id, provider);
  return { ok: true };
});

export const oauthProviders = () => PROVIDERS.map((p) => ({ id: p.id, label: p.label }));
