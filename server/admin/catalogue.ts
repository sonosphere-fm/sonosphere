import { Router, bad, fail, missing } from "../http";
import { adminOnly } from "../guards";
import { findItem } from "../catalog/repo";
import { queue } from "../recommend/repo";
import { audit } from "../site/audit";
import { clean, like, norm } from "../util";
import { idList, note, paging } from "./common";
import * as repo from "./catalogue.repo";
import type { AdminTagList, CatalogueDetails, Tracklist, CatalogueDuplicates, CatalogueMerged, CatalogueSearch, DuplicateArtist, Ok, OrphanList, OrphansDeleted, TagDeleted } from "../../shared/admin-content";

export const router = new Router({ jsonOnly: true });

const KINDS: readonly repo.Kind[] = ["artist", "album", "track"];
const kindOf = (k: unknown): repo.Kind => KINDS.find(kind => kind === k) ?? bad("Pick artist, album or track");
const NAMES: Record<repo.Kind, string> = { artist: "Artist", album: "Album", track: "Track" };
const item = async (kind: repo.Kind, id: number): Promise<repo.CatRow> => (await repo.catRow(kind, id)) ?? missing(NAMES[kind]);

router.get<CatalogueSearch>("/api/admin/catalogue/search", async c => {
  adminOnly(c);
  const kind = kindOf(c.q.get("kind") || "artist");
  const term = (c.q.get("q") || "").trim();
  const pg = paging(c.q, 25);
  const pattern = term ? like(norm(term)) : "%";
  return { items: await repo.search(kind, pattern, pg), total: await repo.searchCount(kind, pattern), ...pg };
});

// Looser than the normalised name: no accents, punctuation, "the" or "&", so near-identical spellings fall together.
function loose(s: string): string {
  return s.normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/^the\s+|,\s*the$/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

router.get<CatalogueDuplicates>("/api/admin/catalogue/duplicates", async c => {
  adminOnly(c);
  const groups = new Map<string, DuplicateArtist[]>();
  for (const a of await repo.artistsWithCounts()) {
    const k = loose(a.name);
    if (!k) continue;
    const group = groups.get(k);
    if (group) group.push(a);
    else groups.set(k, [a]);
  }
  const dupes = [...groups.values()]
    .filter(g => g.length > 1)
    .map(g => g.sort((a, b) => b.scrobbles - a.scrobbles || b.tracks - a.tracks))
    .sort((a, b) => b.length - a.length)
    .slice(0, 100);
  return { groups: dupes };
});

router.post<CatalogueMerged>("/api/admin/catalogue/merge", async c => {
  const me = adminOnly(c);
  const kind = kindOf(c.body.kind);
  const src = Number(c.body.source);
  const dst = Number(c.body.target);
  const why = note(c);
  if (src === dst) bad("Pick two different items");
  const s = await item(kind, src);
  const d = await item(kind, dst);
  const { detail, artists } = await repo.merge(kind, src, dst, me, detail => ({
    action: "catalogue.merge",
    targetType: kind,
    targetId: dst,
    label: `${repo.describe(s)} → ${repo.describe(d)}`,
    note: why,
    data: { source: src, ...detail },
  }));
  for (const id of artists) await queue("artist", id);
  return { ok: true, ...detail };
});

type Revert = { reverts?: number };

async function rename(me: repo.Actor, kind: repo.Kind, r: repo.CatRow, name: string, why: string, extra: Revert = {}) {
  const n = norm(name);
  const clash = await repo.nameClash(kind, r, n);
  if (clash !== null) {
    let existing = "an artist";
    if (kind === "album") existing = `an album by ${r.artist}`;
    if (kind === "track") existing = `a track by ${r.artist}`;
    fail(409, `There's already ${existing} called “${name}”. Merge the two instead (#${clash}).`);
  }
  await repo.rename(kind, r.id, name, n);
  await audit(me, {
    action: "catalogue.rename",
    targetType: kind,
    targetId: r.id,
    label: `${repo.describe(r)} → ${name}`,
    note: why,
    data: { from: r.label, to: name, ...extra },
  });
}

router.post<Ok>("/api/admin/catalogue/rename", async c => {
  const me = adminOnly(c);
  const kind = kindOf(c.body.kind);
  const r = await item(kind, Number(c.body.id));
  const name = clean(c.body.name);
  if (!name) bad("Enter a name");
  await rename(me, kind, r, name, note(c));
  return { ok: true };
});

const FIELDS: Record<repo.Kind, (keyof CatalogueDetails)[]> = {
  artist: ["mbid", "spotifyId"],
  album: ["releaseDate", "releaseType", "mbid"],
  track: ["duration"],
};
const MBID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SPOTIFY_ID = /^[0-9A-Za-z]{22}$/;
const DATE = /^\d{4}(-\d{2}-\d{2})?$/;
const RELEASE_TYPES = ["album", "single", "ep", "broadcast", "other"];
const MAX_DURATION = 24 * 3600;

const validDate = (d: string) => DATE.test(d) && (d.length === 4 || !Number.isNaN(Date.parse(d)));

function fieldValue(key: keyof CatalogueDetails, v: unknown): string | number | null {
  if (key === "duration") {
    const n = Number(v);
    return Number.isInteger(n) && n >= 0 && n <= MAX_DURATION ? n : bad("Enter the length in seconds, or as minutes:seconds");
  }
  const s = clean(v) || null;
  if (s === null) return null;
  if (key === "mbid") return MBID.test(s.toLowerCase()) ? s.toLowerCase() : bad("A MusicBrainz ID looks like 3f1c2b4e-…, 36 characters");
  if (key === "spotifyId") return SPOTIFY_ID.test(s) ? s : bad("A Spotify ID is 22 letters and digits");
  if (key === "releaseDate") return validDate(s) ? s : bad("Enter the release date as YYYY or YYYY-MM-DD");
  return RELEASE_TYPES.includes(s) ? s : bad("Pick a release type");
}

type Changes = Record<string, { from: unknown; to: unknown }>;

async function editDetails(me: repo.Actor, kind: repo.Kind, r: repo.CatRow, set: CatalogueDetails, why: string, extra: Revert = {}) {
  const before = await repo.details(kind, r.id);
  const fields: Changes = {};
  for (const [k, to] of Object.entries(set)) {
    const from = before[k as keyof CatalogueDetails];
    if (from !== to) fields[k] = { from, to };
  }
  if (!Object.keys(fields).length) bad("Nothing changed");
  await repo.setDetails(kind, r.id, set, me, {
    action: "catalogue.edit",
    targetType: kind,
    targetId: r.id,
    label: repo.describe(r),
    note: why,
    data: { fields, ...extra },
  });
}

router.get<CatalogueDetails>("/api/admin/catalogue/details", async c => {
  adminOnly(c);
  const kind = kindOf(c.q.get("kind"));
  const r = await item(kind, Number(c.q.get("id")));
  return repo.details(kind, r.id);
});

router.post<Ok>("/api/admin/catalogue/details", async c => {
  const me = adminOnly(c);
  const kind = kindOf(c.body.kind);
  const r = await item(kind, Number(c.body.id));
  const set: Record<string, unknown> = {};
  for (const k of FIELDS[kind]) if (c.body[k] !== undefined) set[k] = fieldValue(k, c.body[k]);
  await editDetails(me, kind, r, set, note(c));
  return { ok: true };
});

const changedSince = () => fail(409, "It has been changed again since. Edit it by hand instead.");
const sameIds = (a: unknown, b: number[]) => Array.isArray(a) && a.join() === b.join();

router.post<Ok>("/api/admin/catalogue/revert", async c => {
  const me = adminOnly(c);
  const e = (await repo.auditEntry(Number(c.body.id))) ?? missing("Log entry");
  const kind = kindOf(e.targetType);
  const r = await item(kind, e.targetId ?? 0);
  const why = note(c);
  const extra = { reverts: e.id };
  if (e.action === "catalogue.rename") {
    if (r.label !== e.data.to) changedSince();
    await rename(me, kind, r, String(e.data.from), why, extra);
  } else if (e.action === "catalogue.edit") {
    const present = await repo.details(kind, r.id);
    const set: Record<string, unknown> = {};
    for (const [k, ch] of Object.entries(e.data.fields as Changes)) {
      if (present[k as keyof CatalogueDetails] !== ch.to) changedSince();
      set[k] = ch.from;
    }
    await editDetails(me, kind, r, set, why, extra);
  } else if (e.action === "catalogue.tracklist") {
    const from = e.data.from as number[];
    const current = (await repo.tracklist(r.id)).map(t => t.id);
    if (!sameIds(e.data.to, current)) changedSince();
    if ((await repo.existingTracks(from)) !== from.length) fail(409, "Some of those tracks have been deleted or merged since. Edit the list by hand instead.");
    await repo.setTracklist(r, from, me, after => ({
      action: "catalogue.tracklist",
      targetType: "album",
      targetId: r.id,
      label: `${repo.describe(r)} (${current.length} → ${after.length} tracks)`,
      note: why,
      data: { from: current, to: after, ...extra },
    }));
  } else bad("This change can't be undone");
  return { ok: true };
});

const MAX_TRACKS = 300;

// an existing track's id, or the title of a new one
function entryOf(v: unknown): repo.TracklistEntry {
  if (typeof v === "number" && Number.isInteger(v)) return v;
  const title = typeof v === "string" ? clean(v) : "";
  return title || bad("A new track needs a title");
}

router.get<Tracklist>("/api/admin/catalogue/tracklist", async c => {
  adminOnly(c);
  const a = await item("album", Number(c.q.get("id")));
  return { tracks: await repo.tracklist(a.id) };
});

router.post<Ok>("/api/admin/catalogue/tracklist", async c => {
  const me = adminOnly(c);
  const a = await item("album", Number(c.body.id));
  const raw: unknown[] = Array.isArray(c.body.tracks) ? c.body.tracks : [];
  if (raw.length > MAX_TRACKS) bad(`An album can list at most ${MAX_TRACKS} tracks`);
  const entries = raw.map(entryOf);
  const ids = entries.filter(e => typeof e === "number");
  if ((await repo.existingTracks(ids)) !== new Set(ids).size) bad("A track no longer exists. Reload and try again.");
  const before = await repo.tracklist(a.id);
  const why = note(c);
  await repo.setTracklist(a, entries, me, after => ({
    action: "catalogue.tracklist",
    targetType: "album",
    targetId: a.id,
    label: `${repo.describe(a)} (${before.length} → ${after.length} tracks)`,
    note: why,
    data: { from: before.map(t => t.id), to: after },
  }));
  return { ok: true };
});

router.get<OrphanList>("/api/admin/catalogue/orphans", async c => {
  adminOnly(c);
  const kind = kindOf(c.q.get("kind") || "track");
  const imported = c.q.get("imported") === "1";
  return { items: await repo.orphans(kind, imported, 500), total: await repo.orphanCount(kind, imported) };
});

router.post<OrphansDeleted>("/api/admin/catalogue/orphans/delete", async c => {
  const me = adminOnly(c);
  const kind = kindOf(c.body.kind);
  const ids = idList(c.body.ids, 500);
  const why = note(c);
  if (!ids.length) bad("Pick at least one item");
  const deleted = await repo.deleteOrphans(kind, ids, me, (gone, names) => ({
    action: "catalogue.orphans",
    targetType: kind,
    label: `${gone.length} orphaned ${kind}${gone.length === 1 ? "" : "s"}`,
    note: why,
    data: { ids: gone, names: names.slice(0, 50) },
  }));
  return { deleted, skipped: ids.length - deleted };
});

router.get<AdminTagList>("/api/admin/tags", async c => {
  adminOnly(c);
  const term = (c.q.get("q") || "").trim();
  const pg = paging(c.q, 50);
  const pattern = term ? like(norm(term)) : null;
  return { items: await repo.tagRows(pattern, c.q.get("sort") === "name", pg), total: await repo.tagCount(pattern), ...pg };
});

router.post<TagDeleted>("/api/admin/tags/delete", async c => {
  const me = adminOnly(c);
  const g = (await findItem("tag", Number(c.body.id))) ?? missing("Tag");
  const why = note(c);
  const uses = await repo.deleteTag(g.id, me, uses => ({
    action: "tag.delete",
    targetType: "tag",
    targetId: g.id,
    label: g.name,
    note: why,
    data: { uses },
  }));
  return { ok: true, uses };
});
