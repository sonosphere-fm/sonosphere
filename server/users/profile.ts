import { shoutCount } from "../shouts/repo";
import type { Viewer } from "../http";
import * as listening from "../listening/repo";
import { obsessionsOf } from "../obsessions/repo";
import { taste } from "../recommend/service";
import { now } from "../util";
import * as repo from "./repo";
import { appearanceFor } from "./appearance";
import { canSee, canSeeCharts } from "./service";
import type { Person, Profile, PublicUser, UserArtistLibrary, WeekCount } from "../../shared/users";

export async function profile(u: repo.User, viewer: Viewer | null): Promise<Profile> {
  const visible = canSee(u, viewer);
  const open = canSeeCharts(u, viewer);
  const [
    stats,
    lovedCount,
    followers,
    following,
    isFollowing,
    followsYou,
    nowPlaying,
    tasteMatch,
    obsessions,
    shouts,
    journalCount,
    blocked,
  ] = await Promise.all([
    open ? listening.counts({ userId: u.id }) : { playcount: 0, artists: 0, albums: 0, tracks: 0 },
    open ? repo.lovedCount(u.id) : 0,
    repo.followerCount(u.id),
    repo.followingCount(u.id),
    !!viewer && repo.isFollowing(viewer.id, u.id),
    !!viewer && repo.isFollowing(u.id, viewer.id),
    visible ? listening.nowPlaying(u.id, viewer?.id) : null,
    viewer && viewer.id !== u.id && open ? taste(viewer.id, u.id) : null,
    obsessionsOf(u.id, viewer?.id, 1),
    shoutCount("user", u.id),
    repo.journalCount(u.id),
    !!viewer && repo.hasBlocked(viewer.id, u.id),
  ]);
  return {
    ...repo.publicUser(u),
    ...(await appearanceFor(u.id)),
    banner: u.bannerId,
    about: u.about,
    pronouns: u.pronouns,
    links: storedProfileLinks(u.profileLinks),
    registeredAt: u.registeredAt,
    hidden: !visible,
    locked: !open,
    shoutsEnabled: u.shoutsEnabled,
    playcount: stats.playcount,
    artistCount: stats.artists,
    albumCount: stats.albums,
    trackCount: stats.tracks,
    lovedCount,
    followers,
    following,
    isFollowing: !!isFollowing,
    followsYou: !!followsYou,
    nowPlaying,
    taste: tasteMatch,
    obsession: obsessions[0] ?? null,
    shoutCount: shouts,
    journalCount,
    blocked: !!blocked,
    suspended: u.suspended,
    banned: u.banned,
  };
}

// Private listeners appear without their play count.
export async function people(list: PublicUser[], viewerId: number | undefined): Promise<Person[]> {
  const ids = list.map((p) => p.id);
  const [shut, plays, followed, last] = await Promise.all([
    repo.privateAmong(ids.filter((id) => id !== viewerId)),
    repo.playcounts(ids),
    viewerId ? repo.followedAmong(viewerId, ids) : new Set<number>(),
    repo.lastTracks(ids),
  ]);
  return list.map((p) => ({
    ...p,
    ...(shut.has(p.id) ? {} : { playcount: plays.get(p.id) ?? 0 }),
    isFollowing: followed.has(p.id),
    lastTrack: last.get(p.id) ?? null,
  }));
}

// Weeks run Monday to Sunday; the epoch fell on a Thursday.
const WEEK = 604800;
const THURSDAY = 259200;

async function trend(scope: listening.Scope, weeks: number): Promise<WeekCount[]> {
  const end = Math.floor((now() + THURSDAY) / WEEK);
  const firstWeek = end - weeks + 1;
  const series = await listening.series({ ...scope, from: firstWeek * WEEK - THURSDAY }, "week");
  const rows = new Map(series.map((r) => [Number(r.k), r.c]));
  return Array.from({ length: weeks }, (_, i) => ({
    start: (firstWeek + i) * WEEK - THURSDAY,
    count: rows.get(firstWeek + i) || 0,
  }));
}

export async function artistLibrary(
  u: repo.User,
  a: { id: number; name: string; imageId: string | null },
  viewerId: number | undefined
): Promise<UserArtistLibrary> {
  const scope: listening.Scope = { userId: u.id, artistId: a.id, viewerId };
  return {
    artist: { id: a.id, name: a.name, image: a.imageId },
    counts: await listening.counts(scope),
    first: await repo.firstPlay(u.id, a.id),
    tracks: (await listening.topTracks(scope, 50)).items,
    albums: (await listening.topAlbums(scope, 12)).items,
    trend: await trend(scope, 52),
  };
}
import { storedProfileLinks } from "../../shared/profile-links";
