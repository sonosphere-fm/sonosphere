import { discography, findArtist, findItem } from "../catalog/repo";
import { requireArtist } from "../catalog/service";
import type { Viewer } from "../http";
import { coarse, FOREVER, range } from "../listening/period";
import * as listening from "../listening/repo";
import { topTags } from "../tags/repo";
import type { User } from "../users/repo";
import { canSee, canSeeCharts, requireVisibleUser } from "../users/service";
import { CHART_PERIODS, parseReleaseFilter, type ChartReply, type ChartRequest } from "../../shared/charts";

export type ChartItem = {
  id: number;
  artist: string;
  album: string | null;
  image: string | null;
  plays: number;
  censored: boolean;
  nsfw: boolean;
};

export type Gathered = { status: "Ok"; items: ChartItem[] } | Exclude<ChartReply, { status: "Ok" }>;

const PAGE = 200;
const LOOKUPS = 4;

const norm = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();
const normGenre = (value: string) => norm(value).replace(/[\s-]/g, "");

async function eachLimited<T, R>(items: T[], worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const run = async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(LOOKUPS, items.length) }, run));
  return results;
}

function memo<T>(load: (key: string) => Promise<T>) {
  const seen = new Map<string, Promise<T>>();
  return (key: string) => {
    const hit = seen.get(key) ?? load(key);
    seen.set(key, hit);
    return hit;
  };
}

function censorList(text: string, album: boolean): Map<string, boolean> {
  const entries = text
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return new Map(
    entries.map((entry) => {
      const nsfw = /^nsfw\s*:/i.test(entry);
      const value = entry.replace(/^nsfw\s*:\s*/i, "");
      const key = album
        ? value
            .split(/\s+[—–-]\s+/, 2)
            .map(norm)
            .join("\u0000")
        : norm(value);
      return [key, nsfw];
    })
  );
}

// The release and artist filters always look across all time.
function chartRange(req: ChartRequest, user: User, viewer: Viewer, allTime: boolean): [number, number] {
  if (allTime) return [0, FOREVER];
  if (req.from === null && req.to === null) return range(new URLSearchParams({ period: CHART_PERIODS[req.period] }));
  const picked: [number, number] = [req.from ?? 0, req.to ?? FOREVER];
  return canSee(user, viewer) ? picked : coarse(picked);
}

export async function gather(req: ChartRequest, viewer: Viewer): Promise<Gathered> {
  const user = await requireVisibleUser(req.username, viewer);
  const albums = req.kind === "albums";
  const needed = req.width * req.height;
  const skipWithoutImage = req.skip || req.rainbow;

  let extra = 0;
  if (skipWithoutImage) extra = req.height * 2 + (req.height > 5 ? 8 : 2);
  if (req.sfw) extra += req.height;
  if (!canSeeCharts(user, viewer)) return { status: "Hidden", amount: 0, extra };

  const { year, decade } = albums ? parseReleaseFilter(req.releaseFilter) : { year: null, decade: null };
  const artistFilter = albums ? req.artist.trim() : "";
  const singles = albums && req.hideSingles;
  const genres = req.genres.map(normGenre).filter(Boolean);
  const count = year || decade || artistFilter || singles || genres.length ? 1000 : 250;
  const [from, to] = chartRange(req, user, viewer, !!(year || decade || artistFilter));
  const scope: listening.Scope = { userId: user.id, from, to, viewerId: viewer.id };
  if (artistFilter) scope.artistId = (await requireArtist(artistFilter)).id;

  let items: ChartItem[] = [];
  for (let offset = 0; items.length < count; offset += PAGE) {
    const page = albums
      ? (await listening.top("albums", scope, PAGE, offset)).items.map((a) => ({
          id: a.id,
          artist: a.artist,
          album: a.title,
          image: a.image,
          plays: a.playcount,
        }))
      : (await listening.top("artists", scope, PAGE, offset)).items.map((a) => ({
          id: a.id,
          artist: a.name,
          album: null,
          image: a.image,
          plays: a.playcount,
        }));
    items.push(...page.map((item) => ({ ...item, censored: false, nsfw: false })));
    if (page.length < PAGE) break;
  }
  items = items.slice(0, count);
  if (items.length < needed) return { status: "NotEnough", amount: items.length, extra };

  const artistByName = memo((name) => findArtist(name));

  if (genres.length) {
    const tagsOf = memo(async (name) => {
      const id = albums ? (await artistByName(name))?.id : items.find((item) => item.artist === name)?.id;
      return id ? (await topTags("artist", id, 8)).map((tag) => normGenre(tag.name)) : [];
    });
    const matches = await eachLimited(items, async (item) =>
      (await tagsOf(item.artist)).some((tag) => genres.some((genre) => tag.includes(genre)))
    );
    items = items.filter((_, index) => matches[index]);
    if (items.length < needed) return { status: "NotEnough", amount: items.length, extra };
  }

  if (year || decade) {
    const released = await eachLimited(items, async (item) => {
      const row = await findItem("album", item.id);
      const found = /^(\d{4})/.exec(row?.releaseDate ?? "");
      if (!found) return false;
      const when = Number(found[1]);
      return year ? when === year : when >= decade! && when < decade! + 10;
    });
    items = items.filter((_, index) => released[index]);
    if (items.length < needed) {
      return { status: decade ? "NotEnoughReleaseDecade" : "NotEnoughReleaseYear", amount: items.length, extra };
    }
  }

  if (singles) {
    const singlesOf = memo(async (name) => {
      const artist = await artistByName(name);
      if (!artist) return new Set<string>();
      return new Set((await discography(artist.id, true, 48, 0)).map((album) => norm(album.title)));
    });
    const isSingle = await eachLimited(items, async (item) => (await singlesOf(item.artist)).has(norm(item.album)));
    items = items.filter((_, index) => !isSingle[index]);
    if (items.length < needed) return { status: "NotEnoughNonSingles", amount: items.length, extra };
  }

  const taken = items.slice(0, needed + extra);

  if (albums) {
    for (const item of taken.filter((item) => !item.image).slice(0, 3)) {
      item.image = (await artistByName(item.artist))?.imageId ?? null;
    }
  }

  const censorArtists = censorList(req.censorArtists, false);
  const censorAlbums = censorList(req.censorAlbums, true);
  for (const item of taken) {
    const artist = norm(item.artist);
    const albumKey = `${artist}\u0000${norm(item.album)}`;
    const nsfw = censorArtists.get(artist) ?? (albums ? censorAlbums.get(albumKey) : undefined);
    if (nsfw === undefined) continue;
    item.nsfw = nsfw;
    item.censored = !nsfw;
  }

  return { status: "Ok", items: taken };
}
