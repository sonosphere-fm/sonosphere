import "./sentry";
import type { Server } from "bun";
import * as Sentry from "@sentry/bun";
import { api } from "./api";
import { appRoutes } from "./app";
import { handleListenBrainz } from "./listenbrainz/routes";
import { handleRelay } from "./compat/relay";
import { handleCompat } from "./compat/routes";
import { sentryTunnel } from "./sentry-tunnel";
import { dropStaleTokens } from "./compat/repo";
import { dropExpiredEmailTokens, purgeUnverified } from "./auth/email";
import { sendDigests } from "./notifications/email";
import { reviewProbation } from "./trust/service";
import { deliver } from "./mail";
import { dropOldMailLog } from "./mail/routes";
import { syncCorrections } from "./corrections/service";
import { exclusive, releaseAll } from "./kv";
import { sweepUnused } from "./images/repo";
import { startDm } from "./dm/routes";
import { dropExpiredNowPlaying, ensureTallies } from "./listening/repo";
import { upgrade, websocket, type SocketData } from "./realtime";
import { publicNowPlaying, publicPlayingWebsocket } from "./listening/public";
import { startTasteWorker } from "./recommend/worker";
import { startSpotify } from "./spotify/service";
import { startEventSync } from "./events/sync";
import { startImports } from "./listening/imports";
import { startMetadata } from "./metadata/service";
import { syncAdmins } from "./site/roles";
import { pg } from "./db/client";
import { readiness } from "./readiness";
import { llmsTxt } from "./developer-docs";
import { HTTPS } from "./auth/session";

const production = process.env.NODE_ENV === "production";

if (!production && process.env.IMPORT !== "0") {
  const { importPages, IMPORT_DIR } = await import("./dev/import");
  const { imported } = await import("./dev/import.repo");
  if (!(await imported())) {
    const hasDir = await Bun.file(IMPORT_DIR)
      .stat()
      .then(
        (s) => s.isDirectory(),
        () => false
      );
    if (hasDir)
      await importPages().catch((e) => {
        console.error("Import failed:", e);
        Sentry.captureException(e);
      });
    else console.log(`No import folder at ${IMPORT_DIR}; starting with an empty database.`);
  }
}

await ensureTallies();
await syncAdmins();
startDm();
startTasteWorker();
startSpotify();
startMetadata();
startEventSync();
startImports();

const DISCORD_INVITE = "https://discord.gg/sonosphere";

const app = production ? await appRoutes() : { "/*": (await import("../src/index.html")).default };

// Nothing here is meant to be framed by another site: now-playing widgets fetch JSON rather than embedding a page.
const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  ...(HTTPS && { "Strict-Transport-Security": "max-age=31536000; includeSubDomains" }),
};

type RouteFn = (req: Request, srv: Server<SocketData>) => Response | undefined | Promise<Response | undefined>;
const withHeaders =
  (fn: RouteFn): RouteFn =>
  async (req, srv) => {
    const res = await fn(req, srv);
    if (!res) return res;
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      if (!res.headers.has(name)) res.headers.set(name, value);
    }
    return res;
  };
// the development page bundle is served by Bun itself and stays as it is
const secured = <T extends Record<string, unknown>>(routes: T): T =>
  Object.fromEntries(
    Object.entries(routes).map(([path, h]) => [path, typeof h === "function" ? withHeaders(h as RouteFn) : h])
  ) as T;

// Above the largest real upload: a 20,000-row import chunk is a few MB and pictures stop at 8 MB.
const MAX_REQUEST_BYTES = 32 * 1024 * 1024;

const server = Bun.serve<SocketData>({
  port: Number(process.env.PORT) || 3000,
  hostname: production ? "127.0.0.1" : undefined,
  reusePort: true,
  maxRequestBodySize: MAX_REQUEST_BYTES,
  development: production ? false : { hmr: true, console: false },
  routes: secured({
    "/llms.txt": llmsTxt,
    "/health/ready": () => readiness(() => pg`SELECT 1`),
    "/api/ws": (req: Request, srv: Server<SocketData>) => upgrade(req, srv),
    "/api/user/nowplaying": (req: Request, srv: Server<SocketData>) => publicNowPlaying(req, srv),
    "/api/user/nowplaying/stream": (req: Request, srv: Server<SocketData>) => publicNowPlaying(req, srv),
    "/api/user/nowplaying/ws": (req: Request, srv: Server<SocketData>) => publicNowPlaying(req, srv),
    "/api/diag": sentryTunnel,
    "/api/*": api.handle,
    "/discord": () =>
      new Response(null, { status: 302, headers: { Location: DISCORD_INVITE, "Cache-Control": "no-store" } }),
    "/2.0": handleCompat,
    "/2.0/": handleCompat,
    "/1/*": handleListenBrainz,
    "/relay/*": handleRelay,
    ...app,
  }),
  websocket: {
    ...websocket,
    open(ws) {
      (ws.data.publicUserId ? publicPlayingWebsocket : websocket).open(ws);
    },
    message(ws, raw) {
      (ws.data.publicUserId ? publicPlayingWebsocket : websocket).message(ws, raw);
    },
    close(ws) {
      (ws.data.publicUserId ? publicPlayingWebsocket : websocket).close(ws);
    },
  },
});

// intervals live on globalThis so hot reload replaces them instead of stacking
const g = globalThis as {
  __spinHousekeeping?: ReturnType<typeof setInterval>;
  __spinFirstTidy?: ReturnType<typeof setTimeout>;
};
clearInterval(g.__spinHousekeeping);
clearTimeout(g.__spinFirstTidy);
const tidy = () => {
  syncCorrections().catch((e) => {
    console.error(e);
    Sentry.captureException(e);
  });
  const jobs = () =>
    Promise.all([
      dropStaleTokens(),
      sweepUnused(),
      dropExpiredEmailTokens(),
      dropOldMailLog(),
      purgeUnverified(),
      sendDigests(),
      reviewProbation(),
    ]);
  exclusive("tidy", 5 * 60_000, jobs).catch((e) => {
    console.error(e);
    Sentry.captureException(e);
  });
};
g.__spinHousekeeping = setInterval(tidy, 10 * 60 * 1000);
// deploys can come more often than the interval, so each boot also runs it once
g.__spinFirstTidy = setTimeout(tidy, 60_000);

const playing = globalThis as { __spinPlayingExpiry?: ReturnType<typeof setInterval> };
clearInterval(playing.__spinPlayingExpiry);
playing.__spinPlayingExpiry = setInterval(() => {
  exclusive("nowplaying-expiry", 30_000, dropExpiredNowPlaying).catch((e) => {
    console.error("now playing expiry:", e);
    Sentry.captureException(e);
  });
}, 30_000);

const m = globalThis as { __spinMail?: ReturnType<typeof setInterval> };
clearInterval(m.__spinMail);
m.__spinMail = setInterval(() => {
  deliver().catch((e) => {
    console.error("mail:", e);
    Sentry.captureException(e);
  });
}, 30_000);
syncCorrections().catch((e) => {
  console.error(e);
  Sentry.captureException(e);
});

// free job locks first (at most 2s) so another process can pick the jobs up at once
process.once("SIGTERM", () => {
  const forced = setTimeout(() => process.exit(0), 10_000);
  const freed = Promise.race([releaseAll().catch(() => {}), new Promise((r) => setTimeout(r, 2000))]);
  server
    .stop()
    .then(() => freed)
    .then(
      () => {
        clearTimeout(forced);
        process.exit(0);
      },
      () => process.exit(0)
    );
});

console.log(`Sonosphere is running at ${server.url}`);
