// Site charts, the home page and the recommendations page.
import { need } from "../guards";
import { bad, oneOf, paging, Router } from "../http";
import { range } from "../listening/period";
import { counts, nowPlaying, recent, top, topAlbums, topArtists, topTracks } from "../listening/repo";
import { recommendations, recommendedArtists } from "../recommend/service";
import { now } from "../util";
import * as repo from "./repo";
import type { Charts, FriendActivity, Home, Recommended } from "../../shared/home";
import type { TopAlbum, TopTrack } from "../../shared/listening";

export const router = new Router();

const WEEK = 7 * 86400;
const playedAt = (f: FriendActivity) => ("playedAt" in f.track ? f.track.playedAt : 0);

router.get<Charts>("/api/charts", async c => {
  const pg = paging(c.q), [from, to] = range(c.q);
  if (c.q.get("kind") === "tags") return { items: await repo.tagChart(pg.limit, pg.offset), total: await repo.usedTagCount(), ...pg };
  const kind = oneOf(c.q.get("kind"), ["artists", "albums", "tracks"]) ?? bad("kind must be artists, albums, tracks or tags");
  return { ...(await top(kind, { from, to, viewerId: c.user?.id, global: true }, pg.limit, pg.offset)), ...pg };
});

/** What each person the viewer follows is playing or played last: those playing now first, then the most recent. */
async function friendActivity(viewerId: number): Promise<FriendActivity[]> {
  const out: FriendActivity[] = [];
  for (const user of await repo.openFollowees(viewerId)) {
    const playing = await nowPlaying(user.id, viewerId);
    const track = playing ?? (await recent({ userId: user.id, viewerId }, 1)).items[0];
    if (track) out.push({ user, track, nowPlaying: !!playing });
  }
  return out.sort((a, b) => Number(b.nowPlaying) - Number(a.nowPlaying) || playedAt(b) - playedAt(a));
}

router.get<Home>("/api/home", async c => {
  const viewerId = c.user?.id;
  // "This week" needs enough recent listening to mean something; otherwise show the all-time lists.
  const since = now() - WEEK;
  const busy = (await counts({ from: since })).listeners >= 3;
  const week = busy ? since : undefined;
  const out: Home = {
    trendingPeriod: busy ? "week" : "overall",
    trendingArtists: (await topArtists({ from: week, global: true }, 12)).items,
    trendingTracks: (await topTracks({ from: week, viewerId, global: true }, 10)).items,
    trendingAlbums: (await topAlbums({ from: week, global: true }, 6)).items,
    tags: await repo.popularTags(18),
    events: await repo.upcomingEvents(now(), viewerId, 4),
    stats: await repo.siteTotals(),
  };
  if (viewerId) {
    out.friends = await friendActivity(viewerId);
    out.friendLoves = await repo.friendLoves(viewerId, 8);
    out.recommended = await recommendedArtists(viewerId, 6);
    out.week = { now: (await counts({ userId: viewerId, from: since })).playcount, before: (await counts({ userId: viewerId, from: since - WEEK, to: since })).playcount };
  }
  return out;
});

router.get<Recommended>("/api/recommended", async c => {
  const u = need(c), { artists, tracks } = await recommendations(u.id, u.id, 30, 30);
  const albums: TopAlbum[] = [];
  for (const a of artists.slice(0, 18)) albums.push(...(await topAlbums({ artistId: a.id, global: true }, 1)).items);
  return { artists, tracks, albums, events: await repo.upcomingEvents(now(), u.id, 20) };
});
