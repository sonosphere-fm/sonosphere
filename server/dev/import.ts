// One-time development import: reads a folder of saved music-site pages (HTML + their "_files" folders)
// and loads what they contain into the database. Reads local files only; never touches the network, and nothing
// in a page is ever run: pages are parsed as text.
// Run by the dev server on first start, or by hand: `bun server/dev/import.ts [dir] [--force]`.
import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { queueChanged } from "../recommend/repo";
import { refreshTaste } from "../recommend/worker";
import { clean, norm, now, rid } from "../util";
import { imported, load, type CatalogueTable, type EventText, type Pictured, type Writer } from "./import.repo";

export { imported };
/** The folder of saved pages: IMPORT_DIR, or data/import in the project (data/ is never committed). */
export const IMPORT_DIR = process.env.IMPORT_DIR || resolve(import.meta.dir, "../../data/import");

type Ref = { kind: "artist"; artist: string } | { kind: "album" | "track"; artist: string; title: string };
type Ent = { kind: Ref["kind"]; table: CatalogueTable; id: number };
type Page = cheerio.CheerioAPI;
type Picture = { id: number; size: number };
type Ev = { title?: string; venue?: string; city?: string; country?: string; starts?: number; description?: string; url?: string; lineup?: string[]; exact?: boolean };

// ---------- small parsers ----------
const text = (s: string) => s.replace(/\s+/g, " ").trim();
const decode = (s: string) => {
  let v = s.replace(/\+/g, " ");
  for (let i = 0; i < 2; i++) { try { const d = decodeURIComponent(v); if (d === v) break; v = d; } catch { break; } }
  return v.trim();
};
/** What a /music/... link points at: an artist, one of their albums, or a track. */
function musicRef(href?: string | null): Ref | null {
  const m = /^(?:https?:\/\/www\.last\.fm)?\/music\/([^?#]+)/.exec(href || "");
  if (!m) return null;
  const seg: string[] = [];
  for (const s of (m[1] ?? "").split("/")) { if (!s || (s.startsWith("+") && s !== "+")) break; seg.push(s); }
  const artist = seg[0] && seg[0] !== "_" ? decode(seg[0]) : "";
  if (!artist) return null;
  if (seg[1] === "_") return seg[2] && decode(seg[2]) ? { kind: "track", artist, title: decode(seg[2]) } : { kind: "artist", artist };
  if (seg[2] && decode(seg[2])) return { kind: "track", artist, title: decode(seg[2]) };   // album-scoped track link: /music/Artist/Album/Track
  if (seg[1] && decode(seg[1])) return { kind: "album", artist, title: decode(seg[1]) };
  return { kind: "artist", artist };
}
const isRef = (r: Ref | null): r is Ref => r !== null;
const pathPart = (href: string | undefined | null, re: RegExp) => { const m = re.exec(href || ""); return m ? decode(m[1] ?? "") : ""; };
const userOf = (href?: string | null) => pathPart(href, /^(?:https?:\/\/www\.last\.fm)?\/user\/([^/?#]+)/);
const tagOf = (href?: string | null) => pathPart(href, /^(?:https?:\/\/www\.last\.fm)?\/tag\/([^/?#]+)/);
const eventKey = (href?: string | null) => /\/(?:event|festival)\/(\d+)/.exec(href || "")?.[1] || "";
const MULTIPLIER: Record<string, number> = { K: 1e3, M: 1e6, B: 1e9 };
/** The number in front of `word`, as in "1.2M listeners" or "3,456 plays". */
function count(s: string, word: string): number {
  const m = new RegExp(`(\\d[\\d,.]*)\\s*([KMB])?\\s*${word}`, "i").exec(s);
  if (!m) return 0;
  const digits = m[1] ?? "", mult = MULTIPLIER[(m[2] || "").toUpperCase()] || 1;
  return Math.round(mult === 1 ? Number(digits.replace(/[,.]/g, "")) : Number(digits.replace(/,/g, "")) * mult) || 0;
}
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
/** Reads "3 Jan 2024", "3 January 2024, 4:05pm" or "Jan 3, 2024". Without a time it means midday. */
function parseDate(s: string): Date | null {
  let m = /(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?,?\s+(\d{4})(?:,?\s+(?:at\s+)?(\d{1,2}):(\d{2})\s*(am|pm))?/i.exec(s), d = 0, mo = -1, y = 0;
  if (m) { d = Number(m[1]); mo = MONTHS.indexOf((m[2] ?? "").toLowerCase()); y = Number(m[3]); }
  else if ((m = /([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),\s+(\d{4})/.exec(s))) { mo = MONTHS.indexOf((m[1] ?? "").toLowerCase()); d = Number(m[2]); y = Number(m[3]); }
  if (!m || mo < 0) return null;
  let h = 12, mi = 0;
  if (m[4]) { h = (Number(m[4]) % 12) + (/pm/i.test(m[6] ?? "") ? 12 : 0); mi = Number(m[5]); }
  return new Date(y, mo, d, h, mi);
}
const unix = (d: Date | null) => (d ? Math.floor(d.getTime() / 1000) : 0);
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const clock = (s: string) => { const m = /(\d{1,2}):(\d{2})\s*(am|pm)/i.exec(s); return m ? ((Number(m[1]) % 12) + (/pm/i.test(m[3] ?? "") ? 12 : 0)) * 3600 + Number(m[2]) * 60 : 0; };
const seconds = (s: string) => { const p = text(s).split(":").map(Number); return p.length >= 2 && p.every(Number.isFinite) ? p.reduce((a, b) => a * 60 + b, 0) : 0; };
/** The readable text of a block, one paragraph per blank line. */
function prose($: Page, el: cheerio.BasicAcceptedElems<AnyNode>): string {
  const c = $(el).clone();
  c.find("script, style, .wiki-block-cta, a.wiki-block-cta, .factbox").remove();
  c.find("br").replaceWith("\n");
  const paras = c.find("p").length ? c.find("p").map((_, p) => $(p).text()).get() : [c.text()];
  return paras.map(p => p.replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim()).filter(Boolean).join("\n\n").replace(/…?\s*read more\s*$/i, "…").trim();
}
const pageTags = ($: Page) => [...new Set($(".tag a, .big-tags-item-name a").not(".about-artist a").map((_, a) => tagOf($(a).attr("href"))).get().filter(Boolean))];
const summary = ($: Page) => $(".wiki-block-inner-2").not(".about-artist .wiki-block-inner-2").map((_, el) => prose($, el)).get().sort((a, b) => b.length - a.length)[0] || "";

const PLACEHOLDER = /^(818148bf682d429dc215c1705eb27b98|2a96cbd8b46e442fc41c2b86b821562f|c6f59c1e5e7240a4c0d427abd71f3dbb|4128a6eb29f94943c9d206c08e625904)/;
const MIME: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp" };
// Every block that names an artist / album / track.
const ITEMS = [".chartlist-row", ".grid-items-item", ".artist-top-albums-item", ".catalogue-overview-similar-artists-item", ".similar-albums-item",
  ".track-similar-tracks-item", ".big-artist-list-item", ".resource-list--release-list-item", ".resource-list--sidebar-item", ".globalchart-item", ".weeklychart-item",
  ".music-releases-item", ".music-more-artists-item", ".column-tracks-item", ".source-album", ".similar-items-body-item", ".similar-items-sidebar-item",
  ".recs-feed-item", ".artist-header-featured-items-item", ".featured-item"].join(", ");
const RANK = { track: 3, album: 2, artist: 1 };

export async function importPages(dir = IMPORT_DIR, log: (s: string) => void = console.log) {
  const root = resolve(dir);
  if (!existsSync(root)) throw new Error(`Import folder not found: ${root}`);
  const files = readdirSync(root).filter(f => f.endsWith(".html")).sort();
  const password = process.env.IMPORT_PASSWORD || rid(6);
  const [ownerHash, lockedHash] = await Promise.all([
    Bun.password.hash(password, { algorithm: "bcrypt", cost: 10 }),
    Bun.password.hash(rid(32), { algorithm: "bcrypt", cost: 10 }),   // nobody knows this one: imported profiles can't be logged into
  ]);
  const t0 = now();
  const stats: Record<string, number> = {};
  const tally = (k: string, n = 1) => { stats[k] = (stats[k] || 0) + n; };
  let owner = "";

  const work = (w: Writer) => {
    // ---------- images ----------
    const byHash = new Map<string, Picture>(), best = new Map<string, number>();
    function image(file: string, src?: string | null): Picture | null {
      if (!src || !src.startsWith("./")) return null;
      const name = src.split("/").pop() || "", mime = MIME[(/\.(\w+)$/.exec(name)?.[1] || "").toLowerCase()];
      if (!mime || PLACEHOLDER.test(name)) return null;
      for (const rel of [src, decode(src.replace(/\+/g, "%2B"))]) {
        const p = resolve(dirname(file), rel);
        if (!p.startsWith(root + sep) || !existsSync(p) || !statSync(p).isFile()) continue;
        const data = readFileSync(p), key = Bun.hash(data).toString(36);
        let hit = byHash.get(key);
        if (!hit) {
          hit = { id: w.addImage(mime, data, t0), size: data.length };
          byHash.set(key, hit); tally("images");
        }
        return hit;
      }
      return null;
    }
    /** Gives something its picture, unless it already has a bigger one. */
    function setImage(table: Pictured, id: number, img: Picture | null) {
      const k = `${table}:${id}`;
      if (!img || (best.get(k) || 0) >= img.size) return;
      best.set(k, img.size); w.setImage(table, id, img.id);
    }

    // ---------- catalogue ----------
    function make(r: Ref): Ent {
      const artistId = w.artist(r.artist);
      if (r.kind === "artist") return { kind: "artist", table: "artists", id: artistId };
      if (r.kind === "album") return { kind: "album", table: "albums", id: w.album(artistId, r.title) };
      return { kind: "track", table: "tracks", id: w.track(artistId, r.title) };
    }
    const ensure = (r: Ref | null): Ent | null => (r ? make(r) : null);
    const base = (e: Ent, listeners: number, plays: number) => w.raiseBase(e.table, e.id, listeners, plays);
    const tagWeights = new Map<string, number>();   // "type:id:tag" -> weight
    const tag = (e: Ent, name: string, weight: number) => {
      const n = clean(name, 60); if (!n) return;
      const k = `${e.kind}\u0000${e.id}\u0000${n}`; tagWeights.set(k, Math.max(tagWeights.get(k) || 0, Math.max(1, Math.round(weight))));
    };
    const wikis = new Map<string, { content: string; full: boolean }>();
    const wiki = (type: string, id: number, content: string, full: boolean) => {
      const k = `${type}:${id}`, old = wikis.get(k);
      if (content.length > 40 && (!old || (full && !old.full) || (full === old.full && content.length > old.content.length))) wikis.set(k, { content, full });
    };
    function headerStats($: Page, e: Ent) {
      let l = 0, p = 0;
      $(".header-metadata-tnew-item, .header-metadata-item").each((_, li) => {
        const label = text($(li).find("h4").first().text()).toLowerCase(), abbr = $(li).find("abbr[title]").first();
        const v = abbr.length ? count(abbr.attr("title") + " x", "x") : count(text($(li).find(".header-metadata-display, .header-metadata-tnew-display").text()) + " x", "x");
        if (label === "listeners") l = v; else if (label === "scrobbles") p = v;
      });
      base(e, l, p);
    }

    // ---------- people ----------
    function user(name: string, avatar: Picture | null = null): number {
      const n = norm(name);
      let id = w.userId(n);
      if (!id) {
        const mine = n === norm(owner);
        id = w.addUser({
          username: clean(name, 40), usernameNorm: n, email: `${n.replace(/[^a-z0-9._-]/g, "_")}@${mine ? "needle" : "imported"}.invalid`,
          passwordHash: mine ? ownerHash : lockedHash, registeredAt: t0,
        });
        tally(mine ? "account" : "profiles (login disabled)");
      }
      setImage("users", id, avatar);
      return id;
    }
    const userList = ($: Page, file: string): number[] => $(".user-list-item").map((_, li) => {
      const name = userOf($(li).find("a.user-list-link").attr("href"));
      return name ? [user(name, image(file, $(li).find(".user-list-avatar img").attr("src")))] : [];
    }).get();

    // ---------- events ----------
    const eventIds = new Map<string, number>();
    function event(key: string, e: Ev): number {
      let found = eventIds.get(key);
      if (!found) {
        if (!e.title || !e.starts) return 0;
        found = w.addEvent(clean(e.title, 200), e.starts, t0);
        eventIds.set(key, found); tally("events");
      }
      const id = found;
      const set = (field: EventText, v: string | undefined, max = 200) => {
        const whole = field === "description", s = whole ? String(v || "").trim().slice(0, max) : clean(v, max);
        if (s) w.setEventText(id, field, s, whole);
      };
      set("venue", e.venue); set("city", e.city); set("country", e.country); set("url", e.url, 500); set("description", e.description, 8000);
      if (e.starts && e.exact) w.setEventStart(id, e.starts);
      (e.lineup || []).map(n => clean(n)).filter(Boolean).forEach((name, i) => w.addEventArtist(id, w.artist(name), i));
      return id;
    }
    function eventRows($: Page) {
      let day: Date | null = null;
      $(".group-heading, .events-list-item").each((_, el) => {
        const row = $(el);
        if (row.hasClass("group-heading")) { day = parseDate(row.text()); return; }
        const link = row.find("a.link-block-target, a.events-list-item-event-name").first(), key = eventKey(link.attr("href"));
        const iso = row.find(".events-list-item-date").attr("content"), at = iso ? new Date(iso.slice(0, 10) + "T12:00:00") : day;
        if (!key || !at || isNaN(at.getTime())) return;
        const named = row.find("[itemprop=performer] [itemprop=name]").map((_, x) => text($(x).text())).get();
        const lineup = named.length ? named : text(row.find(".events-list-item-event--lineup").text()).split(/,\s+/);
        const title = text(row.find(".events-list-item-event--title").text()) || text(link.find("[itemprop=name]").first().text()) || text(link.text()) || lineup[0];
        const address = text(row.find(".events-list-item-venue [itemprop=address]").first().text()).split(/,\s*/).filter(Boolean);
        event(key, {
          title, starts: unix(at), lineup,
          venue: text(row.find(".events-list-item-venue--title, .events-list-item-venue [itemprop=name]").first().text()),
          city: text(row.find(".events-list-item-venue--city, [itemprop=addressLocality]").first().text()) || address[0],
          country: text(row.find(".events-list-item-venue--country, [itemprop=addressCountry]").first().text()) || (address.length > 1 ? address[address.length - 1] : ""),
        });
      });
    }

    // ---------- generic lists ----------
    function lists($: Page, file: string, personal: boolean): Ent[] {
      const found: Ent[] = [];
      $(ITEMS).each((_, el) => {
        const item = $(el), refs: Ref[] = item.find("a[href]").map((_, a) => musicRef($(a).attr("href"))).get().filter(isRef);
        const play = item.find("[data-track-url]").first();
        if (play.length) { const r = musicRef(play.attr("data-track-url")); if (r?.kind === "track") refs.push({ ...r, title: text(play.attr("data-track-name") || "") || r.title, artist: text(play.attr("data-artist-name") || "") || r.artist }); }
        const lead = refs[0];
        if (!lead) return;
        const target = musicRef(item.find("a.link-block-target").first().attr("href"));
        const main = item.is(".chartlist-row") ? refs.find(r => r.kind === "track") || lead : target || [...refs].sort((a, b) => RANK[b.kind] - RANK[a.kind])[0] || lead;
        const e = make(main); found.push(e);
        const album = main.kind === "track" ? ensure(musicRef(item.find("a.cover-art").attr("href"))) : null;
        const img = image(file, item.find("img[src]").first().attr("src"));
        if (e.table !== "tracks") setImage(e.table, e.id, img);
        else if (album?.kind === "album") { setImage("albums", album.id, img); w.setTrackAlbum(e.id, album.id, true); }
        const dur = seconds(item.find(".chartlist-duration").first().text());
        if (e.kind === "track" && dur) w.setDuration(e.id, dur, true);
        const words = text(item.text());
        if (!personal) base(e, count(words, "listeners"), count(words, "(?:scrobbles|plays)"));
        if (e.kind === "album") { const d = parseDate(text(item.find(".artist-top-albums-item-aux-text, .resource-list--release-list-item-aux-text, .music-releases-item-aux-text").text())); if (d) w.setReleaseDate(e.id, isoDay(d), true); }
      });
      return found;
    }

    // ---------- page by page ----------
    const pages = files.map(f => {
      const file = join(root, f), $ = cheerio.load(readFileSync(file, "utf8"));
      const ns = /namespace--(\S+)/.exec($("body").attr("class") || "")?.[1] || "", url = $("link[rel=canonical]").attr("href") || "";
      return { f, file, $, ns, url };
    }).filter(p => /^(music|tag|user|events_(overview|event|festival)|charts|home|search)/.test(p.ns))
      .sort((a, b) => Number(a.ns.includes("attendance")) - Number(b.ns.includes("attendance")));   // attendance pages need their event first
    owner = userOf(pages.find(p => p.ns === "user_overview")?.url) || userOf(pages.find(p => p.ns.startsWith("user_"))?.url);
    const me = owner ? user(owner) : 0;

    for (const { file, $, ns, url } of pages) {
      $("script, style, noscript").remove();
      const personal = ns.startsWith("user_");
      const self = ensure(musicRef(url));
      tally("pages");

      if (ns === "music_album_overview" && self?.kind === "album") {   // before the generic pass so the tracklist keeps its order
        const albumId = self.id, artistId = w.albumArtist(albumId);
        if (artistId === undefined) throw new Error(`Album ${albumId} has gone missing`);
        $(".chartlist-row").each((i, tr) => {
          const r = musicRef($(tr).find(".chartlist-name a").attr("href") || $(tr).find("[data-track-url]").attr("data-track-url"));
          if (r?.kind !== "track") return;
          w.track(norm(r.artist) ? w.artist(r.artist) : artistId, r.title, seconds($(tr).find(".chartlist-duration").text()), albumId, Number(text($(tr).find(".chartlist-index").text())) || i + 1);
        });
        setImage("albums", albumId, image(file, $(".album-overview-cover-art img").attr("src")));
        $(".catalogue-metadata dt").each((_, dt) => {
          if (!/release date/i.test($(dt).text())) return;
          const v = text($(dt).next("dd").text()), d = parseDate(v);
          w.setReleaseDate(albumId, d ? isoDay(d) : /^\d{4}$/.test(v) ? v : null, false);
        });
      }
      const listed = lists($, file, personal);
      $("a[href]").each((_, a) => { ensure(musicRef($(a).attr("href"))); });
      eventRows($);

      if (self && /^music_(artist|album|track)_overview$/.test(ns)) {
        headerStats($, self);
        pageTags($).slice(0, 12).forEach((t, i) => tag(self, t, 100 - i * 8));
        wiki(self.kind, self.id, summary($), false);
      }
      if (self && ns === "music_artist_overview") {
        $(".catalogue-overview-similar-artists-item").each((i, li) => {
          const s = ensure(musicRef($(li).find("a[href]").map((_, a) => $(a).attr("href")).get().find(h => musicRef(h))));
          if (s?.kind === "artist" && s.id !== self.id) { w.addSimilar(self.id, s.id, Math.max(0.3, 0.95 - i * 0.05)); tally("similar-artist links"); }
        });
      }
      if (self && ns === "music_track_overview") {
        $(".catalogue-metadata dt").each((_, dt) => { if (/^length/i.test(text($(dt).text()))) { const d = seconds($(dt).next("dd").text()); if (d) w.setDuration(self.id, d, false); } });
        const al = ensure(musicRef($(".source-album a[href]").map((_, a) => $(a).attr("href")).get().find(h => musicRef(h)?.kind === "album")));
        if (al) w.setTrackAlbum(self.id, al.id, false);
      }
      if (self && /^music_\w+_wiki/.test(ns)) $(".wiki-content").first().each((_, el) => wiki(self.kind, self.id, prose($, el), true));
      if (self && /^music_\w+_tags/.test(ns)) pageTags($).forEach((t, i) => tag(self, t, 100 - i * 5));

      if (ns.startsWith("tag_")) {
        const name = tagOf(url);
        if (name) {
          const id = w.tag(name);
          if (ns === "tag_overview") wiki("tag", id, summary($), false);
          if (ns === "tag_wiki_overview") $(".wiki-content").first().each((_, el) => wiki("tag", id, prose($, el), true));
          if (/^tag_(overview|artists|albums|tracks)$/.test(ns)) { const seen: Record<string, number> = {}; for (const e of listed) tag(e, name, 60 - (seen[e.kind] = (seen[e.kind] || 0) + 1)); }
          if (ns === "tag_shoutbox_overview") $(".shout").each((_, el) => {
            const s = $(el), author = userOf(s.find(".shout-user a").first().attr("href")), body = prose($, s.find(".shout-body").first()), at = Date.parse(s.find("time[datetime]").first().attr("datetime") || "");
            if (!author || !body || isNaN(at)) return;
            w.addTagShout(user(author, image(file, s.find(".shout-user-avatar img").attr("src"))), id, body.slice(0, 1000), Math.floor(at / 1000));
            tally("shouts");
          });
        }
      }

      if (/^events_(event|festival)_overview$/.test(ns)) {
        const key = eventKey(url), start = $("[itemprop=startDate]").first(), d = new Date((start.attr("content") || "").slice(0, 10) + "T00:00:00");
        if (key && !isNaN(d.getTime())) {
          const id = event(key, {
            exact: true, title: text($("h1").first().text()), starts: unix(d) + (clock(start.text()) || 12 * 3600),
            venue: text($("[itemprop=location] [itemprop=name]").first().text()),
            city: text($("[itemprop=addressLocality]").first().text()), country: text($("[itemprop=addressCountry]").first().text()),
            url: $(".qa-event-link a").attr("href"), description: prose($, $(".qa-event-description").first()),
            lineup: $("[itemprop=performer]").map((_, li) => text($(li).find("a.link-block-target, [itemprop=name]").first().text())).get(),
          });
          $("[itemprop=performer]").each((_, li) => {
            const a = ensure(musicRef($(li).find("a[href]").first().attr("href")));
            if (a && a.table !== "tracks") setImage(a.table, a.id, image(file, $(li).find("img").attr("src")));   // tracks have no picture of their own
          });
          if (!id) tally("events skipped");
        }
      }
      const going = /^events_\w+_attendance_(going|interested)$/.exec(ns), eid = eventIds.get(eventKey(url));
      if (going && eid) for (const uid of userList($, file)) { w.addAttendance(eid, uid, going[1] ?? "", t0); tally("event attendances"); }

      if (personal && me && norm(userOf(url)) === norm(owner)) {
        if (ns === "user_overview") {
          const since = parseDate(/scrobbling since\s+(.+)/i.exec(text($(".header-scrobble-since, .header-title-secondary").text()))?.[1] || "");
          if (since) w.setRegistered(me, unix(since));
          const real = text($(".header-title-display-name").first().text()); if (real && norm(real) !== norm(owner)) w.setRealname(me, clean(real, 60));
          setImage("users", me, image(file, $(".header-avatar img").attr("src")));
        }
        $(".chartlist-row[data-timestamp]").each((_, tr) => {
          const row = $(tr), at = Number(row.attr("data-timestamp")), play = row.find("[data-track-url]").first();
          const r = musicRef(play.attr("data-track-url") || row.find(".chartlist-name a").attr("href"));
          if (r?.kind !== "track" || !at) return;
          const artistId = w.artist(text(play.attr("data-artist-name") || "") || r.artist), trackId = w.track(artistId, text(play.attr("data-track-name") || "") || r.title);
          const al = ensure(musicRef(row.find("a.cover-art").attr("href")));
          tally("scrobbles", w.addScrobble(me, trackId, artistId, al?.kind === "album" ? al.id : null, at));
        });
        if (ns === "user_loved") $(".chartlist-row").each((_, tr) => {
          const t = ensure(musicRef($(tr).find(".chartlist-name a").attr("href"))), at = unix(parseDate($(tr).find(".chartlist-timestamp span[title]").attr("title") || "")) || t0;
          if (t?.kind === "track") tally("loved tracks", w.addLoved(me, t.id, at));
        });
        if (ns === "user_following") for (const id of userList($, file)) if (id !== me) tally("follows", w.addFollow(me, id, t0));
        if (ns === "user_followers") for (const id of userList($, file)) if (id !== me) tally("follows", w.addFollow(id, me, t0));
        if (ns.startsWith("user_playlists")) $(".playlisting-playlists-item-name").each((_, h) => {
          const title = clean($(h).text(), 120);
          if (title && w.addPlaylist(me, title, t0)) tally("playlists (title only)");
        });
        if (ns.startsWith("user_obsessions")) $(".obsession-history-item").each((_, li) => {
          const artist = text($(li).find(".obsession-history-item-artist").text()), title = text($(li).find(".obsession-history-item-heading").text());
          const at = unix(parseDate(text($(li).find(".obsession-history-item-date").text()))) || t0;
          if (!artist || !title) return;
          if (w.addObsession(me, w.track(w.artist(artist), title), at)) tally("obsessions");
        });
      }
    }

    for (const [k, weight] of tagWeights) {
      const [type = "", id, name = ""] = k.split("\u0000");
      w.addTagging(w.tag(name), type, Number(id), weight, t0);
    }
    for (const [k, page] of wikis) { const [type = "", id] = k.split(":"); w.addWiki(type, Number(id), page.content, t0); }
    Object.assign(stats, w.catalogueSizes());
    stats.taggings = tagWeights.size; stats.wikis = wikis.size;
    w.markImported(JSON.stringify({ at: t0, dir: root, owner, stats }));
  };
  load(work);
  // Similar artists and listening neighbours for everything that just arrived.
  queueChanged();
  while (await refreshTaste()) { /* keep going until the queue is empty */ }

  log(`Imported ${root}`);
  log("  " + Object.entries(stats).map(([k, v]) => `${v} ${k}`).join(" · "));
  if (owner) {
    const note = `Sonosphere dev login (created by the one-time import)\nusername: ${owner}\npassword: ${password}\n`;
    mkdirSync("data", { recursive: true }); writeFileSync("data/dev-login.txt", note, { mode: 0o600 });
    log(`  Log in as "${owner}" with password "${password}" (also saved to data/dev-login.txt; change it in Settings).`);
  }
  return { owner, stats };
}

if (import.meta.main) {
  if ((await imported()) && !process.argv.includes("--force")) console.log("Already imported. Delete data/needle.db (or run `bun run reset`) to import again.");
  else await importPages(process.argv.slice(2).find(a => !a.startsWith("--")) || IMPORT_DIR);
}
