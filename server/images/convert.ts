// Turns one uploaded picture into the WebP files the site serves. Runs as a short-lived child process of its own
// (see process.ts), sandboxed in production, because image decoders are a classic place for malicious files to break
// in: if one did, it would land in a process with no network, no writable disk, a memory cap and a few seconds to live.
// Reads the upload on stdin and writes JSON to stdout: { width, height, large, small } with the files in base64.
// Re-encoding also drops everything but the pixels: camera metadata, GPS positions, embedded profiles, extra frames.
const Image = Bun.Image;
Image.backend = "bun"; // Bun's own bundled decoders (JPEG, PNG, WebP, GIF...), never codecs from the system

export const MAX_PIXELS = 40_000_000; // checked from the file's header, before any pixel memory is allocated
export const SIZES = { large: 1200, small: 300 } as const;

async function convert(input: Uint8Array) {
  const opts = { maxPixels: MAX_PIXELS, autoOrient: true };
  const meta = await new Image(input, opts).metadata();
  const out = async (edge: number, quality: number) =>
    new Image(input, opts).resize(edge, edge, { fit: "inside", withoutEnlargement: true }).webp({ quality }).bytes();
  const [large, small] = [await out(SIZES.large, 82), await out(SIZES.small, 78)];
  const shape = await new Image(large, opts).metadata(); // the size as stored, after any rotation and shrinking
  return { width: shape.width, height: shape.height, source: meta.format, large: Buffer.from(large).toString("base64"), small: Buffer.from(small).toString("base64") };
}

if (import.meta.main) {
  try {
    const input = new Uint8Array(await Bun.stdin.arrayBuffer());
    process.stdout.write(JSON.stringify(await convert(input)));
  } catch (e) {
    process.stdout.write(JSON.stringify({ error: (e as { code?: string }).code || "ERR_IMAGE_DECODE_FAILED" }));
  }
}
