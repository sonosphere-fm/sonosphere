import { requireArtist, requireTag } from "../catalog/service";
import { confirmed, need } from "../guards";
import { bad, fail, oneOf, paging, Router } from "../http";
import { range } from "../listening/period";
import * as listening from "../listening/repo";
import { blasts, report, stats } from "../listening/service";
import { notify } from "../notifications/repo";
import { neighbours } from "../recommend/service";
import { artistLibrary, people, profile } from "./profile";
import * as repo from "./repo";
import { canSee, canSeeCharts, requireUser, requireVisibleUser } from "./service";
import { type Blasts, type ListeningStats, type Report, reportType } from "../../shared/listening";
import type {
  FollowResult,
  Neighbours,
  People,
  Profile,
  UserArtistLibrary,
  UserLoved,
  UserRecent,
  UserTags,
  UserTop,
} from "../../shared/users";
import { limit } from "../trust/service";
import { wantCovers } from "../metadata/wanted";

export const router = new Router();

const PRIVATE = "userKeepsTheirListeningPrivate";
const KINDS = ["artists", "albums", "tracks"] as const;

router.get<Profile>("/api/user", async (c) => {
  const u = await requireVisibleUser(c.q.get("name"), c.user);
  return profile(u, c.user);
});

router.get<UserRecent>("/api/user/recent", async (c) => {
  const u = await requireVisibleUser(c.q.get("name"), c.user);
  const pg = paging(c.q);
  const [from, to] = range(c.q);
  if (!canSee(u, c.user)) return { items: [], total: 0, hidden: true, ...pg };
  const scope: listening.Scope = { userId: u.id, from, to, viewerId: c.user?.id };
  if (c.q.get("artist")) scope.artistId = (await requireArtist(c.q.get("artist"))).id;
  const plays = await listening.recent(scope, pg.limit, pg.offset);
  const nowPlaying = pg.page === 1 && !from ? await listening.nowPlaying(u.id, c.user?.id) : null;
  return { ...plays, nowPlaying, ...pg };
});

router.get<UserTop>("/api/user/top", async (c) => {
  const u = await requireVisibleUser(c.q.get("name"), c.user);
  const pg = paging(c.q);
  const [from, to] = range(c.q);
  const kind = oneOf(c.q.get("kind"), KINDS) ?? bad("kindArtistsAlbumsTracks");
  if (!canSeeCharts(u, c.user)) return { items: [], total: 0, hidden: true, ...pg };
  const scope: listening.Scope = { userId: u.id, from, to, viewerId: c.user?.id };
  if (c.q.get("artist")) scope.artistId = (await requireArtist(c.q.get("artist"))).id;
  const chart = await listening.top(kind, scope, pg.limit, pg.offset);
  const counts = pg.page === 1 ? await listening.counts(scope) : undefined;
  return { ...chart, ...pg, counts };
});

router.get<UserArtistLibrary>("/api/user/library/artist", async (c) => {
  const u = await requireVisibleUser(c.q.get("name"), c.user);
  if (!canSeeCharts(u, c.user)) fail(403, PRIVATE);
  return artistLibrary(u, await requireArtist(c.q.get("artist")), c.user?.id);
});

router.get<UserLoved>("/api/user/loved", async (c) => {
  const u = await requireVisibleUser(c.q.get("name"), c.user);
  const pg = paging(c.q);
  if (!canSeeCharts(u, c.user)) return { items: [], total: 0, hidden: true, ...pg };
  const items = wantCovers(await repo.lovedTracksOf(u.id, c.user?.id, pg.limit, pg.offset), (r) => r.id);
  return { items, total: await repo.lovedCount(u.id), ...pg };
});

router.get<People>("/api/user/following", async (c) => {
  const u = await requireVisibleUser(c.q.get("name"), c.user);
  const pg = paging(c.q);
  const items = await people(await repo.followingPage(u.id, pg.limit, pg.offset), c.user?.id);
  return { items, total: await repo.followingCount(u.id), ...pg };
});

router.get<People>("/api/user/followers", async (c) => {
  const u = await requireVisibleUser(c.q.get("name"), c.user);
  const pg = paging(c.q);
  const items = await people(await repo.followerPage(u.id, pg.limit, pg.offset), c.user?.id);
  return { items, total: await repo.followerCount(u.id), ...pg };
});

router.get<Neighbours>("/api/user/neighbours", async (c) => {
  const u = await requireVisibleUser(c.q.get("name"), c.user);
  return canSeeCharts(u, c.user) ? { items: await neighbours(u.id, 24) } : { items: [], hidden: true };
});

router.get<Report>("/api/user/report", async (c) => {
  const u = await requireVisibleUser(c.q.get("name"), c.user);
  if (!canSee(u, c.user)) return fail(403, PRIVATE);
  const type = reportType(c.q.get("type"));
  const offset = Math.max(0, Math.min(520, Number(c.q.get("offset")) || 0));
  const tz = Number(c.q.get("tz")) || 0;
  return report(u.id, type, offset, tz, c.user?.id);
});

router.get<ListeningStats>("/api/user/stats", async (c) => {
  const u = await requireVisibleUser(c.q.get("name"), c.user);
  if (!canSee(u, c.user)) return fail(403, PRIVATE);
  const offset = Math.max(0, Math.min(100, Number(c.q.get("offset")) || 0));
  return stats(u.id, offset, Number(c.q.get("tz")) || 0, c.user?.id);
});

router.get<Blasts>("/api/user/blasts", async (c) => {
  const u = await requireVisibleUser(c.q.get("name"), c.user);
  if (!canSee(u, c.user)) return fail(403, PRIVATE);
  const offset = Math.max(0, Math.min(52, Number(c.q.get("offset")) || 0));
  return blasts(u.id, offset, Number(c.q.get("tz")) || 0, c.user?.id);
});

router.get<UserTags>("/api/user/tags", async (c) => {
  const u = await requireVisibleUser(c.q.get("name"), c.user);
  const tag = c.q.get("tag");
  if (!tag) return { items: await repo.tagsUsedBy(u.id) };
  const t = await requireTag(tag);
  return { items: await repo.taggedBy(u.id, t.id) };
});

router.post<FollowResult>("/api/follow", async (c) => {
  const u = need(c);
  await limit(u, `follow:${u.id}`, 100, 3600, "lotFollowsTryAgainWhile");
  const t = await requireUser(typeof c.body.username === "string" ? c.body.username : null);
  const follow = c.body.follow !== false;
  if (t.id === u.id) bad("cantFollowYourself");
  if (follow) confirmed(u);
  if (follow && (await repo.blockedEither(u.id, t.id))) fail(403, "cantFollowUser");
  if (!follow) await repo.unfollow(u.id, t.id);
  else if (await repo.follow(u.id, t.id)) await notify(t.id, "follow", u.id);
  return { isFollowing: follow };
});
