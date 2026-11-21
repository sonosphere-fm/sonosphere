// API applications: registering apps that scrobble through the Last.fm-compatible API, and approving their access.
import { confirmed, need } from "../guards";
import { bad, missing, Router } from "../http";
import { clean, now, rid } from "../util";
import * as repo from "./repo";
import type { AppInfo, AppOk, Apps } from "../../shared/apps";

export const router = new Router();

/** How long an application has to get its token approved, in seconds. */
const TOKEN_LIFE = 3600;

router.get<Apps>("/api/apps", async c => {
  const u = need(c);
  return { items: await repo.appsOf(u.id), sessions: await repo.sessionsOf(u.id) };
});

router.post<AppOk>("/api/apps", async c => {
  const u = confirmed(need(c)), name = clean(c.body.name, 60) || bad("Give the application a name");
  await repo.createApp({ userId: u.id, name, description: clean(c.body.description, 300), apiKey: rid(16), secret: rid(16) });
  return { ok: true };
});

router.delete<AppOk>("/api/apps/:id", async c => {
  const id = Number(c.params[0]);
  await repo.deleteApp(id, need(c).id);
  return { ok: true };
});

router.post<AppOk>("/api/apps/revoke", async c => {
  const key = String(c.body.key);
  await repo.revokeSession(key, need(c).id);
  return { ok: true };
});

router.get<AppInfo>("/api/apps/lookup", async c => (await repo.appByKey(c.q.get("api_key") ?? "")) ?? missing("Application"));

router.post<AppOk>("/api/apps/authorize", async c => {
  const u = need(c), token = String(c.body.token);
  if (!(await repo.tokenIssued(token, String(c.body.api_key), now() - TOKEN_LIFE))) missing("Token (it may have expired)");
  await repo.approveToken(token, u.id);
  return { ok: true };
});
