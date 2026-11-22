import { bad, Router } from "../http";
import { clean } from "../util";
import { videosFor } from "./service";
import type { VideoLookup } from "../../shared/video";

export const router = new Router();

router.get<VideoLookup>("/api/video", async (c) => {
  const artist = clean(c.q.get("artist") || "");
  const track = clean(c.q.get("track") || "");
  if (!artist || !track) bad("artist and track are required");
  return { videoIds: await videosFor(artist, track) };
});
