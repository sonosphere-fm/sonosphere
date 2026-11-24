import { requireItem } from "../catalog/service";
import { bad, missing, type Body } from "../http";
import * as listening from "../listening/repo";
import { resolve } from "../listening/service";
import { lovedTracksOf } from "../users/repo";
import { now } from "../util";
import * as repo from "./repo";
import type { TemplateId } from "../../shared/playlists";

export const requireOwn = async (id: number, userId: number): Promise<repo.Playlist> =>
  (await repo.findOwnPlaylist(id, userId)) ?? missing("playlistNotFound");

// Artist and track names are added to the catalogue if new.
export async function trackToAdd(b: Body): Promise<number> {
  if (b.trackId) return (await requireItem("track", b.trackId, ["track"])).row.id;
  const r = (await resolve(b)) ?? bad("artistTrackRequired");
  return r.trackId;
}

const DAY = 86400;

async function topIds(userId: number, from: number, to: number, limit: number) {
  return (await listening.topTracks({ userId, from, to }, limit)).items.map((t) => t.id);
}

export async function templateTracks(userId: number, template: TemplateId): Promise<number[]> {
  const t = now();
  switch (template) {
    case "repeat":
      return topIds(userId, t - 7 * DAY, t, 25);
    case "month":
      return topIds(userId, t - 30 * DAY, t, 30);
    case "favourites":
      return (await listening.topTracks({ userId }, 50)).items.map((x) => x.id);
    case "forgotten":
      return listening.tracksOnlyPlayed(userId, "before", t - 90 * DAY, 30);
    case "fresh":
      return listening.tracksOnlyPlayed(userId, "after", t - 30 * DAY, 30);
    case "yearAgo":
      return topIds(userId, t - 380 * DAY, t - 350 * DAY, 30);
    case "loved":
      return (await lovedTracksOf(userId, undefined, 50, 0)).map((x) => x.id);
  }
}
