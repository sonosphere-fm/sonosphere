import { need } from "../guards";
import { bad, missing, oneOf, paging, Router, throttle } from "../http";
import { range } from "../listening/period";
import { counts, nowPlaying, recent, siteTop, topAlbums } from "../listening/repo";
import { requireItem } from "../catalog/service";
import { isDislikeKind } from "../recommend/dislikes";
import { setDislike } from "../recommend/repo";
import { feedback, recommendations } from "../recommend/service";
import { now } from "../util";
import * as repo from "./repo";
import {
  LEADER_BOARDS,
  LEADER_PERIODS,
  type Charts,
  type FriendActivity,
  type Friends,
  type Home,
  type Leaderboard,
  type LeaderPage,
  type Recommended,
} from "../../shared/home";
import type { TopAlbum } from "../../shared/listening";
import { wantCovers } from "../metadata/wanted";

export const router = new Router();

const WEEK = 7 * 86400;
const playedAt = (f: FriendActivity) => ("playedAt" in f.track ? f.track.playedAt : 0);

router.get<Charts>("/api/charts", async (c) => {
  const pg = paging(c.q);
  const [from, to] = range(c.q);
  if (c.q.get("kind") === "tags") {
    const items = await repo.tagChart(pg.limit, pg.offset);
    return { items, total: await repo.usedTagCount(), ...pg };
  }
  const kind = oneOf(c.q.get("kind"), ["artists", "albums", "tracks"]) ?? bad("kindArtistsAlbumsTracksTags");
  const top = await siteTop(kind, { from, to, viewerId: c.user?.id }, pg.limit, pg.offset);
  return { ...top, ...pg };
});

// Those playing now first, then the most recent.
async function friendActivity(viewerId: number): Promise<FriendActivity[]> {
  const found = await Promise.all(
    (await repo.openFollowees(viewerId)).map(async (user): Promise<FriendActivity | null> => {
      const playing = await nowPlaying(user.id, viewerId);
      const track = playing ?? (await recent({ userId: user.id, viewerId }, 1)).items[0];
      return track ? { user, track, nowPlaying: !!playing } : null;
    })
  );
  const out = found.filter((f) => f !== null);
  return out.sort((a, b) => {
    return Number(b.nowPlaying) - Number(a.nowPlaying) || playedAt(b) - playedAt(a);
  });
}

router.get<Friends>("/api/home/friends", async (c) => ({ items: await friendActivity(need(c).id) }));

router.get<Home>(
  "/api/home",
  async (c) => {
    const viewerId = c.user?.id;
    // "This week" needs enough recent listening to mean something; otherwise show the all-time lists.
    const since = now() - WEEK;
    const busy = (await counts({ from: since })).listeners >= 3;
    const week = busy ? since : undefined;
    const [trendingArtists, trendingTracks, trendingAlbums, tags, events, stats] = await Promise.all([
      siteTop("artists", { from: week }, 12),
      siteTop("tracks", { from: week, viewerId }, 10),
      siteTop("albums", { from: week }, 6),
      repo.popularTags(18),
      repo.upcomingEvents(now(), viewerId, 4),
      repo.siteTotals(),
    ]);
    const out: Home = {
      trendingPeriod: busy ? "week" : "overall",
      trendingArtists: trendingArtists.items,
      trendingTracks: trendingTracks.items,
      trendingAlbums: trendingAlbums.items,
      tags,
      events,
      stats,
    };
    if (viewerId) {
      const [friends, friendLoves, thisWeek, lastWeek] = await Promise.all([
        friendActivity(viewerId),
        repo.friendLoves(viewerId, 8).then((rows) => wantCovers(rows, (r) => r.id)),
        counts({ userId: viewerId, from: since }),
        counts({ userId: viewerId, from: since - WEEK, to: since }),
      ]);
      out.friends = friends;
      out.friendLoves = friendLoves;
      out.week = { now: thisWeek.playcount, before: lastWeek.playcount };
    }
    return out;
  },
  { edgeMaxAge: 30 }
);

router.get<Recommended>("/api/recommended", async (c) => {
  const u = need(c);
  const fb = await feedback(u.id);
  const [{ artists, tracks }, events] = await Promise.all([
    recommendations(u.id, u.id, 30, 30, fb),
    repo.upcomingEvents(now(), u.id, 20),
  ]);
  const tops = await Promise.all(artists.slice(0, 18).map((a) => topAlbums({ artistId: a.id, global: true }, 1)));
  const albums: TopAlbum[] = tops.flatMap((t) => t.items).filter((a) => !fb.albums.has(a.id));
  return { artists, tracks, albums, events };
});

router.post<{ dismissed: boolean }>("/api/recommended/dismiss", async (c) => {
  const u = need(c);
  const kind = c.body.kind;
  if (!isDislikeKind(kind)) return bad("invalidItemType");
  await throttle(`dismiss:${u.id}`, 300, 3600);
  const { row } = await requireItem(kind, c.body.id, [kind]);
  const artistId = "artistId" in row ? row.artistId : row.id;
  const dismissed = c.body.dismissed !== false;
  await setDislike(u.id, kind, row.id, artistId, dismissed);
  return { dismissed };
});

const leaderPeriod = (q: URLSearchParams) =>
  oneOf(q.get("period") ?? "7day", LEADER_PERIODS) ?? bad("periodWeekMonthYearOverall");

router.get<Leaderboard>("/api/leaderboard", (c) => repo.leaderboard(leaderPeriod(c.q)), { edgeMaxAge: 60 });

router.get<LeaderPage>(
  "/api/leaderboard/:board",
  (c) => {
    const board = oneOf(c.params[0], LEADER_BOARDS) ?? missing("notFound");
    return repo.leaderPage(board, leaderPeriod(c.q), paging(c.q, 50, 100));
  },
  { edgeMaxAge: 60 }
);
