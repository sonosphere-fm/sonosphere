import { type Canvas, createCanvas, GlobalFonts, Image, type SKRSContext2D } from "@napi-rs/canvas";
import { readdirSync } from "node:fs";
import { join } from "node:path";

export type RenderCell = {
  index: number;
  top: string | null;
  bottom: string | null;
  plays: string | null;
  image: string | null;
  censored: boolean;
  nsfw: boolean;
};

export type RenderJob = {
  width: number;
  height: number;
  cellSize: number;
  titles: "titles" | "plays" | "none";
  artistChart: boolean;
  rainbow: boolean;
  skipWithoutImage: boolean;
  skipNsfw: boolean;
  labels: { censored: string; noImage: string };
  cells: RenderCell[];
};

const BASE_CELL_SIZE = 300;
const FONT_SCALE = 1.11;
const FAMILY = "Source Sans 3 Variable";
const RAINBOW_SATURATION_THRESHOLD = 0.15;

type Rgb = { r: number; g: number; b: number };
type Ctx = SKRSContext2D;

function registerFonts(dir: string) {
  for (const file of readdirSync(dir)) {
    if (file.endsWith("-wght-normal.woff2")) GlobalFonts.registerFromPath(join(dir, file), FAMILY);
  }
}

function decode(base64: string | null): Image | null {
  if (!base64) return null;
  try {
    const image = new Image();
    image.src = Buffer.from(base64, "base64");
    return image.width && image.height ? image : null;
  } catch {
    return null;
  }
}

function setFont(ctx: Ctx, size: number) {
  ctx.font = `${Math.max(1, size * FONT_SCALE).toFixed(2)}px "${FAMILY}", sans-serif`;
}

function measure(ctx: Ctx, text: string) {
  const metrics = ctx.measureText(text);
  const ascent = metrics.actualBoundingBoxAscent || 0;
  const descent = metrics.actualBoundingBoxDescent || 0;
  return { width: metrics.width, ascent, top: -ascent, height: ascent + descent || metrics.width * 0.8 };
}

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

function fitText(ctx: Ctx, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  const graphemes = [...segmenter.segment(text)].map((entry) => entry.segment);
  let low = 0;
  let high = graphemes.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (ctx.measureText(`${graphemes.slice(0, mid).join("").trimEnd()}…`).width <= maxWidth) low = mid;
    else high = mid - 1;
  }
  return `${graphemes.slice(0, low).join("").trimEnd()}…`;
}

function placeholder(ctx: Ctx, size: number, text: string, censored: boolean) {
  ctx.fillStyle = censored ? "#1b1b1f" : "#3c3a40";
  ctx.fillRect(0, 0, size, size);
  setFont(ctx, (20 * size) / BASE_CELL_SIZE / FONT_SCALE);
  ctx.fillStyle = censored ? "#f08b86" : "#c9c6c1";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(fitText(ctx, text, size * 0.9), size / 2, size / 2);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

/** Contain for albums, cover for artists, centred either way. */
function drawFitted(ctx: Ctx, image: Image, size: number, cover: boolean) {
  const { width, height } = image;
  const ratio = width / height;
  if (cover) {
    const side = Math.min(width, height);
    ctx.drawImage(image, (width - side) / 2, (height - side) / 2, side, side, 0, 0, size, size);
    return;
  }
  const dw = ratio < 1 ? size * ratio : size;
  const dh = ratio > 1 ? size / ratio : size;
  ctx.drawImage(image, (size - dw) / 2, (size - dh) / 2, dw, dh);
}

function textColorFor(ctx: Ctx, size: number): "black" | "white" {
  const startY = Math.floor((size * 3) / 4);
  const data = ctx.getImageData(0, startY, size, size - startY).data;
  const pixels = data.length / 4;
  if (!pixels) return "white";
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i]!;
    g += data[i + 1]!;
    b += data[i + 2]!;
  }
  r /= pixels;
  g /= pixels;
  b /= pixels;
  return Math.sqrt(r * r * 0.299 + g * g * 0.587 + b * b * 0.114) > 130 ? "black" : "white";
}

function dominantColor(ctx: Ctx, size: number): Rgb | null {
  const data = ctx.getImageData(0, 0, size, size).data;
  const step = Math.max(1, Math.ceil(size / 64));
  const bins = new Map<number, Rgb & { count: number }>();
  let total = 0;
  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      const i = (y * size + x) * 4;
      if (data[i + 3]! < 10) continue;
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      const key = ((r >> 5) << 16) | ((g >> 5) << 8) | (b >> 5);
      const bin = bins.get(key) ?? { r: 0, g: 0, b: 0, count: 0 };
      bin.r += r;
      bin.g += g;
      bin.b += b;
      bin.count += 1;
      bins.set(key, bin);
      total += 1;
    }
  }
  let best: Rgb | null = null;
  let bestScore = -1;
  for (const bin of bins.values()) {
    const r = bin.r / bin.count;
    const g = bin.g / bin.count;
    const b = bin.b / bin.count;
    const chroma = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
    const score = (bin.count / total) * (1 + chroma * 3);
    if (score > bestScore) {
      bestScore = score;
      best = { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
    }
  }
  return best;
}

function hsl({ r, g, b }: Rgb) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  const lightness = (max + min) / 2;
  if (!delta) return { hue: 0, saturation: 0, lightness };
  let hue = max === rn ? ((gn - bn) / delta) % 6 : max === gn ? (bn - rn) / delta + 2 : (rn - gn) / delta + 4;
  hue *= 60;
  if (hue < 0) hue += 360;
  return { hue, saturation: delta / (1 - Math.abs(2 * lightness - 1)), lightness };
}

type Drawn = { canvas: Canvas; cell: RenderCell; valid: boolean; color: Rgb | null };

function rainbowSort(cells: Drawn[]): Drawn[] {
  const chromatic: { cell: Drawn; hue: number; lightness: number }[] = [];
  const achromatic: { cell: Drawn; lightness: number }[] = [];
  for (const cell of cells) {
    if (!cell.color) {
      achromatic.push({ cell, lightness: 0 });
      continue;
    }
    const { hue, saturation, lightness } = hsl(cell.color);
    if (saturation < RAINBOW_SATURATION_THRESHOLD) achromatic.push({ cell, lightness });
    else chromatic.push({ cell, hue, lightness });
  }
  chromatic.sort((a, b) => a.hue - b.hue || a.lightness - b.lightness);
  achromatic.sort((a, b) => a.lightness - b.lightness);
  return [...chromatic.map((entry) => entry.cell), ...achromatic.map((entry) => entry.cell)];
}

function addTitle(ctx: Ctx, size: number, scale: number, top: string | null, bottom: string | null) {
  const textColor = textColorFor(ctx, size);
  const backdrop = textColor === "black" ? "255, 255, 255" : "0, 0, 0";
  let fontSize = 17 * scale;
  setFont(ctx, fontSize);
  if ((bottom && measure(ctx, bottom).width > size) || (top && measure(ctx, top).width > size)) {
    fontSize -= 5 * scale;
    setFont(ctx, fontSize);
  }
  const topBounds = top ? measure(ctx, top) : null;
  const bottomBounds = bottom ? measure(ctx, bottom) : null;
  const widest = Math.max(topBounds?.width ?? 0, bottomBounds?.width ?? 0);
  const left = (size - widest) / 2 - 6 * scale;
  const right = (size + widest) / 2 + 6 * scale;
  const rectTop = bottom ? size - 44 * scale : size - 23 * scale;

  ctx.fillStyle = `rgba(${backdrop}, ${(140 / 255).toFixed(3)})`;
  ctx.beginPath();
  ctx.roundRect(left, rectTop, right - left, size - 1 - rectTop, 4 * scale);
  ctx.fill();

  ctx.fillStyle = textColor;
  ctx.textAlign = "center";
  if (top && topBounds) ctx.fillText(top, size / 2, size - (bottom ? 39 : 20) * scale - topBounds.top);
  if (bottom && bottomBounds) ctx.fillText(bottom, size / 2, size - 20 * scale - bottomBounds.top);
  ctx.textAlign = "left";
}

function addFadeTitle(
  ctx: Ctx,
  size: number,
  scale: number,
  top: string | null,
  bottom: string | null,
  plays: string | null
) {
  const fadeHeight = (bottom ? 104 : 80) * scale;
  const fadeTop = size - fadeHeight;
  const gradient = ctx.createLinearGradient(0, fadeTop, 0, size);
  gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
  gradient.addColorStop(0.35, `rgba(0, 0, 0, ${(110 / 255).toFixed(3)})`);
  gradient.addColorStop(0.65, `rgba(0, 0, 0, ${(170 / 255).toFixed(3)})`);
  gradient.addColorStop(1, `rgba(0, 0, 0, ${(215 / 255).toFixed(3)})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, fadeTop, size, fadeHeight);

  ctx.shadowColor = `rgba(0, 0, 0, ${(150 / 255).toFixed(3)})`;
  ctx.shadowBlur = 2 * scale;
  ctx.shadowOffsetY = 1 * scale;

  let y = size - 9 * scale;
  const left = 10 * scale;
  const maxWidth = size - left * 2;
  if (plays) {
    setFont(ctx, 13 * scale);
    ctx.fillStyle = `rgba(255, 255, 255, ${(185 / 255).toFixed(3)})`;
    const digitHeight = measure(ctx, "0").height;
    ctx.fillText(fitText(ctx, plays, maxWidth), left, y);
    y -= digitHeight + 8.5 * scale;
  }
  if (bottom) {
    setFont(ctx, 15 * scale);
    ctx.fillStyle = `rgba(255, 255, 255, ${(225 / 255).toFixed(3)})`;
    const capHeight = measure(ctx, "H").ascent;
    ctx.fillText(fitText(ctx, bottom, maxWidth), left, y);
    y -= capHeight + 7.5 * scale;
  }
  if (top) {
    setFont(ctx, 17 * scale);
    ctx.fillStyle = "rgb(255, 255, 255)";
    ctx.fillText(fitText(ctx, top, maxWidth), left, y);
  }
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

export async function render(job: RenderJob): Promise<{ jpeg: Buffer; drawn: number }> {
  const size = job.cellSize;
  const scale = size / BASE_CELL_SIZE;
  const drawn: Drawn[] = job.cells.map((cell) => {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext("2d");
    const image = cell.censored ? null : decode(cell.image);
    if (image) drawFitted(ctx, image, size, job.artistChart);
    else if (cell.censored) placeholder(ctx, size, job.labels.censored, true);
    else placeholder(ctx, size, [cell.top, cell.bottom].filter(Boolean).join(" - ") || job.labels.noImage, false);

    if (scale >= 0.4 && job.titles === "titles") addTitle(ctx, size, scale, cell.top, cell.bottom);
    if (scale >= 0.4 && job.titles === "plays") addFadeTitle(ctx, size, scale, cell.top, cell.bottom, cell.plays);
    return { canvas, cell, valid: !!image, color: job.rainbow ? dominantColor(ctx, size) : null };
  });

  const kept = drawn.filter((d) => (!job.skipNsfw || !d.cell.nsfw) && (!job.skipWithoutImage || d.valid));
  const ordered = job.rainbow ? rainbowSort(kept) : kept.sort((a, b) => a.cell.index - b.cell.index);
  const count = Math.min(job.width * job.height, ordered.length);

  const output = createCanvas(size * job.width, size * job.height);
  const ctx = output.getContext("2d");
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, output.width, output.height);
  for (let i = 0; i < count; i++) {
    ctx.drawImage(ordered[i]!.canvas, (i % job.width) * size, Math.floor(i / job.width) * size);
  }
  return { jpeg: await output.encode("jpeg", 90), drawn: count };
}

if (import.meta.main) {
  registerFonts(process.argv[2]!);
  const job: RenderJob = JSON.parse(await Bun.stdin.text());
  const { jpeg, drawn } = await render(job);
  process.stdout.write(JSON.stringify({ drawn, jpeg: jpeg.toString("base64") }));
}
