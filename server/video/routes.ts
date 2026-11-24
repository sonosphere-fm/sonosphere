import { bad, ipOf, limit, Router } from "../http";
import { clean } from "../util";
import { videosFor } from "./service";
import type { VideoLookup } from "../../shared/video";

export const router = new Router();

router.get<VideoLookup>("/api/video", async (c) => {
  const artist = clean(c.q.get("artist") || "");
  const track = clean(c.q.get("track") || "");
  if (!artist || !track) bad("artistAndTrackRequiredLower");
  // only lookups that reach YouTube count, since they spend its quota
  const fetches = c.user ? `video:${c.user.id}` : `video-ip:${ipOf(c.req)}`;
  return { videoIds: await videosFor(artist, track, () => limit(fetches, c.user ? 120 : 30, 3600)) };
});
