import * as Sentry from "@sentry/react";
import { useEffect } from "react";
import { useLocation, useNavigationType, createRoutesFromChildren, matchRoutes } from "react-router-dom";
import { isFailedBuildLink, isStaleBuild, recoverAsset } from "./asset-recovery";

// the build defines SENTRY_RELEASE; the dev bundler only defines NODE_ENV
const release = process.env.NODE_ENV === "production" ? process.env.SENTRY_RELEASE : "dev";

// The entry point runs again during Bun HMR; Replay must retain its existing client.
if (!Sentry.getClient()) {
  const dsn = import.meta.env?.VITE_SENTRY_DSN;
  // local builds run in production mode too; only the live site reports
  const deployed = location.hostname === "sonosphere.fm";
  Sentry.init({
    dsn: dsn ?? (deployed ? "https://871bed67ac8e4f45ad7eaa2c78c19646@rustrak.edideaur.works/2" : undefined),
    tunnel: dsn ? undefined : "/api/diag",
    enabled: import.meta.env?.VITE_SENTRY_DISABLED !== "1" && (deployed || !!dsn),
    environment: import.meta.env?.VITE_SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",
    release,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.reactRouterV6BrowserTracingIntegration({
        useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      }),
    ],
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    // Brave and Firefox on iOS inject user scripts under this namespace
    ignoreErrors: [/__firefox__/],
    beforeSend(event, hint) {
      const env = import.meta.env?.VITE_SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development";
      if (env !== "production") return null;
      // A build asset that fails to load belongs to a previous deploy: reload instead of reporting it.
      const stale = event.exception?.values?.some((e) => isStaleBuild(e.value));
      if (stale || isFailedBuildLink(hint.originalException)) {
        recoverAsset();
        return null;
      }
      return event;
    },
  });

  const loadReplay = () => {
    void import("./sentry-replay").then(({ addReplay }) => addReplay()).catch(() => {});
  };
  const scheduleReplay = () => {
    if ("requestIdleCallback" in window) requestIdleCallback(loadReplay);
    else setTimeout(loadReplay, 0);
  };
  if (document.readyState === "complete") scheduleReplay();
  else window.addEventListener("load", scheduleReplay, { once: true });
}
