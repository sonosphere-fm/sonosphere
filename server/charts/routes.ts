import { join } from "node:path";
import { need } from "../guards";
import { bad, fail, HttpError, ipOf, limit, Router, type Body } from "../http";
import { requestLocale } from "../i18n";
import { picture } from "../images/routes";
import { format, type Entry, type Locale } from "../../shared/i18n/core";
import {
  CHART_MAX_SIDE,
  CHART_PERIODS,
  type ChartPeriod,
  type ChartReply,
  type ChartRequest,
  type ChartTitles,
} from "../../shared/charts";
import { counts, series, topArtists, topTracks } from "../listening/repo";
import { canSee, requireVisibleUser } from "../users/service";
import { gather, type ChartItem } from "./data";
import type { RenderCell, RenderJob } from "./render";
import type { CardJob } from "./year-card";

export const router = new Router();

const SCRIPT = join(import.meta.dir, "render.ts");
const CARD_SCRIPT = join(import.meta.dir, "year-card.ts");
const FONTS = join(import.meta.dir, "../../node_modules/@fontsource-variable/source-sans-3/files");
const TIME_LIMIT_MS = 45_000;
const MAX_RUNNING = 2;
const MAX_WAITING = 8;
const MAX_TEXT = 200;
const MAX_LIST = 2000;
const MAX_GENRES = 10;

const KINDS = ["albums", "artists"] as const;
const TITLES: ChartTitles[] = ["titles", "plays", "none"];

let running = 0;
const waiting: (() => void)[] = [];
const inFlight = new Set<number>();

async function slot<T>(job: () => Promise<T>): Promise<T> {
  if (running >= MAX_RUNNING) {
    if (waiting.length >= MAX_WAITING) throw new HttpError(503, "tooManyRequestsTryAgain", 30);
    await new Promise<void>((resolve) => waiting.push(resolve));
  }
  running++;
  try {
    return await job();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

const text = (value: unknown, max: number) => (typeof value === "string" ? value.slice(0, max) : "");
const flag = (value: unknown) => value === true;

function side(value: unknown): number {
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > CHART_MAX_SIDE) bad("invalidNumber");
  return value as number;
}

function parse(body: Body): ChartRequest {
  const period = String(body.period);
  return {
    username: text(body.username, 64).trim(),
    kind: KINDS.find((k) => k === body.kind) ?? "albums",
    period: (period in CHART_PERIODS ? period : "weekly") as ChartPeriod,
    width: side(body.width),
    height: side(body.height),
    titles: TITLES.find((t) => t === body.titles) ?? "titles",
    skip: flag(body.skip),
    rainbow: flag(body.rainbow),
    sfw: flag(body.sfw),
    hideSingles: flag(body.hideSingles),
    releaseFilter: text(body.releaseFilter, 16),
    artist: text(body.artist, MAX_TEXT),
    genres: (Array.isArray(body.genres) ? body.genres : [])
      .slice(0, MAX_GENRES)
      .map((genre) => text(genre, 64))
      .filter(Boolean),
    censorArtists: text(body.censorArtists, MAX_LIST),
    censorAlbums: text(body.censorAlbums, MAX_LIST),
  };
}

function cellSize(width: number, height: number): number {
  const longest = Math.max(width, height);
  return Math.min(640, Math.max(200, Math.floor(3200 / longest)));
}

type Music = Record<string, Entry>;
const catalogs = new Map<Locale, Promise<Music>>();
function music(locale: Locale): Promise<Music> {
  const hit =
    catalogs.get(locale) ?? import(`../../shared/i18n/${locale}/music.ts`).then((m: { default: Music }) => m.default);
  catalogs.set(locale, hit);
  return hit;
}

async function cells(items: ChartItem[], req: ChartRequest, size: number, locale: Locale): Promise<RenderCell[]> {
  const words = await music(locale);
  const small = size <= 320;
  return Promise.all(
    items.map(async (item, index) => {
      const pic = item.image && !item.censored ? await picture(item.image, small).catch(() => null) : null;
      const onlyAlbums = req.kind === "albums" && req.artist.trim();
      return {
        index,
        top: req.kind === "artists" ? item.artist : onlyAlbums ? item.album : item.artist,
        bottom: req.kind === "albums" && !onlyAlbums ? item.album : null,
        plays: req.titles === "plays" && item.plays ? format(locale, words.chartPlays!, { count: item.plays }) : null,
        image: pic ? Buffer.from(pic.data).toString("base64") : null,
        censored: item.censored,
        nsfw: item.nsfw,
      };
    })
  );
}

// Decoding pictures and drawing runs in its own process, with no environment and a hard time limit.
async function draw<T>(script: string, job: RenderJob | CardJob): Promise<T> {
  const child = Bun.spawn([process.execPath, script, FONTS], {
    stdin: new TextEncoder().encode(JSON.stringify(job)),
    stdout: "pipe",
    stderr: "pipe",
    env: { PATH: "/usr/bin:/bin", BUN_RUNTIME_TRANSPILER_CACHE_PATH: "0", HOME: "/tmp" },
    timeout: TIME_LIMIT_MS,
    killSignal: "SIGKILL",
  });
  const [out, err, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (code !== 0 || !out) {
    console.error("chart render failed:", code, err.trim().slice(0, 300));
    fail(500, "somethingWentWrong");
  }
  return JSON.parse(out);
}

router.post<ChartReply>("/api/charts", async (c) => {
  const user = need(c);
  const req = parse(c.body);
  if (!req.username) bad("userNotFound");
  if (inFlight.has(user.id)) throw new HttpError(429, "goingABitFast", 5);
  await limit(`chart:${user.id}`, 12, 600, "goingABitFast");
  await limit(`chart-ip:${ipOf(c.req)}`, 30, 600, "tooManyRequestsFromHere");
  const locale = requestLocale(c.req);

  inFlight.add(user.id);
  try {
    return await slot(async () => {
      const found = await gather(req, user);
      if (found.status !== "Ok") return found;
      const size = cellSize(req.width, req.height);
      const words = await music(locale);
      const { drawn, jpeg } = await draw<{ drawn: number; jpeg: string }>(SCRIPT, {
        width: req.width,
        height: req.height,
        cellSize: size,
        titles: req.titles,
        artistChart: req.kind === "artists",
        rainbow: req.rainbow,
        skipWithoutImage: req.skip || req.rainbow,
        skipNsfw: req.sfw,
        labels: { censored: format(locale, words.chartCensored!), noImage: format(locale, words.chartNoImage!) },
        cells: await cells(found.items, req, size, locale),
      });
      return {
        status: "Ok",
        image: jpeg,
        width: size * req.width,
        height: size * req.height,
        drawn,
        names: found.items.map((item) => ({ artist: item.artist, album: item.album })),
      };
    });
  } finally {
    inFlight.delete(user.id);
  }
});

router.get("/api/user/year-card", async (c) => {
  const u = await requireVisibleUser(c.q.get("name"), c.user);
  if (!canSee(u, c.user)) fail(403, "userKeepsTheirListeningPrivate");
  await limit(`yearcard:${ipOf(c.req)}`, 20, 600, "goingABitFast");
  const year = Number(c.q.get("year"));
  if (!Number.isInteger(year) || year < 2000 || year > new Date().getUTCFullYear()) bad("invalidNumber");
  const tz = Math.max(-900, Math.min(900, Math.round(Number(c.q.get("tz")) || 0)));
  const scope = {
    userId: u.id,
    from: Date.UTC(year, 0, 1) / 1000 - tz * 60,
    to: Date.UTC(year + 1, 0, 1) / 1000 - tz * 60,
  };
  const locale = requestLocale(c.req);
  const [total, days, artists, tracks, words] = await Promise.all([
    counts(scope),
    series(scope, "day", tz),
    topArtists(scope, 5),
    topTracks(scope, 5),
    music(locale),
  ]);
  const number = new Intl.NumberFormat(locale);
  const plays = (count: number) => format(locale, words.chartPlays!, { count });
  const base64 = async (id: string | null, small: boolean) => {
    const pic = id ? await picture(id, small).catch(() => null) : null;
    return pic ? Buffer.from(pic.data).toString("base64") : null;
  };
  const job: CardJob = {
    name: u.username,
    title: format(locale, words.yearCardTitle!, { year }),
    plays: number.format(total.playcount),
    playsLabel: format(locale, words.yearCardScrobbles!, { count: total.playcount }),
    days: number.format(days.length),
    daysLabel: format(locale, words.yearCardDays!, { count: days.length }),
    artistsLabel: format(locale, words.topArtists!),
    tracksLabel: format(locale, words.topTracks!),
    artists: await Promise.all(
      artists.items.map(async (a, i) => ({
        name: a.name,
        plays: plays(a.playcount),
        image: i ? null : await base64(a.image, false),
      }))
    ),
    tracks: await Promise.all(
      tracks.items.map(async (t) => ({
        title: t.title,
        artist: t.artist,
        plays: plays(t.playcount),
        image: await base64(t.image, true),
      }))
    ),
  };
  const { png } = await slot(() => draw<{ png: string }>(CARD_SCRIPT, job));
  return new Response(Buffer.from(png, "base64"), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="${u.username}-${year}.png"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
});
