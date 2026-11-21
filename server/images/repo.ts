// Uploaded pictures: storing them (files in object storage, a row here naming them), finding them again, pointing an
// account, artist or album at one, and clearing away pictures nothing uses any more.
import { and, eq, lt, notExists, sql } from "drizzle-orm";
import { db } from "../db/client";
import { albums, artists, images, users } from "../db/schema";
import { store } from "../storage";
import { spendWrites } from "../storage/budget";
import { first, now, rid } from "../util";
import type { Converted } from "./process";

export type Variant = "large" | "small";
/** The storage key of one size of a picture. */
export const fileOf = (key: string, v: Variant) => (v === "small" ? `${key}-s.webp` : `${key}.webp`);

/** Uploads both sizes of a converted picture as the files of picture `id`, and returns the key naming them. */
export async function putFiles(img: Converted, id: string): Promise<string> {
  await spendWrites(2);
  const key = `img/${id}`;
  await Promise.all([store.put(fileOf(key, "large"), img.large, "image/webp"), store.put(fileOf(key, "small"), img.small, "image/webp")]);
  return key;
}
/** Deletes both sizes of a picture's files. */
export async function deleteFiles(key: string): Promise<void> {
  await spendWrites(2);
  await Promise.all([store.delete(fileOf(key, "large")), store.delete(fileOf(key, "small"))]);
}

/** Stores a converted picture and returns its id. The files go up before the row exists, so a row never points at
 *  missing files. */
export async function saveImage(img: Converted, uploaderId: number | null, at = now()): Promise<string> {
  const id = rid(16), key = await putFiles(img, id);
  try {
    const [row] = await db.insert(images).values({
      id, mime: "image/webp", key, size: img.large.length + img.small.length, width: img.width, height: img.height, uploaderId, createdAt: at,
    }).returning({ id: images.id });
    if (!row) throw new Error("The picture was not stored");
    return row.id;
  } catch (e) { await deleteFiles(key).catch(() => {}); throw e; }
}

/** A picture's storage key, the address of one shown from elsewhere, or for one from before object storage, its original bytes. */
export async function findImage(id: string): Promise<{ key: string } | { url: string } | { mime: string; data: Uint8Array<ArrayBuffer> } | null> {
  const row = await first(db.select({ key: images.key, url: images.url, mime: images.mime, data: images.data }).from(images).where(eq(images.id, id)).limit(1));
  if (!row) return null;
  if (row.key) return { key: row.key };
  if (row.url) return { url: row.url };
  return row.data instanceof Uint8Array ? { mime: row.mime, data: new Uint8Array(row.data) } : null;
}

/** Bytes stored for pictures a person uploaded that are still around. */
export async function bytesBy(userId: number): Promise<number> {
  const row = await first(db.select({ n: sql<number>`COALESCE(SUM(${images.size}), 0)::bigint` }).from(images).where(eq(images.uploaderId, userId)));
  return Number(row?.n ?? 0);
}
/** Bytes stored for every picture. */
export async function bytesTotal(): Promise<number> {
  const row = await first(db.select({ n: sql<number>`COALESCE(SUM(${images.size}), 0)::bigint` }).from(images));
  return Number(row?.n ?? 0);
}

// These write other domains' tables (accounts, catalogue) and could move to their repos.
/** Sets or (with null) removes an account's profile picture. */
export async function setUserImage(userId: number, imageId: string | null): Promise<void> {
  await db.update(users).set({ imageId }).where(eq(users.id, userId));
}
/** Sets the picture of an artist or the cover of an album. */
export async function setCatalogueImage(type: "artist" | "album", id: number, imageId: string): Promise<void> {
  if (type === "artist") await db.update(artists).set({ imageId }).where(eq(artists.id, id));
  else await db.update(albums).set({ imageId }).where(eq(albums.id, id));
}

/** Records a picture shown from another site's address (nothing is stored here) and returns its id. */
export async function saveRemoteImage(url: string, width: number | null, height: number | null): Promise<string> {
  const [row] = await db.insert(images).values({ id: rid(16), mime: "image/jpeg", url, width, height, uploaderId: null, createdAt: now() }).returning({ id: images.id });
  if (!row) throw new Error("The picture was not recorded");
  return row.id;
}

// ---------- clearing away ----------
const unused = and(
  notExists(db.select({ x: sql`1` }).from(users).where(eq(users.imageId, images.id))),
  notExists(db.select({ x: sql`1` }).from(artists).where(eq(artists.imageId, images.id))),
  notExists(db.select({ x: sql`1` }).from(albums).where(eq(albums.imageId, images.id))),
);

/**
 * Deletes pictures no account, artist or album points at any more (replaced or removed ones), files first, then rows.
 * Pictures younger than `graceSeconds` are left alone: one just uploaded is not attached yet. Returns how many went.
 */
export async function sweepUnused(graceSeconds = 3600, batch = 200): Promise<number> {
  const rows = await db.select({ id: images.id, key: images.key }).from(images)
    .where(and(unused, lt(images.createdAt, now() - graceSeconds))).orderBy(images.id).limit(batch);
  let gone = 0;
  for (const r of rows) {
    if (r.key) await deleteFiles(r.key);
    await db.delete(images).where(and(eq(images.id, r.id), unused));
    gone++;
  }
  return gone;
}
