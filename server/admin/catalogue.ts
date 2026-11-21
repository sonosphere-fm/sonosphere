// Admin routes for catalogue upkeep: search, likely duplicate artists, merging, renaming, deleting items nothing
// uses, and managing tags.
import { Router, bad, fail, missing } from "../http";
import { adminOnly } from "../guards";
import { findItem } from "../catalog/repo";
import { queue } from "../recommend/repo";
import { audit } from "../site/audit";
import { clean, like, norm } from "../util";
import { idList, note, paging } from "./common";
import * as repo from "./catalogue.repo";
import type { AdminTagList, CatalogueDuplicates, CatalogueMerged, CatalogueSearch, DuplicateArtist, Ok, OrphanList, OrphansDeleted, TagDeleted } from "../../shared/admin-content";

export const router = new Router({ jsonOnly: true });

const KINDS: readonly repo.Kind[] = ["artist", "album", "track"];
const kindOf = (k: unknown): repo.Kind => KINDS.find(kind => kind === k) ?? bad("Pick artist, album or track");
const NAMES: Record<repo.Kind, string> = { artist: "Artist", album: "Album", track: "Track" };
const item = async (kind: repo.Kind, id: number): Promise<repo.CatRow> => (await repo.catRow(kind, id)) ?? missing(NAMES[kind]);

router.get<CatalogueSearch>("/api/admin/catalogue/search", async c => {
  adminOnly(c);
  const kind = kindOf(c.q.get("kind") || "artist"), term = (c.q.get("q") || "").trim(), pg = paging(c.q, 25);
  const pattern = term ? like(norm(term)) : "%";
  return { items: await repo.search(kind, pattern, pg), total: await repo.searchCount(kind, pattern), ...pg };
});

/** A looser key than the normalised name: no accents, punctuation, "the" or "&" so near-identical spellings fall together. */
const loose = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ").replace(/^the\s+|,\s*the$/g, "").replace(/[^\p{L}\p{N}]+/gu, "");

router.get<CatalogueDuplicates>("/api/admin/catalogue/duplicates", async c => {
  adminOnly(c);
  const groups = new Map<string, DuplicateArtist[]>();
  for (const a of await repo.artistsWithCounts()) {
    const k = loose(a.name);
    if (!k) continue;
    const group = groups.get(k);
    if (group) group.push(a); else groups.set(k, [a]);
  }
  return { groups: [...groups.values()].filter(g => g.length > 1).map(g => g.sort((a, b) => b.scrobbles - a.scrobbles || b.tracks - a.tracks)).sort((a, b) => b.length - a.length).slice(0, 100) };
});

router.post<CatalogueMerged>("/api/admin/catalogue/merge", async c => {
  const me = adminOnly(c), kind = kindOf(c.body.kind), src = Number(c.body.source), dst = Number(c.body.target), why = note(c);
  if (src === dst) bad("Pick two different items");
  const s = await item(kind, src), d = await item(kind, dst);
  const { detail, artists } = (await repo.merge(kind, src, dst, me, detail => (
    { action: "catalogue.merge", targetType: kind, targetId: dst, label: `${repo.describe(s)} → ${repo.describe(d)}`, note: why, data: { source: src, ...detail } })));
  // the merged artists have different listeners now: have their taste matches worked out again
  for (const id of artists) await queue("artist", id);
  return { ok: true, ...detail };
});

router.post<Ok>("/api/admin/catalogue/rename", async c => {
  const me = adminOnly(c), kind = kindOf(c.body.kind), id = Number(c.body.id), r = await item(kind, id), name = clean(c.body.name);
  if (!name) bad("Enter a name");
  const n = norm(name), clash = await repo.nameClash(kind, r, n);
  if (clash !== null) fail(409, `There's already ${kind === "artist" ? "an artist" : `a${kind === "album" ? "n album" : " track"} by ${r.artist}`} called “${name}”. Merge the two instead (#${clash}).`);
  await repo.rename(kind, id, name, n);
  await audit(me, { action: "catalogue.rename", targetType: kind, targetId: id, label: `${repo.describe(r)} → ${name}`, note: note(c), data: { from: r.label, to: name } });
  return { ok: true };
});

router.get<OrphanList>("/api/admin/catalogue/orphans", async c => {
  adminOnly(c);
  const kind = kindOf(c.q.get("kind") || "track"), imported = c.q.get("imported") === "1";
  return { items: await repo.orphans(kind, imported, 500), total: await repo.orphanCount(kind, imported) };
});

router.post<OrphansDeleted>("/api/admin/catalogue/orphans/delete", async c => {
  const me = adminOnly(c), kind = kindOf(c.body.kind), ids = idList(c.body.ids, 500), why = note(c);
  if (!ids.length) bad("Pick at least one item");
  const deleted = (await repo.deleteOrphans(kind, ids, me, (gone, names) => (
    { action: "catalogue.orphans", targetType: kind, label: `${gone.length} orphaned ${kind}${gone.length === 1 ? "" : "s"}`, note: why, data: { ids: gone, names: names.slice(0, 50) } })));
  return { deleted, skipped: ids.length - deleted };
});

router.get<AdminTagList>("/api/admin/tags", async c => {
  adminOnly(c);
  const term = (c.q.get("q") || "").trim(), pg = paging(c.q, 50), pattern = term ? like(norm(term)) : null;
  return { items: await repo.tagRows(pattern, c.q.get("sort") === "name", pg), total: await repo.tagCount(pattern), ...pg };
});

router.post<TagDeleted>("/api/admin/tags/delete", async c => {
  const me = adminOnly(c), g = (await findItem("tag", Number(c.body.id))) ?? missing("Tag"), why = note(c);
  const uses = (await repo.deleteTag(g.id, me, uses => ({ action: "tag.delete", targetType: "tag", targetId: g.id, label: g.name, note: why, data: { uses } })));
  return { ok: true, uses };
});
