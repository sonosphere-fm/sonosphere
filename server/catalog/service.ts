import { correct } from "../corrections/service";
import { bad, missing } from "../http";
import type { ItemType } from "../../shared/catalog";
import { aliasOf } from "../metadata/service";
import * as repo from "./repo";

export type Item<K extends ItemType = ItemType> = { [T in K]: { type: T; row: repo.ItemRows[T] } }[K];

async function viaAlias<T>(
  kind: "artist" | "album" | "track",
  names: (string | null)[],
  find: (to: string[]) => Promise<T | null>
): Promise<T | null> {
  const to = await aliasOf(kind, names);
  return to && to.length === names.length ? find(to) : null;
}

export async function requireArtist(name: string | null): Promise<repo.Artist> {
  const n = name || "";
  // an old link to a name that has since been corrected, or one filed under another spelling by a lookup elsewhere
  return (
    (await repo.findArtist(n)) ??
    (await repo.findArtist(correct(n, "").artist)) ??
    (await viaAlias("artist", [name], (to) => repo.findArtist(to[0]!))) ??
    missing("artistNotFound")
  );
}

export async function requireAlbum(artist: string | null, title: string | null): Promise<repo.AlbumWithArtist> {
  return (
    (await repo.findAlbum(artist || "", title || "")) ??
    (await viaAlias("album", [artist, title], (to) => repo.findAlbum(to[0]!, to[1]!))) ??
    missing("albumNotFound")
  );
}

export async function requireTrack(artist: string | null, title: string | null): Promise<repo.TrackWithArtist> {
  return (
    (await repo.findTrack(artist || "", title || "")) ??
    (await viaAlias("track", [artist, title], (to) => repo.findTrack(to[0]!, to[1]!))) ??
    missing("trackNotFound")
  );
}

export const requireTag = async (name: string | null): Promise<repo.Tag> =>
  (await repo.findTag(name || "")) ?? missing("tagNotFound");

const isType = <K extends ItemType>(type: unknown, allowed: readonly K[]): type is K =>
  typeof type === "string" && (allowed as readonly string[]).includes(type);

/** Throws 400 when the type is not one of `allowed` and 404 when there is no such item. */
export async function requireItem<K extends ItemType = ItemType>(
  type: unknown,
  id: unknown,
  allowed: readonly K[] = repo.ITEM_TYPES as K[]
): Promise<Item<K>> {
  if (!isType(type, allowed)) return bad("invalidItemType");
  const n = Number(id);
  if (!Number.isSafeInteger(n)) return missing("itemNotFound");
  const row = await repo.findItem(type, n);
  return row ? ({ type, row } as Item<K>) : missing("itemNotFound");
}
