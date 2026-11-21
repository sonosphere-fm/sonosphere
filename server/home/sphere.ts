import { topAlbumsWithArtwork } from "../listening/repo";
import { taggedArtists } from "../tags/repo";
import { now } from "../util";
import type { FeaturedSphere, Home } from "../../shared/home";
import type { TopAlbum } from "../../shared/listening";
import { topGenreTags } from "./repo";

const genres = [
  "alternative rock", "ambient", "blues", "classical", "dream pop", "electronic",
  "experimental", "folk", "funk", "hip hop", "house", "indie pop", "indie rock",
  "jazz", "metal", "pop", "punk", "r&b", "reggae", "rock", "shoegaze", "soul", "techno",
] as const;
const day = 86400;
const cacheSeconds = 15 * 60;

function uniqueArtwork(albums: TopAlbum[]) {
  const seen = new Set<string>();
  return albums.filter(({ image }) => {
    if (!image || seen.has(image)) return false;
    seen.add(image);
    return true;
  }).slice(0, 12);
}

async function sphereForTag(tag: { id: number; name: string }): Promise<FeaturedSphere | null> {
  const artists = await taggedArtists(tag.id, 60);
  if (artists.length < 3) return null;
  const albums = uniqueArtwork(await topAlbumsWithArtwork(artists.map(artist => artist.id), 2, 24));
  return albums.length >= 6 ? { tag: tag.name, albums } : null;
}

async function pickSphere(week: number, previousTag: string | undefined, sameWeek: boolean): Promise<FeaturedSphere | null> {
  const tags = await topGenreTags(genres);
  const current = sameWeek ? tags.find(tag => tag.name === previousTag) : undefined;
  if (current) {
    const sphere = await sphereForTag(current);
    if (sphere) return sphere;
  }
  const eligible: FeaturedSphere[] = [];
  for (const tag of tags) {
    if (tag === current) continue;
    const sphere = await sphereForTag(tag);
    if (sphere) eligible.push(sphere);
    if (eligible.length === 8) break;
  }
  if (!eligible.length) return null;
  eligible.sort((a, b) => a.tag.localeCompare(b.tag, "en"));
  const previousIndex = sameWeek ? -1 : eligible.findIndex(sphere => sphere.tag === previousTag);
  const index = previousIndex < 0 ? week : previousIndex + 1;
  return eligible[index % eligible.length] ?? null;
}

type Spheres = Pick<Home, "featuredSphere" | "sphereAlbums">;
let cache: { week: number; expires: number; result: Promise<Spheres> } | undefined;

export function homeSpheres(at = now()): Promise<Spheres> {
  // Unix time began on Thursday. Offset to Monday 5 January 1970 for UTC week boundaries.
  const week = Math.floor((at - 4 * day) / (7 * day));
  const sameWeek = cache?.week === week;
  if (sameWeek && cache && cache.expires > at) return cache.result;
  const last = cache && (sameWeek || cache.week === week - 1) ? cache.result : Promise.resolve(null);
  const result = last.then(async previous => {
    const [featuredSphere, albums] = await Promise.all([
      pickSphere(week, previous?.featuredSphere?.tag, sameWeek),
      topAlbumsWithArtwork(undefined, 2, 24),
    ]);
    return { featuredSphere, sphereAlbums: uniqueArtwork(albums) };
  }).catch(error => {
    if (cache?.result === result) cache = undefined;
    console.error("Featured Sphere selection failed:", error);
    return { featuredSphere: null, sphereAlbums: [] };
  });
  cache = { week, expires: at + cacheSeconds, result };
  return result;
}
