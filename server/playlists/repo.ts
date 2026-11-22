import { and, asc, count, desc, eq, getTableColumns, sql } from "drizzle-orm";
import { trackImage } from "../catalog/art";
import { alias } from "drizzle-orm/pg-core";
import { db, transact } from "../db/client";
import { albums, artists, playlists, playlistTracks, tracks, users } from "../db/schema";
import { lovedBy } from "../users/repo";
import { first, now } from "../util";
import type { PlaylistCard, PlaylistTrack } from "../../shared/playlists";

export type Playlist = typeof playlists.$inferSelect;
type PlaylistWithOwner = Playlist & { owner: string };

export function playlistsOf(userId: number): Promise<PlaylistCard[]> {
  const p = alias(playlists, "p");
  const size = db.select({ c: count() }).from(playlistTracks).where(eq(playlistTracks.playlistId, p.id));
  const cover = db
    .select({ image: trackImage() })
    .from(playlistTracks)
    .innerJoin(tracks, eq(tracks.id, playlistTracks.trackId))
    .innerJoin(artists, eq(artists.id, tracks.artistId))
    .leftJoin(albums, eq(albums.id, tracks.albumId))
    .where(eq(playlistTracks.playlistId, p.id))
    .orderBy(asc(playlistTracks.position))
    .limit(1);
  return db
    .select({
      id: p.id,
      title: p.title,
      description: p.description,
      createdAt: p.createdAt,
      trackCount: sql<number>`${size}`,
      image: sql<string | null>`${cover}`,
    })
    .from(p)
    .where(eq(p.userId, userId))
    .orderBy(desc(p.createdAt));
}

export const findPlaylist = (id: number): Promise<PlaylistWithOwner | null> =>
  first(
    db
      .select({ ...getTableColumns(playlists), owner: users.username })
      .from(playlists)
      .innerJoin(users, eq(users.id, playlists.userId))
      .where(eq(playlists.id, id))
      .limit(1)
  );

export const findOwnPlaylist = (id: number, userId: number): Promise<Playlist | null> =>
  first(
    db
      .select()
      .from(playlists)
      .where(and(eq(playlists.id, id), eq(playlists.userId, userId)))
      .limit(1)
  );

export function tracksOn(playlistId: number, viewerId: number | undefined): Promise<PlaylistTrack[]> {
  return db
    .select({
      entryId: playlistTracks.id,
      id: tracks.id,
      title: tracks.title,
      duration: tracks.duration,
      artist: artists.name,
      album: albums.title,
      image: trackImage(),
      loved: lovedBy(viewerId),
    })
    .from(playlistTracks)
    .innerJoin(tracks, eq(tracks.id, playlistTracks.trackId))
    .innerJoin(artists, eq(artists.id, tracks.artistId))
    .leftJoin(albums, eq(albums.id, tracks.albumId))
    .where(eq(playlistTracks.playlistId, playlistId))
    .orderBy(asc(playlistTracks.position), asc(playlistTracks.id));
}

export async function createPlaylist(userId: number, title: string, description: string): Promise<number> {
  const [row] = await db
    .insert(playlists)
    .values({ userId, title, description, createdAt: now() })
    .returning({ id: playlists.id });
  if (!row) throw new Error("Playlist was not saved");
  return row.id;
}

export async function updatePlaylist(id: number, title: string, description: string): Promise<void> {
  await db.update(playlists).set({ title, description }).where(eq(playlists.id, id));
}

export async function deletePlaylist(id: number): Promise<void> {
  await db.delete(playlists).where(eq(playlists.id, id));
}

export async function appendTrack(playlistId: number, trackId: number): Promise<void> {
  await transact(async (tx) => {
    const [last] = await tx
      .select({ p: sql<number>`COALESCE(MAX(${playlistTracks.position}), 0)` })
      .from(playlistTracks)
      .where(eq(playlistTracks.playlistId, playlistId));
    await tx.insert(playlistTracks).values({ playlistId, trackId, position: (last?.p ?? 0) + 1, addedAt: now() });
  });
}

export async function removeEntry(playlistId: number, entryId: number): Promise<void> {
  await db.delete(playlistTracks).where(and(eq(playlistTracks.id, entryId), eq(playlistTracks.playlistId, playlistId)));
}
