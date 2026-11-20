// Rules for playlists: only the owner may change one, and what a request to add a track may name.
import { requireItem } from "../catalog/service";
import { bad, missing, type Body } from "../http";
import { resolve } from "../listening/service";
import * as repo from "./repo";

/** The user's own playlist with this id, or a 404 (also when it exists but is someone else's). */
export const requireOwn = async (id: number, userId: number): Promise<repo.Playlist> => (await repo.findOwnPlaylist(id, userId)) ?? missing("Playlist");

/** The track a request wants added: a known track by id, or artist and track names, which are added to the catalogue if new. */
export async function trackToAdd(b: Body): Promise<number> {
  if (b.trackId) return (await requireItem("track", b.trackId, ["track"])).row.id;
  return ((await resolve(b)) ?? bad("Artist and track are required")).trackId;
}
