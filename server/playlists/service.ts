import { requireItem } from "../catalog/service";
import { bad, missing, type Body } from "../http";
import { resolve } from "../listening/service";
import * as repo from "./repo";

export const requireOwn = async (id: number, userId: number): Promise<repo.Playlist> =>
  (await repo.findOwnPlaylist(id, userId)) ?? missing("Playlist");

// Artist and track names are added to the catalogue if new.
export async function trackToAdd(b: Body): Promise<number> {
  if (b.trackId) return (await requireItem("track", b.trackId, ["track"])).row.id;
  const r = (await resolve(b)) ?? bad("Artist and track are required");
  return r.trackId;
}
