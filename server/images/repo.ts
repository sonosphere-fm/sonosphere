// Data access for uploaded pictures, and for pointing an account, artist or album at one.
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { albums, artists, images, users } from "../db/schema";
import { first, now } from "../util";

/** Stores a picture and returns its id. */
export async function saveImage(mime: string, data: Uint8Array, uploaderId: number): Promise<number> {
  const [row] = await db.insert(images).values({ mime, data: Buffer.from(data), uploaderId, createdAt: now() }).returning({ id: images.id });
  if (!row) throw new Error("The picture was not stored");
  return row.id;
}
/** A stored picture: its type and bytes. */
export async function findImage(id: number): Promise<{ mime: string; data: Uint8Array<ArrayBuffer> } | null> {
  const row = await first(db.select({ mime: images.mime, data: images.data }).from(images).where(eq(images.id, id)).limit(1));
  // the column holds raw bytes, which the driver hands back as a byte array; the copy gives them a buffer of their own to send
  return row && row.data instanceof Uint8Array ? { mime: row.mime, data: new Uint8Array(row.data) } : null;
}

// These write other domains' tables (accounts, catalogue) and could move to their repos.
/** Sets or (with null) removes an account's profile picture. */
export async function setUserImage(userId: number, imageId: number | null): Promise<void> {
  await db.update(users).set({ imageId }).where(eq(users.id, userId));
}
/** Sets the picture of an artist or the cover of an album. */
export async function setCatalogueImage(type: "artist" | "album", id: number, imageId: number): Promise<void> {
  if (type === "artist") await db.update(artists).set({ imageId }).where(eq(artists.id, id));
  else await db.update(albums).set({ imageId }).where(eq(albums.id, id));
}
