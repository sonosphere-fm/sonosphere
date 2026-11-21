// Users API: profiles and everything hanging off one (recent plays, charts, library, loved tracks, people, reports, tags), plus following.
import { requireArtist, requireTag } from "../catalog/service";
import { need } from "../guards";
import { bad, fail, missing, oneOf, paging, Router, throttle } from "../http";
import { range } from "../listening/period";
import * as listening from "../listening/repo";
import { report } from "../listening/service";
import { notify } from "../notifications/repo";
import { neighbours } from "../recommend/service";
import { isStaff } from "../site/roles";
import { artistLibrary, people, profile } from "./profile";
import * as repo from "./repo";
import { canSee, requireUser } from "./service";
import type { Report } from "../../shared/listening";
import type { FollowResult, Neighbours, People, Profile, UserArtistLibrary, UserLoved, UserRecent, UserTags, UserTop } from "../../shared/users";

export const router = new Router();

const KINDS = ["artists", "albums", "tracks"] as const;

router.get<Profile>("/api/user", async c => {
  const u = await requireUser(c.q.get("name"));
  if (u.banned && !isStaff(c.user)) return missing("User"); // banned profiles are hidden from everyone but staff
  return profile(u, c.user);
});

router.get<UserRecent>("/api/user/recent", async c => {
  const u = await requireUser(c.q.get("name")), pg = paging(c.q), [from, to] = range(c.q);
  if (!canSee(u, c.user)) return { items: [], total: 0, hidden: true, ...pg };
  const scope: listening.Scope = { userId: u.id, from, to, viewerId: c.user?.id };
  if (c.q.get("artist")) scope.artistId = (await requireArtist(c.q.get("artist"))).id;
  return { ...(await listening.recent(scope, pg.limit, pg.offset)), nowPlaying: pg.page === 1 && !from ? await listening.nowPlaying(u.id, c.user?.id) : null, ...pg };
});

router.get<UserTop>("/api/user/top", async c => {
  const u = await requireUser(c.q.get("name")), pg = paging(c.q), [from, to] = range(c.q);
  const kind = oneOf(c.q.get("kind"), KINDS) ?? bad("kind must be artists, albums or tracks");
  const scope: listening.Scope = { userId: u.id, from, to, viewerId: c.user?.id };
  if (c.q.get("artist")) scope.artistId = (await requireArtist(c.q.get("artist"))).id;
  return { ...(await listening.top(kind, scope, pg.limit, pg.offset)), ...pg, counts: pg.page === 1 ? await listening.counts(scope) : undefined };
});

router.get<UserArtistLibrary>("/api/user/library/artist", async c =>
  artistLibrary(await requireUser(c.q.get("name")), await requireArtist(c.q.get("artist")), c.user?.id));

router.get<UserLoved>("/api/user/loved", async c => {
  const u = await requireUser(c.q.get("name")), pg = paging(c.q);
  return { items: await repo.lovedTracksOf(u.id, c.user?.id, pg.limit, pg.offset), total: await repo.lovedCount(u.id), ...pg };
});

router.get<People>("/api/user/following", async c => ({ items: await people(await repo.followingOf((await requireUser(c.q.get("name"))).id), c.user?.id) }));
router.get<People>("/api/user/followers", async c => ({ items: await people(await repo.followersOf((await requireUser(c.q.get("name"))).id), c.user?.id) }));
router.get<Neighbours>("/api/user/neighbours", async c => ({ items: await neighbours((await requireUser(c.q.get("name"))).id, 24) }));

router.get<Report>("/api/user/report", async c => {
  const u = await requireUser(c.q.get("name"));
  if (!canSee(u, c.user)) return fail(403, "This user keeps their listening private");
  const type = c.q.get("type") === "year" ? "year" : "week";
  return report(u.id, type, Math.max(0, Math.min(520, Number(c.q.get("offset")) || 0)), Number(c.q.get("tz")) || 0, c.user?.id);
});

router.get<UserTags>("/api/user/tags", async c => {
  const u = await requireUser(c.q.get("name")), tag = c.q.get("tag");
  return { items: tag ? await repo.taggedBy(u.id, (await requireTag(tag)).id) : await repo.tagsUsedBy(u.id) };
});

router.post<FollowResult>("/api/follow", async c => {
  const u = need(c);
  await throttle(`follow:${u.id}`, 100, 3600, "That is a lot of follows. Try again in a while.");
  const t = await requireUser(typeof c.body.username === "string" ? c.body.username : null);
  const follow = c.body.follow !== false;
  if (t.id === u.id) bad("You can't follow yourself");
  if (follow && await repo.blockedEither(u.id, t.id)) fail(403, "You can't follow this user");
  if (!follow) await repo.unfollow(u.id, t.id);
  else if (await repo.follow(u.id, t.id)) await notify(t.id, "follow", u.id);
  return { isFollowing: follow };
});
