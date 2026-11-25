import { Router, fail, oneOf } from "../http";
import { journalsOf } from "../journals/repo";
import { recent, top } from "../listening/repo";
import { coarse, range, FOREVER } from "../listening/period";
import { featureCatalog } from "../../shared/i18n/features";
import { SITE_URL } from "../mail";
import { canSee, canSeeCharts, requireVisibleUser } from "../users/service";
import { albumUrl, artistUrl, trackUrl, userUrl } from "../../shared/paths";
import { rss, type FeedItem } from "./xml";

export const router = new Router();
const absolute = (path: string) => new URL(path, SITE_URL).href;

router.get("/api/feeds/:name/:kind", async (c) => {
  const u = await requireVisibleUser(c.params[0]!, null);
  const kind = oneOf(c.params[1], ["journal", "recent", "artists", "albums", "tracks"]);
  if (!kind) return fail(404, "notFound");
  const base = userUrl(u.username);
  const items: FeedItem[] = [];
  let link = base;
  if (kind === "journal") {
    link += "/journal";
    for (const post of await journalsOf(u.id, 30, 0)) {
      const url = absolute(`${base}/journal/${post.id}`);
      items.push({ id: url, title: post.title, link: url, description: post.body, published: post.createdAt });
    }
  } else if (kind === "recent") {
    if (!canSee(u, null)) fail(403, "userKeepsTheirListeningPrivate");
    link += "/library";
    const plays = await recent({ userId: u.id, from: 0, to: FOREVER }, 50);
    for (const play of plays.items) {
      items.push({
        id: absolute(`${base}/library#scrobble-${play.id}`),
        title: `${play.artist} - ${play.title}`,
        link: absolute(trackUrl(play.artist, play.title)),
        description: play.album || `${play.artist} - ${play.title}`,
        published: play.playedAt,
      });
    }
  } else {
    if (!canSeeCharts(u, null)) fail(403, "userKeepsTheirListeningPrivate");
    const period = oneOf(c.q.get("period"), ["7day", "1month", "3month", "6month", "12month", "overall"]) ?? "7day";
    const [from, to] = coarse(range(new URLSearchParams({ period })));
    link += `/library/${kind}?period=${period}`;
    const chart = await top(kind, { userId: u.id, from, to }, 50);
    chart.items.forEach((item, i) => {
      const title = "name" in item ? item.name : `${item.artist} - ${item.title}`;
      const path =
        "name" in item
          ? artistUrl(item.name)
          : kind === "albums"
            ? albumUrl(item.artist, item.title)
            : trackUrl(item.artist, item.title);
      items.push({
        id: absolute(path),
        title: `${i + 1}. ${title}`,
        link: absolute(path),
        description: String(item.playcount),
      });
    });
  }
  const title = `Sonosphere / ${u.username} / ${featureCatalog("en")[kind]}`;
  const body = rss({
    title,
    link: absolute(link),
    self: absolute(c.url.pathname + c.url.search),
    description: title,
    items,
  });
  const etag = `"${new Bun.CryptoHasher("sha256").update(body).digest("hex")}"`;
  const headers = { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "no-cache", ETag: etag };
  return new Response(c.req.headers.get("if-none-match") === etag ? null : body, {
    status: c.req.headers.get("if-none-match") === etag ? 304 : 200,
    headers,
  });
});
