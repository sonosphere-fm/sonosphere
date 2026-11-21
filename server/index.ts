import type { Server } from "bun";
import { api } from "./api";
import { appRoutes } from "./app";
import { handleCompat } from "./compat/routes";
import { dropStaleTokens } from "./compat/repo";
import { dropExpiredEmailTokens, purgeUnverified } from "./auth/email";
import { sendDigests } from "./notifications/email";
import { reviewProbation } from "./trust/service";
import { deliver } from "./mail";
import { syncCorrections } from "./corrections/service";
import { exclusive, releaseAll } from "./kv";
import { sweepUnused } from "./images/repo";
import { startDm } from "./dm/routes";
import { dropExpiredNowPlaying, ensureTallies } from "./listening/repo";
import { upgrade, websocket, type SocketData } from "./realtime";
import { startTasteWorker } from "./recommend/worker";
import { startSpotify } from "./spotify/service";
import { startEventSync } from "./events/sync";
import { startImports } from "./listening/imports";
import { startMetadata } from "./metadata/service";
import { syncAdmins } from "./site/roles";

const production = process.env.NODE_ENV === "production";

if (!production && process.env.IMPORT !== "0") {
  const { importPages, IMPORT_DIR } = await import("./dev/import");
  const { imported } = await import("./dev/import.repo");
  if (!(await imported())) {
    const hasDir = await Bun.file(IMPORT_DIR).stat().then(s => s.isDirectory(), () => false);
    if (hasDir) await importPages().catch(e => console.error("Import failed:", e));
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

const app = production ? await appRoutes() : { "/*": (await import("../src/index.html")).default };

const server = Bun.serve<SocketData>({
  port: Number(process.env.PORT) || 3000,
  hostname: production ? "127.0.0.1" : undefined,
  reusePort: true,
  development: production ? false : { hmr: true, console: false },
  routes: {
    "/api/ws": (req: Request, srv: Server<SocketData>) => upgrade(req, srv),
    "/api/*": api.handle,
    "/2.0": handleCompat,
    "/2.0/": handleCompat,
    ...app,
  },
  websocket,
});

// intervals live on globalThis so hot reload replaces them instead of stacking
const g = globalThis as { __spinHousekeeping?: ReturnType<typeof setInterval> };
clearInterval(g.__spinHousekeeping);
const tidy = () => {
  syncCorrections().catch(e => console.error(e));
  const jobs = () => Promise.all([
    dropStaleTokens(),
    sweepUnused(),
    dropExpiredEmailTokens(),
    purgeUnverified(),
    sendDigests(),
    reviewProbation(),
  ]);
  exclusive("tidy", 5 * 60_000, jobs).catch(e => console.error(e));
};
g.__spinHousekeeping = setInterval(tidy, 10 * 60 * 1000);

const playing = globalThis as { __spinPlayingExpiry?: ReturnType<typeof setInterval> };
clearInterval(playing.__spinPlayingExpiry);
playing.__spinPlayingExpiry = setInterval(() => {
  exclusive("nowplaying-expiry", 30_000, dropExpiredNowPlaying).catch(e => console.error("now playing expiry:", e));
}, 30_000);

const m = globalThis as { __spinMail?: ReturnType<typeof setInterval> };
clearInterval(m.__spinMail);
m.__spinMail = setInterval(() => {
  deliver().catch(e => console.error("mail:", e));
}, 30_000);
syncCorrections().catch(e => console.error(e));

// free job locks first (at most 2s) so another process can pick the jobs up at once
process.once("SIGTERM", () => {
  const forced = setTimeout(() => process.exit(0), 10_000);
  const freed = Promise.race([releaseAll().catch(() => {}), new Promise(r => setTimeout(r, 2000))]);
  server.stop()
    .then(() => freed)
    .then(() => {
      clearTimeout(forced);
      process.exit(0);
    }, () => process.exit(0));
});

console.log(`Sonosphere is running at ${server.url}`);
