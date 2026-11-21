// Checks an upload and turns it into the WebP files the site stores. The file's type is decided from its first bytes,
// never from what the browser claims, and only JPEG, PNG, WebP and GIF get as far as a decoder. Decoding then happens
// in convert.ts, in a child process: on Linux under root it runs as a throwaway systemd unit (no network, read-only
// disk, an unprivileged user that exists only for that run, capped memory, CPU and time), elsewhere as a plain child
// process with a time limit. At most two run at once per site process.
import { realpathSync } from "node:fs";
import { join } from "node:path";
import { fail } from "../http";
import { SIZES } from "./convert";

export type Converted = { width: number; height: number; large: Uint8Array; small: Uint8Array };

/** The upload's real type from its signature, or null for anything that is not one of the accepted formats. */
export function sniff(b: Uint8Array): "jpeg" | "png" | "webp" | "gif" | null {
  const at = (i: number, ...v: number[]) => v.every((x, j) => b[i + j] === x);
  if (at(0, 0xff, 0xd8, 0xff)) return "jpeg";
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "png";
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return "webp"; // RIFF....WEBP
  if (at(0, 0x47, 0x49, 0x46, 0x38) && (at(4, 0x37, 0x61) || at(4, 0x39, 0x61))) return "gif"; // GIF87a, GIF89a
  return null;
}

const SCRIPT = join(import.meta.dir, "convert.ts");
const TIME_LIMIT = 30;
// The sandbox needs systemd and the right to start units (root, as the site runs). IMAGE_SANDBOX=off turns it off.
const sandboxed = process.platform === "linux" && process.getuid?.() === 0 && !!Bun.which("systemd-run") && process.env.IMAGE_SANDBOX !== "off";
// Bun may live in root's home, which the throwaway user cannot enter: it is mounted read-only at a neutral path instead.
const BUN = realpathSync(process.execPath);
const SANDBOX = [
  "systemd-run", "--quiet", "--pipe", "--wait", "--collect",
  ...[
    "DynamicUser=yes", "PrivateNetwork=yes", "IPAddressDeny=any", "RestrictAddressFamilies=AF_UNIX",
    "PrivateTmp=yes", "PrivateDevices=yes", "ProtectSystem=strict", "ProtectHome=yes", `BindReadOnlyPaths=${BUN}:/run/spin-bun`,
    "NoNewPrivileges=yes", "CapabilityBoundingSet=", "RestrictNamespaces=yes", "LockPersonality=yes",
    "ProtectKernelTunables=yes", "ProtectKernelModules=yes", "ProtectControlGroups=yes",
    "SystemCallFilter=@system-service", "SystemCallArchitectures=native",
    "MemoryMax=768M", "MemorySwapMax=0", "TasksMax=32", "CPUQuota=100%", `RuntimeMaxSec=${TIME_LIMIT}`,
  ].flatMap(p => ["-p", p]),
  "-E", "BUN_RUNTIME_TRANSPILER_CACHE_PATH=0", "-E", "HOME=/tmp",
  // systemd-run looks for the program before the sandbox exists, so a shell inside it starts Bun from the mounted path
  "/bin/sh", "-c", 'exec /run/spin-bun "$0"', SCRIPT,
];
const PLAIN = [process.execPath, SCRIPT];

let running = 0;
const waiting: (() => void)[] = [];
async function slot<T>(job: () => Promise<T>): Promise<T> {
  if (running >= 2) await new Promise<void>(r => waiting.push(r));
  running++;
  try { return await job(); } finally { running--; waiting.shift()?.(); }
}

const REASONS: Record<string, string> = {
  ERR_IMAGE_TOO_MANY_PIXELS: "That image is too large. Use one under 40 megapixels.",
  ERR_IMAGE_UNKNOWN_FORMAT: "Upload a PNG, JPEG, WebP or GIF image",
  ERR_IMAGE_FORMAT_UNSUPPORTED: "Upload a PNG, JPEG, WebP or GIF image",
};

/** Decodes the upload in a child process and returns the full-size and small WebP files. Throws a 400 for files that
 *  are not usable pictures. */
export async function convert(input: Uint8Array): Promise<Converted> {
  if (!sniff(input)) fail(400, "Upload a PNG, JPEG, WebP or GIF image");
  const out = await slot(async () => {
    const child = Bun.spawn(sandboxed ? SANDBOX : PLAIN, {
      stdin: input, stdout: "pipe", stderr: "pipe",
      env: { PATH: "/usr/bin:/bin", BUN_RUNTIME_TRANSPILER_CACHE_PATH: "0", HOME: process.env.TMPDIR || "/tmp" },
      timeout: (TIME_LIMIT + 5) * 1000, killSignal: "SIGKILL",
    });
    const [text, err, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    if (code !== 0 || !text) { console.error("image conversion failed:", code, err.trim().slice(0, 300)); fail(500, "The picture could not be processed. Try again."); }
    return JSON.parse(text) as { error?: string; width: number; height: number; large: string; small: string };
  });
  if (out.error) fail(400, REASONS[out.error] ?? "That file could not be read as an image");
  const ok = (n: unknown) => Number.isInteger(n) && (n as number) > 0 && (n as number) <= SIZES.large;
  // what comes back is checked too: it is stored and served as WebP, so it has to be WebP
  if (!ok(out.width) || !ok(out.height) || sniff(Buffer.from(out.large.slice(0, 24), "base64")) !== "webp" || sniff(Buffer.from(out.small.slice(0, 24), "base64")) !== "webp") fail(500, "The picture could not be processed. Try again.");
  return { width: out.width, height: out.height, large: Buffer.from(out.large, "base64"), small: Buffer.from(out.small, "base64") };
}
