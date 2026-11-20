// HTTP routes for a listener's own plays: scrobbling, now playing, editing and deleting plays, and loving tracks.
import { requireItem, requireTrack } from "../catalog/service";
import { need } from "../guards";
import { bad, int, missing, oneOf, Router, type Ctx } from "../http";
import { clean } from "../util";
import * as repo from "./repo";
import { editScrobble, editScrobbles, importLoved, scrobbleMany, setNowPlaying, type ScrobbleInput } from "./service";
import type { Ok } from "../../shared/auth";
import type { Loved, LovedImported, ScopeCounts, ScrobbleEdited, ScrobbleResponse, ScrobblesDeleted } from "../../shared/listening";

export const router = new Router();

const SCOPES = ["track", "album", "artist"] as const;
/** A submitted play as an object whose fields can be read (and still need checking). Anything else counts as empty. */
const asInput = (v: unknown): ScrobbleInput => (typeof v === "object" && v !== null ? v : {});
const text = (v: unknown): string | null => (typeof v === "string" ? v : null);
/** The signed-in listener's play named in the URL, or a 404. */
async function ownScrobble(c: Ctx) {
  const id = int(c.params[0]);
  return (id === null ? null : await repo.findScrobble(need(c).id, id)) ?? missing("Scrobble");
}

router.post<ScrobbleResponse>("/api/scrobble", async c => {
  const u = need(c);
  const list: unknown[] = Array.isArray(c.body.tracks) ? c.body.tracks : [c.body];
  if (list.length > 5000) bad("At most 5000 scrobbles per request");
  const inputs = list.map(asInput), results = await scrobbleMany(u.id, inputs, clean(c.body.source, 20) || "web");
  const details: ScrobbleResponse["details"] = [];
  let accepted = 0;
  results.forEach((r, i) => {
    if (r.accepted) accepted++;
    else if (details.length < 20) details.push({ artist: inputs[i]?.artist, track: inputs[i]?.track, reason: r.reason });
  });
  return { accepted, ignored: list.length - accepted, details };
});

router.post<Ok>("/api/nowplaying", async c => {
  const u = need(c);
  if (c.body.stop) await repo.clearNowPlaying(u.id);
  else if (!(await setNowPlaying(u.id, c.body))) bad("Artist and track are required");
  return { ok: true };
});

router.delete<Ok>("/api/scrobble/:id", async c => {
  const u = need(c), id = int(c.params[0]);
  if (id === null || !(await repo.deleteScrobble(u.id, id))) missing("Scrobble");
  return { ok: true };
});

router.get<ScopeCounts>("/api/scrobble/:id/scope", async c => repo.scopeCounts(await ownScrobble(c)));

router.patch<ScrobbleEdited>("/api/scrobble/:id", async c => {
  const s = await ownScrobble(c), scope = oneOf(c.body.scope, SCOPES);
  // with a scope, the same correction goes to every play that shares this one's track, album or artist
  if (scope) return { ok: true, changed: await editScrobbles(s, scope, c.body) };
  await editScrobble(s.id, c.body);
  return { ok: true, changed: 1 };
});

router.post<ScrobblesDeleted>("/api/scrobbles/delete", async c => {
  const u = need(c), ids = (Array.isArray(c.body.ids) ? c.body.ids : []).map(Number).filter(Number.isInteger).slice(0, 1000);
  if (!ids.length) bad("Pick at least one scrobble");
  return { deleted: await repo.deleteScrobbles(u.id, ids) };
});

router.post<LovedImported>("/api/love/import", async c => {
  const u = need(c), list: unknown[] = Array.isArray(c.body.tracks) ? c.body.tracks : [];
  if (list.length > 5000) bad("At most 5000 loved tracks per request");
  const accepted = await importLoved(u.id, list);
  return { accepted, ignored: list.length - accepted };
});

router.post<Loved>("/api/love", async c => {
  const u = need(c), loved = c.body.loved !== false;
  const track = c.body.trackId ? (await requireItem("track", c.body.trackId, ["track"])).row : await requireTrack(text(c.body.artist), text(c.body.track));
  await repo.setLoved(u.id, track.id, loved);
  return { loved };
});
