import { mbidOfAlbum, mbidOfArtist } from "../corrections/service";
import { counts, series, topTracks, type Scope } from "../listening/repo";
import { similarArtists, similarTracks } from "../recommend/service";
import { shoutCount } from "../shouts/repo";
import { myTags, topTags } from "../tags/repo";
import { now } from "../util";
import { latestWiki } from "../wiki/repo";
import type { AlbumPage, ArtistPage, ArtistSimilar, TrackPage, TrendPoint } from "../../shared/catalog";
import * as repo from "./repo";
import { wantBare } from "../metadata/wanted";

const WEEK = 604800;
// weeks start on Monday; the epoch fell on a Thursday
const SHIFT = 259200;

/** Plays per week, oldest first, with empty weeks included. */
async function trend(scope: Scope, weeks = 26): Promise<TrendPoint[]> {
  const end = Math.floor((now() + SHIFT) / WEEK);
  const first = end - weeks + 1;
  const rows = await series({ ...scope, from: first * WEEK - SHIFT }, "week");
  const plays = new Map(rows.map(r => [Number(r.k), r.c]));
  return Array.from({ length: weeks }, (_, i) => ({
    start: (first + i) * WEEK - SHIFT,
    count: plays.get(first + i) || 0,
  }));
}

export async function artistPage(a: repo.Artist, viewerId: number | undefined): Promise<ArtistPage> {
  const stats = await counts({ artistId: a.id });
  const weekTracks = await topTracks({ artistId: a.id, from: now() - 7 * 86400, global: true }, 1);
  return {
    id: a.id,
    name: a.name,
    mbid: mbidOfArtist(a.name) || a.mbid || "",
    spotifyId: a.spotifyId || "",
    image: a.imageId,
    listeners: stats.listeners,
    playcount: stats.playcount,
    userPlaycount: viewerId ? (await counts({ artistId: a.id, userId: viewerId })).playcount : 0,
    tags: await topTags("artist", a.id, 8),
    myTags: await myTags(viewerId, "artist", a.id),
    wiki: await latestWiki("artist", a.id),
    similar: await similarArtists(a.id, 6),
    topTracks: (await topTracks({ artistId: a.id, viewerId, global: true }, 10)).items,
    topAlbums: wantBare("album", await repo.popularAlbums(a.id, 8), r => r.id),
    latestAlbum: await repo.latestAlbum(a.id),
    weekTrack: weekTracks.items[0] ?? null,
    albumCount: await repo.albumCount(a.id),
    trackCount: await repo.trackCount(a.id),
    trend: await trend({ artistId: a.id }),
    topListeners: await repo.topListeners("artist", a.id, 8),
    events: await repo.eventsWithArtist(a.id, now() - 86400, viewerId ?? 0, 4),
    shoutCount: await shoutCount("artist", a.id),
  };
}

export async function similarWithTags(artistId: number): Promise<ArtistSimilar["items"]> {
  const out: ArtistSimilar["items"] = [];
  for (const s of await similarArtists(artistId, 40)) {
    const tags = await topTags("artist", s.id, 3);
    out.push({ ...s, tags: tags.map(t => t.name) });
  }
  return out;
}

export async function albumPage(al: repo.AlbumWithArtist, viewerId: number): Promise<AlbumPage> {
  const stats = await counts({ albumId: al.id });
  const artistImage = (await repo.findItem("artist", al.artistId))?.imageId ?? null;
  const tracks = (await repo.trackList(al.id, viewerId)).map(t => ({
    position: t.position,
    id: t.id,
    title: t.title,
    duration: t.duration,
    artist: al.artist,
    album: al.title,
    image: al.imageId ?? artistImage,
    playcount: t.playcount,
    listeners: t.listeners,
    loved: t.loved,
  }));
  return {
    id: al.id,
    title: al.title,
    artist: al.artist,
    mbid: mbidOfAlbum(al.artist, al.title) || al.mbid || "",
    image: al.imageId,
    releaseDate: al.releaseDate,
    artistImage,
    listeners: stats.listeners,
    playcount: stats.playcount,
    userPlaycount: viewerId ? (await counts({ albumId: al.id, userId: viewerId })).playcount : 0,
    tags: await topTags("album", al.id, 8),
    myTags: await myTags(viewerId, "album", al.id),
    wiki: await latestWiki("album", al.id),
    tracks,
    duration: tracks.reduce((sum, t) => sum + t.duration, 0),
    otherAlbums: wantBare("album", await repo.otherAlbums(al.artistId, al.id, 6), r => r.id),
    trend: await trend({ albumId: al.id }),
    topListeners: await repo.topListeners("album", al.id, 8),
    shoutCount: await shoutCount("album", al.id),
  };
}

export async function trackPage(t: repo.TrackWithArtist, viewerId: number): Promise<TrackPage> {
  const stats = await counts({ trackId: t.id });
  const album = t.albumId ? await repo.findItem("album", t.albumId) : null;
  return {
    id: t.id,
    title: t.title,
    artist: t.artist,
    duration: t.duration,
    album: album?.title ?? null,
    image: album?.imageId ?? null,
    artistImage: (await repo.findItem("artist", t.artistId))?.imageId ?? null,
    listeners: stats.listeners,
    playcount: stats.playcount,
    userPlaycount: viewerId ? await repo.trackPlaysBy(t.id, viewerId) : 0,
    loved: await repo.hasLoved(viewerId, t.id),
    loves: await repo.loveCount(t.id),
    tags: await topTags("track", t.id, 8),
    myTags: await myTags(viewerId, "track", t.id),
    wiki: await latestWiki("track", t.id),
    albums: wantBare("album", await repo.albumsWithTrack(t.id, t.artist), r => r.id),
    similar: await similarTracks(t.id, t.artistId, viewerId, 10),
    trend: await trend({ trackId: t.id }),
    topListeners: await repo.topListeners("track", t.id, 8),
    shoutCount: await shoutCount("track", t.id),
  };
}
