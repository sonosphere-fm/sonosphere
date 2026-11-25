import { fail } from "../http";
import * as Sentry from "@sentry/bun";

// Without keys in development, Cloudflare's published test keys: the widget shows and always passes.
const DEV = process.env.NODE_ENV !== "production" && !process.env.TURNSTILE_SITE_KEY;
const SITE = DEV ? "1x00000000000000000000AA" : process.env.TURNSTILE_SITE_KEY || null;
const SECRET = DEV ? "1x0000000000000000000000000000000AA" : process.env.TURNSTILE_SECRET_KEY || null;
const VERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export const turnstileSiteKey = () => (SITE && SECRET ? SITE : null);

export async function checkTurnstile(token: unknown, ip: string, action: string): Promise<void> {
  if (!turnstileSiteKey()) return;
  if (typeof token !== "string" || !token || token.length > 2048) fail(400, "completeCheckNotRobot");
  const form = new URLSearchParams({ secret: SECRET!, response: token as string });
  if (ip !== "local") form.set("remoteip", ip);
  let out: { success?: boolean; action?: string };
  try {
    const r = await fetch(VERIFY, { method: "POST", body: form, signal: AbortSignal.timeout(8000) });
    out = (await r.json()) as typeof out;
  } catch (e) {
    console.error("turnstile check failed:", e instanceof Error ? e.message : e);
    Sentry.captureException(e);
    return fail(503, "couldNotConfirmNotRobot");
  }
  if (!out.success || (out.action && out.action !== action)) fail(400, "robotCheckExpiredFailedTry");
}
