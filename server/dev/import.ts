import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { queueChanged } from "../recommend/repo";
import { refreshTaste } from "../recommend/worker";
import { clean, norm, now, rid } from "../util";
import { imported, load, type CatalogueTable, type EventText, type Pictured, type Writer } from "./import.repo";

export const IMPORT_DIR = process.env.IMPORT_DIR || resolve(import.meta.dir, "../../data/import");

type Ref = { kind: "artist"; artist: string } | { kind: "album" | "track"; artist: string; title: string };
type Ent = { kind: Ref["kind"]; table: CatalogueTable; id: number };
type Page = cheerio.CheerioAPI;
type Picture = { id: string; size: number };
type Ev = {
  title?: string;
  venue?: string;
  city?: string;
  country?: string;
  starts?: number;
  description?: string;
  url?: string;
  lineup?: string[];
  exact?: boolean;
};

const text = (s: string) => s.replace(/\s+/g, " ").trim();

// links are sometimes encoded twice
function decode(s: string) {
  let v = s.replace(/\+/g, " ");
  for (let i = 0; i < 2; i++) {
    try {
      const d = decodeURIComponent(v);
      if (d === v) break;
      v = d;
    } catch {
      break;
    }
  }
  return v.trim();
}

/** What a /music/... link points at: an artist, one of their albums, or a track. */
function musicRef(href?: string | null): Ref | null {
  const m = /^(?:https?:\/\/www\.last\.fm)?\/music\/([^?#]+)/.exec(href || "");
  if (!m) return null;
  const seg: string[] = [];
  for (const s of m[1]!.split("/")) {
    if (!s || (s.startsWith("+") && s !== "+")) break;
    seg.push(s);
  }
  const artist = seg[0] && seg[0] !== "_" ? decode(seg[0]) : "";
  if (!artist) return null;
  const second = seg[1] ? decode(seg[1]) : "";
  const third = seg[2] ? decode(seg[2]) : "";
  if (seg[1] === "_") return third ? { kind: "track", artist, title: third } : { kind: "artist", artist };
  // album-scoped track link: /music/Artist/Album/Track
  if (third) return { kind: "track", artist, title: third };
  if (second) return { kind: "album", artist, title: second };
  return { kind: "artist", artist };
}

const isRef = (r: Ref | null): r is Ref => r !== null;

const pathPart = (href: string | undefined | null, re: RegExp) => {
  const m = re.exec(href || "");
  return m ? decode(m[1]!) : "";
};
const userOf = (href?: string | null) => pathPart(href, /^(?:https?:\/\/www\.last\.fm)?\/user\/([^/?#]+)/);
const tagOf = (href?: string | null) => pathPart(href, /^(?:https?:\/\/www\.last\.fm)?\/tag\/([^/?#]+)/);
const eventKey = (href?: string | null) => /\/(?:event|festival)\/(\d+)/.exec(href || "")?.[1] || "";

const MULTIPLIER: Record<string, number> = { K: 1e3, M: 1e6, B: 1e9 };

/** The number in front of `word`, as in "1.2M listeners" or "3,456 plays". */
function count(s: string, word: string): number {
  const m = new RegExp(`(\\d[\\d,.]*)\\s*([KMB])?\\s*${word}`, "i").exec(s);
  if (!m) return 0;
  const digits = m[1]!;
  const mult = MULTIPLIER[(m[2] || "").toUpperCase()] || 1;
  const value = mult === 1 ? Number(digits.replace(/[,.]/g, "")) : Number(digits.replace(/,/g, "")) * mult;
  return Math.round(value) || 0;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

const hour12 = (h: string, meridiem: string | undefined) => (Number(h) % 12) + (/pm/i.test(meridiem ?? "") ? 12 : 0);

/** Reads "3 Jan 2024", "3 January 2024, 4:05pm" or "Jan 3, 2024". Without a time it means midday. */
function parseDate(s: string): Date | null {
  let d = 0;
  let mo = -1;
  let y = 0;
  let h = 12;
  let mi = 0;
  const dayFirst = /(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?,?\s+(\d{4})(?:,?\s+(?:at\s+)?(\d{1,2}):(\d{2})\s*(am|pm))?/i.exec(s);
  if (dayFirst) {
    d = Number(dayFirst[1]);
    mo = MONTHS.indexOf(dayFirst[2]!.toLowerCase());
    y = Number(dayFirst[3]);
    if (dayFirst[4]) {
      h = hour12(dayFirst[4], dayFirst[6]);
      mi = Number(dayFirst[5]);
    }
  } else {
    const monthFirst = /([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),\s+(\d{4})/.exec(s);
    if (!monthFirst) return null;
    mo = MONTHS.indexOf(monthFirst[1]!.toLowerCase());
    d = Number(monthFirst[2]);
    y = Number(monthFirst[3]);
  }
  if (mo < 0) return null;
  return new Date(y, mo, d, h, mi);
}

const unix = (d: Date | null) => (d ? Math.floor(d.getTime() / 1000) : 0);
const pad = (n: number) => String(n).padStart(2, "0");
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Seconds after midnight of a "4:05pm" in the text, or 0. */
function clock(s: string) {
  const m = /(\d{1,2}):(\d{2})\s*(am|pm)/i.exec(s);
  return m ? hour12(m[1]!, m[3]) * 3600 + Number(m[2]) * 60 : 0;
}

/** "3:45" or "1:02:03" as seconds, or 0. */
function seconds(s: string) {
  const p = text(s).split(":").map(Number);
  if (p.length < 2 || !p.every(Number.isFinite)) return 0;
  return p.reduce((a, b) => a * 60 + b, 0);
}

/** Awaits `fn` on each element in turn (cheerio's own .each does not wait for promises). Returning false stops. */
async function eachSeq<T>(sel: cheerio.Cheerio<T> | T[], fn: (i: number, el: T) => Promise<unknown> | unknown): Promise<void> {
  const els = Array.isArray(sel) ? sel : sel.toArray();
  for (let i = 0; i < els.length; i++) {
    if ((await fn(i, els[i]!)) === false) break;
  }
}

/** Like cheerio's .map(...).get(), one element at a time: arrays are flattened and nulls dropped. */
async function mapSeq<T, R>(sel: cheerio.Cheerio<T> | T[], fn: (i: number, el: T) => Promise<R | R[] | null | undefined>): Promise<R[]> {
  const out: R[] = [];
  await eachSeq(sel, async (i, el) => {
    const r = await fn(i, el);
    if (Array.isArray(r)) out.push(...r);
    else if (r != null) out.push(r);
  });
  return out;
}

/** The readable text of a block, one paragraph per blank line. */
function prose($: Page, el: cheerio.BasicAcceptedElems<AnyNode>): string {
  const c = $(el).clone();
  c.find("script, style, .wiki-block-cta, a.wiki-block-cta, .factbox").remove();
  c.find("br").replaceWith("\n");
  const paras = c.find("p").length ? c.find("p").map((_, p) => $(p).text()).get() : [c.text()];
  return paras
    .map(p => p.replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim())
    .filter(Boolean)
    .join("\n\n")
    .replace(/…?\s*read more\s*$/i, "…")
    .trim();
}

function pageTags($: Page) {
  const names = $(".tag a, .big-tags-item-name a")
    .not(".about-artist a")
    .map((_, a) => tagOf($(a).attr("href")))
    .get();
  return [...new Set(names.filter(Boolean))];
}

function summary($: Page) {
  const blocks = $(".wiki-block-inner-2")
    .not(".about-artist .wiki-block-inner-2")
    .map((_, el) => prose($, el))
    .get();
  return blocks.sort((a, b) => b.length - a.length)[0] || "";
}

// the site's stock "no picture" images
const PLACEHOLDER = /^(818148bf682d429dc215c1705eb27b98|2a96cbd8b46e442fc41c2b86b821562f|c6f59c1e5e7240a4c0d427abd71f3dbb|4128a6eb29f94943c9d206c08e625904)/;
const MIME: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp" };
// every block that names an artist, album or track
const ITEMS = [
  ".chartlist-row", ".grid-items-item", ".artist-top-albums-item", ".catalogue-overview-similar-artists-item", ".similar-albums-item",
  ".track-similar-tracks-item", ".big-artist-list-item", ".resource-list--release-list-item", ".resource-list--sidebar-item",
  ".globalchart-item", ".weeklychart-item", ".music-releases-item", ".music-more-artists-item", ".column-tracks-item", ".source-album",
  ".similar-items-body-item", ".similar-items-sidebar-item", ".recs-feed-item", ".artist-header-featured-items-item", ".featured-item",
].join(", ");
const RANK = { track: 3, album: 2, artist: 1 };
const ALBUM_DATE = ".artist-top-albums-item-aux-text, .resource-list--release-list-item-aux-text, .music-releases-item-aux-text";

export async function importPages(dir = IMPORT_DIR, log: (s: string) => void = console.log) {
  const root = resolve(dir);
  if (!existsSync(root)) throw new Error(`Import folder not found: ${root}`);
  const files = readdirSync(root).filter(f => f.endsWith(".html")).sort();
  const password = process.env.IMPORT_PASSWORD || rid(6);
  const [ownerHash, lockedHash] = await Promise.all([
    Bun.password.hash(password, { algorithm: "bcrypt", cost: 10 }),
    // nobody knows this one: imported profiles can't be logged into
    Bun.password.hash(rid(32), { algorithm: "bcrypt", cost: 10 }),
  ]);
  const t0 = now();
  const stats: Record<string, number> = {};
  const tally = (k: string, n = 1) => {
    stats[k] = (stats[k] || 0) + n;
  };
  let owner = "";

  const work = async (w: Writer) => {
    const byHash = new Map<string, Picture>();
    const best = new Map<string, number>();

    async function image(file: string, src?: string | null): Promise<Picture | null> {
      if (!src || !src.startsWith("./")) return null;
      const name = src.split("/").pop() || "";
      const mime = MIME[(/\.(\w+)$/.exec(name)?.[1] || "").toLowerCase()];
      if (!mime || PLACEHOLDER.test(name)) return null;
      for (const rel of [src, decode(src.replace(/\+/g, "%2B"))]) {
        const p = resolve(dirname(file), rel);
        if (!p.startsWith(root + sep) || !existsSync(p) || !statSync(p).isFile()) continue;
        const data = readFileSync(p);
        const key = Bun.hash(data).toString(36);
        let hit = byHash.get(key);
        if (!hit) {
          const id = await w.addImage(data, t0);
          if (id === null) return null;
          hit = { id, size: data.length };
          byHash.set(key, hit);
          tally("images");
        }
        return hit;
      }
      return null;
    }

    /** Unless it already has a bigger one. */
    async function setImage(table: Pictured, id: number, img: Picture | null) {
      const k = `${table}:${id}`;
      if (!img || (best.get(k) || 0) >= img.size) return;
      best.set(k, img.size);
      await w.setImage(table, id, img.id);
    }

    async function make(r: Ref): Promise<Ent> {
      const artistId = await w.artist(r.artist);
      if (r.kind === "artist") return { kind: "artist", table: "artists", id: artistId };
      if (r.kind === "album") return { kind: "album", table: "albums", id: await w.album(artistId, r.title) };
      return { kind: "track", table: "tracks", id: await w.track(artistId, r.title) };
    }
    const ensure = async (r: Ref | null): Promise<Ent | null> => (r ? make(r) : null);
    const base = (e: Ent, listeners: number, plays: number) => w.raiseBase(e.table, e.id, listeners, plays);

    const tagWeights = new Map<string, number>();
    const tag = (e: Ent, name: string, weight: number) => {
      const n = clean(name, 60);
      if (!n) return;
      const k = `${e.kind}\u0000${e.id}\u0000${n}`;
      tagWeights.set(k, Math.max(tagWeights.get(k) || 0, Math.max(1, Math.round(weight))));
    };

    // a full wiki page beats a summary; otherwise the longer text wins
    const wikis = new Map<string, { content: string; full: boolean }>();
    const wiki = (type: string, id: number, content: string, full: boolean) => {
      if (content.length <= 40) return;
      const k = `${type}:${id}`;
      const old = wikis.get(k);
      const better = !old || (full && !old.full) || (full === old.full && content.length > old.content.length);
      if (better) wikis.set(k, { content, full });
    };

    async function headerStats($: Page, e: Ent) {
      let listeners = 0;
      let plays = 0;
      $(".header-metadata-tnew-item, .header-metadata-item").each((_, li) => {
        const label = text($(li).find("h4").first().text()).toLowerCase();
        const abbr = $(li).find("abbr[title]").first();
        const shown = abbr.length
          ? abbr.attr("title")
          : text($(li).find(".header-metadata-display, .header-metadata-tnew-display").text());
        const v = count(shown + " x", "x");
        if (label === "listeners") listeners = v;
        else if (label === "scrobbles") plays = v;
      });
      await base(e, listeners, plays);
    }

    async function user(name: string, avatar: Picture | null = null): Promise<number> {
      const n = norm(name);
      let id = await w.userId(n);
      if (!id) {
        const mine = n === norm(owner);
        id = await w.addUser({
          username: clean(name, 40),
          usernameNorm: n,
          email: `${n.replace(/[^a-z0-9._-]/g, "_")}@${mine ? "sonosphere" : "imported"}.invalid`,
          passwordHash: mine ? ownerHash : lockedHash,
          registeredAt: t0,
        });
        tally(mine ? "account" : "profiles (login disabled)");
      }
      await setImage("users", id, avatar);
      return id;
    }

    const userList = ($: Page, file: string): Promise<number[]> =>
      mapSeq($(".user-list-item"), async (_, li) => {
        const name = userOf($(li).find("a.user-list-link").attr("href"));
        if (!name) return [];
        const avatar = await image(file, $(li).find(".user-list-avatar img").attr("src"));
        return [await user(name, avatar)];
      });

    const eventIds = new Map<string, number>();

    async function event(key: string, e: Ev): Promise<number> {
      let found = eventIds.get(key);
      if (!found) {
        if (!e.title || !e.starts) return 0;
        found = await w.addEvent(clean(e.title, 200), e.starts, t0);
        eventIds.set(key, found);
        tally("events");
      }
      const id = found;
      const set = async (field: EventText, v: string | undefined, max = 200) => {
        const whole = field === "description";
        const s = whole ? String(v || "").trim().slice(0, max) : clean(v, max);
        if (s) await w.setEventText(id, field, s, whole);
      };
      await set("venue", e.venue);
      await set("city", e.city);
      await set("country", e.country);
      await set("url", e.url, 500);
      await set("description", e.description, 8000);
      if (e.starts && e.exact) await w.setEventStart(id, e.starts);
      const lineup = (e.lineup || []).map(n => clean(n)).filter(Boolean);
      await eachSeq(lineup, async (i, name) => w.addEventArtist(id, await w.artist(name), i));
      return id;
    }

    async function eventRows($: Page) {
      let day: Date | null = null;
      await eachSeq($(".group-heading, .events-list-item"), async (_, el) => {
        const row = $(el);
        if (row.hasClass("group-heading")) {
          day = parseDate(row.text());
          return;
        }
        const link = row.find("a.link-block-target, a.events-list-item-event-name").first();
        const key = eventKey(link.attr("href"));
        const iso = row.find(".events-list-item-date").attr("content");
        const at = iso ? new Date(iso.slice(0, 10) + "T12:00:00") : day;
        if (!key || !at || isNaN(at.getTime())) return;
        const named = row.find("[itemprop=performer] [itemprop=name]").map((_, x) => text($(x).text())).get();
        const lineup = named.length ? named : text(row.find(".events-list-item-event--lineup").text()).split(/,\s+/);
        const title = text(row.find(".events-list-item-event--title").text())
          || text(link.find("[itemprop=name]").first().text())
          || text(link.text())
          || lineup[0];
        const address = text(row.find(".events-list-item-venue [itemprop=address]").first().text()).split(/,\s*/).filter(Boolean);
        const venue = text(row.find(".events-list-item-venue--title, .events-list-item-venue [itemprop=name]").first().text());
        const city = text(row.find(".events-list-item-venue--city, [itemprop=addressLocality]").first().text()) || address[0];
        const country = text(row.find(".events-list-item-venue--country, [itemprop=addressCountry]").first().text())
          || (address.length > 1 ? address[address.length - 1] : "");
        await event(key, { title, starts: unix(at), lineup, venue, city, country });
      });
    }

    async function lists($: Page, file: string, personal: boolean): Promise<Ent[]> {
      const found: Ent[] = [];
      await eachSeq($(ITEMS), async (_, el) => {
        const item = $(el);
        const refs: Ref[] = item.find("a[href]").map((_, a) => musicRef($(a).attr("href"))).get().filter(isRef);
        const play = item.find("[data-track-url]").first();
        if (play.length) {
          const r = musicRef(play.attr("data-track-url"));
          if (r?.kind === "track") {
            refs.push({
              ...r,
              title: text(play.attr("data-track-name") || "") || r.title,
              artist: text(play.attr("data-artist-name") || "") || r.artist,
            });
          }
        }
        const lead = refs[0];
        if (!lead) return;
        const target = musicRef(item.find("a.link-block-target").first().attr("href"));
        let main: Ref;
        if (item.is(".chartlist-row")) main = refs.find(r => r.kind === "track") || lead;
        else main = target || [...refs].sort((a, b) => RANK[b.kind] - RANK[a.kind])[0]!;
        const e = await make(main);
        found.push(e);

        const album = main.kind === "track" ? await ensure(musicRef(item.find("a.cover-art").attr("href"))) : null;
        const img = await image(file, item.find("img[src]").first().attr("src"));
        if (e.table !== "tracks") {
          await setImage(e.table, e.id, img);
        } else if (album?.kind === "album") {
          await setImage("albums", album.id, img);
          await w.setTrackAlbum(e.id, album.id, true);
        }
        const dur = seconds(item.find(".chartlist-duration").first().text());
        if (e.kind === "track" && dur) await w.setDuration(e.id, dur, true);
        const words = text(item.text());
        if (!personal) await base(e, count(words, "listeners"), count(words, "(?:scrobbles|plays)"));
        if (e.kind === "album") {
          const d = parseDate(text(item.find(ALBUM_DATE).text()));
          if (d) await w.setReleaseDate(e.id, isoDay(d), true);
        }
      });
      return found;
    }

    async function albumPage($: Page, file: string, albumId: number) {
      const artistId = await w.albumArtist(albumId);
      if (artistId === undefined) throw new Error(`Album ${albumId} has gone missing`);
      await eachSeq($(".chartlist-row"), async (i, tr) => {
        const href = $(tr).find(".chartlist-name a").attr("href") || $(tr).find("[data-track-url]").attr("data-track-url");
        const r = musicRef(href);
        if (r?.kind !== "track") return;
        const trackArtist = norm(r.artist) ? await w.artist(r.artist) : artistId;
        const duration = seconds($(tr).find(".chartlist-duration").text());
        const position = Number(text($(tr).find(".chartlist-index").text())) || i + 1;
        await w.track(trackArtist, r.title, duration, albumId, position);
      });
      await setImage("albums", albumId, await image(file, $(".album-overview-cover-art img").attr("src")));
      await eachSeq($(".catalogue-metadata dt"), async (_, dt) => {
        if (!/release date/i.test($(dt).text())) return;
        const v = text($(dt).next("dd").text());
        const d = parseDate(v);
        let date: string | null = null;
        if (d) date = isoDay(d);
        else if (/^\d{4}$/.test(v)) date = v;
        await w.setReleaseDate(albumId, date, false);
      });
    }

    async function tagPage($: Page, file: string, ns: string, url: string, listed: Ent[]) {
      const name = tagOf(url);
      if (!name) return;
      const id = await w.tag(name);
      if (ns === "tag_overview") wiki("tag", id, summary($), false);
      if (ns === "tag_wiki_overview") {
        await eachSeq($(".wiki-content").first(), async (_, el) => wiki("tag", id, prose($, el), true));
      }
      if (/^tag_(overview|artists|albums|tracks)$/.test(ns)) {
        const seen: Record<string, number> = {};
        for (const e of listed) {
          seen[e.kind] = (seen[e.kind] || 0) + 1;
          tag(e, name, 60 - seen[e.kind]!);
        }
      }
      if (ns === "tag_shoutbox_overview") {
        await eachSeq($(".shout"), async (_, el) => {
          const s = $(el);
          const author = userOf(s.find(".shout-user a").first().attr("href"));
          const body = prose($, s.find(".shout-body").first());
          const at = Date.parse(s.find("time[datetime]").first().attr("datetime") || "");
          if (!author || !body || isNaN(at)) return;
          const avatar = await image(file, s.find(".shout-user-avatar img").attr("src"));
          await w.addTagShout(await user(author, avatar), id, body.slice(0, 1000), Math.floor(at / 1000));
          tally("shouts");
        });
      }
    }

    async function eventPage($: Page, file: string, url: string) {
      const key = eventKey(url);
      const start = $("[itemprop=startDate]").first();
      const d = new Date((start.attr("content") || "").slice(0, 10) + "T00:00:00");
      if (!key || isNaN(d.getTime())) return;
      const id = await event(key, {
        exact: true,
        title: text($("h1").first().text()),
        starts: unix(d) + (clock(start.text()) || 12 * 3600),
        venue: text($("[itemprop=location] [itemprop=name]").first().text()),
        city: text($("[itemprop=addressLocality]").first().text()),
        country: text($("[itemprop=addressCountry]").first().text()),
        url: $(".qa-event-link a").attr("href"),
        description: prose($, $(".qa-event-description").first()),
        lineup: $("[itemprop=performer]").map((_, li) => text($(li).find("a.link-block-target, [itemprop=name]").first().text())).get(),
      });
      await eachSeq($("[itemprop=performer]"), async (_, li) => {
        const a = await ensure(musicRef($(li).find("a[href]").first().attr("href")));
        if (a && a.table !== "tracks") await setImage(a.table, a.id, await image(file, $(li).find("img").attr("src")));
      });
      if (!id) tally("events skipped");
    }

    async function ownerPage($: Page, file: string, ns: string, me: number) {
      if (ns === "user_overview") {
        const since = /scrobbling since\s+(.+)/i.exec(text($(".header-scrobble-since, .header-title-secondary").text()))?.[1];
        const sinceDate = parseDate(since || "");
        if (sinceDate) await w.setRegistered(me, unix(sinceDate));
        const real = text($(".header-title-display-name").first().text());
        if (real && norm(real) !== norm(owner)) await w.setRealname(me, clean(real, 60));
        await setImage("users", me, await image(file, $(".header-avatar img").attr("src")));
      }
      await eachSeq($(".chartlist-row[data-timestamp]"), async (_, tr) => {
        const row = $(tr);
        const at = Number(row.attr("data-timestamp"));
        const play = row.find("[data-track-url]").first();
        const r = musicRef(play.attr("data-track-url") || row.find(".chartlist-name a").attr("href"));
        if (r?.kind !== "track" || !at) return;
        const artistId = await w.artist(text(play.attr("data-artist-name") || "") || r.artist);
        const trackId = await w.track(artistId, text(play.attr("data-track-name") || "") || r.title);
        const al = await ensure(musicRef(row.find("a.cover-art").attr("href")));
        tally("scrobbles", await w.addScrobble(me, trackId, artistId, al?.kind === "album" ? al.id : null, at));
      });
      if (ns === "user_loved") {
        await eachSeq($(".chartlist-row"), async (_, tr) => {
          const t = await ensure(musicRef($(tr).find(".chartlist-name a").attr("href")));
          const at = unix(parseDate($(tr).find(".chartlist-timestamp span[title]").attr("title") || "")) || t0;
          if (t?.kind === "track") tally("loved tracks", await w.addLoved(me, t.id, at));
        });
      }
      if (ns === "user_following") {
        for (const id of await userList($, file)) {
          if (id !== me) tally("follows", await w.addFollow(me, id, t0));
        }
      }
      if (ns === "user_followers") {
        for (const id of await userList($, file)) {
          if (id !== me) tally("follows", await w.addFollow(id, me, t0));
        }
      }
      if (ns.startsWith("user_playlists")) {
        await eachSeq($(".playlisting-playlists-item-name"), async (_, h) => {
          const title = clean($(h).text(), 120);
          if (title && (await w.addPlaylist(me, title, t0))) tally("playlists (title only)");
        });
      }
      if (ns.startsWith("user_obsessions")) {
        await eachSeq($(".obsession-history-item"), async (_, li) => {
          const artist = text($(li).find(".obsession-history-item-artist").text());
          const title = text($(li).find(".obsession-history-item-heading").text());
          const at = unix(parseDate(text($(li).find(".obsession-history-item-date").text()))) || t0;
          if (!artist || !title) return;
          const trackId = await w.track(await w.artist(artist), title);
          if (await w.addObsession(me, trackId, at)) tally("obsessions");
        });
      }
    }

    const pages = files
      .map(f => {
        const file = join(root, f);
        const $ = cheerio.load(readFileSync(file, "utf8"));
        const ns = /namespace--(\S+)/.exec($("body").attr("class") || "")?.[1] || "";
        const url = $("link[rel=canonical]").attr("href") || "";
        return { file, $, ns, url };
      })
      .filter(p => /^(music|tag|user|events_(overview|event|festival)|charts|home|search)/.test(p.ns))
      // attendance pages need their event first
      .sort((a, b) => Number(a.ns.includes("attendance")) - Number(b.ns.includes("attendance")));
    owner = userOf(pages.find(p => p.ns === "user_overview")?.url) || userOf(pages.find(p => p.ns.startsWith("user_"))?.url);
    const me = owner ? await user(owner) : 0;

    for (const { file, $, ns, url } of pages) {
      $("script, style, noscript").remove();
      const personal = ns.startsWith("user_");
      const self = await ensure(musicRef(url));
      tally("pages");

      // before the generic pass so the tracklist keeps its order
      if (ns === "music_album_overview" && self?.kind === "album") await albumPage($, file, self.id);
      const listed = await lists($, file, personal);
      await eachSeq($("a[href]"), async (_, a) => {
        await ensure(musicRef($(a).attr("href")));
      });
      await eventRows($);

      if (self && /^music_(artist|album|track)_overview$/.test(ns)) {
        await headerStats($, self);
        pageTags($).slice(0, 12).forEach((t, i) => tag(self, t, 100 - i * 8));
        wiki(self.kind, self.id, summary($), false);
      }
      if (self && ns === "music_artist_overview") {
        await eachSeq($(".catalogue-overview-similar-artists-item"), async (i, li) => {
          const href = $(li).find("a[href]").map((_, a) => $(a).attr("href")).get().find(h => musicRef(h));
          const s = await ensure(musicRef(href));
          if (s?.kind !== "artist" || s.id === self.id) return;
          await w.addSimilar(self.id, s.id, Math.max(0.3, 0.95 - i * 0.05));
          tally("similar-artist links");
        });
      }
      if (self && ns === "music_track_overview") {
        await eachSeq($(".catalogue-metadata dt"), async (_, dt) => {
          if (!/^length/i.test(text($(dt).text()))) return;
          const d = seconds($(dt).next("dd").text());
          if (d) await w.setDuration(self.id, d, false);
        });
        const albumHref = $(".source-album a[href]").map((_, a) => $(a).attr("href")).get().find(h => musicRef(h)?.kind === "album");
        const al = await ensure(musicRef(albumHref));
        if (al) await w.setTrackAlbum(self.id, al.id, false);
      }
      if (self && /^music_\w+_wiki/.test(ns)) {
        await eachSeq($(".wiki-content").first(), async (_, el) => wiki(self.kind, self.id, prose($, el), true));
      }
      if (self && /^music_\w+_tags/.test(ns)) pageTags($).forEach((t, i) => tag(self, t, 100 - i * 5));

      if (ns.startsWith("tag_")) await tagPage($, file, ns, url, listed);
      if (/^events_(event|festival)_overview$/.test(ns)) await eventPage($, file, url);

      const going = /^events_\w+_attendance_(going|interested)$/.exec(ns);
      const eid = eventIds.get(eventKey(url));
      if (going && eid) {
        for (const uid of await userList($, file)) {
          await w.addAttendance(eid, uid, going[1]!, t0);
          tally("event attendances");
        }
      }

      if (personal && me && norm(userOf(url)) === norm(owner)) await ownerPage($, file, ns, me);
    }

    for (const [k, weight] of tagWeights) {
      const [type = "", id, name = ""] = k.split("\u0000");
      await w.addTagging(await w.tag(name), type, Number(id), weight, t0);
    }
    for (const [k, page] of wikis) {
      const [type = "", id] = k.split(":");
      await w.addWiki(type, Number(id), page.content, t0);
    }
    Object.assign(stats, await w.catalogueSizes());
    stats.taggings = tagWeights.size;
    stats.wikis = wikis.size;
    await w.markImported(JSON.stringify({ at: t0, dir: root, owner, stats }));
  };
  await load(work);

  await queueChanged();
  while (await refreshTaste()) {}

  log(`Imported ${root}`);
  log("  " + Object.entries(stats).map(([k, v]) => `${v} ${k}`).join(" · "));
  if (owner) {
    const note = `Sonosphere dev login (created by the one-time import)\nusername: ${owner}\npassword: ${password}\n`;
    mkdirSync("data", { recursive: true });
    writeFileSync("data/dev-login.txt", note, { mode: 0o600 });
    log(`  Log in as "${owner}" with password "${password}" (also saved to data/dev-login.txt; change it in Settings).`);
  }
  return { owner, stats };
}

if (import.meta.main) {
  if ((await imported()) && !process.argv.includes("--force")) {
    console.log("Already imported. Run `bun run reset` to empty the database and import again.");
  } else {
    await importPages(process.argv.slice(2).find(a => !a.startsWith("--")) || IMPORT_DIR);
  }
}
