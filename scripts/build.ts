// Builds the browser app into dist/ for production: `bun run build`.
// Output: dist/index.html, dist/assets/* (hashed, cacheable forever) and dist/staff.json, the list of files that
// contain the staff portal. The server refuses to send those to anyone who is not staff (server/app.ts).
import { rm } from "node:fs/promises";
import { STAFF_BUNDLE_MARK } from "../src/admin/index";

const out = "dist";
await rm(out, { recursive: true, force: true });
const result = await Bun.build({
  entrypoints: ["src/index.html"], outdir: out, target: "browser", splitting: true, minify: true, sourcemap: "none",
  publicPath: "/", naming: { entry: "[name].[ext]", chunk: "assets/[name]-[hash].[ext]", asset: "assets/[name]-[hash].[ext]" },
  define: { "process.env.NODE_ENV": '"production"' },
});
if (!result.success) { for (const log of result.logs) console.error(log); process.exit(1); }

const staff: string[] = [], open: string[] = [];
for (const file of result.outputs) {
  const name = file.path.slice(file.path.indexOf(`/${out}/`) + out.length + 2);
  if (!name.endsWith(".js")) continue;
  ((await file.text()).includes(STAFF_BUNDLE_MARK) ? staff : open).push(name);
}
// The whole point is that staff code is not in what everyone downloads: stop the build if that cannot be shown.
if (!staff.length) { console.error("Build failed: no file carries the staff portal mark, so it cannot be walled off."); process.exit(1); }
const html = await Bun.file(`${out}/index.html`).text();
const leaked = staff.filter(name => html.includes(name));
if (leaked.length) { console.error(`Build failed: the page loads staff-only files for everyone: ${leaked.join(", ")}`); process.exit(1); }
// Styles imported by the portal come out as a stylesheet the page does not link. It is served at /assets/staff.css.
const styles = result.outputs.map(f => f.path.slice(f.path.indexOf(`/${out}/`) + out.length + 2)).filter(n => n.endsWith(".css") && !html.includes(n));
if (styles.length > 1) { console.error(`Build failed: expected one staff stylesheet, found ${styles.join(", ")}`); process.exit(1); }
await Bun.write(`${out}/staff.json`, JSON.stringify({ scripts: staff, style: styles[0] ?? null }));
const size = (names: string[]) => `${(names.reduce((n, f) => n + Bun.file(`${out}/${f}`).size, 0) / 1024).toFixed(0)} KB`;
console.log(`built ${result.outputs.length} files: app ${size(open)}, staff portal ${size(staff)} (${staff.length} file${staff.length === 1 ? "" : "s"})`);
