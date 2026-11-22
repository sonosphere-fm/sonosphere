import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../db/client";
import { albums, tracks } from "../db/schema";
import { setAdd } from "../kv";

export const WANTED = "meta-wanted";
type Wanted = "artist" | "album" | "track";

/** Cheap: the queue holds each once, and ones already done are skipped when it's drained. */
export function want(kind: Wanted, ids: (number | null | undefined)[]): void {
  const members = [...new Set(ids.filter((i): i is number => !!i))].map((i) => `${kind}:${i}`);
  setAdd(WANTED, members, 20_000).catch(() => {});
}

/** Queues the cards with no picture, and hands the list back. */
export function wantBare<T extends { image: string | null }>(kind: Wanted, rows: T[], id: (r: T) => number): T[] {
  want(kind, rows.filter((r) => !r.image).map(id));
  return rows;
}

/** Queues the tracks whose album has no cover of its own, though the artist's picture may stand in for it. */
export function wantCovers<T>(rows: T[], id: (r: T) => number): T[] {
  const ids = [...new Set(rows.map(id))];
  if (ids.length) {
    db.select({ id: tracks.id })
      .from(tracks)
      .leftJoin(albums, eq(albums.id, tracks.albumId))
      .where(and(inArray(tracks.id, ids), isNull(albums.imageId)))
      .then((found) =>
        want(
          "track",
          found.map((r) => r.id)
        )
      )
      .catch(() => {});
  }
  return rows;
}
