import { locale, t } from "../i18n";
import { CHART, TitleSetting } from "./constants";
import { mapWithConcurrency } from "./metadata";
import type { ChartItem, ChartSettings } from "./options";

/** Exact port of ChartRenderer.GetCellSize. */
export function getCellSize(width: number, height: number): number {
  const longestSide = Math.max(1, width, height);
  let cellSize = Math.min(
    CHART.MAX_CELL_SIZE,
    Math.max(CHART.MIN_CELL_SIZE, Math.floor(CHART.MAX_CHART_SIZE / longestSide))
  );
  if (longestSide * cellSize > CHART.MAX_PIXEL_DIMENSION) {
    cellSize = Math.max(1, Math.floor(CHART.MAX_PIXEL_DIMENSION / longestSide));
  }
  return cellSize;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function placeholderDataUri(label: string, kind: "unknown" | "censored"): string {
  const censored = kind === "censored";
  const text = escapeXml(
    censored ? t("music.chartCensored") : String(label || "").slice(0, 42) || t("music.chartNoImage")
  );
  const background = censored ? "#1b1b1f" : "#3c3a40";
  const foreground = censored ? "#f08b86" : "#c9c6c1";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">` +
    `<rect width="300" height="300" fill="${background}"/>` +
    `<text x="150" y="150" fill="${foreground}" font-family="sans-serif" font-size="20" ` +
    `text-anchor="middle" dominant-baseline="middle">${text}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function imageUrlFor(item: ChartItem): string | null {
  return item.coverUrl || item.fallbackImageUrl || null;
}

function coverUrlCandidates(url: string | null): string[] {
  if (!url) return [];
  const candidates = [url];
  const match = /^(https:\/\/[a-z-]*lastfm[a-z-]*\.freetls\.fastly\.net\/i\/u\/)([0-9a-f]+\.[a-z]+)$/.exec(url);
  if (match) candidates.push(`${match[1]}ar0/${match[2]}`);
  return candidates;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load image: ${url}`));
    image.src = url;
  });
}

async function loadCover(item: ChartItem, artistChart: boolean) {
  for (const candidate of coverUrlCandidates(imageUrlFor(item))) {
    try {
      return { image: await loadImage(candidate), validImage: true };
    } catch {
      // Try the ar0/ variant, then a generated placeholder.
    }
  }
  const label = artistChart ? item.artistName : `${item.artistName} — ${item.albumName}`;
  return { image: await loadImage(placeholderDataUri(label, "unknown")), validImage: false };
}

/** Port of AccentColors.TextColorFor: average of the bottom quarter. */
function textColorFor(ctx: CanvasRenderingContext2D, cellSize: number): "black" | "white" {
  const startY = Math.floor((cellSize * 3) / 4);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, startY, cellSize, cellSize - startY).data;
  } catch {
    return "white";
  }
  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  const totalPixels = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    totalR += data[i];
    totalG += data[i + 1];
    totalB += data[i + 2];
  }
  if (!totalPixels) return "white";
  const avgR = totalR / totalPixels;
  const avgG = totalG / totalPixels;
  const avgB = totalB / totalPixels;
  const brightness = Math.sqrt(avgR * avgR * 0.299 + avgG * avgG * 0.587 + avgB * avgB * 0.114);
  return brightness > 130 ? "black" : "white";
}

type Rgb = { r: number; g: number; b: number };

/** Port of AccentColors.FromBitmap (quantised dominant colour). */
function dominantColor(ctx: CanvasRenderingContext2D, cellSize: number): Rgb | null {
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, cellSize, cellSize).data;
  } catch {
    return null;
  }
  const step = Math.max(1, Math.ceil(cellSize / 64));
  const bins = new Map<number, Rgb & { count: number }>();
  let totalPixels = 0;
  for (let y = 0; y < cellSize; y += step) {
    for (let x = 0; x < cellSize; x += step) {
      const index = (y * cellSize + x) * 4;
      if (data[index + 3] < 10) continue;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const key = ((r >> 5) << 16) | ((g >> 5) << 8) | (b >> 5);
      const bin = bins.get(key) || { r: 0, g: 0, b: 0, count: 0 };
      bin.r += r;
      bin.g += g;
      bin.b += b;
      bin.count += 1;
      bins.set(key, bin);
      totalPixels += 1;
    }
  }
  if (!totalPixels) return null;

  let best: Rgb | null = null;
  let bestScore = -1;
  for (const bin of bins.values()) {
    const avgR = bin.r / bin.count;
    const avgG = bin.g / bin.count;
    const avgB = bin.b / bin.count;
    const chroma = (Math.max(avgR, avgG, avgB) - Math.min(avgR, avgG, avgB)) / 255;
    const score = (bin.count / totalPixels) * (1 + chroma * 3);
    if (score > bestScore) {
      bestScore = score;
      best = { r: Math.round(avgR), g: Math.round(avgG), b: Math.round(avgB) };
    }
  }
  return best;
}

function rgbToHsl(color: Rgb) {
  const rn = color.r / 255;
  const gn = color.g / 255;
  const bn = color.b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  const lightness = (max + min) / 2;
  let hue = 0;
  let saturation = 0;
  if (delta !== 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    if (max === rn) hue = ((gn - bn) / delta) % 6;
    else if (max === gn) hue = (bn - rn) / delta + 2;
    else hue = (rn - gn) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  return { hue, saturation, lightness };
}

type Cell = {
  canvas: HTMLCanvasElement;
  index: number;
  validImage: boolean;
  primaryColor: Rgb | null;
  nsfw: boolean;
  censored: boolean;
};

/** Port of ChartRenderer.RainbowSort. */
function rainbowSort(images: Cell[]): Cell[] {
  const chromatic: { image: Cell; hue: number; lightness: number }[] = [];
  const achromatic: { image: Cell; lightness: number }[] = [];
  for (const image of images) {
    if (!image.primaryColor) {
      achromatic.push({ image, lightness: 0 });
      continue;
    }
    const hsl = rgbToHsl(image.primaryColor);
    if (hsl.saturation < CHART.RAINBOW_SATURATION_THRESHOLD) {
      achromatic.push({ image, lightness: hsl.lightness });
    } else {
      chromatic.push({ image, hue: hsl.hue, lightness: hsl.lightness });
    }
  }
  chromatic.sort((a, b) => a.hue - b.hue || a.lightness - b.lightness);
  achromatic.sort((a, b) => a.lightness - b.lightness);
  return [...chromatic.map((entry) => entry.image), ...achromatic.map((entry) => entry.image)];
}

function setFont(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.font = `${Math.max(1, size * CHART.FONT_SCALE).toFixed(2)}px ${CHART.FONT_FAMILY}`;
}

function measure(ctx: CanvasRenderingContext2D, text: string) {
  const metrics = ctx.measureText(text);
  const ascent = metrics.actualBoundingBoxAscent || 0;
  const descent = metrics.actualBoundingBoxDescent || 0;
  return {
    width: metrics.width,
    ascent,
    top: -ascent,
    height: ascent + descent || metrics.width * 0.8,
  };
}

function textElements(text: string): string[] {
  if (typeof Intl.Segmenter !== "undefined") {
    const segmenter = new Intl.Segmenter(locale(), { granularity: "grapheme" });
    return [...segmenter.segment(text)].map((entry) => entry.segment);
  }
  return Array.from(text);
}

/** Port of FallbackFont.FitText: truncate with an ellipsis, never overflow. */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  const elements = textElements(text);
  let low = 0;
  let high = elements.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const candidate = `${elements.slice(0, mid).join("").trimEnd()}…`;
    if (ctx.measureText(candidate).width <= maxWidth) low = mid;
    else high = mid - 1;
  }
  return `${elements.slice(0, low).join("").trimEnd()}…`;
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    return;
  }
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** Port of ChartRenderer.AddTitleToChartImage. */
function addTitle(
  ctx: CanvasRenderingContext2D,
  cellSize: number,
  scale: number,
  topName: string | null,
  bottomName: string | null
): void {
  const textColor = textColorFor(ctx, cellSize);
  const rectangleColor = textColor === "black" ? "255, 255, 255" : "0, 0, 0";

  let fontSize = 17 * scale;
  setFont(ctx, fontSize);
  const tooWide =
    (bottomName && measure(ctx, bottomName).width > cellSize) || (topName && measure(ctx, topName).width > cellSize);
  if (tooWide) {
    fontSize -= 5 * scale;
    setFont(ctx, fontSize);
  }

  const topBounds = topName ? measure(ctx, topName) : null;
  const bottomBounds = bottomName ? measure(ctx, bottomName) : null;
  const widest = Math.max(topBounds?.width || 0, bottomBounds?.width || 0);
  const left = (cellSize - widest) / 2 - 6 * scale;
  const right = (cellSize + widest) / 2 + 6 * scale;
  const rectangleTop = bottomName ? cellSize - 44 * scale : cellSize - 23 * scale;

  ctx.fillStyle = `rgba(${rectangleColor}, ${(140 / 255).toFixed(3)})`;
  roundRectPath(ctx, left, rectangleTop, right - left, cellSize - 1 - rectangleTop, 4 * scale);
  ctx.fill();

  ctx.fillStyle = textColor;
  ctx.textAlign = "center";
  if (topName && topBounds)
    ctx.fillText(topName, cellSize / 2, cellSize - (bottomName ? 39 : 20) * scale - topBounds.top);
  if (bottomName && bottomBounds) ctx.fillText(bottomName, cellSize / 2, cellSize - 20 * scale - bottomBounds.top);
  ctx.textAlign = "left";
}

/** Port of ChartRenderer.AddFadeTitleToChartImage. */
function addFadeTitle(
  ctx: CanvasRenderingContext2D,
  cellSize: number,
  scale: number,
  topName: string | null,
  bottomName: string | null,
  plays: string | null
): void {
  const fadeHeight = (bottomName ? 104 : 80) * scale;
  const fadeTop = cellSize - fadeHeight;

  const gradient = ctx.createLinearGradient(0, fadeTop, 0, cellSize);
  gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
  gradient.addColorStop(0.35, `rgba(0, 0, 0, ${(110 / 255).toFixed(3)})`);
  gradient.addColorStop(0.65, `rgba(0, 0, 0, ${(170 / 255).toFixed(3)})`);
  gradient.addColorStop(1, `rgba(0, 0, 0, ${(215 / 255).toFixed(3)})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, fadeTop, cellSize, fadeHeight);

  ctx.shadowColor = `rgba(0, 0, 0, ${(150 / 255).toFixed(3)})`;
  ctx.shadowBlur = 2 * scale;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 1 * scale;

  let y = cellSize - 9 * scale;
  const left = 10 * scale;
  const maxWidth = cellSize - left * 2;

  if (plays) {
    setFont(ctx, 13 * scale);
    ctx.fillStyle = `rgba(255, 255, 255, ${(185 / 255).toFixed(3)})`;
    const digitHeight = measure(ctx, "0").height;
    ctx.fillText(fitText(ctx, plays, maxWidth), left, y);
    y -= digitHeight + 8.5 * scale;
  }

  if (bottomName) {
    setFont(ctx, 15 * scale);
    ctx.fillStyle = `rgba(255, 255, 255, ${(225 / 255).toFixed(3)})`;
    const capHeight = measure(ctx, "H").ascent;
    ctx.fillText(fitText(ctx, bottomName, maxWidth), left, y);
    y -= capHeight + 7.5 * scale;
  }

  if (topName) {
    setFont(ctx, 17 * scale);
    ctx.fillStyle = "rgb(255, 255, 255)";
    ctx.fillText(fitText(ctx, topName, maxWidth), left, y);
  }

  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

/** Port of the image fit/crop in ChartRenderer.PrepareChartImage. */
function drawFitted(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  cellSize: number,
  artistChart: boolean
): void {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const ratioBitmap = width / height;
  let sx = 0;
  let sy = 0;
  let sw = width;
  let sh = height;
  let dx = 0;
  let dy = 0;
  let dw = cellSize;
  let dh = cellSize;

  if (artistChart) {
    // object-fit: cover, centred
    sw = ratioBitmap > 1 ? height : width;
    sh = ratioBitmap < 1 ? width : height;
    sx = (width - sw) / 2;
    sy = (height - sh) / 2;
  } else {
    // object-fit: contain, centred
    dw = ratioBitmap < 1 ? cellSize * ratioBitmap : cellSize;
    dh = ratioBitmap > 1 ? cellSize / ratioBitmap : cellSize;
    dx = (cellSize - dw) / 2;
    dy = (cellSize - dh) / 2;
  }
  ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
}

function namesFor(item: ChartItem, settings: ChartSettings) {
  if (settings.artistChart) return { topName: item.artistName || null, bottomName: null };
  if (settings.filteredArtist) return { topName: item.albumName || null, bottomName: null };
  return { topName: item.artistName || null, bottomName: item.albumName || null };
}

export type RenderInfo = { cellSize: number; drawn: number; containsNsfw: boolean; censoredItems: number };

/** Port of ChartRenderer.GenerateChartAsync + EncodeChart, rendered to a canvas. */
export async function renderChart(
  settings: ChartSettings,
  output: HTMLCanvasElement,
  onProgress?: (stage: string, detail?: string) => void
): Promise<RenderInfo> {
  const cellSize = getCellSize(settings.width, settings.height);
  const scale = cellSize / CHART.BASE_CELL_SIZE;
  const items = settings.artistChart ? settings.artists : settings.albums;
  if (!items.length) throw new Error(t("music.chartNoItems"));

  const report = (stage: string, detail?: string) => onProgress?.(stage, detail);
  report(t("music.chartLoadingArt"), `0/${items.length}`);

  const loaded = await mapWithConcurrency(items, CHART.MAX_CONCURRENT_COVER_LOADS, async (item, index) => {
    let image: HTMLImageElement;
    let validImage = Boolean(imageUrlFor(item));
    if (item.censored) {
      image = await loadImage(placeholderDataUri("", "censored"));
      validImage = false;
    } else {
      const cover = await loadCover(item, settings.artistChart);
      image = cover.image;
      validImage = cover.validImage;
    }
    if (index % 5 === 0 || index === items.length - 1)
      report(t("music.chartLoadingArt"), `${index + 1}/${items.length}`);
    return { item, image, validImage };
  });

  const cells: Cell[] = [];
  for (const entry of loaded) {
    const cellCanvas = document.createElement("canvas");
    cellCanvas.width = cellSize;
    cellCanvas.height = cellSize;
    const ctx = cellCanvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error(t("music.chartNoCanvas"));
    drawFitted(ctx, entry.image, cellSize, settings.artistChart);

    const { topName, bottomName } = namesFor(entry.item, settings);
    const plays =
      settings.titleSetting === TitleSetting.TitlesWithPlays && entry.item.userPlaycount
        ? t("music.chartPlays", { count: entry.item.userPlaycount })
        : null;

    if (settings.titleSetting === TitleSetting.Titles && scale >= 0.4) {
      addTitle(ctx, cellSize, scale, topName, bottomName);
    } else if (settings.titleSetting === TitleSetting.TitlesWithPlays && scale >= 0.4) {
      addFadeTitle(ctx, cellSize, scale, topName, bottomName, plays);
    }

    cells.push({
      canvas: cellCanvas,
      index: entry.item.index,
      validImage: entry.validImage,
      primaryColor: settings.rainbowSortingEnabled ? dominantColor(ctx, cellSize) : null,
      nsfw: Boolean(entry.item.nsfw),
      censored: Boolean(entry.item.censored),
    });
  }

  const filtered = cells.filter(
    (cell) => (!settings.skipNsfw || !cell.nsfw) && (!settings.skipWithoutImage || cell.validImage)
  );
  const sorted = settings.rainbowSortingEnabled ? rainbowSort(filtered) : filtered.sort((a, b) => a.index - b.index);

  output.width = cellSize * settings.width;
  output.height = cellSize * settings.height;
  const context = output.getContext("2d");
  if (!context) throw new Error(t("music.chartNoCanvas"));
  // fmbot encodes to JPEG with alpha ignored, so letterboxed gaps appear black.
  context.fillStyle = "#000000";
  context.fillRect(0, 0, output.width, output.height);

  let containsNsfw = false;
  let censoredItems = 0;
  const drawn = Math.min(settings.imagesNeeded, sorted.length);
  for (let i = 0; i < drawn; i += 1) {
    const cell = sorted[i];
    context.drawImage(cell.canvas, (i % settings.width) * cellSize, Math.floor(i / settings.width) * cellSize);
    if (cell.nsfw) containsNsfw = true;
    if (cell.censored) censoredItems += 1;
  }

  settings.containsNsfw = containsNsfw;
  settings.censoredItems = censoredItems;
  return { cellSize, drawn, containsNsfw, censoredItems };
}
