// sonosp.here/<username> and sonosp.here/<a|r|t>/<base-36 id>; Caddy sends that host's paths here.
import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { albums, artists, catalogueMoves, tracks } from "../db/schema";
import { Router } from "../http";
import { SITE_URL } from "../mail";
import { first } from "../util";
import { albumUrl, artistUrl, SHORT_KINDS, trackUrl, userUrl } from "../../shared/paths";

export const router = new Router();

const go = (path: string) =>
  new Response(null, { status: 302, headers: { Location: `${SITE_URL}${path}`, "Cache-Control": "no-store" } });

type Kind = (typeof SHORT_KINDS)[keyof typeof SHORT_KINDS];

async function currentId(kind: Kind, id: number) {
  const moved = await first(
    db
      .select({ to: catalogueMoves.toId })
      .from(catalogueMoves)
      .where(and(eq(catalogueMoves.kind, kind), eq(catalogueMoves.fromId, id)))
  );
  return moved?.to ?? id;
}

async function pathOf(kind: Kind, id: number) {
  if (kind === "artist") {
    const a = await first(db.select({ name: artists.name }).from(artists).where(eq(artists.id, id)));
    return a && artistUrl(a.name);
  }
  const t = kind === "album" ? albums : tracks;
  const row = await first(
    db
      .select({ title: t.title, artist: artists.name })
      .from(t)
      .innerJoin(artists, eq(artists.id, t.artistId))
      .where(eq(t.id, id))
  );
  if (!row) return null;
  return kind === "album" ? albumUrl(row.artist, row.title) : trackUrl(row.artist, row.title);
}

router.get("/api/short/:name", (c) => go(userUrl(c.params[0]!)));

// an unknown link lands on the site's not-found page
router.get("/api/short/:kind/:code", async (c) => {
  const [letter, code] = c.params as [string, string];
  const kind = SHORT_KINDS[letter as keyof typeof SHORT_KINDS];
  const id = /^[0-9a-z]{1,6}$/.test(code) ? parseInt(code, 36) : 0;
  if (!kind || !id || id > 2 ** 31 - 1) return go(`/${letter}/${code}`);
  const path = await pathOf(kind, await currentId(kind, id));
  return go(path ?? `/${letter}/${code}`);
});
