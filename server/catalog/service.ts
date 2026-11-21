// Catalogue lookups for request handlers: each returns the row or throws the 404 the API has always sent.
import { correct } from "../corrections/service";
import { bad, missing } from "../http";
import type { ItemType } from "../../shared/catalog";
import { aliasOf } from "../metadata/service";
import * as repo from "./repo";

/** An item together with its type, so callers handling several types can tell the rows apart. */
export type Item<K extends ItemType = ItemType> = { [T in K]: { type: T; row: repo.ItemRows[T] } }[K];

export async function requireArtist(name: string | null): Promise<repo.Artist> {
  // the second try covers an old link to a name that has since been corrected
  // and the last a name that was looked up elsewhere and filed under another spelling (server/metadata)
  return (await repo.findArtist(name || "")) ?? (await repo.findArtist(correct(name || "", "").artist))
    ?? (await viaAlias("artist", [name], to => repo.findArtist(to[0]!))) ?? missing("Artist");
}
export const requireAlbum = async (artist: string | null, title: string | null): Promise<repo.AlbumWithArtist> =>
  (await repo.findAlbum(artist || "", title || "")) ?? (await viaAlias("album", [artist, title], to => repo.findAlbum(to[0]!, to[1]!))) ?? missing("Album");
export const requireTrack = async (artist: string | null, title: string | null): Promise<repo.TrackWithArtist> =>
  (await repo.findTrack(artist || "", title || "")) ?? (await viaAlias("track", [artist, title], to => repo.findTrack(to[0]!, to[1]!))) ?? missing("Track");

async function viaAlias<T>(kind: "artist" | "album" | "track", names: (string | null)[], find: (to: string[]) => Promise<T | null>): Promise<T | null> {
  const to = await aliasOf(kind, names);
  return to && to.length === names.length ? find(to) : null;
}
export const requireTag = async (name: string | null): Promise<repo.Tag> => (await repo.findTag(name || "")) ?? missing("Tag");

const isType = <K extends ItemType>(type: unknown, allowed: readonly K[]): type is K => typeof type === "string" && (allowed as readonly string[]).includes(type);
const load = async <K extends ItemType>(type: K, id: number): Promise<Item<K> | null> => {
  const row = await repo.findItem(type, id);
  return row && ({ type, row } as Item<K>);
};

/**
 * The item a request names by type and id, both straight from untrusted input. Throws 400 when the type is not
 * one of `allowed` and 404 when there is no such item.
 */
export async function requireItem<K extends ItemType = ItemType>(type: unknown, id: unknown, allowed: readonly K[] = repo.ITEM_TYPES as K[]): Promise<Item<K>> {
  if (!isType(type, allowed)) return bad("Invalid item type");
  const n = Number(id);
  return (Number.isSafeInteger(n) ? await load(type, n) : null) ?? missing("Item");
}
