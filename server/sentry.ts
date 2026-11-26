import { execSync } from "node:child_process";
import * as Sentry from "@sentry/bun";

function gitSha(): string | undefined {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return undefined;
  }
}

const release = process.env.SENTRY_RELEASE || process.env.GIT_SHA || gitSha();

const dsn = process.env.SENTRY_DSN;
// only deployed sonosphere.fm Docker builds fall back to the default DSN
const deployed = !!process.env.SENTRY_RELEASE && /^https?:\/\/sonosphere\.fm(\/|$)/.test(process.env.SITE_URL ?? "");
Sentry.init({
  dsn: dsn ?? (deployed ? "https://62e81253f648439c9e4564bb857a504b@rustrak.edideaur.works/3" : undefined),
  enabled: process.env.SENTRY_DISABLED !== "1" && (deployed || !!dsn),
  environment: process.env.NODE_ENV,
  release,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  beforeSend(event, hint) {
    if (process.env.NODE_ENV !== "production") return null;
    // Ignore aborted /api/diag tunnel requests when a browser navigates away.
    const exc = event.exception?.values?.[0];
    if (exc && (exc.type === "AbortError" || /connection.*closed/i.test(exc.value ?? ""))) return null;
    return event;
  },
});
