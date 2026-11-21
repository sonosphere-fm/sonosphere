import { and, count, desc, eq, exists, or, sql } from "drizzle-orm";
import { trackImage } from "../catalog/art";
import { db } from "../db/client";
import { flag, matches } from "../db/dialect";
import { albums, artists, lovedTracks, taggings, tags, tracks, userAlbums, userArtists, userTracks, users } from "../db/schema";
import { publicCols } from "../users/repo";
import { like } from "../util";
import type { FoundAlbum, FoundArtist, FoundTrack, FoundUser } from "../../shared/search";
import type { TagCount } from "../../shared/tags";

// `term` is already normalised.
type Query = { term: string; limit: number; offset: number };

export function searchArtists({ term, limit, offset }: Query): Promise<FoundArtist[]> {
  const heard = db.select({ c: count() }).from(userArtists).where(eq(userArtists.artistId, artists.id));
  const listeners = sql<number>`((${heard}) + ${artists.baseListeners})`.as("listeners");
  return db.select({ id: artists.id, name: artists.name, image: artists.imageId, listeners }).from(artists)
    .where(matches(artists.nameNorm, like(term)))
    .orderBy(desc(eq(artists.nameNorm, term)), desc(listeners))
    .limit(limit)
    .offset(offset);
}

export function searchAlbums({ term, limit, offset }: Query): Promise<FoundAlbum[]> {
  const heard = db.select({ c: count() }).from(userAlbums).where(eq(userAlbums.albumId, albums.id));
  const listeners = sql<number>`((${heard}) + ${albums.baseListeners})`.as("listeners");
  return db.select({ id: albums.id, title: albums.title, image: albums.imageId, artist: artists.name, listeners }).from(albums)
    .innerJoin(artists, eq(artists.id, albums.artistId))
    .where(matches(albums.titleNorm, like(term)))
    .orderBy(desc(eq(albums.titleNorm, term)), desc(listeners))
    .limit(limit)
    .offset(offset);
}

export function searchTracks({ term, limit, offset }: Query, viewerId: number): Promise<FoundTrack[]> {
  const heard = db.select({ c: count() }).from(userTracks).where(eq(userTracks.trackId, tracks.id));
  const plays = db.select({ c: sql<number>`COALESCE(SUM(${userTracks.plays}), 0)` }).from(userTracks)
    .where(eq(userTracks.trackId, tracks.id));
  const loved = db.select({ one: sql`1` }).from(lovedTracks)
    .where(and(eq(lovedTracks.userId, viewerId), eq(lovedTracks.trackId, tracks.id)));
  const listeners = sql<number>`((${heard}) + ${tracks.baseListeners})`.as("listeners");
  return db.select({
    id: tracks.id,
    title: tracks.title,
    duration: tracks.duration,
    artist: artists.name,
    album: albums.title,
    image: trackImage(),
    listeners,
    playcount: sql<number>`((${plays}) + ${tracks.basePlaycount})`.as("playcount"),
    loved: flag(exists(loved)),
  })
    .from(tracks)
    .innerJoin(artists, eq(artists.id, tracks.artistId))
    .leftJoin(albums, eq(albums.id, tracks.albumId))
    .where(matches(tracks.titleNorm, like(term)))
    .orderBy(desc(eq(tracks.titleNorm, term)), desc(listeners))
    .limit(limit)
    .offset(offset);
}

export function searchTags({ term, limit, offset }: Query): Promise<TagCount[]> {
  const applied = db.select({ c: count() }).from(taggings).where(eq(taggings.tagId, tags.id));
  const uses = sql<number>`(${applied})`.as("count");
  return db.select({ name: tags.name, count: uses }).from(tags)
    .where(matches(tags.nameNorm, like(term)))
    .orderBy(desc(uses))
    .limit(limit)
    .offset(offset);
}

export function searchUsers({ term, limit, offset }: Query): Promise<FoundUser[]> {
  const plays = db.select({ c: sql<number>`COALESCE(SUM(${userArtists.plays}), 0)` }).from(userArtists)
    .where(eq(userArtists.userId, users.id));
  const playcount = sql<number>`(${plays})`.as("playcount");
  return db.select({ ...publicCols, playcount }).from(users)
    .where(or(matches(users.usernameNorm, like(term)), matches(sql`lower(${users.realname})`, like(term))))
    .orderBy(desc(playcount))
    .limit(limit)
    .offset(offset);
}
