// HTTP routes for linking a Spotify account (through the listener's own Spotify app) so its plays are scrobbled.
import { need } from "../guards";
import { fail, limit, Router } from "../http";
import { clean } from "../util";
import * as spotify from "./service";
import type { Ok } from "../../shared/auth";
import type { SpotifyConnect, SpotifyPlayerToken, SpotifyStatus, SpotifySynced } from "../../shared/spotify";

export const router = new Router();

router.get<SpotifyStatus>("/api/spotify", c => spotify.status(need(c).id, c.req));

router.post<SpotifyConnect>("/api/spotify/connect", async c => {
  const u = need(c);
  const redirectUri = spotify.redirectFor(c.req) ?? fail(404, "Spotify is disabled");
  const clientId = clean(c.body.clientId, 64);
  if (!spotify.validClientId(clientId)) fail(400, "That doesn't look like a client ID. It is 32 letters and numbers, shown on your app's page on Spotify.");
  const origin = c.req.headers.get("origin") || c.url.origin; // writes are same-origin, so this is the address in use
  return { url: await spotify.connectUrl(u.id, clientId.toLowerCase(), redirectUri, origin, c.body.playback === true) };
});

/** Spotify sends the browser here after the listener approves (or declines). Answers with a redirect to settings. */
router.get("/api/spotify/callback", async c => {
  const hop = await spotify.callbackHop(c.user?.id ?? null, c.q);
  if (hop) return new Response(null, { status: 302, headers: { Location: hop, "Cache-Control": "no-store" } });
  const outcome = await spotify.finishConnect(c.user?.id ?? null, c.q);
  return new Response(null, { status: 302, headers: { Location: `/settings/applications?spotify=${outcome}`, "Cache-Control": "no-store" } });
});

/** For the in-browser player (Web Playback SDK). Spotify tokens last an hour, so this is asked for rarely. */
router.get<SpotifyPlayerToken>("/api/spotify/token", async c => {
  const u = need(c);
  await limit(`spotify-token:${u.id}`, 30, 3600, "Too many requests to Spotify. Try again later.");
  return spotify.playerToken(u.id);
});

router.post<SpotifySynced>("/api/spotify/sync", async c => {
  const u = need(c);
  await limit(`spotify-sync:${u.id}`, 1, 30, "Wait a moment before importing again");
  return (await spotify.syncNow(u.id)) ?? fail(404, "Spotify is not connected");
});

router.delete<Ok>("/api/spotify", async c => {
  await spotify.disconnect(need(c).id);
  return { ok: true };
});
