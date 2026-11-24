import { requireArtist, requireTag } from "../catalog/service";
import { need } from "../guards";
import { bad, fail, Router, type Ctx } from "../http";
import { requestLocale, tr } from "../i18n";
import { canSee, requireUser } from "../users/service";
import * as service from "./service";
import type { Station } from "../../shared/stations";

export const router = new Router();

const EMPTY = "notEnoughMusicForStation";

async function station(type: string | null, name: string | null, c: Ctx): Promise<Station> {
  const viewer = c.user?.id ?? 0;
  const locale = requestLocale(c.req);
  if (type === "library") {
    const u = name ? await requireUser(name) : need(c);
    if (!canSee(u, c.user)) fail(403, "userKeepsTheirListeningPrivate");
    const title =
      u.id === viewer
        ? tr(locale, "errors.stationOwnLibrary")
        : tr(locale, "errors.stationLibrary", { username: u.username });
    return { title, tracks: await service.library(u.id, viewer) };
  }
  if (type === "recommended") {
    return {
      title: tr(locale, "errors.stationRecommendations"),
      tracks: await service.recommended(need(c).id, viewer),
    };
  }
  if (type === "mix") {
    return { title: tr(locale, "errors.stationMix"), tracks: await service.mix(need(c).id, viewer) };
  }
  if (type === "artist") {
    const a = await requireArtist(name);
    return {
      title: tr(locale, "errors.stationRadio", { name: a.name }),
      tracks: await service.artistRadio(a.id, viewer),
    };
  }
  if (type === "tag") {
    const g = await requireTag(name);
    return { title: tr(locale, "errors.stationRadio", { name: g.name }), tracks: await service.tagRadio(g.id, viewer) };
  }
  return bad("unknownStation");
}

router.get<Station>("/api/station", async (c) => {
  const s = await station(c.q.get("type"), c.q.get("name"), c);
  return s.tracks.length ? s : fail(404, EMPTY);
});
