import * as Sentry from "@sentry/react";
import { useEffect } from "react";
import { useLocation, useNavigationType, createRoutesFromChildren, matchRoutes } from "react-router-dom";
import { failedBuildLink, isStaleBuild, recoverAsset } from "./asset-recovery";

// the build defines SENTRY_RELEASE; the dev bundler only defines NODE_ENV
const release = process.env.NODE_ENV === "production" ? process.env.SENTRY_RELEASE : "dev";

// The entry point runs again during Bun HMR; Replay must retain its existing client.
if (!Sentry.getClient()) {
  const dsn = import.meta.env?.VITE_SENTRY_DSN;
  // local builds run in production mode too; only the live site reports
  const deployed = location.hostname === "sonosphere.fm";
  Sentry.init({
    dsn: dsn ?? (deployed ? "https://871bed67ac8e4f45ad7eaa2c78c19646@rustrak.edideaur.works/2" : undefined),
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
    beforeSend(event, hint) {
      const resource = failedBuildLink(hint.originalException);
      const stale = event.exception?.values?.some((e) => isStaleBuild(e.value));
      if ((resource || stale) && recoverAsset()) return null;
      if (resource) {
        event.extra = { ...event.extra, failedResourceUrl: resource };
        event.exception = {
          values: [{ type: "AssetLoadError", value: `Failed to load build asset: ${resource}` }],
        };
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
