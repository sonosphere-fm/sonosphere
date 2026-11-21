// Obsessions API: list a user's pinned tracks, pin one, unpin one.
import { requireItem, requireTrack } from "../catalog/service";
import { need } from "../guards";
import { Router, throttle, type Body } from "../http";
import { requireUser } from "../users/service";
import * as repo from "./repo";
import type { ObsessionCreated, ObsessionRemoved, Obsessions } from "../../shared/obsessions";

export const router = new Router();

const text = (v: unknown): string | null => (typeof v === "string" ? v : null);
/** The track a request names: by id, or by artist and title. */
const trackId = async (b: Body): Promise<number> =>
  b.trackId ? (await requireItem("track", b.trackId, ["track"])).row.id : (await requireTrack(text(b.artist), text(b.track))).id;

router.get<Obsessions>("/api/user/obsessions", async c => ({ items: await repo.obsessionsOf((await requireUser(c.q.get("name"))).id, c.user?.id) }));

router.post<ObsessionCreated>("/api/obsessions", async c => {
  const u = need(c);
  await throttle(`obsession:${u.id}`, 30, 3600);
  const id = await trackId(c.body);
  return { id: await repo.addObsession(u.id, id, String(c.body.comment || "").trim().slice(0, 300)) };
});

router.delete<ObsessionRemoved>("/api/obsessions/:id", async c => {
  const id = Number(c.params[0]);
  await repo.removeObsession(id, need(c).id);
  return { ok: true };
});
