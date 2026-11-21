import { readdir } from "node:fs/promises";
import { sessionUser } from "./auth/session";
import { me } from "./auth/service";
import { tokenOf } from "./http";
import { isStaff } from "./site/roles";
import { pageSeo, seoContent, seoHead } from "./seo";
import { crawlerRoutes } from "./sitemap";

type Asset = { body: ArrayBuffer; type: string; staff: boolean };
const DIST = "dist";
const FOREVER = "max-age=31536000, immutable";

async function load() {
  const names = await readdir(`${DIST}/assets`).catch(() => null);
  const page = Bun.file(`${DIST}/index.html`);
  if (!names || !(await page.exists())) throw new Error("dist/ is missing. Run `bun run build` first.");
  const manifest: { scripts: string[]; style: string | null } = await Bun.file(`${DIST}/staff.json`).json();
  const staffOnly = new Set(manifest.scripts);
  if (manifest.style) staffOnly.add(manifest.style);
  const assets = new Map<string, Asset>();
  for (const name of names) {
    const path = `assets/${name}`;
    const file = Bun.file(`${DIST}/${path}`);
    assets.set(`/${path}`, { body: await file.arrayBuffer(), type: file.type, staff: staffOnly.has(path) });
  }
  // a fixed address lets the portal load its stylesheet without knowing the hashed name
  const style = manifest.style ? assets.get(`/${manifest.style}`) : undefined;
  if (style) assets.set("/assets/staff.css", style);
  return { assets, html: await page.text() };
}

const escapeScript = (json: string) =>
  json.replace(/</g, "\\u003c").replace(/\u2028|\u2029/g, c => `\\u${c.charCodeAt(0).toString(16)}`);

export async function appRoutes() {
  const { assets, html } = await load();
  const missing = () => new Response("Not found", { status: 404 });

  // the page embeds the viewer's account, so no shared cache may keep it
  const shell = async (req: Request) => {
    const [viewer, seo] = await Promise.all([sessionUser(tokenOf(req)).catch(() => null), pageSeo(new URL(req.url))]);
    const data = escapeScript(JSON.stringify({ user: viewer ? await me(viewer) : null }));
    const scheme = viewer?.theme === "dark" || viewer?.theme === "system" ? ` data-scheme="${viewer.theme}"` : "";
    const page = html
      .replace("<html lang=\"en\">", () => `<html lang="en"${scheme}>`)
      .replace(/<title>[^<]*<\/title>/, () => seoHead(seo))
      .replace(/<div id=["']?root["']?>/, root => root + seoContent(seo))
      .replace("</head>", () => `<script>window.__ME=${data}</script></head>`);
    const headers = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-cache", Vary: "Cookie" };
    return new Response(page, { headers, status: seo.status ?? 200 });
  };

  const metadata = async (req: Request) => {
    const target = new URL(req.url).searchParams.get("path") || "/";
    const url = new URL(req.url);
    const path = target.startsWith("/") ? new URL(url.origin + target) : new URL(url.origin);
    return new Response(seoHead(await pageSeo(path)), {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  };

  const asset = async (req: Request) => {
    const path = new URL(req.url).pathname;
    const found = assets.get(path);
    if (!found) return missing();
    if (!found.staff) {
      return new Response(found.body, { headers: { "Content-Type": found.type, "Cache-Control": path === "/assets/social-card.png" ? "public, max-age=86400" : `public, ${FOREVER}` } });
    }
    const viewer = await sessionUser(tokenOf(req));
    if (!viewer || !isStaff(viewer)) return missing();
    const cache = path === "/assets/staff.css" ? "private, no-cache" : `private, ${FOREVER}`;
    return new Response(found.body, { headers: { "Content-Type": found.type, "Cache-Control": cache, Vary: "Cookie" } });
  };

  return { ...crawlerRoutes, "/page-metadata": metadata, "/assets/*": asset, "/*": shell };
}
