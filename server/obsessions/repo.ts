import { and, desc, eq } from "drizzle-orm";
import { trackImage } from "../catalog/art";
import { db } from "../db/client";
import { albums, artists, obsessions, tracks } from "../db/schema";
import { lovedBy } from "../users/repo";
import { now } from "../util";
import type { Obsession } from "../../shared/obsessions";

export function obsessionsOf(userId: number, viewerId = 0, limit = 50): Promise<Obsession[]> {
  return db
    .select({
      id: obsessions.id,
      comment: obsessions.comment,
      createdAt: obsessions.createdAt,
      trackId: tracks.id,
      title: tracks.title,
      duration: tracks.duration,
      artist: artists.name,
      album: albums.title,
      image: trackImage(),
      loved: lovedBy(viewerId),
    })
    .from(obsessions)
    .innerJoin(tracks, eq(tracks.id, obsessions.trackId))
    .innerJoin(artists, eq(artists.id, tracks.artistId))
    .leftJoin(albums, eq(albums.id, tracks.albumId))
    .where(eq(obsessions.userId, userId))
    .orderBy(desc(obsessions.createdAt))
    .limit(limit);
}

export async function addObsession(userId: number, trackId: number, comment: string): Promise<number> {
  const [row] = await db
    .insert(obsessions)
    .values({ userId, trackId, comment, createdAt: now() })
    .returning({ id: obsessions.id });
  if (!row) throw new Error("Obsession was not saved");
  return row.id;
}

export async function removeObsession(id: number, userId: number): Promise<void> {
  await db.delete(obsessions).where(and(eq(obsessions.id, id), eq(obsessions.userId, userId)));
}
