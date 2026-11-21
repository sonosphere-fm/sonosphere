// Puts together what the profile pages show: the profile itself, lists of people, and a listener's history with one artist.
import { shoutCount } from "../shouts/repo";
import type { Viewer } from "../http";
import * as listening from "../listening/repo";
import { obsessionsOf } from "../obsessions/repo";
import { taste } from "../recommend/service";
import { now } from "../util";
import * as repo from "./repo";
import { canSee, canSeeCharts } from "./service";
import type { Person, Profile, PublicUser, UserArtistLibrary, WeekCount } from "../../shared/users";

/** Everything on a profile page, as `viewer` (null when signed out) may see it. */
export async function profile(u: repo.User, viewer: Viewer | null): Promise<Profile> {
  const visible = canSee(u, viewer), open = canSeeCharts(u, viewer);
  // independent lookups: run them side by side rather than one after another
  const [stats, lovedCount, followers, following, isFollowing, followsYou, nowPlaying, tasteMatch, obsessions, shouts, journalCount, blocked] = await Promise.all([
    // a private listener's numbers are left at zero for others (the page shows none of them)
    open ? listening.counts({ userId: u.id }) : { playcount: 0, artists: 0, albums: 0, tracks: 0 },
    open ? repo.lovedCount(u.id) : 0, repo.followerCount(u.id), repo.followingCount(u.id),
    !!viewer && repo.isFollowing(viewer.id, u.id), !!viewer && repo.isFollowing(u.id, viewer.id),
    visible ? listening.nowPlaying(u.id, viewer?.id) : null,
    viewer && viewer.id !== u.id && open ? taste(viewer.id, u.id) : null,
    obsessionsOf(u.id, viewer?.id, 1), shoutCount("user", u.id), repo.journalCount(u.id),
    !!viewer && repo.hasBlocked(viewer.id, u.id),
  ]);
  return {
    ...repo.publicUser(u), about: u.about, website: u.website, registeredAt: u.registeredAt, hidden: !visible, locked: !open, shoutsEnabled: u.shoutsEnabled,
    playcount: stats.playcount, artistCount: stats.artists, albumCount: stats.albums, trackCount: stats.tracks,
    lovedCount, followers, following, isFollowing: !!isFollowing, followsYou: !!followsYou, nowPlaying, taste: tasteMatch,
    obsession: obsessions[0] ?? null, shoutCount: shouts, journalCount, blocked: !!blocked,
    suspended: u.suspended, banned: u.banned,
  };
}

/** Adds to each person what a list of people shows: their plays, their last track, and whether the viewer follows them. */
/** Private listeners appear without their play count. */
export async function people(list: PublicUser[], viewerId: number | undefined): Promise<Person[]> {
  const shut = await repo.privateAmong(list.map(p => p.id).filter(id => id !== viewerId));
  return Promise.all(list.map(async p => ({
    ...p, ...(shut.has(p.id) ? {} : { playcount: await repo.playcount(p.id) }),
    isFollowing: !!viewerId && await repo.isFollowing(viewerId, p.id), lastTrack: await repo.lastTrack(p.id),
  })));
}

const WEEK = 604800, THURSDAY = 259200; // weeks run Monday to Sunday; the epoch fell on a Thursday

/** Plays per week over the last `weeks` weeks, oldest first, with empty weeks included. */
async function trend(scope: listening.Scope, weeks: number): Promise<WeekCount[]> {
  const end = Math.floor((now() + THURSDAY) / WEEK), firstWeek = end - weeks + 1;
  const rows = new Map((await listening.series({ ...scope, from: firstWeek * WEEK - THURSDAY }, "week")).map(r => [Number(r.k), r.c]));
  return Array.from({ length: weeks }, (_, i) => ({ start: (firstWeek + i) * WEEK - THURSDAY, count: rows.get(firstWeek + i) || 0 }));
}

/** One listener's history with one artist: totals, first play, favourite tracks and albums, and a year of weekly plays. */
export async function artistLibrary(u: repo.User, a: { id: number; name: string; imageId: string | null }, viewerId: number | undefined): Promise<UserArtistLibrary> {
  const scope: listening.Scope = { userId: u.id, artistId: a.id, viewerId };
  return {
    artist: { id: a.id, name: a.name, image: a.imageId }, counts: await listening.counts(scope), first: await repo.firstPlay(u.id, a.id),
    tracks: (await listening.topTracks(scope, 50)).items, albums: (await listening.topAlbums(scope, 12)).items, trend: await trend(scope, 52),
  };
}
