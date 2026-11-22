import { join } from "node:path";
import { fail } from "../http";
import { SIZES } from "./convert";

export type Converted = { width: number; height: number; large: Uint8Array; small: Uint8Array };
type ChildResult = { error?: string; width: number; height: number; large: string; small: string };

export function sniff(b: Uint8Array): "jpeg" | "png" | "webp" | "gif" | null {
  const at = (i: number, ...v: number[]) => v.every((x, j) => b[i + j] === x);
  if (at(0, 0xff, 0xd8, 0xff)) return "jpeg";
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "png";
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return "webp";
  if (at(0, 0x47, 0x49, 0x46, 0x38) && (at(4, 0x37, 0x61) || at(4, 0x39, 0x61))) return "gif";
  return null;
}

const SCRIPT = join(import.meta.dir, "convert.ts");
const TIME_LIMIT_MS = 30_000;
const MAX_RUNNING = 2;
const PROCESSING_FAILED = "The picture could not be processed. Try again.";

const REASONS: Record<string, string> = {
  ERR_IMAGE_TOO_MANY_PIXELS: "That image is too large. Use one under 40 megapixels.",
  ERR_IMAGE_UNKNOWN_FORMAT: "Upload a PNG, JPEG, WebP or GIF image",
  ERR_IMAGE_FORMAT_UNSUPPORTED: "Upload a PNG, JPEG, WebP or GIF image",
};

let running = 0;
const waiting: (() => void)[] = [];

async function slot<T>(job: () => Promise<T>): Promise<T> {
  if (running >= MAX_RUNNING) await new Promise<void>((resolve) => waiting.push(resolve));
  running++;
  try {
    return await job();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

// Decoders are a classic way in for malicious files, so decoding runs in a separate process with no environment.
async function runChild(input: Uint8Array): Promise<ChildResult> {
  const child = Bun.spawn([process.execPath, SCRIPT], {
    stdin: input,
    stdout: "pipe",
    stderr: "pipe",
    env: { PATH: "/usr/bin:/bin", BUN_RUNTIME_TRANSPILER_CACHE_PATH: "0", HOME: "/tmp" },
    timeout: TIME_LIMIT_MS,
    killSignal: "SIGKILL",
  });
  const [text, err, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (code !== 0 || !text) {
    console.error("image conversion failed:", code, err.trim().slice(0, 300));
    fail(500, PROCESSING_FAILED);
  }
  return JSON.parse(text);
}

const isWebp = (base64: string) => sniff(Buffer.from(base64.slice(0, 24), "base64")) === "webp";
const isEdge = (n: unknown) => Number.isInteger(n) && (n as number) > 0 && (n as number) <= SIZES.large;

export async function convert(input: Uint8Array): Promise<Converted> {
  if (!sniff(input)) fail(400, "Upload a PNG, JPEG, WebP or GIF image");
  const out = await slot(() => runChild(input));
  if (out.error) fail(400, REASONS[out.error] ?? "That file could not be read as an image");
  if (!isEdge(out.width) || !isEdge(out.height) || !isWebp(out.large) || !isWebp(out.small))
    fail(500, PROCESSING_FAILED);
  return {
    width: out.width,
    height: out.height,
    large: Buffer.from(out.large, "base64"),
    small: Buffer.from(out.small, "base64"),
  };
}
