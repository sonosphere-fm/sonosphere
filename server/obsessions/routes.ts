import { requireItem, requireTrack } from "../catalog/service";
import { confirmed, need, poster } from "../guards";
import { Router, throttle, type Body } from "../http";
import { requireVisibleUser } from "../users/service";
import * as repo from "./repo";
import type { ObsessionCreated, ObsessionRemoved, Obsessions } from "../../shared/obsessions";
import { wantCovers } from "../metadata/wanted";

export const router = new Router();

const text = (v: unknown): string | null => (typeof v === "string" ? v : null);

async function trackId(b: Body): Promise<number> {
  if (b.trackId) return (await requireItem("track", b.trackId, ["track"])).row.id;
  return (await requireTrack(text(b.artist), text(b.track))).id;
}

router.get<Obsessions>("/api/user/obsessions", async (c) => {
  const u = await requireVisibleUser(c.q.get("name"), c.user);
  return { items: wantCovers(await repo.obsessionsOf(u.id, c.user?.id), (r) => r.trackId) };
});

router.post<ObsessionCreated>("/api/obsessions", async (c) => {
  const u = confirmed(poster(c));
  await throttle(`obsession:${u.id}`, 30, 3600);
  const id = await trackId(c.body);
  const comment = String(c.body.comment || "")
    .trim()
    .slice(0, 300);
  return { id: await repo.addObsession(u.id, id, comment) };
});

router.delete<ObsessionRemoved>("/api/obsessions/:id", async (c) => {
  const id = Number(c.params[0]);
  await repo.removeObsession(id, need(c).id);
  return { ok: true };
});
