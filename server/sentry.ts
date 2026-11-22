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
Sentry.init({
  dsn: dsn ?? (process.env.NODE_ENV === "production" ? "https://62e81253f648439c9e4564bb857a504b@rustrak.edideaur.works/3" : undefined),
  enabled: process.env.SENTRY_DISABLED !== "1" && (process.env.NODE_ENV === "production" || !!dsn),
  environment: process.env.NODE_ENV,
  release,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
});
