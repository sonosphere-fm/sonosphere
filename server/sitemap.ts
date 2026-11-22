import { and, asc, eq, gt, lte, sql, type SQL } from "drizzle-orm";
import { albumUrl, artistUrl, tagUrl, trackUrl, userUrl } from "../shared/paths";
import { db } from "./db/client";
import { albums, artists, events, journals, playlists, tags, tracks, users } from "./db/schema";
import { absolute, escape, landing } from "./seo";

const size = 5000;
const publicUser = and(eq(users.hideRecent, false), eq(users.privateListening, false), eq(users.suspended, false));
const sources = {
  artists: {
    table: artists,
    paths: (where: SQL) =>
      db
        .select({ name: artists.name })
        .from(artists)
        .where(where)
        .orderBy(asc(artists.id))
        .then((rows) => rows.map((row) => artistUrl(row.name))),
  },
  albums: {
    table: albums,
    paths: (where: SQL) =>
      db
        .select({ artist: artists.name, title: albums.title })
        .from(albums)
        .innerJoin(artists, eq(albums.artistId, artists.id))
        .where(where)
        .orderBy(asc(albums.id))
        .then((rows) => rows.map((row) => albumUrl(row.artist, row.title))),
  },
  tracks: {
    table: tracks,
    paths: (where: SQL) =>
      db
        .select({ artist: artists.name, title: tracks.title })
        .from(tracks)
        .innerJoin(artists, eq(tracks.artistId, artists.id))
        .where(where)
        .orderBy(asc(tracks.id))
        .then((rows) => rows.map((row) => trackUrl(row.artist, row.title))),
  },
  tags: {
    table: tags,
    paths: (where: SQL) =>
      db
        .select({ name: tags.name })
        .from(tags)
        .where(where)
        .orderBy(asc(tags.id))
        .then((rows) => rows.map((row) => tagUrl(row.name))),
  },
  events: {
    table: events,
    paths: (where: SQL) =>
      db
        .select({ id: events.id })
        .from(events)
        .where(where)
        .orderBy(asc(events.id))
        .then((rows) => rows.map((row) => `/event/${row.id}`)),
  },
  playlists: {
    table: playlists,
    paths: (where: SQL) =>
      db
        .select({ id: playlists.id })
        .from(playlists)
        .where(where)
        .orderBy(asc(playlists.id))
        .then((rows) => rows.map((row) => `/playlist/${row.id}`)),
  },
  listeners: {
    table: users,
    paths: (where: SQL) =>
      db
        .select({ name: users.username })
        .from(users)
        .where(and(where, publicUser))
        .orderBy(asc(users.id))
        .then((rows) => rows.map((row) => userUrl(row.name))),
  },
  journals: {
    table: journals,
    paths: (where: SQL) =>
      db
        .select({ id: journals.id, name: users.username })
        .from(journals)
        .innerJoin(users, eq(journals.userId, users.id))
        .where(and(where, publicUser))
        .orderBy(asc(journals.id))
        .then((rows) => rows.map((row) => `${userUrl(row.name)}/journal/${row.id}`)),
  },
};

const xml = (root: "urlset" | "sitemapindex", entry: "url" | "sitemap", paths: string[]) =>
  new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<${root} xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...new Set(paths)].map((path) => `<${entry}><loc>${escape(absolute(path))}</loc></${entry}>`).join("\n")}\n</${root}>`,
    { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=900" } }
  );

const filename = (kind: string, page: number) => `/sitemaps/${kind}-${page}.xml`;

export const crawlerRoutes = {
  "/robots.txt": () =>
    new Response(`User-agent: *\nAllow: /\nSitemap: ${absolute("/sitemap.xml")}\n`, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
    }),
  "/sitemap.xml": async () => {
    const paths = await Promise.all(
      Object.entries(sources).map(async ([kind, { table }]) => {
        const bucket = sql<number>`((${table.id} - 1) / ${size})`.mapWith(Number).as("bucket");
        const rows = await db
          .selectDistinct({ bucket })
          .from(table)
          .orderBy((fields) => fields.bucket);
        return rows.map((row) => filename(kind, row.bucket));
      })
    );
    return xml("sitemapindex", "sitemap", ["/sitemaps/pages.xml", ...paths.flat()]);
  },
  "/sitemaps/pages.xml": () => xml("urlset", "url", Object.keys(landing)),
  "/sitemaps/*": async (req: Request) => {
    const [, kind, page] = /^\/sitemaps\/([a-z]+)-(\d{1,6})\.xml$/.exec(new URL(req.url).pathname) ?? [];
    if (!kind || !Object.hasOwn(sources, kind)) return new Response("Not found", { status: 404 });
    const { table, paths } = sources[kind as keyof typeof sources];
    const first = Number(page) * size;
    if (first >= 2147483647) return new Response("Not found", { status: 404 });
    const urls = await paths(and(gt(table.id, first), lte(table.id, Math.min(first + size, 2147483647)))!);
    return xml("urlset", "url", urls);
  },
};
