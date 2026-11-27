import { and, count, eq, inArray, notInArray } from "drizzle-orm";
import { db, transact, type Tx } from "../db/client";
import { albums, albumTracks, artists, recordingMbids, scrobbles, tracks } from "../db/schema";
import { firstCredits } from "../metadata/mbdb";
import { norm } from "../util";
import { getOrCreateAlbumTx, getOrCreateArtistTx } from "./repo";

type Plan = { artistId: number; name: string; mbid: string | null; keep: string; move: Map<string, number[]> };

/**
 * Artists whose listened recordings MusicBrainz credits to more than one artist of their name. The one most of those
 * plays are of keeps the bare name; the tracks of each other one are to move to an artist of their own.
 */
async function plans(): Promise<Plan[]> {
  const links = await db
    .select({
      recording: recordingMbids.mbid,
      trackId: tracks.id,
      artistId: artists.id,
      name: artists.name,
      nameNorm: artists.nameNorm,
      mbid: artists.mbid,
    })
    .from(recordingMbids)
    .innerJoin(tracks, eq(tracks.id, recordingMbids.trackId))
    .innerJoin(artists, eq(artists.id, tracks.artistId))
    .where(eq(artists.disambig, ""));
  const credits = await firstCredits(links.map((l) => l.recording));

  // a credit under another name ("Metallica & Lou Reed") is a different artist entry, not one of this name
  const heard = new Map<number, Set<string>>();
  for (const l of links) {
    const c = credits.get(l.recording);
    if (!c || norm(c.name) !== l.nameNorm) continue;
    if (!heard.has(l.trackId)) heard.set(l.trackId, new Set());
    heard.get(l.trackId)!.add(c.mbid);
  }
  const byArtist = new Map<number, { link: (typeof links)[number]; tracks: Map<string, number[]> }>();
  for (const l of links) {
    const ids = heard.get(l.trackId);
    if (ids?.size !== 1) continue;
    const id = [...ids][0]!;
    const a = byArtist.get(l.artistId) ?? { link: l, tracks: new Map() };
    byArtist.set(l.artistId, a);
    const list = a.tracks.get(id) ?? [];
    if (!list.includes(l.trackId)) list.push(l.trackId);
    a.tracks.set(id, list);
  }
  const split = [...byArtist.values()].filter((a) => a.tracks.size > 1 || !a.tracks.has(a.link.mbid ?? ""));
  const trackIds = split.flatMap((a) => [...a.tracks.values()].flat());
  const plays = new Map<number, number>();
  for (let i = 0; i < trackIds.length; i += 5000) {
    const rows = await db
      .select({ trackId: scrobbles.trackId, n: count() })
      .from(scrobbles)
      .where(inArray(scrobbles.trackId, trackIds.slice(i, i + 5000)))
      .groupBy(scrobbles.trackId);
    for (const r of rows) plays.set(r.trackId, r.n);
  }

  return split.flatMap(({ link, tracks: heardTracks }) => {
    const weight = (id: string) =>
      heardTracks.get(id)!.reduce((sum, t) => sum + (plays.get(t) ?? 0), 0) + (id === link.mbid ? 0.5 : 0);
    const keep = [...heardTracks.keys()].sort((a, b) => weight(b) - weight(a))[0]!;
    const move = new Map([...heardTracks].filter(([id]) => id !== keep));
    if (keep === link.mbid && !move.size) return [];
    return [{ artistId: link.artistId, name: link.name, mbid: link.mbid, keep, move }];
  });
}

const any = async (q: { limit(n: number): PromiseLike<unknown[]> }) => (await q.limit(1)).length > 0;

/** Moves the tracks with their plays; an album goes along when nothing of the artist's is left on it. */
async function moveTracksTx(tx: Tx, from: number, to: number, ids: number[]) {
  const theirs = await tx.select({ titleNorm: tracks.titleNorm }).from(tracks).where(eq(tracks.artistId, to));
  const taken = new Set(theirs.map((t) => t.titleNorm));
  const rows = await tx
    .select({ id: tracks.id, titleNorm: tracks.titleNorm, albumId: tracks.albumId })
    .from(tracks)
    .where(and(inArray(tracks.id, ids), eq(tracks.artistId, from)));
  const moving = rows.filter((t) => !taken.has(t.titleNorm)).map((t) => t.id);
  if (!moving.length) return { tracks: [], albums: [] };
  await tx.update(tracks).set({ artistId: to }).where(inArray(tracks.id, moving));
  await tx.update(scrobbles).set({ artistId: to }).where(inArray(scrobbles.trackId, moving));

  const played = await tx
    .selectDistinct({ albumId: scrobbles.albumId })
    .from(scrobbles)
    .where(inArray(scrobbles.trackId, moving));
  const listed = await tx
    .select({ albumId: albumTracks.albumId })
    .from(albumTracks)
    .where(inArray(albumTracks.trackId, moving));
  const albumIds = [...new Set([...rows, ...played, ...listed].map((r) => r.albumId).filter((a) => a !== null))];
  const moved = [];
  for (const albumId of albumIds) {
    const [album] = await tx
      .select()
      .from(albums)
      .where(and(eq(albums.id, albumId), eq(albums.artistId, from)));
    if (!album) continue;
    const kept =
      (await any(
        tx
          .select({ id: tracks.id })
          .from(tracks)
          .where(and(eq(tracks.albumId, albumId), eq(tracks.artistId, from)))
      )) ||
      (await any(
        tx
          .select({ id: scrobbles.id })
          .from(scrobbles)
          .where(and(eq(scrobbles.albumId, albumId), eq(scrobbles.artistId, from)))
      )) ||
      (await any(
        tx
          .select({ id: albumTracks.trackId })
          .from(albumTracks)
          .innerJoin(tracks, eq(tracks.id, albumTracks.trackId))
          .where(and(eq(albumTracks.albumId, albumId), eq(tracks.artistId, from)))
      ));
    const [twin] = await tx
      .select({ id: albums.id })
      .from(albums)
      .where(and(eq(albums.artistId, to), eq(albums.titleNorm, album.titleNorm)));
    if (!kept && !twin) {
      await tx.update(albums).set({ artistId: to }).where(eq(albums.id, albumId));
      moved.push({ albumId, to: albumId });
      continue;
    }
    const dst = twin?.id ?? (await getOrCreateAlbumTx(tx, to, album.title));
    const ours = and(eq(albumTracks.albumId, albumId), inArray(albumTracks.trackId, moving));
    const listedThere = await tx
      .select({ trackId: albumTracks.trackId })
      .from(albumTracks)
      .where(eq(albumTracks.albumId, dst));
    const there = listedThere.map((r) => r.trackId);
    await tx
      .update(albumTracks)
      .set({ albumId: dst })
      .where(there.length ? and(ours, notInArray(albumTracks.trackId, there)) : ours);
    await tx.delete(albumTracks).where(ours);
    await tx
      .update(tracks)
      .set({ albumId: dst })
      .where(and(inArray(tracks.id, moving), eq(tracks.albumId, albumId)));
    await tx
      .update(scrobbles)
      .set({ albumId: dst })
      .where(and(inArray(scrobbles.trackId, moving), eq(scrobbles.albumId, albumId)));
    moved.push({ albumId, to: dst });
  }
  return { tracks: moving, albums: moved };
}

async function apply(p: Plan) {
  return transact(async (tx) => {
    if (p.keep !== p.mbid) {
      await tx.update(artists).set({ mbid: p.keep, metaAt: null }).where(eq(artists.id, p.artistId));
    }
    const out = [];
    for (const [mbid, ids] of p.move) {
      const to = await getOrCreateArtistTx(tx, p.name, mbid);
      if (to === p.artistId) throw new Error(`no artist of its own for ${mbid}`);
      out.push({ mbid, to, ...(await moveTracksTx(tx, p.artistId, to, ids)) });
    }
    return out;
  });
}

if (import.meta.main) {
  const go = process.argv.includes("--apply");
  for (const p of await plans()) {
    const record = { artistId: p.artistId, name: p.name, mbid: p.mbid, keep: p.keep, move: Object.fromEntries(p.move) };
    if (!go) {
      console.log(JSON.stringify(record));
      continue;
    }
    try {
      console.log(JSON.stringify({ ...record, done: await apply(p) }));
    } catch (e) {
      console.log(JSON.stringify({ ...record, failed: String(e) }));
    }
  }
  process.exit(0);
}
