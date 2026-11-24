import { checkTurnstile } from "../auth/turnstile";
import { confirmed, need } from "../guards";
import { bad, ipOf, missing, Router, throttle } from "../http";
import { clean, now, rid } from "../util";
import * as repo from "./repo";
import { createSession } from "../compat/repo";
import type { AppAuthorized, AppInfo, AppOk, Apps, ListenToken } from "../../shared/apps";

export const router = new Router();

const TOKEN_LIFE = 3600;

// Native apps may use their own scheme (myapp://...); script-running and local-file schemes are refused.
function callbackUrl(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  if (s.length > 500) bad("callbackUrlTooLong");
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return bad("callbackUrlIsntValidUrl");
  }
  if (["javascript:", "data:", "vbscript:", "file:", "blob:", "about:"].includes(u.protocol))
    bad("kindCallbackUrlIsntAllowed");
  return u.href;
}

router.get<Apps>("/api/apps", async (c) => {
  const u = need(c);
  return { items: await repo.appsOf(u.id), sessions: await repo.sessionsOf(u.id) };
});

router.post<AppOk>("/api/apps", async (c) => {
  const u = confirmed(need(c));
  const name = clean(c.body.name, 60) || bad("giveApplicationName");
  const cb = callbackUrl(c.body.callbackUrl);
  await throttle(`app-create:${u.id}`, 5, 86_400, "tooManyAppsToday");
  await checkTurnstile(c.body.turnstile, ipOf(c.req), "apiapp");
  await repo.createApp({
    userId: u.id,
    name,
    description: clean(c.body.description, 300),
    apiKey: rid(16),
    secret: rid(16),
    callbackUrl: cb,
  });
  return { ok: true };
});

router.patch<AppOk>("/api/apps/:id", async (c) => {
  await repo.setCallback(Number(c.params[0]), need(c).id, callbackUrl(c.body.callbackUrl));
  return { ok: true };
});

router.delete<AppOk>("/api/apps/:id", async (c) => {
  const id = Number(c.params[0]);
  await repo.deleteApp(id, need(c).id);
  return { ok: true };
});

router.post<AppOk>("/api/apps/revoke", async (c) => {
  const key = String(c.body.key);
  await repo.revokeSession(key, need(c).id);
  return { ok: true };
});

router.get<AppInfo>(
  "/api/apps/lookup",
  async (c) => (await repo.appByKey(c.q.get("api_key") ?? "")) ?? missing("applicationNotFound")
);

// Desktop sign-in brings the token from auth.getToken; web sign-in brings none, so one is made here, already approved.
router.post<AppAuthorized>("/api/apps/authorize", async (c) => {
  const u = need(c);
  const apiKey = String(c.body.api_key ?? "");
  const app = (await repo.appByKey(apiKey)) ?? missing("applicationNotFound");
  const cb = callbackUrl(c.body.cb);
  // so a crafted link can't send the token to a site the app didn't register
  if (cb && app.callbackUrl && new URL(cb).origin !== new URL(app.callbackUrl).origin) {
    bad("unregisteredRedirect");
  }
  const back = cb || app.callbackUrl;
  let token = typeof c.body.token === "string" ? c.body.token : "";
  if (token) {
    if (!(await repo.tokenIssued(token, apiKey, now() - TOKEN_LIFE))) missing("tokenNotFound");
    await repo.approveToken(token, u.id);
  } else {
    if (!back) bad("applicationDidntSayWhereSend");
    token = rid(16);
    await repo.createApprovedToken(token, (await repo.appIdByKey(apiKey))!, u.id);
  }
  if (!back) return { token, redirect: null };
  const sep = back.includes("?") ? "&" : "?";
  return { token, redirect: `${back}${sep}token=${encodeURIComponent(token)}` };
});

// for ListenBrainz-compatible players (served at /1/); shown once, and listed with the connected applications
router.post<ListenToken>("/api/apps/listen-token", async (c) => {
  const u = confirmed(need(c));
  await throttle(`listen-token:${u.id}`, 10, 86_400, "tooManyTokensToday");
  await checkTurnstile(c.body.turnstile, ipOf(c.req), "listentoken");
  const token = crypto.randomUUID();
  await createSession(token, (await repo.appIdByKey("listenbrainz"))!, u.id);
  return { token };
});

// a link to set as a player's Last.fm server, passing calls on to Last.fm and copying scrobbles here
router.post<ListenToken>("/api/apps/relay-token", async (c) => {
  const u = confirmed(need(c));
  await throttle(`listen-token:${u.id}`, 10, 86_400, "tooManyTokensToday");
  await checkTurnstile(c.body.turnstile, ipOf(c.req), "listentoken");
  const token = crypto.randomUUID();
  await createSession(token, (await repo.appIdByKey("relay"))!, u.id);
  return { token };
});
