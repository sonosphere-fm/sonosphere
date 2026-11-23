/** Keep encoded pixels/animation, discard WebP EXIF, XMP and color-profile chunks. */
export function stripWebpMetadata(input: Uint8Array): Uint8Array {
  const bytes = Buffer.from(input);
  const chunks: Buffer[] = [];
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const kind = bytes.toString("ascii", offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const end = offset + 8 + size + (size & 1);
    if (end > bytes.length) throw new Error("Truncated WebP chunk");
    if (!["EXIF", "XMP ", "ICCP"].includes(kind)) {
      const chunk = Buffer.from(bytes.subarray(offset, end));
      if (kind === "VP8X" && size >= 10) chunk[8] &= ~0x2c;
      chunks.push(chunk);
    }
    offset = end;
  }
  if (offset !== bytes.length) throw new Error("Invalid WebP container");
  const header = Buffer.from(bytes.subarray(0, 12));
  header.writeUInt32LE(4 + chunks.reduce((sum, chunk) => sum + chunk.length, 0), 4);
  return Buffer.concat([header, ...chunks]);
}

/** GIF has no standard EXIF; remove comments and application metadata, retaining only loop control. */
export function stripGifMetadata(input: Uint8Array): Uint8Array {
  const bytes = Buffer.from(input);
  if (bytes.length < 13) throw new Error("Truncated GIF header");
  let offset = 13 + (bytes[10] & 0x80 ? 3 * (1 << ((bytes[10] & 7) + 1)) : 0);
  const chunks: Buffer[] = [bytes.subarray(0, offset)];
  const subBlocks = () => {
    for (;;) {
      if (offset >= bytes.length) throw new Error("Truncated GIF data");
      const size = bytes[offset++];
      if (offset + size > bytes.length) throw new Error("Truncated GIF block");
      offset += size;
      if (!size) return;
    }
  };
  while (offset < bytes.length) {
    const start = offset;
    const marker = bytes[offset++];
    if (marker === 0x3b) {
      chunks.push(bytes.subarray(start, offset));
      return Buffer.concat(chunks);
    }
    if (marker === 0x21) {
      const label = bytes[offset++];
      const application = bytes.toString("ascii", offset + 1, offset + 12);
      subBlocks();
      const loop =
        label === 0xff &&
        bytes[start + 2] === 11 &&
        ["NETSCAPE2.0", "ANIMEXTS1.0"].includes(application) &&
        offset - start === 19 &&
        bytes[start + 14] === 3 &&
        bytes[start + 15] === 1;
      if (label === 0xf9 || loop) chunks.push(bytes.subarray(start, offset));
    } else if (marker === 0x2c) {
      if (offset + 9 > bytes.length) throw new Error("Truncated GIF frame");
      const packed = bytes[offset + 8];
      offset += 9 + (packed & 0x80 ? 3 * (1 << ((packed & 7) + 1)) : 0);
      offset++; // LZW minimum code size
      subBlocks();
      chunks.push(bytes.subarray(start, offset));
    } else {
      throw new Error("Invalid GIF block");
    }
  }
  throw new Error("Missing GIF trailer");
}
