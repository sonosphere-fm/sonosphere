// Cloudflare Turnstile on sign-up and log-in, so scripts cannot hammer them. Set TURNSTILE_SITE_KEY (shown to the
// browser) and TURNSTILE_SECRET_KEY (kept here) to turn it on; without them the check is skipped, as in dev.
import { fail } from "../http";

const SITE = process.env.TURNSTILE_SITE_KEY || null;
const SECRET = process.env.TURNSTILE_SECRET_KEY || null;
const VERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** The key the browser needs to show the widget, or null when the check is off. */
export const turnstileSiteKey = () => (SITE && SECRET ? SITE : null);

/** Checks a widget token with Cloudflare and refuses the request when it is missing, used, expired or fake. */
export async function checkTurnstile(token: unknown, ip: string, action: string): Promise<void> {
  if (!turnstileSiteKey()) return;
  if (typeof token !== "string" || !token || token.length > 2048) fail(400, "Complete the check that you are not a robot");
  const form = new URLSearchParams({ secret: SECRET!, response: token as string });
  if (ip !== "local") form.set("remoteip", ip);
  let out: { success?: boolean; action?: string; hostname?: string; "error-codes"?: string[] };
  try {
    const r = await fetch(VERIFY, { method: "POST", body: form, signal: AbortSignal.timeout(8000) });
    out = await r.json() as typeof out;
  } catch (e) {
    console.error("turnstile check failed:", e instanceof Error ? e.message : e);
    return fail(503, "Could not confirm you are not a robot. Try again in a moment.");
  }
  if (!out.success || (out.action && out.action !== action)) fail(400, "The robot check expired or failed. Try it again.");
}
