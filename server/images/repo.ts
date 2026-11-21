import { and, eq, lt, notExists, sql } from "drizzle-orm";
import { db } from "../db/client";
import { albums, artists, images, users } from "../db/schema";
import { store } from "../storage";
import { spendWrites } from "../storage/budget";
import { first, now, rid } from "../util";
import type { Converted } from "./process";

type Variant = "large" | "small";
export const fileOf = (key: string, v: Variant) => (v === "small" ? `${key}-s.webp` : `${key}.webp`);

async function putFiles(img: Converted, id: string): Promise<string> {
  await spendWrites(2);
  const key = `img/${id}`;
  await Promise.all([
    store.put(fileOf(key, "large"), img.large, "image/webp"),
    store.put(fileOf(key, "small"), img.small, "image/webp"),
  ]);
  return key;
}

async function deleteFiles(key: string): Promise<void> {
  await spendWrites(2);
  await Promise.all([store.delete(fileOf(key, "large")), store.delete(fileOf(key, "small"))]);
}

// files go up before the row exists, so a row never points at missing files
export async function saveImage(img: Converted, uploaderId: number | null, at = now()): Promise<string> {
  const id = rid(16);
  const key = await putFiles(img, id);
  try {
    await db.insert(images).values({
      id,
      mime: "image/webp",
      key,
      size: img.large.length + img.small.length,
      width: img.width,
      height: img.height,
      uploaderId,
      createdAt: at,
    });
    return id;
  } catch (e) {
    await deleteFiles(key).catch(() => {});
    throw e;
  }
}

type Found = { key: string } | { url: string } | { mime: string; data: Uint8Array<ArrayBuffer> };

// `data` holds the original bytes of pictures uploaded before object storage
export async function findImage(id: string): Promise<Found | null> {
  const row = await first(
    db.select({ key: images.key, url: images.url, mime: images.mime, data: images.data })
      .from(images)
      .where(eq(images.id, id))
      .limit(1),
  );
  if (!row) return null;
  if (row.key) return { key: row.key };
  if (row.url) return { url: row.url };
  return row.data instanceof Uint8Array ? { mime: row.mime, data: new Uint8Array(row.data) } : null;
}

const totalSize = sql<number>`COALESCE(SUM(${images.size}), 0)::bigint`;

export async function bytesBy(userId: number): Promise<number> {
  const row = await first(db.select({ n: totalSize }).from(images).where(eq(images.uploaderId, userId)));
  return Number(row?.n ?? 0);
}

export async function bytesTotal(): Promise<number> {
  const row = await first(db.select({ n: totalSize }).from(images));
  return Number(row?.n ?? 0);
}

export async function setUserImage(userId: number, imageId: string | null): Promise<void> {
  await db.update(users).set({ imageId }).where(eq(users.id, userId));
}

export async function setCatalogueImage(type: "artist" | "album", id: number, imageId: string): Promise<void> {
  if (type === "artist") await db.update(artists).set({ imageId }).where(eq(artists.id, id));
  else await db.update(albums).set({ imageId }).where(eq(albums.id, id));
}

/** Records a picture hotlinked from another site; nothing is stored here. */
export async function saveRemoteImage(url: string, width: number | null, height: number | null): Promise<string> {
  const id = rid(16);
  await db.insert(images).values({ id, mime: "image/jpeg", url, width, height, uploaderId: null, createdAt: now() });
  return id;
}

const unused = and(
  notExists(db.select({ x: sql`1` }).from(users).where(eq(users.imageId, images.id))),
  notExists(db.select({ x: sql`1` }).from(artists).where(eq(artists.imageId, images.id))),
  notExists(db.select({ x: sql`1` }).from(albums).where(eq(albums.imageId, images.id))),
);

// pictures younger than an hour are left alone: one just uploaded is not attached yet
export async function sweepUnused(): Promise<void> {
  const rows = await db.select({ id: images.id, key: images.key })
    .from(images)
    .where(and(unused, lt(images.createdAt, now() - 3600)))
    .orderBy(images.id)
    .limit(200);
  for (const r of rows) {
    if (r.key) await deleteFiles(r.key);
    await db.delete(images).where(and(eq(images.id, r.id), unused));
  }
}
