import { catRow, describe, merge, type Actor } from "../admin/catalogue.repo";
import { exclusive } from "../kv";
import * as repo from "./repo";
import * as src from "./sources";

const AUTOMATIC: Actor = { id: null, username: "Automatic" };

async function typeAlbums() {
  const rows = await repo.untypedAlbums(src.mbLocal() ? 500 : 5);
  if (!rows.length) return;
  const types = await src.mbReleaseTypes(rows.map((r) => r.mbid!));
  for (const r of rows) await repo.setReleaseType(r.id, (types.get(r.mbid!) ?? "").toLowerCase());
}

// a single that came out again on an album is that album's track, so its scrobbles and page go there
async function foldSingles() {
  for (const { single, album } of await repo.singlesOnAlbums(20)) {
    const s = await catRow("album", single);
    const d = await catRow("album", album);
    if (!s || !d) continue;
    await merge("album", single, album, AUTOMATIC, () => ({
      action: "catalogue.merge",
      targetType: "album",
      targetId: album,
      label: `${describe(s)} → ${describe(d)}`,
      note: "Single also released on this album",
      data: { source: single },
    }));
  }
}

export async function singlesBackfill() {
  await exclusive("metadata-singles", 5 * 60_000, async () => {
    await typeAlbums();
    await foldSingles();
  });
}
