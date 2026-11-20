// Data access for name corrections: renaming what is already in the catalogue, and the record of the last sweep.
import { and, eq, ne } from "drizzle-orm";
import { transact, type Tx } from "../db/client";
import { albums, artists, meta, tracks } from "../db/schema";
import { norm } from "../util";

/** Corrected titles for one artist: `fix` keeps the name and changes its capitals, `move` is a different name. */
export type Titles = { fix: Map<string, string>; move: Map<string, string> };
/** Every rename to apply, keyed by the normalised name it replaces. */
export type Renames = { artistCase: Map<string, string>; artistMove: Map<string, string>; titles: Map<string, Titles> };
export type SweepResult = { fixed: number; renamed: number; clashes: number };
const STATUS = "corrections";

/** The same three steps for albums and for tracks of one artist. Each returns how many rows it changed. */
const titled = (tx: Tx, artistId: number) => [
  {
    recase: (n: string, title: string) => tx.update(albums).set({ title }).where(and(eq(albums.artistId, artistId), eq(albums.titleNorm, n), ne(albums.title, title))).returning({ id: albums.id }).all().length,
    has: (n: string) => !!tx.select({ id: albums.id }).from(albums).where(and(eq(albums.artistId, artistId), eq(albums.titleNorm, n))).get(),
    rename: (n: string, title: string) => tx.update(albums).set({ title, titleNorm: norm(title) }).where(and(eq(albums.artistId, artistId), eq(albums.titleNorm, n))).returning({ id: albums.id }).all().length,
  },
  {
    recase: (n: string, title: string) => tx.update(tracks).set({ title }).where(and(eq(tracks.artistId, artistId), eq(tracks.titleNorm, n), ne(tracks.title, title))).returning({ id: tracks.id }).all().length,
    has: (n: string) => !!tx.select({ id: tracks.id }).from(tracks).where(and(eq(tracks.artistId, artistId), eq(tracks.titleNorm, n))).get(),
    rename: (n: string, title: string) => tx.update(tracks).set({ title, titleNorm: norm(title) }).where(and(eq(tracks.artistId, artistId), eq(tracks.titleNorm, n))).returning({ id: tracks.id }).all().length,
  },
];

/**
 * Brings stored names into line, all or nothing. Renames only: when the corrected name already exists as a separate
 * entry the two are left alone and counted as a clash. `status` turns the result into the text saved as the record
 * of this sweep.
 */
export function sweep(r: Renames, status: (result: SweepResult) => string): SweepResult {
  return transact(tx => {
    let fixed = 0, renamed = 0, clashes = 0;
    const artistId = (n: string) => tx.select({ id: artists.id }).from(artists).where(eq(artists.nameNorm, n)).get()?.id;
    for (const [n, name] of r.artistCase) fixed += tx.update(artists).set({ name }).where(and(eq(artists.nameNorm, n), ne(artists.name, name))).returning({ id: artists.id }).all().length;
    for (const [n, name] of r.artistMove) {
      if (!artistId(n)) continue;
      if (artistId(norm(name))) { clashes++; continue; }
      renamed += tx.update(artists).set({ name, nameNorm: norm(name) }).where(eq(artists.nameNorm, n)).returning({ id: artists.id }).all().length;
    }
    for (const [artist, t] of r.titles) {
      const id = artistId(artist);
      if (!id) continue;
      for (const items of titled(tx, id)) {
        for (const [n, title] of t.fix) fixed += items.recase(n, title);
        for (const [n, title] of t.move) {
          if (!items.has(n)) continue;
          if (items.has(norm(title))) { clashes++; continue; }
          renamed += items.rename(n, title);
        }
      }
    }
    const result = { fixed, renamed, clashes }, value = status(result);
    tx.insert(meta).values({ key: STATUS, value }).onConflictDoUpdate({ target: meta.key, set: { value } }).run();
    return result;
  });
}

/** The saved record of the last sweep (JSON text), or null if there has not been one. */
