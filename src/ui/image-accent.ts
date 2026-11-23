/** Sample a small first frame; rank quantized colors by coverage and chroma. */
export async function imageAccents(url: string): Promise<string[]> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = url;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Your browser could not read the picture.");
  ctx.drawImage(image, 0, 0, 64, 64);
  const pixels = ctx.getImageData(0, 0, 64, 64).data;
  const bins = new Map<number, { count: number; r: number; g: number; b: number }>();
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    const [r, g, b] = [pixels[i], pixels[i + 1], pixels[i + 2]];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bin = bins.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    bin.count++;
    bin.r += r;
    bin.g += g;
    bin.b += b;
    bins.set(key, bin);
  }
  const colors = [...bins.values()]
    .map((bin) => {
      const rgb = [bin.r, bin.g, bin.b].map((v) => Math.round(v / bin.count));
      const max = Math.max(...rgb);
      const min = Math.min(...rgb);
      const useful = max > 35 && min < 225;
      return { rgb, score: bin.count * (1 + (max - min) / 64) * (useful ? 1 : 0.05) };
    })
    .sort((a, b) => b.score - a.score);
  if (!colors.length) throw new Error("That picture has no visible colors.");
  const first = colors[0];
  const second = colors.find(({ rgb }) => rgb.reduce((sum, v, i) => sum + (v - first.rgb[i]) ** 2, 0) > 6400) ?? first;
  return [first, second].map(({ rgb }) => "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join(""));
}
