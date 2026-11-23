const Image = Bun.Image;
Image.backend = "bun"; // Bun's bundled decoders, never system codecs

export const MAX_PIXELS = 40_000_000;
export const SIZES = { large: 1200, small: 300 } as const;

const OPTIONS = { maxPixels: MAX_PIXELS, autoOrient: true };

function webp(input: Uint8Array, edge: number, quality: number) {
  return new Image(input, OPTIONS)
    .resize(edge, edge, { fit: "inside", withoutEnlargement: true })
    .webp({ quality })
    .bytes();
}

async function convert(input: Uint8Array) {
  const large = stripWebpMetadata(await webp(input, SIZES.large, 82));
  const small = stripWebpMetadata(await webp(input, SIZES.small, 78));
  const { width, height } = await new Image(large, OPTIONS).metadata();
  return {
    width,
    height,
    large: Buffer.from(large).toString("base64"),
    small: Buffer.from(small).toString("base64"),
  };
}

if (import.meta.main) {
  try {
    const input = new Uint8Array(await Bun.stdin.arrayBuffer());
    process.stdout.write(JSON.stringify(await convert(input)));
  } catch (e) {
    const code = (e as { code?: string }).code ?? "ERR_IMAGE_DECODE_FAILED";
    process.stdout.write(JSON.stringify({ error: code }));
  }
}
import { stripWebpMetadata } from "./metadata";
