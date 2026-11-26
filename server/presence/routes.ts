import { need, owner } from "../guards";
import { bad, fail, limit, oneOf, Router } from "../http";
import * as presence from "./service";
import type { Ok } from "../../shared/auth";
import {
  PRESENCE_DETAILS,
  PRESENCE_LAYOUTS,
  type PresencePreferencesPatch,
  type PresenceStatus,
} from "../../shared/discord";

export const router = new Router();

const redirect = (location: string) =>
  new Response(null, { status: 302, headers: { Location: location, "Cache-Control": "no-store" } });

router.get<PresenceStatus>("/api/discord/presence", (c) => presence.status(need(c).id));

router.get("/api/discord/presence/start", async (c) => {
  const u = owner(c);
  await limit(`presence-connect:${u.id}`, 10, 3600);
  if (!presence.enabled()) fail(404, "notFound");
  if (!(await presence.linkedDiscord(u.id))) bad("isntConnected");
  return redirect(await presence.connectUrl(u.id));
});

/** Discord sends the browser here after the listener approves (or declines). */
router.get("/api/discord/presence/callback", async (c) => {
  const outcome = await presence.finishConnect(c.user?.id ?? null, c.q);
  return redirect(`/settings/applications?presence=${outcome}`);
});

router.post<PresenceStatus>("/api/discord/presence", async (c) => {
  const u = need(c);
  await limit(`presence-toggle:${u.id}`, 30, 3600, "tooManyRequests");
  return presence.updateSettings(u.id, { on: c.body.on === true });
});

router.patch<PresenceStatus>("/api/discord/presence", async (c) => {
  const u = need(c);
  await limit(`presence-toggle:${u.id}`, 30, 3600, "tooManyRequests");
  const { image, details, layout, branding } = c.body;
  const patch: PresencePreferencesPatch = {};
  if (image !== undefined) patch.image = image === "logo" ? "logo" : "album";
  if (details !== undefined) patch.details = oneOf(details, PRESENCE_DETAILS) ?? bad("invalidJsonBody");
  if (layout !== undefined) patch.layout = oneOf(layout, PRESENCE_LAYOUTS) ?? bad("invalidJsonBody");
  if (branding !== undefined) {
    if (typeof branding !== "boolean") return bad("invalidJsonBody");
    patch.branding = branding;
  }
  if (!Object.keys(patch).length) bad("invalidJsonBody");
  return presence.updateSettings(u.id, patch);
});

router.delete<Ok>("/api/discord/presence", async (c) => {
  await presence.disconnect(owner(c).id);
  return { ok: true };
});
