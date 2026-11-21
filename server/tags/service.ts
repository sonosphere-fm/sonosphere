import type { Tag } from "../catalog/repo";
import { bad } from "../http";
import { topAlbums, topTracks } from "../listening/repo";
import { latestWiki } from "../wiki/repo";
import { clean, norm } from "../util";
import type { ItemTags, TagCount, TagPage } from "../../shared/tags";
import * as repo from "./repo";

export async function tagPage(tag: Tag, viewerId: number | undefined): Promise<TagPage> {
  const artists = await repo.taggedArtists(tag.id, 60);
  const artistIds = artists.map(a => a.id);
  return {
    id: tag.id,
    name: tag.name,
    wiki: await latestWiki("tag", tag.id),
    taggings: await repo.taggingCount(tag.id),
    taggers: await repo.taggerCount(tag.id),
    artists,
    albums: (await topAlbums({ artistIds, global: true }, 24)).items,
    tracks: (await topTracks({ artistIds, viewerId, global: true }, 30)).items,
    related: await repo.relatedTags(tag.id, 12),
  };
}

// With nothing typed yet: the person's most recently used tags, then the most used overall.
export async function suggest(typed: string, userId: number | undefined): Promise<TagCount[]> {
  const q = norm(typed).slice(0, 40);
  if (q) return repo.matchingTags(q, 8);
  const recent = userId ? await repo.recentTags(userId, 12) : [];
  const popular = await repo.popularTags(24);
  const seen = new Set(recent.map(t => t.name));
  return [...recent, ...popular.filter(t => !seen.has(t.name))].slice(0, 24);
}

// A list, or one comma-separated string.
export function namesFrom(input: unknown): string[] {
  const raw: unknown[] = Array.isArray(input) ? input : String(input || "").split(",");
  const names = raw.map(t => clean(t, 40)).filter(Boolean).slice(0, 10);
  return names.length ? names : bad("Enter at least one tag");
}

export async function tagsOn(userId: number, type: string, id: number): Promise<ItemTags> {
  return {
    tags: await repo.topTags(type, id, 8),
    myTags: await repo.myTags(userId, type, id),
  };
}
