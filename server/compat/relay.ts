// A per-user link that stands in for Last.fm's API: each call is passed to Last.fm byte for byte, so the
// player's own key and signature stay valid, and what Last.fm accepts is copied into the user's listening.
import * as Sentry from "@sentry/bun";
import { findTrack } from "../catalog/repo";
import { ipOf } from "../http";
import { setLoved } from "../listening/repo";
import { resolve, scrobbleMany, setNowPlaying } from "../listening/service";
import { appIdByKey } from "../apps/repo";
import { sessionUser } from "./repo";
import { failed, paramsOf, throttled } from "./routes";
import { scrobbleInputs, type Params } from "./service";

const LASTFM = "https://ws.audioscrobbler.com/2.0/";
const MAX_BODY = 64 * 1024;
const TIME_LIMIT_MS = 15_000;

let appId: number | null = null;

async function userOf(token: string): Promise<number | null> {
  appId ??= await appIdByKey("relay");
  return appId && token ? sessionUser(token, appId) : null;
}

const accepted = (res: Response, body: string) =>
  res.ok && !body.includes('status="failed"') && !/^\s*\{\s*"error"/.test(body);

async function mirror(userId: number, p: Params): Promise<void> {
  const method = String(p.method ?? "").toLowerCase();
  const track = { artist: p.artist, track: p.track, album: p.album, duration: p.duration };
  if (method === "track.scrobble") {
    const inputs = scrobbleInputs(p);
    if (inputs.length) await scrobbleMany(userId, inputs, "relay");
  } else if (method === "track.updatenowplaying") {
    await setNowPlaying(userId, track);
  } else if (method === "track.love") {
    const ref = await resolve(track);
    if (ref) await setLoved(userId, ref.trackId, true);
  } else if (method === "track.unlove") {
    const found = await findTrack(String(p.artist ?? ""), String(p.track ?? ""));
    if (found) await setLoved(userId, found.id, false);
  }
}

export async function handleRelay(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const token = url.pathname.split("/")[2] ?? "";
  const type = req.headers.get("content-type");
  const size = Number(req.headers.get("content-length") || 0);
  const body = req.method === "POST" && size <= MAX_BODY ? await req.text().catch(() => "") : "";
  const p = paramsOf(url, body, type);
  const json = p.format === "json";

  if (size > MAX_BODY || body.length > MAX_BODY) return failed(json, 6, "Request too large", 413);
  const slow = await throttled(`compat:${ipOf(req)}`, json);
  if (slow) return slow;
  const userId = await userOf(token);
  if (!userId) return failed(json, 9, "Invalid relay link - create a new one in your Sonosphere settings", 403);
  const busy = await throttled(`relay:${userId}`, json);
  if (busy) return busy;

  let res: Response;
  let reply: string;
  try {
    res = await fetch(LASTFM + url.search, {
      method: req.method === "POST" ? "POST" : "GET",
      headers: {
        ...(type ? { "Content-Type": type } : {}),
        "User-Agent": req.headers.get("user-agent") || "Sonosphere scrobble relay",
      },
      body: req.method === "POST" ? body : undefined,
      redirect: "error",
      signal: AbortSignal.timeout(TIME_LIMIT_MS),
    });
    reply = await res.text();
  } catch {
    return failed(json, 16, "Last.fm could not be reached. Please try again", 503);
  }

  if (accepted(res, reply)) {
    mirror(userId, p).catch((e) => {
      console.error(e);
      Sentry.captureException(e);
    });
  }
  return new Response(reply, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") || "text/xml; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
}
