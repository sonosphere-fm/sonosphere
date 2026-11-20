// Puts together what the profile pages show: the profile itself, lists of people, and a listener's history with one artist.
import { shoutCount } from "../shouts/repo";
import type { Viewer } from "../http";
import * as listening from "../listening/repo";
import { obsessionsOf } from "../obsessions/repo";
import { taste } from "../recommend/service";
import { now } from "../util";
import * as repo from "./repo";
import { canSee } from "./service";
import type { Person, Profile, PublicUser, UserArtistLibrary, WeekCount } from "../../shared/users";

/** Everything on a profile page, as `viewer` (null when signed out) may see it. */
export async function profile(u: repo.User, viewer: Viewer | null): Promise<Profile> {
  const stats = await listening.counts({ userId: u.id }), visible = canSee(u, viewer);
  return {
    ...repo.publicUser(u), about: u.about, website: u.website, registeredAt: u.registeredAt, hidden: !visible, shoutsEnabled: u.shoutsEnabled,
    playcount: stats.playcount, artistCount: stats.artists, albumCount: stats.albums, trackCount: stats.tracks,
    lovedCount: await repo.lovedCount(u.id), followers: await repo.followerCount(u.id), following: await repo.followingCount(u.id),
    isFollowing: !!viewer && await repo.isFollowing(viewer.id, u.id),
    followsYou: !!viewer && await repo.isFollowing(u.id, viewer.id),
    nowPlaying: visible ? await listening.nowPlaying(u.id, viewer?.id) : null,
    taste: viewer && viewer.id !== u.id ? await taste(viewer.id, u.id) : null,
    obsession: (await obsessionsOf(u.id, viewer?.id, 1))[0] ?? null,
    shoutCount: await shoutCount("user", u.id), journalCount: await repo.journalCount(u.id),
    blocked: !!viewer && await repo.hasBlocked(viewer.id, u.id),
    suspended: u.suspended, banned: u.banned,
  };
}

/** Adds to each person what a list of people shows: their plays, their last track, and whether the viewer follows them. */
export const people = (list: PublicUser[], viewerId: number | undefined): Promise<Person[]> =>
  Promise.all(list.map(async p => ({
    ...p, playcount: await repo.playcount(p.id), isFollowing: !!viewerId && await repo.isFollowing(viewerId, p.id), lastTrack: await repo.lastTrack(p.id),
  })));

const WEEK = 604800, THURSDAY = 259200; // weeks run Monday to Sunday; the epoch fell on a Thursday

/** Plays per week over the last `weeks` weeks, oldest first, with empty weeks included. */
async function trend(scope: listening.Scope, weeks: number): Promise<WeekCount[]> {
  const end = Math.floor((now() + THURSDAY) / WEEK), firstWeek = end - weeks + 1;
  const rows = new Map((await listening.series({ ...scope, from: firstWeek * WEEK - THURSDAY }, "week")).map(r => [Number(r.k), r.c]));
  return Array.from({ length: weeks }, (_, i) => ({ start: (firstWeek + i) * WEEK - THURSDAY, count: rows.get(firstWeek + i) || 0 }));
}

/** One listener's history with one artist: totals, first play, favourite tracks and albums, and a year of weekly plays. */
export async function artistLibrary(u: repo.User, a: { id: number; name: string; imageId: number | null }, viewerId: number | undefined): Promise<UserArtistLibrary> {
  const scope: listening.Scope = { userId: u.id, artistId: a.id, viewerId };
  return {
    artist: { id: a.id, name: a.name, image: a.imageId }, counts: await listening.counts(scope), first: await repo.firstPlay(u.id, a.id),
    tracks: (await listening.topTracks(scope, 50)).items, albums: (await listening.topAlbums(scope, 12)).items, trend: await trend(scope, 52),
  };
}
