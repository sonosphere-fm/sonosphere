// Serves the built browser app (dist/, made by `bun run build`) in production.
// Files that contain the staff portal are listed in dist/staff.json and are only sent to signed-in staff;
// to everyone else they do not exist. Everything is read into memory once at start.
import { readdir } from "node:fs/promises";
import { sessionUser } from "./auth/session";
import { tokenOf } from "./http";
import { isStaff } from "./site/roles";

type Asset = { body: ArrayBuffer; type: string; staff: boolean };
const DIST = "dist";
const FOREVER = "max-age=31536000, immutable"; // file names carry a hash of their contents

async function load() {
  const names = await readdir(`${DIST}/assets`).catch(() => null);
  const page = Bun.file(`${DIST}/index.html`);
  if (!names || !(await page.exists())) throw new Error("dist/ is missing. Run `bun run build` first.");
  const manifest: { scripts: string[]; style: string | null } = await Bun.file(`${DIST}/staff.json`).json();
  const staffOnly = new Set([...manifest.scripts, ...(manifest.style ? [manifest.style] : [])]);
  const assets = new Map<string, Asset>();
  for (const name of names) {
    const path = `assets/${name}`, file = Bun.file(`${DIST}/${path}`);
    assets.set(`/${path}`, { body: await file.arrayBuffer(), type: file.type, staff: staffOnly.has(path) });
  }
  // the staff stylesheet has one fixed address, so the portal can ask for it without knowing the hashed name
  const style = manifest.style ? assets.get(`/${manifest.style}`) : undefined;
  if (style) assets.set("/assets/staff.css", style);
  return { assets, html: await page.text() };
}

export async function appRoutes() {
  const { assets, html } = await load();
  const missing = () => new Response("Not found", { status: 404 });
  const shell = () => new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" } });
  const asset = async (req: Request) => {
    const path = new URL(req.url).pathname, found = assets.get(path);
    if (!found) return missing();
    if (!found.staff) return new Response(found.body, { headers: { "Content-Type": found.type, "Cache-Control": `public, ${FOREVER}` } });
    const viewer = await sessionUser(tokenOf(req));
    if (!viewer || !isStaff(viewer)) return missing();
    // private: a shared cache must never hand this to someone else; the fixed stylesheet address is re-checked each time
    const cache = path === "/assets/staff.css" ? "private, no-cache" : `private, ${FOREVER}`;
    return new Response(found.body, { headers: { "Content-Type": found.type, "Cache-Control": cache, Vary: "Cookie" } });
  };
  return { "/assets/*": asset, "/*": shell };
}
