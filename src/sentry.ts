import * as Sentry from "@sentry/react";
import { useEffect } from "react";
import { useLocation, useNavigationType, createRoutesFromChildren, matchRoutes } from "react-router-dom";

const release = process.env.SENTRY_RELEASE || "unknown";

Sentry.init({
  dsn: import.meta.env?.VITE_SENTRY_DSN || "https://871bed67ac8e4f45ad7eaa2c78c19646@rustrak.edideaur.works/2",
  environment: process.env.NODE_ENV,
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
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});