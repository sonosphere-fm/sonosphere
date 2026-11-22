import { rm } from "node:fs/promises";
import { execSync } from "node:child_process";
import tailwind from "bun-plugin-tailwind";
import { guestHomeShell } from "./home-shell";
import { STAFF_BUNDLE_MARK } from "../src/admin/index";
import "./changelog";

let gitSha = process.env.SENTRY_RELEASE || process.env.GIT_SHA || "unknown";
try {
  if (gitSha === "unknown") gitSha = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
} catch {}

const out = "dist";
await rm(out, { recursive: true, force: true });
const result = await Bun.build({
  entrypoints: ["src/index.html"],
  outdir: out,
  target: "browser",
  splitting: true,
  minify: true,
  sourcemap: "none",
  publicPath: "/",
  naming: { entry: "[name].[ext]", chunk: "assets/[name]-[hash].[ext]", asset: "assets/[name]-[hash].[ext]" },
  define: { "process.env.NODE_ENV": '"production"', "process.env.SENTRY_RELEASE": JSON.stringify(gitSha) },
  plugins: [tailwind],
});

function die(message: string): never {
  console.error(message);
  process.exit(1);
}

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

const relative = (path: string) => path.slice(path.indexOf(`/${out}/`) + out.length + 2);

// Bun inlines every font subset into the stylesheet, which blocks the first paint; as files, a browser fetches only
// the subsets the page's text needs
const INLINE_FONT = /url\(data:font\/(woff2?);base64,([A-Za-z0-9+/=]+)\)/g;
const stylesheets = result.outputs.filter((file) => file.path.endsWith(".css"));
for (const file of stylesheets) {
  const css = await file.text();
  const fonts: [string, Buffer][] = [];
  const rewritten = css.replace(INLINE_FONT, (_, ext: string, data: string) => {
    const bytes = Buffer.from(data, "base64");
    const name = `assets/font-${Bun.hash(bytes).toString(36)}.${ext}`;
    fonts.push([name, bytes]);
    return `url(/${name})`;
  });
  for (const [name, bytes] of fonts) await Bun.write(`${out}/${name}`, bytes);
  await Bun.write(file.path, rewritten);
}

const staff: string[] = [];
const open: string[] = [];
for (const file of result.outputs) {
  const name = relative(file.path);
  if (!name.endsWith(".js")) continue;
  const isStaff = (await file.text()).includes(STAFF_BUNDLE_MARK);
  (isStaff ? staff : open).push(name);
}

// staff code must not be in what everyone downloads: stop if that cannot be shown
if (!staff.length) die("Build failed: no file carries the staff portal mark, so it cannot be walled off.");
const html = await Bun.file(`${out}/index.html`).text();
const leaked = staff.filter((name) => html.includes(name));
if (leaked.length) die(`Build failed: the page loads staff-only files for everyone: ${leaked.join(", ")}`);

// the portal styles itself with utilities from the main stylesheet, so nothing loads a second one
const unloaded = result.outputs.map((f) => relative(f.path)).filter((n) => n.endsWith(".css") && !html.includes(n));
if (unloaded.length) die(`Build failed: nothing loads these stylesheets: ${unloaded.join(", ")}`);
const shell = /<!--app-shell-->[\s\S]*?<!--\/app-shell-->/;
if (!shell.test(html)) die("Build failed: the guest home shell is missing its insertion point.");
const appStylesheet = stylesheets.find((file) => html.includes(relative(file.path)));
if (!appStylesheet) die("Build failed: the guest home shell cannot find the app stylesheet.");
const css = await Bun.file(appStylesheet.path).text();
const faceRules = css.match(/@font-face\{[^}]*\}/g) ?? [];
const criticalFaces = [];
for (const family of ["source-sans-3", "radio-canada"]) {
  const font = await Bun.file(
    `node_modules/@fontsource-variable/${family}/files/${family}-latin-wght-normal.woff2`
  ).arrayBuffer();
  const path = `/assets/font-${Bun.hash(font).toString(36)}.woff2`;
  const face = faceRules.find((rule) => rule.includes(path));
  if (!face) die(`Build failed: missing Latin font face for ${family}.`);
  criticalFaces.push({ path, face });
}
const critical = await Promise.all([
  Bun.file("scripts/home-shell.css").text(),
  Bun.file("src/pages/music/home-hero.css").text(),
]);
const preload = criticalFaces.map(
  ({ path }) => `<link rel="preload" href="${path}" as="font" type="font/woff2" crossorigin>`
);
const styleLink = /<link rel="stylesheet"[^>]+>/;
const deferredStyle = `<link id="app-styles" media="print" onload="this.media='all'" onerror="this.media='all'" `;
if (!styleLink.test(html)) die("Build failed: the guest home shell cannot find the app stylesheet.");
await Bun.write(
  `${out}/home.html`,
  html
    .replace(shell, () => guestHomeShell())
    .replace(
      styleLink,
      (link) =>
        `${preload.join("")}<style>${criticalFaces.map(({ face }) => face).join("")}${critical.join("")}</style>` +
        `${link.replace("<link ", deferredStyle)}<noscript>${link}</noscript>`
    )
);
await Bun.write(`${out}/staff.json`, JSON.stringify({ scripts: staff }));
await Bun.write(`${out}/assets/social-card.png`, Bun.file("brand/social-card.png"));

const size = (names: string[]) => {
  const bytes = names.reduce((n, f) => n + Bun.file(`${out}/${f}`).size, 0);
  return `${(bytes / 1024).toFixed(0)} KB`;
};
const plural = staff.length === 1 ? "" : "s";
console.log(
  `built ${result.outputs.length} files: app ${size(open)}, staff portal ${size(staff)} (${staff.length} file${plural})`
);
