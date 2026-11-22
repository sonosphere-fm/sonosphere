import { checkTurnstile } from "../auth/turnstile";
import { confirmed, need } from "../guards";
import { bad, ipOf, missing, Router, throttle } from "../http";
import { clean, now, rid } from "../util";
import * as repo from "./repo";
import type { AppAuthorized, AppInfo, AppOk, Apps } from "../../shared/apps";

export const router = new Router();

const TOKEN_LIFE = 3600;

// Native apps may use their own scheme (myapp://...); script-running and local-file schemes are refused.
function callbackUrl(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  if (s.length > 500) bad("The callback URL is too long");
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return bad("The callback URL isn't a valid URL");
  }
  if (["javascript:", "data:", "vbscript:", "file:", "blob:", "about:"].includes(u.protocol))
    bad("That kind of callback URL isn't allowed");
  return u.href;
}

router.get<Apps>("/api/apps", async (c) => {
  const u = need(c);
  return { items: await repo.appsOf(u.id), sessions: await repo.sessionsOf(u.id) };
});

router.post<AppOk>("/api/apps", async (c) => {
  const u = confirmed(need(c));
  const name = clean(c.body.name, 60) || bad("Give the application a name");
  const cb = callbackUrl(c.body.callbackUrl);
  await throttle(`app-create:${u.id}`, 5, 86_400, "You can create up to 5 applications a day.");
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
  async (c) => (await repo.appByKey(c.q.get("api_key") ?? "")) ?? missing("Application")
);

// Desktop sign-in brings the token from auth.getToken; web sign-in brings none, so one is made here, already approved.
router.post<AppAuthorized>("/api/apps/authorize", async (c) => {
  const u = need(c);
  const apiKey = String(c.body.api_key ?? "");
  const app = (await repo.appByKey(apiKey)) ?? missing("Application");
  const cb = callbackUrl(c.body.cb);
  // so a crafted link can't send the token to a site the app didn't register
  if (cb && app.callbackUrl && new URL(cb).origin !== new URL(app.callbackUrl).origin) {
    bad("This sign-in link sends you to a site the application didn't register");
  }
  const back = cb || app.callbackUrl;
  let token = typeof c.body.token === "string" ? c.body.token : "";
  if (token) {
    if (!(await repo.tokenIssued(token, apiKey, now() - TOKEN_LIFE))) missing("Token (it may have expired)");
    await repo.approveToken(token, u.id);
  } else {
    if (!back) bad("This application didn't say where to send you back to");
    token = rid(16);
    await repo.createApprovedToken(token, (await repo.appIdByKey(apiKey))!, u.id);
  }
  if (!back) return { token, redirect: null };
  const sep = back.includes("?") ? "&" : "?";
  return { token, redirect: `${back}${sep}token=${encodeURIComponent(token)}` };
});
