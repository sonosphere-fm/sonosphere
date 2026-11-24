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
// only the Docker image sets SENTRY_RELEASE, so local production-mode runs stay quiet
const deployed = !!process.env.SENTRY_RELEASE;
Sentry.init({
  dsn: dsn ?? (deployed ? "https://62e81253f648439c9e4564bb857a504b@rustrak.edideaur.works/3" : undefined),
  enabled: process.env.SENTRY_DISABLED !== "1" && (deployed || !!dsn),
  environment: process.env.NODE_ENV,
  release,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  beforeSend(event, hint) {
    // Never report errors from non-production environments.
    if (process.env.NODE_ENV !== "production") return null;
    // Ignore aborted / closed connections on the Sentry tunnel (/api/diag): a
    // browser navigating away while an error report is forwarded triggers this,
    // and it only produces noise (e.g. SONOSPHERE-BACKEND-28).
    const exc = event.exception?.values?.[0];
    if (exc && (exc.type === "AbortError" || /connection.*closed/i.test(exc.value ?? ""))) return null;
    return event;
  },
});
