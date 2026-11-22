import { requireArtist, requireTag } from "../catalog/service";
import { need } from "../guards";
import { bad, fail, Router, type Ctx } from "../http";
import { canSee, requireUser } from "../users/service";
import * as service from "./service";
import type { Station } from "../../shared/stations";

export const router = new Router();

const EMPTY = "There isn't enough music to start this station yet";

async function station(type: string | null, name: string | null, c: Ctx): Promise<Station> {
  const viewer = c.user?.id ?? 0;
  if (type === "library") {
    const u = name ? await requireUser(name) : need(c);
    if (!canSee(u, c.user)) fail(403, "This user keeps their listening private");
    const title = u.id === viewer ? "Your library" : `${u.username}'s library`;
    return { title, tracks: await service.library(u.id, viewer) };
  }
  if (type === "recommended") {
    return { title: "Your recommendations", tracks: await service.recommended(need(c).id, viewer) };
  }
  if (type === "mix") {
    return { title: "Your mix", tracks: await service.mix(need(c).id, viewer) };
  }
  if (type === "artist") {
    const a = await requireArtist(name);
    return { title: `${a.name} radio`, tracks: await service.artistRadio(a.id, viewer) };
  }
  if (type === "tag") {
    const g = await requireTag(name);
    return { title: `${g.name} radio`, tracks: await service.tagRadio(g.id, viewer) };
  }
  return bad("Unknown station");
}

router.get<Station>("/api/station", async (c) => {
  const s = await station(c.q.get("type"), c.q.get("name"), c);
  return s.tracks.length ? s : fail(404, EMPTY);
});
