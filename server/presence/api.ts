// Discord's headless sessions API, the only way to set presence without the desktop app's local RPC.
// Ported from BrookenRecord/studio-activity (plugin/src/Api/Discord.luau).
import { asObject } from "../util";

const API = "https://discord.com/api/v10";
export const CLIENT_ID = process.env.DISCORD_CLIENT_ID || "";
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || "";
export const SCOPE = "identify sdk.social_layer_presence";

const str = (v: unknown) => (typeof v === "string" ? v : "");
const numOr = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);

/** Discord withdrew the grant for good: the listener has to connect again. */
export class Revoked extends Error {}

export type Tokens = { access: string; refresh: string; expiresIn: number };

export type Activity = {
  type: number;
  name: string;
  application_id: string;
  platform: string;
  details?: string;
  state?: string;
  timestamps?: { start?: string; end?: string };
  assets?: { large_image?: string; large_text?: string; small_image?: string; small_text?: string };
  buttons?: { label: string; url: string }[];
};

export type Problem =
  | { type: "unauthorized" }
  | { type: "rate_limited"; retryAfter: number }
  // 202: the application is not cached on Discord's side yet; retryAfter is in seconds
  | { type: "application_not_cached"; retryAfter: number }
  | { type: "network"; message: string }
  | { type: "unexpected"; statusCode: number };
export type Result<T> = { ok: true; value: T } | { ok: false; error: Problem };

const timeout = () => AbortSignal.timeout(15_000);

async function postForm(url: string, params: Record<string, string>): Promise<Response> {
  return fetch(url, { method: "POST", body: new URLSearchParams(params), signal: timeout() });
}

function tokens(j: Record<string, unknown>): Tokens {
  return { access: str(j.access_token), refresh: str(j.refresh_token), expiresIn: numOr(j.expires_in, 604800) };
}

export async function exchangeCode(code: string, redirectUri: string): Promise<Tokens> {
  const res = await postForm(`${API}/oauth2/token`, {
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  });
  const j = asObject(await res.json().catch(() => null));
  if (!res.ok || !str(j?.access_token)) throw new Error(`Discord token exchange answered ${res.status}`);
  return tokens(j!);
}

export async function refresh(refreshToken: string): Promise<Tokens> {
  const res = await postForm(`${API}/oauth2/token`, {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  });
  const j = asObject(await res.json().catch(() => null));
  if (res.status === 400 && str(j?.error) === "invalid_grant") throw new Revoked("Discord access was withdrawn");
  if (!res.ok || !str(j?.access_token)) throw new Error(`Discord token refresh answered ${res.status}`);
  return tokens(j!);
}

export async function revoke(token: string): Promise<void> {
  const res = await postForm(`${API}/oauth2/token/revoke`, {
    token,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  });
  await res.body?.cancel();
}

export async function me(access: string): Promise<{ id: string; username: string; globalName: string }> {
  const res = await fetch(`${API}/users/@me`, { headers: { Authorization: `Bearer ${access}` }, signal: timeout() });
  const j = asObject(await res.json().catch(() => null));
  if (!res.ok || !str(j?.id)) throw new Error(`Discord profile answered ${res.status}`);
  return { id: str(j!.id), username: str(j!.username), globalName: str(j!.global_name) };
}

/** Public asset list; presence images are referenced by asset id. */
export async function assets(): Promise<{ id: string; name: string }[]> {
  const res = await fetch(`${API}/oauth2/applications/${CLIENT_ID}/assets`, { signal: timeout() });
  const j = await res.json().catch(() => null);
  if (!res.ok || !Array.isArray(j)) return [];
  return j.flatMap((a) => {
    const o = asObject(a);
    return o && str(o.id) && str(o.name) ? [{ id: str(o.id), name: str(o.name) }] : [];
  });
}

async function headless(access: string, body: Record<string, unknown>): Promise<Result<{ token: string }>> {
  let res: Response;
  try {
    res = await fetch(`${API}/users/@me/headless-sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${access}` },
      body: JSON.stringify(body),
      signal: timeout(),
    });
  } catch (e) {
    return { ok: false, error: { type: "network", message: e instanceof Error ? e.message : String(e) } };
  }
  const j = asObject(await res.json().catch(() => null));
  if (res.status === 401) return { ok: false, error: { type: "unauthorized" } };
  if (res.status === 429) return { ok: false, error: { type: "rate_limited", retryAfter: numOr(j?.retry_after, 5) } };
  if (res.status === 202)
    return { ok: false, error: { type: "application_not_cached", retryAfter: numOr(j?.retry_after, 4000) / 1000 } };
  if (res.ok && str(j?.token)) return { ok: true, value: { token: str(j!.token) } };
  return { ok: false, error: { type: "unexpected", statusCode: res.status } };
}

export const createSession = (access: string, activity: Activity) => headless(access, { activities: [activity] });

/** The session token may rotate: always carry the one from the reply forward. */
export const updateSession = (access: string, token: string, activity: Activity) =>
  headless(access, { token, activities: [activity] });

export async function deleteSession(access: string, token: string): Promise<Result<null>> {
  let res: Response;
  try {
    res = await fetch(`${API}/users/@me/headless-sessions/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${access}` },
      body: JSON.stringify({ token }),
      signal: timeout(),
    });
  } catch (e) {
    return { ok: false, error: { type: "network", message: e instanceof Error ? e.message : String(e) } };
  }
  const j = asObject(await res.json().catch(() => null));
  if (res.status === 401) return { ok: false, error: { type: "unauthorized" } };
  if (res.status === 429) return { ok: false, error: { type: "rate_limited", retryAfter: numOr(j?.retry_after, 5) } };
  if (res.ok) return { ok: true, value: null };
  return { ok: false, error: { type: "unexpected", statusCode: res.status } };
}
