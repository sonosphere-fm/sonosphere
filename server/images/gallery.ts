import { and, eq, inArray, sql } from "drizzle-orm";
import { db, transact, type Conn, type Tx } from "../db/client";
import { albums, artists, catalogueImages, catalogueImageVotes, users } from "../db/schema";
import { HttpError, bad, fail, missing, type Viewer } from "../http";
import { auditTx } from "../site/audit";
import { isStaff } from "../site/roles";
import { now } from "../util";
import { pickMain, type MainCandidate } from "./main";
import type { GalleryImage, GalleryKind, GalleryList, GalleryVote } from "../../shared/images";

/** Candidates kept per artist or album. */
export const MAX_IMAGES = 12;

const candidateScore = sql<number>`COALESCE(SUM(${catalogueImageVotes.value}), 0)::int`;

async function candidateRows(conn: Conn, kind: GalleryKind, id: number): Promise<MainCandidate[]> {
  return conn
    .select({
      entryId: catalogueImages.id,
      imageId: catalogueImages.imageId,
      createdAt: catalogueImages.createdAt,
      score: candidateScore,
    })
    .from(catalogueImages)
    .leftJoin(catalogueImageVotes, eq(catalogueImageVotes.entryId, catalogueImages.id))
    .where(and(eq(catalogueImages.itemType, kind), eq(catalogueImages.itemId, id)))
    .groupBy(catalogueImages.id, catalogueImages.imageId, catalogueImages.createdAt);
}

/** Locks the item row. `undefined` means the item no longer exists. */
async function lockItem(tx: Tx, kind: GalleryKind, id: number): Promise<string | null | undefined> {
  if (kind === "artist") {
    const [row] = await tx.select({ imageId: artists.imageId }).from(artists).where(eq(artists.id, id)).for("update");
    return row ? row.imageId : undefined;
  }
  const [row] = await tx.select({ imageId: albums.imageId }).from(albums).where(eq(albums.id, id)).for("update");
  return row ? row.imageId : undefined;
}

async function setMainTx(tx: Tx, kind: GalleryKind, id: number, imageId: string | null): Promise<void> {
  if (kind === "artist") await tx.update(artists).set({ imageId }).where(eq(artists.id, id));
  else await tx.update(albums).set({ imageId }).where(eq(albums.id, id));
}

/** Recomputes and stores the winning picture. Locks the item first, so concurrent votes cannot leave a stale main image. */
export async function syncMainTx(tx: Tx, kind: GalleryKind, id: number): Promise<string | null> {
  const current = await lockItem(tx, kind, id);
  if (current === undefined) return null;
  const chosen = pickMain(await candidateRows(tx, kind, id), current);
  const imageId = chosen?.imageId ?? null;
  if (imageId !== current) await setMainTx(tx, kind, id, imageId);
  return imageId;
}

async function itemName(tx: Tx, kind: GalleryKind, id: number): Promise<string> {
  if (kind === "artist") {
    const [row] = await tx.select({ name: artists.name }).from(artists).where(eq(artists.id, id));
    return row?.name ?? "";
  }
  const [row] = await tx.select({ name: albums.title }).from(albums).where(eq(albums.id, id));
  return row?.name ?? "";
}

export async function list(
  kind: GalleryKind,
  itemId: number,
  main: string | null,
  viewerId: number | null
): Promise<GalleryList> {
  const entries = await db
    .select({
      id: catalogueImages.id,
      image: catalogueImages.imageId,
      uploaderId: catalogueImages.uploaderId,
      uploader: users.username,
      createdAt: catalogueImages.createdAt,
    })
    .from(catalogueImages)
    .leftJoin(users, eq(users.id, catalogueImages.uploaderId))
    .where(and(eq(catalogueImages.itemType, kind), eq(catalogueImages.itemId, itemId)))
    .orderBy(catalogueImages.createdAt, catalogueImages.id);
  if (!entries.length) return { items: [], main };

  const ids = entries.map((e) => e.id);
  const totals = await db
    .select({
      entryId: catalogueImageVotes.entryId,
      score: sql<number>`SUM(${catalogueImageVotes.value})::int`,
      up: sql<number>`COUNT(*) FILTER (WHERE ${catalogueImageVotes.value} = 1)::int`,
      down: sql<number>`COUNT(*) FILTER (WHERE ${catalogueImageVotes.value} = -1)::int`,
    })
    .from(catalogueImageVotes)
    .where(inArray(catalogueImageVotes.entryId, ids))
    .groupBy(catalogueImageVotes.entryId);
  const mine = viewerId
    ? await db
        .select({ entryId: catalogueImageVotes.entryId, value: catalogueImageVotes.value })
        .from(catalogueImageVotes)
        .where(and(eq(catalogueImageVotes.userId, viewerId), inArray(catalogueImageVotes.entryId, ids)))
    : [];

  const totalsOf = new Map(totals.map((t) => [t.entryId, t]));
  const mineOf = new Map(mine.map((m) => [m.entryId, m.value]));
  const voteOf = (id: number): GalleryVote => {
    const v = mineOf.get(id);
    return v === 1 || v === -1 ? v : 0;
  };
  const items: GalleryImage[] = entries.map((e) => {
    const t = totalsOf.get(e.id);
    return {
      id: e.id,
      image: e.image,
      score: t?.score ?? 0,
      up: t?.up ?? 0,
      down: t?.down ?? 0,
      mine: voteOf(e.id),
      main: e.image === main,
      uploader: e.uploader,
      uploaderId: e.uploaderId,
      createdAt: e.createdAt,
    };
  });
  items.sort(
    (a, b) => Number(b.main) - Number(a.main) || b.score - a.score || a.createdAt - b.createdAt || a.id - b.id
  );
  return { items, main };
}

export async function hasRoom(kind: GalleryKind, itemId: number): Promise<boolean> {
  return (await count(kind, itemId)) < MAX_IMAGES;
}

export async function count(kind: GalleryKind, itemId: number): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(catalogueImages)
    .where(and(eq(catalogueImages.itemType, kind), eq(catalogueImages.itemId, itemId)));
  return row?.n ?? 0;
}

/** Adds a candidate. A first picture becomes main; later uploads wait for votes. */
export async function add(
  kind: GalleryKind,
  itemId: number,
  imageId: string,
  uploaderId: number | null,
  at = now()
): Promise<number> {
  return transact(async (tx) => {
    const current = await lockItem(tx, kind, itemId);
    if (current === undefined) missing("itemNotFound");
    const [existing] = await tx
      .select({ id: catalogueImages.id })
      .from(catalogueImages)
      .where(
        and(
          eq(catalogueImages.itemType, kind),
          eq(catalogueImages.itemId, itemId),
          eq(catalogueImages.imageId, imageId)
        )
      )
      .limit(1);
    if (existing) return existing.id;
    const [counted] = await tx
      .select({ n: sql<number>`COUNT(*)::int` })
      .from(catalogueImages)
      .where(and(eq(catalogueImages.itemType, kind), eq(catalogueImages.itemId, itemId)));
    if ((counted?.n ?? 0) >= MAX_IMAGES) bad("galleryFull");
    const [entry] = await tx
      .insert(catalogueImages)
      .values({ itemType: kind, itemId, imageId, uploaderId, createdAt: at })
      .returning({ id: catalogueImages.id });
    if (!current) await setMainTx(tx, kind, itemId, imageId);
    return entry!.id;
  });
}

/** Automation (metadata lookups) offers a picture; a full gallery is ignored rather than failing a lookup. */
export async function offer(
  kind: GalleryKind,
  itemId: number,
  imageId: string,
  uploaderId: number | null = null,
  at = now()
): Promise<boolean> {
  try {
    await add(kind, itemId, imageId, uploaderId, at);
    return true;
  } catch (e) {
    if (e instanceof HttpError && e.key === "galleryFull") return false;
    throw e;
  }
}

export async function vote(
  userId: number,
  entryId: number,
  value: GalleryVote
): Promise<{ kind: GalleryKind; itemId: number; main: string | null }> {
  return transact(async (tx) => {
    const [entry] = await tx
      .select({ itemType: catalogueImages.itemType, itemId: catalogueImages.itemId })
      .from(catalogueImages)
      .where(eq(catalogueImages.id, entryId))
      .limit(1);
    if (!entry || (entry.itemType !== "artist" && entry.itemType !== "album")) missing("imageNotFound");
    const kind: GalleryKind = entry.itemType === "artist" ? "artist" : "album";
    if ((await lockItem(tx, kind, entry.itemId)) === undefined) missing("itemNotFound");
    if (value === 0) {
      await tx
        .delete(catalogueImageVotes)
        .where(and(eq(catalogueImageVotes.entryId, entryId), eq(catalogueImageVotes.userId, userId)));
    } else {
      await tx
        .insert(catalogueImageVotes)
        .values({ entryId, userId, value, createdAt: now() })
        .onConflictDoUpdate({
          target: [catalogueImageVotes.entryId, catalogueImageVotes.userId],
          set: { value, createdAt: now() },
        });
    }
    return { kind, itemId: entry.itemId, main: await syncMainTx(tx, kind, entry.itemId) };
  });
}

/** The uploader may remove their own picture; staff may remove any. Staff removals are audited. */
export async function remove(
  viewer: Viewer,
  actor: Viewer,
  entryId: number
): Promise<{ kind: GalleryKind; itemId: number; main: string | null }> {
  return transact(async (tx) => {
    const [entry] = await tx
      .select({
        itemType: catalogueImages.itemType,
        itemId: catalogueImages.itemId,
        imageId: catalogueImages.imageId,
        uploaderId: catalogueImages.uploaderId,
      })
      .from(catalogueImages)
      .where(eq(catalogueImages.id, entryId))
      .limit(1);
    if (!entry || (entry.itemType !== "artist" && entry.itemType !== "album")) missing("imageNotFound");
    const staff = isStaff(viewer);
    if (entry.uploaderId !== viewer.id && !staff) fail(403, "notYourImage");
    const kind: GalleryKind = entry.itemType === "artist" ? "artist" : "album";
    if ((await lockItem(tx, kind, entry.itemId)) === undefined) missing("itemNotFound");
    const name = await itemName(tx, kind, entry.itemId);
    await tx.delete(catalogueImages).where(eq(catalogueImages.id, entryId));
    const main = await syncMainTx(tx, kind, entry.itemId);
    if (staff) {
      await auditTx(tx, actor, {
        action: "image.remove",
        targetType: kind,
        targetId: entry.itemId,
        label: `Image for ${name}`,
        data: { entryId, imageId: entry.imageId, uploaderId: entry.uploaderId },
      });
    }
    return { kind, itemId: entry.itemId, main };
  });
}

/** Moves a merged item's gallery to its destination, carrying votes where both sides have the same picture. */
export async function moveEntriesTx(tx: Tx, kind: GalleryKind, src: number, dst: number): Promise<void> {
  await tx.execute(sql`
    UPDATE "catalogue_image_votes" v
    SET "entry_id" = d."id"
    FROM "catalogue_images" s, "catalogue_images" d
    WHERE v."entry_id" = s."id"
      AND s."item_type" = ${kind} AND s."item_id" = ${src}
      AND d."item_type" = ${kind} AND d."item_id" = ${dst} AND d."image_id" = s."image_id"
      AND NOT EXISTS (
        SELECT 1 FROM "catalogue_image_votes" x WHERE x."entry_id" = d."id" AND x."user_id" = v."user_id"
      )
  `);
  await tx.execute(sql`
    DELETE FROM "catalogue_image_votes" v
    USING "catalogue_images" s, "catalogue_images" d
    WHERE v."entry_id" = s."id"
      AND s."item_type" = ${kind} AND s."item_id" = ${src}
      AND d."item_type" = ${kind} AND d."item_id" = ${dst} AND d."image_id" = s."image_id"
  `);
  await tx.execute(sql`
    DELETE FROM "catalogue_images" s
    USING "catalogue_images" d
    WHERE s."item_type" = ${kind} AND s."item_id" = ${src}
      AND d."item_type" = ${kind} AND d."item_id" = ${dst} AND d."image_id" = s."image_id"
  `);
  await tx
    .update(catalogueImages)
    .set({ itemId: dst })
    .where(and(eq(catalogueImages.itemType, kind), eq(catalogueImages.itemId, src)));
}
