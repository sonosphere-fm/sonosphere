import { getJson, setJson } from "../kv";
import { topAlbumsWithArtwork } from "../listening/repo";
import { taggedArtists } from "../tags/repo";
import { now } from "../util";
import type { Sphere } from "../../shared/home";
import type { TopAlbum } from "../../shared/listening";
import { topGenreTags } from "./repo";

const genres = [
  "alternative rock", "ambient", "blues", "classical", "dream pop", "electronic",
  "experimental", "folk", "funk", "hip hop", "house", "indie pop", "indie rock",
  "jazz", "metal", "pop", "punk", "r&b", "reggae", "rock", "shoegaze", "soul", "techno",
] as const;
const day = 86400;
const KEY = "home-spheres";
const FRESH = 6 * 3600;
const KEEP = 3 * day * 1000;
const SHOWN = 4;

type Cached = { at: number; week: number; spheres: Sphere[] };
let memory: Cached | null | undefined;
let building: Promise<Sphere[]> | undefined;

function uniqueArtwork(albums: TopAlbum[]) {
  const seen = new Set<string>();
  return albums.filter(({ image }) => {
    if (!image || seen.has(image)) return false;
    seen.add(image);
    return true;
  }).slice(0, 12);
}

async function sphereForTag(tag: { id: number; name: string }): Promise<Sphere | null> {
  const artists = await taggedArtists(tag.id, 60);
  if (artists.length < 3) return null;
  const albums = uniqueArtwork(await topAlbumsWithArtwork(artists.map(artist => artist.id), 2, 24));
  return albums.length >= 6 ? { tag: tag.name, albums } : null;
}

async function build(week: number): Promise<Sphere[]> {
  const eligible: Sphere[] = [];
  for (const tag of await topGenreTags(genres)) {
    const sphere = await sphereForTag(tag);
    if (sphere) eligible.push(sphere);
    if (eligible.length === 8) break;
  }
  eligible.sort((a, b) => (a.tag ?? "").localeCompare(b.tag ?? "", "en"));
  const shown = Array.from({ length: Math.min(SHOWN, eligible.length) }, (_, i) => eligible[(week + i) % eligible.length]!);
  const top = uniqueArtwork(await topAlbumsWithArtwork(undefined, 2, 24));
  return top.length >= 6 ? [...shown, { tag: null, albums: top }] : shown;
}

function refresh(at: number, week: number): Promise<Sphere[]> {
  building ??= build(week)
    .then(async spheres => {
      memory = { at, week, spheres };
      await setJson(KEY, memory, KEEP);
      return spheres;
    })
    .catch(error => {
      console.error("Home spheres failed:", error);
      return memory?.spheres ?? [];
    })
    .finally(() => { building = undefined; });
  return building;
}

/** The genres shown turn over weekly; the covers are rebuilt every few hours and served stale while that runs. */
export async function homeSpheres(at = now()): Promise<Sphere[]> {
  // Unix time began on Thursday. Offset to Monday 5 January 1970 for UTC week boundaries.
  const week = Math.floor((at - 4 * day) / (7 * day));
  if (memory === undefined) memory = await getJson<Cached>(KEY);
  if (!memory) return refresh(at, week);
  if (memory.week !== week || at - memory.at > FRESH) void refresh(at, week);
  return memory.spheres;
}
