import { requireItem, requireTrack } from "../catalog/service";
import { need } from "../guards";
import { bad, int, missing, oneOf, Router, throttle, type Ctx } from "../http";
import { requestLocale } from "../i18n";
import { clean } from "../util";
import * as repo from "./repo";
import { editScrobble, editScrobbles, importLoved, scrobbleMany, setNowPlaying, type ScrobbleInput } from "./service";
import type { Ok } from "../../shared/auth";
import type {
  Loved,
  LovedImported,
  ScopeCounts,
  ScrobbleEdited,
  ScrobbleResponse,
  ScrobblesDeleted,
} from "../../shared/listening";

export const router = new Router();

const SCOPES = ["track", "album", "artist"] as const;
const asInput = (v: unknown): ScrobbleInput => (typeof v === "object" && v !== null ? v : {});
const text = (v: unknown): string | null => (typeof v === "string" ? v : null);

async function ownScrobble(c: Ctx) {
  const id = int(c.params[0]);
  const found = id === null ? null : await repo.findScrobble(need(c).id, id);
  return found ?? missing("scrobbleNotFound");
}

router.post<ScrobbleResponse>("/api/scrobble", async (c) => {
  const u = need(c);
  await throttle(`scrobble-web:${u.id}`, 200, 3600, "tooManyScrobblesFromWebsite");
  const list: unknown[] = Array.isArray(c.body.tracks) ? c.body.tracks : [c.body];
  if (list.length > 5000) bad("tooManyScrobblesPerRequest");
  const inputs = list.map(asInput);
  const results = await scrobbleMany(u.id, inputs, clean(c.body.source, 20) || "web", requestLocale(c.req));
  const details: ScrobbleResponse["details"] = [];
  let accepted = 0;
  results.forEach((r, i) => {
    if (r.accepted) accepted++;
    else if (details.length < 20)
      details.push({ artist: inputs[i]?.artist, track: inputs[i]?.track, reason: r.reason });
  });
  return { accepted, ignored: list.length - accepted, details };
});

router.post<Ok>("/api/nowplaying", async (c) => {
  const u = need(c);
  if (c.body.stop) await repo.clearNowPlaying(u.id);
  else if (!(await setNowPlaying(u.id, c.body))) bad("artistTrackRequired");
  return { ok: true };
});

router.delete<Ok>("/api/scrobble/:id", async (c) => {
  const u = need(c);
  const id = int(c.params[0]);
  if (id === null || !(await repo.deleteScrobble(u.id, id))) missing("scrobbleNotFound");
  return { ok: true };
});

router.get<ScopeCounts>("/api/scrobble/:id/scope", async (c) => repo.scopeCounts(await ownScrobble(c)));

router.patch<ScrobbleEdited>("/api/scrobble/:id", async (c) => {
  const s = await ownScrobble(c);
  const scope = oneOf(c.body.scope, SCOPES);
  // with a scope, the same correction goes to every play sharing this one's track, album or artist
  if (scope) return { ok: true, changed: await editScrobbles(s, scope, c.body) };
  await editScrobble(s.id, c.body);
  return { ok: true, changed: 1 };
});

router.post<ScrobblesDeleted>("/api/scrobbles/delete", async (c) => {
  const u = need(c);
  const raw = Array.isArray(c.body.ids) ? c.body.ids : [];
  const ids = raw.map(Number).filter(Number.isInteger).slice(0, 1000);
  if (!ids.length) bad("pickLeastOneScrobble");
  return { deleted: await repo.deleteScrobbles(u.id, ids) };
});

router.post<ScrobblesDeleted>("/api/scrobbles/delete-by", async (c) => {
  const u = need(c);
  const scope = oneOf(c.body.scope, SCOPES) ?? bad("chooseWhatRemoveScrobbles");
  const item = await requireItem(scope, c.body.id, [scope]);
  return { deleted: await repo.deleteScrobblesBy(u.id, scope, item.row.id) };
});

router.post<LovedImported>("/api/love/import", async (c) => {
  const u = need(c);
  const list: unknown[] = Array.isArray(c.body.tracks) ? c.body.tracks : [];
  if (list.length > 5000) bad("tooManyLovesPerRequest");
  const accepted = await importLoved(u.id, list);
  return { accepted, ignored: list.length - accepted };
});

router.post<Loved>("/api/love", async (c) => {
  const u = need(c);
  const loved = c.body.loved !== false;
  await throttle(`love:${u.id}`, 300, 3600);
  const track = c.body.trackId
    ? (await requireItem("track", c.body.trackId, ["track"])).row
    : await requireTrack(text(c.body.artist), text(c.body.track));
  await repo.setLoved(u.id, track.id, loved);
  return { loved };
});
