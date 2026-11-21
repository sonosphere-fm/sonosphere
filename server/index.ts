// The Sonosphere server: one Bun process serving the JSON API (server/api.ts), the scrobbler-compatible API (/2.0/),
// live updates over WebSocket and the React app. In production the app comes from dist/ (see server/app.ts);
// in development Bun bundles src/ on the fly with hot reload.
import type { Server } from "bun";
import { api } from "./api";
import { appRoutes } from "./app";
import { handleCompat } from "./compat/routes";
import { dropStaleTokens } from "./compat/repo";
import { syncCorrections } from "./corrections/service";
import { exclusive } from "./kv";
import { sweepUnused } from "./images/repo";
import { startDm } from "./dm/service";
import { dropExpiredNowPlaying, ensureTallies } from "./listening/repo";
import { upgrade, websocket, type SocketData } from "./realtime";
import { startTasteWorker } from "./recommend/worker";
import { startSpotify } from "./spotify/service";
import { syncAdmins } from "./site/roles";

const production = process.env.NODE_ENV === "production";

// Development only: the first time the dev server starts on an empty database, load the saved pages once.
if (!production && process.env.IMPORT !== "0") {
  const { importPages, IMPORT_DIR } = await import("./dev/import");
  const { imported } = await import("./dev/import.repo");
  if (!(await imported())) {
    if (await Bun.file(IMPORT_DIR).stat().then(s => s.isDirectory(), () => false)) await importPages().catch(e => console.error("Import failed:", e));
    else console.log(`No import folder at ${IMPORT_DIR}; starting with an empty database.`);
  }
}

await ensureTallies();
await syncAdmins(); // accounts named in ADMIN_USERS are staff
startDm();
startTasteWorker();
startSpotify();

// The browser app: built files in production, Bun's bundler (with hot reload) in development.
const app = production ? await appRoutes() : { "/*": (await import("../src/index.html")).default };

const server = Bun.serve<SocketData>({
  port: Number(process.env.PORT) || 3000,
  hostname: production ? "127.0.0.1" : undefined, // in production only nginx, on the same machine, talks to it
  development: production ? false : { hmr: true, console: false },
  routes: {
    "/api/ws": (req: Request, srv: Server<SocketData>) => upgrade(req, srv), // live updates; same process, same port
    "/api/*": api.handle,
    "/2.0": handleCompat,
    "/2.0/": handleCompat,
    ...app,
  },
  websocket,
});

// Housekeeping every ten minutes. Similar artists are kept fresh by the taste worker, not here.
const g = globalThis as { __spinHousekeeping?: ReturnType<typeof setInterval> };
clearInterval(g.__spinHousekeeping);
const tidy = () => {
  syncCorrections().catch(e => console.error(e)); // re-downloads at most once a day
  exclusive("tidy", 5 * 60_000, () => Promise.all([dropExpiredNowPlaying(), dropStaleTokens(), sweepUnused()])).catch(e => console.error(e)); // one process is enough
};
g.__spinHousekeeping = setInterval(tidy, 10 * 60 * 1000);
syncCorrections().catch(e => console.error(e));

// A rolling deploy stops the old process with SIGTERM once the new one is serving: finish what is in flight, then exit.
process.once("SIGTERM", () => {
  const forced = setTimeout(() => process.exit(0), 10_000);
  server.stop().then(() => { clearTimeout(forced); process.exit(0); }, () => process.exit(0));
});

console.log(`Sonosphere is running at ${server.url}`);
