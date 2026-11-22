import { and, eq, ne } from "drizzle-orm";
import { transact, type Tx } from "../db/client";
import { albums, artists, meta, tracks } from "../db/schema";
import { norm } from "../util";

/** `fix` keeps the name and changes its capitals, `move` is a different name. */
export type Titles = { fix: Map<string, string>; move: Map<string, string> };
export type Renames = { artistCase: Map<string, string>; artistMove: Map<string, string>; titles: Map<string, Titles> };
export type SweepResult = { fixed: number; renamed: number; clashes: number };
const STATUS = "corrections";

function titled(tx: Tx, table: typeof albums | typeof tracks, artistId: number) {
  const byTitle = (n: string) => and(eq(table.artistId, artistId), eq(table.titleNorm, n));
  return {
    recase: async (n: string, title: string) => {
      const rows = await tx
        .update(table)
        .set({ title })
        .where(and(byTitle(n), ne(table.title, title)))
        .returning({ id: table.id });
      return rows.length;
    },
    has: async (n: string) => {
      const rows = await tx.select({ id: table.id }).from(table).where(byTitle(n));
      return !!rows[0];
    },
    rename: async (n: string, title: string) => {
      const rows = await tx
        .update(table)
        .set({ title, titleNorm: norm(title) })
        .where(byTitle(n))
        .returning({ id: table.id });
      return rows.length;
    },
  };
}

/**
 * Renames only, all or nothing: when the corrected name already exists as a separate entry the two are left
 * alone and counted as a clash. `status` gives the text saved as the record of this sweep.
 */
export async function sweep(r: Renames, status: (result: SweepResult) => string): Promise<SweepResult> {
  return transact(async (tx) => {
    let fixed = 0;
    let renamed = 0;
    let clashes = 0;
    const artistId = async (n: string) => {
      const rows = await tx.select({ id: artists.id }).from(artists).where(eq(artists.nameNorm, n));
      return rows[0]?.id;
    };

    for (const [n, name] of r.artistCase) {
      const rows = await tx
        .update(artists)
        .set({ name })
        .where(and(eq(artists.nameNorm, n), ne(artists.name, name)))
        .returning({ id: artists.id });
      fixed += rows.length;
    }
    for (const [n, name] of r.artistMove) {
      if (!(await artistId(n))) continue;
      if (await artistId(norm(name))) {
        clashes++;
        continue;
      }
      const rows = await tx
        .update(artists)
        .set({ name, nameNorm: norm(name) })
        .where(eq(artists.nameNorm, n))
        .returning({ id: artists.id });
      renamed += rows.length;
    }
    for (const [artist, t] of r.titles) {
      const id = await artistId(artist);
      if (!id) continue;
      for (const items of [titled(tx, albums, id), titled(tx, tracks, id)]) {
        for (const [n, title] of t.fix) fixed += await items.recase(n, title);
        for (const [n, title] of t.move) {
          if (!(await items.has(n))) continue;
          if (await items.has(norm(title))) {
            clashes++;
            continue;
          }
          renamed += await items.rename(n, title);
        }
      }
    }

    const result = { fixed, renamed, clashes };
    const value = status(result);
    await tx.insert(meta).values({ key: STATUS, value }).onConflictDoUpdate({ target: meta.key, set: { value } });
    return result;
  });
}
