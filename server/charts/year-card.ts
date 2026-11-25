import { createCanvas, type Image, type SKRSContext2D } from "@napi-rs/canvas";
import { decode, drawFitted, fitText, registerFonts, setFont } from "./render";

export type CardJob = {
  name: string;
  title: string;
  plays: string;
  playsLabel: string;
  days: string;
  daysLabel: string;
  artistsLabel: string;
  tracksLabel: string;
  artists: { name: string; plays: string; image: string | null }[];
  tracks: { title: string; artist: string; plays: string; image: string | null }[];
};

const WIDTH = 1080;
const HEIGHT = 1350;
const PAD = 72;
const COLUMN = (WIDTH - PAD * 2 - 48) / 2;
const PAPER = "#f6f2e9";
const INK = "#1b1b1f";
const MUTED = "#6b665e";
const ACCENT = "#2438d6";
const BLANK = "#e4ddcf";

type Ctx = SKRSContext2D;

function picture(ctx: Ctx, image: Image | null, x: number, y: number, size: number, cover: boolean) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, 4);
  ctx.clip();
  ctx.fillStyle = BLANK;
  ctx.fillRect(x, y, size, size);
  if (image) {
    ctx.translate(x, y);
    drawFitted(ctx, image, size, cover);
  }
  ctx.restore();
}

function text(ctx: Ctx, value: string, x: number, y: number, size: number, weight: number, color: string, max: number) {
  setFont(ctx, size, weight);
  ctx.fillStyle = color;
  ctx.fillText(fitText(ctx, value, max), x, y);
}

export async function card(job: CardJob): Promise<Buffer> {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  text(ctx, job.name, PAD, PAD + 44, 50, 700, INK, WIDTH - PAD * 2);
  text(ctx, job.title, PAD, PAD + 100, 34, 400, MUTED, WIDTH - PAD * 2);

  const heroTop = PAD + 150;
  const heroSize = 420;
  picture(ctx, decode(job.artists[0]?.image ?? null), PAD, heroTop, heroSize, true);
  const statX = PAD + heroSize + 48;
  const statMax = WIDTH - PAD - statX;
  text(ctx, job.plays, statX, heroTop + 110, 104, 700, ACCENT, statMax);
  text(ctx, job.playsLabel, statX, heroTop + 160, 30, 400, MUTED, statMax);
  text(ctx, job.days, statX, heroTop + 300, 76, 700, INK, statMax);
  text(ctx, job.daysLabel, statX, heroTop + 346, 30, 400, MUTED, statMax);

  const listTop = heroTop + heroSize + 90;
  const row = 92;
  text(ctx, job.artistsLabel, PAD, listTop, 32, 700, INK, COLUMN);
  job.artists.forEach((a, i) => {
    const y = listTop + 44 + i * row;
    text(ctx, String(i + 1), PAD, y + 40, 30, 700, ACCENT, 40);
    text(ctx, a.name, PAD + 44, y + 30, 30, 600, INK, COLUMN - 44);
    text(ctx, a.plays, PAD + 44, y + 64, 24, 400, MUTED, COLUMN - 44);
  });

  const tracksX = PAD + COLUMN + 48;
  const thumb = 68;
  text(ctx, job.tracksLabel, tracksX, listTop, 32, 700, INK, COLUMN);
  job.tracks.forEach((t, i) => {
    const y = listTop + 44 + i * row;
    picture(ctx, decode(t.image), tracksX, y, thumb, false);
    const x = tracksX + thumb + 18;
    text(ctx, t.title, x, y + 28, 28, 600, INK, COLUMN - thumb - 18);
    text(ctx, `${t.artist} · ${t.plays}`, x, y + 60, 24, 400, MUTED, COLUMN - thumb - 18);
  });

  setFont(ctx, 26, 600);
  ctx.fillStyle = MUTED;
  ctx.textAlign = "right";
  ctx.fillText("sonosphere.fm", WIDTH - PAD, HEIGHT - PAD + 10);
  return canvas.encode("png");
}

if (import.meta.main) {
  registerFonts(process.argv[2]!);
  const png = await card(JSON.parse(await Bun.stdin.text()));
  process.stdout.write(JSON.stringify({ png: png.toString("base64") }));
}
