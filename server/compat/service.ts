// The methods of the scrobbler-compatible API: same names, parameters, signing scheme and response shapes as
// Last.fm's web service, so existing scrobbler clients can be pointed at this server. Each method returns the
// reply as plain data; routes.ts turns it into JSON or XML.
import { createHash } from "node:crypto";
import { findAlbum, findArtist, findItem, findTag, findTrack, hasLoved } from "../catalog/repo";
import { mbidOfAlbum, mbidOfArtist } from "../corrections/service";
import { range } from "../listening/period";
import { counts, nowPlaying, recent, setLoved, top } from "../listening/repo";
import { resolve, scrobbleMany, setNowPlaying } from "../listening/service";
import { similarArtists, similarTracks } from "../recommend/service";
import { addTags, removeTag, taggerCount, taggingCount, topTags } from "../tags/repo";
import { findById, findByName, followingCount, lovedCount, type User } from "../users/repo";
import { now, norm, rid } from "../util";
import { latestWiki } from "../wiki/repo";
import * as repo from "./repo";

/** A failure the API has a number for. Anything else that goes wrong is reported as a temporary error. */
export class ApiError extends Error { constructor(public code: number, message: string) { super(message); } }
function fail(code: number, message: string): never { throw new ApiError(code, message); }

/** Request parameters as they arrived. A JSON body can put anything in them, so nothing is assumed to be a string. */
export type Params = Record<string, unknown>;
export type Reply = Record<string, unknown>;
type Page = { limit: number; page: number; offset: number };
type Call = { p: Params; origin: string; app: repo.App; pg: Page };
type Method = (c: Call) => Promise<Reply>;

// ---------- reading parameters ----------
/** A parameter used as a name: missing is "", and anything that is not text is a broken request. */
function text(v: unknown): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  throw new TypeError("Expected a text parameter");
}
/** A parameter matched against a stored key. Numbers match the key with the same digits. */
const key = (v: unknown): string => (typeof v === "number" && v ? String(v) : text(v));
const page = (p: Params, def = 50): Page => {
  const limit = Math.min(1000, Math.max(1, Number(p.limit) || def)), pg = Math.max(1, Number(p.page) || 1);
  return { limit, page: pg, offset: (pg - 1) * limit };
};
const period = (p: Params, name: unknown = p.period): [number, number] =>
  range(new URLSearchParams({ period: String(name || "overall"), from: String(p.from || ""), to: String(p.to || "") }));

// ---------- signing and sessions ----------
const md5 = (s: string) => createHash("md5").update(s, "utf8").digest("hex");
const UNSIGNED = ["format", "callback", "api_sig"];
/** Refuses the call unless it carries the signature only the application's secret can produce. */
function signed({ p, app }: Call): void {
  const base = Object.keys(p).filter(k => !UNSIGNED.includes(k)).sort().map(k => k + String(p[k])).join("");
  if (md5(base + app.secret) !== String(p.api_sig || "").toLowerCase()) fail(13, "Invalid method signature supplied");
}
/** The user a signed call acts for. */
async function session(c: Call): Promise<number> {
  signed(c);
  return (await repo.sessionUser(key(c.p.sk), c.app.id)) ?? fail(9, "Invalid session key - Please re-authenticate");
}
async function newSession(c: Call, userId: number): Promise<Reply> {
  const sk = rid(16);
  await repo.createSession(sk, c.app.id, userId);
  const user = await findById(userId);
  if (!user) throw new Error("Session created for a user who does not exist");
  return { session: { name: user.username, key: sk, subscriber: 0 } };
}

// ---------- what a call is about ----------
const artistOf = async (p: Params) => (await findArtist(text(p.artist))) ?? fail(6, "The artist you supplied could not be found");
const trackOf = async (p: Params) => (await findTrack(text(p.artist), text(p.track))) ?? fail(6, "Track not found");
const albumOf = async (p: Params) => (await findAlbum(text(p.artist), text(p.album))) ?? fail(6, "Album not found");
const tagOf = async (p: Params) => (await findTag(text(p.tag))) ?? fail(6, "Tag not found");
/** The user named, or failing that the one with the fallback id. */
/** An empty chart for someone who keeps their listening private, or undefined when it may be read. */
const shut = (u: User) => (u.privateListening ? { items: [], total: 0 } : undefined);

async function userOf(name: unknown, fallback?: number): Promise<User> {
  const u = name ? await findByName(text(name)) : fallback ? await findById(fallback) : null;
  return u ?? fail(6, "User not found");
}

// ---------- shapes ----------
const enc = (s: string) => encodeURIComponent(s).replace(/%20/g, "+");
const img = (id: string | null, origin: string) => ["small", "medium", "large", "extralarge"].map(size => ({ "#text": id ? `${origin}/api/image/${id}${size === "small" || size === "medium" ? "?s=small" : ""}` : "", size }));
const attr = (extra: Record<string, string>, pg: Page, total: number) =>
  ({ ...extra, page: String(pg.page), perPage: String(pg.limit), totalPages: String(Math.ceil(total / pg.limit)), total: String(total) });
const ranked = <T extends object>(items: T[], pg: Page) => items.map((x, i) => ({ ...x, "@attr": { rank: String(pg.offset + i + 1) } }));
/** A time the way clients show it, e.g. "20 Nov 2026, 10:23". */
const shortDate = (seconds: number) => new Date(seconds * 1000).toUTCString().slice(5, 22);
const longDate = (seconds: number) => new Date(seconds * 1000).toUTCString();

type ArtistRow = { name: string; image: string | null; playcount?: number; listeners?: number };
type TrackRow = { title: string; duration: number; artist: string; image: string | null; playcount?: number; listeners?: number };
type AlbumRow = { title: string; artist: string; image: string | null; playcount?: number };
type PlayRow = { title: string; artist: string; album: string | null; image: string | null };

const artistUrl = (c: Call, artist: string) => `${c.origin}/music/${enc(artist)}`;
const trackUrl = (c: Call, artist: string, title: string) => `${c.origin}/music/${enc(artist)}/_/${enc(title)}`;
const albumUrl = (c: Call, artist: string, title: string) => `${c.origin}/music/${enc(artist)}/${enc(title)}`;
const tagUrl = (c: Call, name: string) => `${c.origin}/tag/${enc(name)}`;

const artistShape = (c: Call) => (a: ArtistRow) =>
  ({ name: a.name, playcount: String(a.playcount ?? 0), listeners: String(a.listeners ?? 0), mbid: "", url: artistUrl(c, a.name), image: img(a.image, c.origin) });
const trackShape = (c: Call) => (t: TrackRow) => ({
  name: t.title, duration: String(t.duration || 0), playcount: String(t.playcount ?? 0), listeners: String(t.listeners ?? 0), mbid: "",
  url: trackUrl(c, t.artist, t.title), artist: { name: t.artist, mbid: "", url: artistUrl(c, t.artist) }, image: img(t.image, c.origin),
});
const albumShape = (c: Call) => (a: AlbumRow) => ({
  name: a.title, playcount: String(a.playcount ?? 0), mbid: "", url: albumUrl(c, a.artist, a.title),
  artist: { name: a.artist, mbid: "", url: artistUrl(c, a.artist) }, image: img(a.image, c.origin),
});
/** A play in someone's recent tracks. `loved` is always empty: it is there because clients expect the element. */
const playShape = (c: Call, t: PlayRow, when: Reply) => ({
  artist: { "#text": t.artist, mbid: "" }, name: t.title, album: { "#text": t.album || "", mbid: "" }, mbid: "", streamable: "0",
  url: trackUrl(c, t.artist, t.title), image: img(t.image, c.origin), loved: undefined, ...when,
});
const tagsShape = async (c: Call, type: string, id: number) =>
  ({ tag: (await topTags(type, id, 50)).map(t => ({ name: t.name, count: t.count, url: tagUrl(c, t.name) })) });
const wikiShape = (wiki: { content: string; createdAt: number } | null) =>
  (wiki ? { published: longDate(wiki.createdAt), summary: wiki.content.slice(0, 300), content: wiki.content } : undefined);

// ---------- tagging ----------
async function tagMutation(c: Call, type: string, id: number, remove: boolean): Promise<Reply> {
  const uid = await session(c);
  if (remove) await removeTag(uid, type, id, text(c.p.tag));
  else await addTags(uid, type, id, String(c.p.tags || "").split(",").map(s => s.trim()).filter(Boolean).slice(0, 10));
  return {};
}

// ---------- the methods ----------
const methods: Record<string, Method> = {
  // --- auth ---
  "auth.gettoken": async c => { signed(c); const token = rid(16); await repo.createToken(token, c.app.id); return { token }; },
  "auth.getsession": async c => {
    signed(c);
    const t = (await repo.findToken(key(c.p.token), c.app.id)) ?? fail(4, "Invalid authentication token supplied");
    if (!t.userId) fail(14, "This token has not been authorized");
    if (t.createdAt < now() - 3600) fail(15, "This token has expired");
    await repo.deleteToken(t.token);
    return newSession(c, t.userId);
  },
  "auth.getmobilesession": async c => {
    signed(c);
    const u = await findByName(text(c.p.username));
    if (!u || u.banned || !(await Bun.password.verify(text(c.p.password), u.passwordHash))) fail(4, "Authentication Failed - You do not have permissions to access the service");
    return newSession(c, u.id);
  },
  // --- writes ---
  "track.scrobble": async c => {
    const uid = await session(c), p = c.p;
    const idx = p.artist !== undefined ? [""] : Array.from({ length: 50 }, (_, i) => `[${i}]`).filter(i => p["artist" + i] !== undefined);
    if (!idx.length) fail(6, "Invalid parameters - Your request is missing a required parameter");
    const inputs = idx.map(i => ({ artist: p["artist" + i], track: p["track" + i], album: p["album" + i], timestamp: p["timestamp" + i], duration: p["duration" + i] }));
    const results = await scrobbleMany(uid, inputs, "api:" + c.app.name.slice(0, 16));
    const corrected = "0";
    const out = inputs.map((input, n) => {
      const r = results[n], refused = !r ? "Artist and track are required" : r.accepted ? null : r.reason;
      return {
        artist: { "#text": input.artist || "", corrected }, track: { "#text": input.track || "", corrected }, album: { "#text": input.album || "", corrected },
        albumArtist: { "#text": "", corrected }, timestamp: String(input.timestamp || ""), ignoredMessage: { "#text": refused ?? "", code: refused === null ? "0" : "1" },
      };
    });
    const ok = out.filter(o => o.ignoredMessage.code === "0").length;
    return { scrobbles: { scrobble: out.length === 1 ? out[0] : out, "@attr": { accepted: ok, ignored: out.length - ok } } };
  },
  "track.updatenowplaying": async c => {
    const uid = await session(c), p = c.p;
    if (!(await setNowPlaying(uid, { artist: p.artist, track: p.track, album: p.album, duration: p.duration }))) fail(6, "Invalid parameters - artist and track are required");
    return { nowplaying: { artist: { "#text": p.artist, corrected: "0" }, track: { "#text": p.track, corrected: "0" }, album: { "#text": p.album || "", corrected: "0" }, ignoredMessage: { "#text": "", code: "0" } } };
  },
  "track.love": async c => {
    const uid = await session(c), p = c.p;
    const r = (await resolve({ artist: p.artist, track: p.track, album: p.album, duration: p.duration })) ?? fail(6, "Invalid parameters");
    await setLoved(uid, r.trackId, true);
    return {};
  },
  "track.unlove": async c => { const uid = await session(c); await setLoved(uid, (await trackOf(c.p)).id, false); return {}; },
  "artist.addtags": async c => tagMutation(c, "artist", (await artistOf(c.p)).id, false),
  "artist.removetag": async c => tagMutation(c, "artist", (await artistOf(c.p)).id, true),
  "album.addtags": async c => tagMutation(c, "album", (await albumOf(c.p)).id, false),
  "album.removetag": async c => tagMutation(c, "album", (await albumOf(c.p)).id, true),
  "track.addtags": async c => tagMutation(c, "track", (await trackOf(c.p)).id, false),
  "track.removetag": async c => tagMutation(c, "track", (await trackOf(c.p)).id, true),
  // --- user ---
  "user.getinfo": async c => {
    const me = c.p.sk ? await session(c) : undefined, u = await userOf(c.p.user, me);
    const n = u.privateListening && u.id !== me ? { playcount: 0, artists: 0, albums: 0, tracks: 0 } : await counts({ userId: u.id });
    return { user: {
      name: u.username, realname: u.realname, country: u.country, url: `${c.origin}/user/${u.username}`, playcount: String(n.playcount), artist_count: String(n.artists),
      album_count: String(n.albums), track_count: String(n.tracks), image: img(u.imageId, c.origin), registered: { unixtime: String(u.registeredAt), "#text": u.registeredAt }, subscriber: "0", type: "user",
    } };
  },
  "user.getrecenttracks": async c => {
    const u = await userOf(c.p.user), [from, to] = period(c.p, "overall");
    if (u.hideRecent || u.privateListening) return { recenttracks: { track: [], "@attr": attr({ user: u.username }, c.pg, 0) } };
    const r = await recent({ userId: u.id, from, to }, c.pg.limit, c.pg.offset);
    const np = c.pg.page === 1 ? await nowPlaying(u.id) : null;
    const plays = r.items.map(t => playShape(c, t, { date: { uts: String(t.playedAt), "#text": shortDate(t.playedAt) } }));
    return { recenttracks: { track: [...(np ? [playShape(c, np, { "@attr": { nowplaying: "true" } })] : []), ...plays], "@attr": attr({ user: u.username }, c.pg, r.total) } };
  },
  "user.gettopartists": async c => {
    const u = await userOf(c.p.user), [from, to] = period(c.p), r = shut(u) ?? await top("artists", { userId: u.id, from, to }, c.pg.limit, c.pg.offset);
    return { topartists: { artist: ranked(r.items.map(artistShape(c)), c.pg), "@attr": attr({ user: u.username }, c.pg, r.total) } };
  },
  "user.gettopalbums": async c => {
    const u = await userOf(c.p.user), [from, to] = period(c.p), r = shut(u) ?? await top("albums", { userId: u.id, from, to }, c.pg.limit, c.pg.offset);
    return { topalbums: { album: ranked(r.items.map(albumShape(c)), c.pg), "@attr": attr({ user: u.username }, c.pg, r.total) } };
  },
  "user.gettoptracks": async c => {
    const u = await userOf(c.p.user), [from, to] = period(c.p), r = shut(u) ?? await top("tracks", { userId: u.id, from, to }, c.pg.limit, c.pg.offset);
    return { toptracks: { track: ranked(r.items.map(trackShape(c)), c.pg), "@attr": attr({ user: u.username }, c.pg, r.total) } };
  },
  "user.getlovedtracks": async c => {
    const u = await userOf(c.p.user), total = shut(u) ? 0 : await lovedCount(u.id), rows = shut(u) ? [] : await repo.lovedPage(u.id, c.pg.limit, c.pg.offset);
    return { lovedtracks: { track: rows.map(t => ({ ...trackShape(c)(t), date: { uts: String(t.at), "#text": shortDate(t.at) } })), "@attr": attr({ user: u.username }, c.pg, total) } };
  },
  "user.getfriends": async c => {
    const u = await userOf(c.p.user), total = await followingCount(u.id), rows = await repo.friendsPage(u.id, c.pg.limit, c.pg.offset);
    return { friends: { user: rows.map(f => ({ name: f.username, realname: f.realname, country: f.country, url: `${c.origin}/user/${f.username}`, image: img(f.imageId, c.origin),
      registered: { unixtime: String(f.registeredAt) } })), "@attr": attr({ user: u.username }, c.pg, total) } };
  },
  "user.gettoptags": async c => {
    const rows = await repo.userTopTags((await userOf(c.p.user)).id, c.pg.limit);
    return { toptags: { tag: rows.map(t => ({ name: t.name, count: String(t.count), url: tagUrl(c, t.name) })) } };
  },
  // --- artist ---
  "artist.getinfo": async c => {
    const a = await artistOf(c.p), n = await counts({ artistId: a.id }), wiki = await latestWiki("artist", a.id);
    const mine = c.p.username ? { userplaycount: String((await counts({ artistId: a.id, userId: (await userOf(c.p.username)).id })).playcount) } : {};
    const similar = (await similarArtists(a.id, 5)).map(s => ({ name: s.name, url: artistUrl(c, s.name), image: img(s.image, c.origin) }));
    return { artist: {
      name: a.name, mbid: mbidOfArtist(a.name), url: artistUrl(c, a.name), image: img(a.imageId, c.origin), streamable: "0", ontour: "0",
      stats: { listeners: String(n.listeners), playcount: String(n.playcount), ...mine }, similar: { artist: similar }, tags: await tagsShape(c, "artist", a.id),
      bio: { published: wiki ? longDate(wiki.createdAt) : "", summary: (wiki?.content || "").slice(0, 300), content: wiki?.content || "" },
    } };
  },
  "artist.gettoptracks": async c => {
    const a = await artistOf(c.p), r = await top("tracks", { artistId: a.id, global: true }, c.pg.limit, c.pg.offset);
    return { toptracks: { track: ranked(r.items.map(trackShape(c)), c.pg), "@attr": attr({ artist: a.name }, c.pg, r.total) } };
  },
  "artist.gettopalbums": async c => {
    const a = await artistOf(c.p), r = await top("albums", { artistId: a.id, global: true }, c.pg.limit, c.pg.offset);
    return { topalbums: { album: r.items.map(albumShape(c)), "@attr": attr({ artist: a.name }, c.pg, r.total) } };
  },
  "artist.getsimilar": async c => {
    const a = await artistOf(c.p), similar = await similarArtists(a.id, Math.min(100, c.pg.limit));
    return { similarartists: { artist: similar.map(s => ({ ...artistShape(c)(s), match: String(Number(s.match).toFixed(6)) })), "@attr": { artist: a.name } } };
  },
  "artist.gettoptags": async c => { const a = await artistOf(c.p); return { toptags: { ...(await tagsShape(c, "artist", a.id)), "@attr": { artist: a.name } } }; },
  "artist.search": async c => {
    const pattern = `%${norm(text(c.p.artist))}%`, rows = await repo.searchArtists(pattern, c.pg.limit, c.pg.offset);
    return { results: {
      "opensearch:totalResults": String(await repo.countArtists(pattern)), "opensearch:startIndex": String(c.pg.offset), "opensearch:itemsPerPage": String(c.pg.limit),
      artistmatches: { artist: rows.map(artistShape(c)) }, "@attr": { for: c.p.artist || "" },
    } };
  },
  // --- album ---
  "album.getinfo": async c => {
    const al = await albumOf(c.p), n = await counts({ albumId: al.id }), wiki = await latestWiki("album", al.id), list = await repo.albumTrackList(al.id);
    return { album: {
      name: al.title, artist: al.artist, mbid: mbidOfAlbum(al.artist, al.title), url: albumUrl(c, al.artist, al.title), image: img(al.imageId, c.origin), listeners: String(n.listeners), playcount: String(n.playcount),
      tracks: { track: list.map(t => ({ name: t.title, duration: t.duration, url: trackUrl(c, al.artist, t.title), "@attr": { rank: t.position }, artist: { name: al.artist, url: artistUrl(c, al.artist) } })) },
      tags: await tagsShape(c, "album", al.id), wiki: wikiShape(wiki),
    } };
  },
  "album.gettoptags": async c => { const al = await albumOf(c.p); return { toptags: { ...(await tagsShape(c, "album", al.id)), "@attr": { artist: al.artist, album: al.title } } }; },
  "album.search": async c => {
    const pattern = `%${norm(text(c.p.album))}%`, rows = await repo.searchAlbums(pattern, c.pg.limit, c.pg.offset);
    return { results: {
      "opensearch:totalResults": String(await repo.countAlbums(pattern)),
      albummatches: { album: rows.map(a => ({ name: a.title, artist: a.artist, url: albumUrl(c, a.artist, a.title), image: img(a.image, c.origin) })) }, "@attr": { for: c.p.album || "" },
    } };
  },
  // --- track ---
  "track.getinfo": async c => {
    const t = await trackOf(c.p), n = await counts({ trackId: t.id }), wiki = await latestWiki("track", t.id);
    const al = t.albumId ? await findItem("album", t.albumId) : null;
    const uid = c.p.username ? (await userOf(c.p.username)).id : 0;
    const mine = uid ? { userplaycount: String((await counts({ trackId: t.id, userId: uid })).playcount), userloved: (await hasLoved(uid, t.id)) ? "1" : "0" } : {};
    return { track: {
      name: t.title, mbid: "", url: trackUrl(c, t.artist, t.title), duration: String(t.duration * 1000), listeners: String(n.listeners), playcount: String(n.playcount),
      artist: { name: t.artist, url: artistUrl(c, t.artist) }, album: al ? { artist: t.artist, title: al.title, image: img(al.imageId, c.origin) } : undefined,
      ...mine, toptags: await tagsShape(c, "track", t.id), wiki: wikiShape(wiki),
    } };
  },
  "track.getsimilar": async c => {
    const t = await trackOf(c.p), similar = await similarTracks(t.id, t.artistId, 0, Math.min(50, c.pg.limit));
    return { similartracks: { track: similar.map(trackShape(c)), "@attr": { artist: t.artist } } };
  },
  "track.gettoptags": async c => { const t = await trackOf(c.p); return { toptags: { ...(await tagsShape(c, "track", t.id)), "@attr": { artist: t.artist, track: t.title } } }; },
  "track.search": async c => {
    const pattern = `%${norm(text(c.p.track))}%`;
    const rows = await repo.searchTracks(pattern, c.p.artist ? norm(text(c.p.artist)) : null, c.pg.limit, c.pg.offset);
    return { results: { trackmatches: { track: rows.map(t => ({ name: t.title, artist: t.artist, url: trackUrl(c, t.artist, t.title), listeners: String(t.listeners), image: img(t.image, c.origin) })) }, "@attr": { for: c.p.track || "" } } };
  },
  // --- tags & charts ---
  "tag.getinfo": async c => {
    const g = await tagOf(c.p), wiki = await latestWiki("tag", g.id);
    return { tag: { name: g.name, total: await taggingCount(g.id), reach: await taggerCount(g.id), wiki: { summary: (wiki?.content || "").slice(0, 300), content: wiki?.content || "" } } };
  },
  "tag.gettopartists": async c => {
    const g = await tagOf(c.p), rows = await repo.tagTopArtists(g.id, c.pg.limit, c.pg.offset);
    return { topartists: { artist: ranked(rows.map(a => artistShape(c)({ name: a.name, image: a.image })), c.pg), "@attr": { tag: g.name } } };
  },
  "tag.gettoptracks": async c => {
    const g = await tagOf(c.p), r = await top("tracks", { artistIds: await repo.taggedArtistIds(g.id), global: true }, c.pg.limit, c.pg.offset);
    return { tracks: { track: ranked(r.items.map(trackShape(c)), c.pg), "@attr": { tag: g.name } } };
  },
  "tag.gettopalbums": async c => {
    const g = await tagOf(c.p), r = await top("albums", { artistIds: await repo.taggedArtistIds(g.id), global: true }, c.pg.limit, c.pg.offset);
    return { albums: { album: ranked(r.items.map(albumShape(c)), c.pg), "@attr": { tag: g.name } } };
  },
  "chart.gettopartists": async c => { const r = await top("artists", { global: true }, c.pg.limit, c.pg.offset); return { artists: { artist: r.items.map(artistShape(c)), "@attr": attr({}, c.pg, r.total) } }; },
  "chart.gettoptracks": async c => { const r = await top("tracks", { global: true }, c.pg.limit, c.pg.offset); return { tracks: { track: r.items.map(trackShape(c)), "@attr": attr({}, c.pg, r.total) } }; },
  "chart.gettoptags": async c => {
    const rows = await repo.chartTopTags(c.pg.limit, c.pg.offset);
    return { tags: { tag: rows.map(t => ({ name: t.name, url: tagUrl(c, t.name), reach: String(t.reach), taggings: String(t.taggings) })) } };
  },
};

/**
 * Runs the method a request names and returns its reply. Throws ApiError for a failure the API has a number for:
 * an unknown API key (10), an unknown method (3), a bad signature (13), a bad session (9) and so on.
 */
export async function call(p: Params, origin: string): Promise<Reply> {
  const app = (await repo.appByKey(key(p.api_key))) ?? fail(10, "Invalid API key - You must be granted a valid key by this service");
  const name = String(p.method || "").toLowerCase();
  const method = Object.hasOwn(methods, name) ? methods[name] : undefined;
  if (!method) fail(3, "Invalid Method - No method with that name in this package");
  return method({ p, origin, app, pg: page(p) });
}

/** The methods this API offers, as clients spell them. */
export const COMPAT_METHODS = ["auth.getToken", "auth.getSession", "auth.getMobileSession", "track.scrobble", "track.updateNowPlaying", "track.love", "track.unlove",
  "track.getInfo", "track.getSimilar", "track.getTopTags", "track.search", "track.addTags", "track.removeTag",
  "artist.getInfo", "artist.getTopTracks", "artist.getTopAlbums", "artist.getSimilar", "artist.getTopTags", "artist.search", "artist.addTags", "artist.removeTag",
  "album.getInfo", "album.getTopTags", "album.search", "album.addTags", "album.removeTag",
  "user.getInfo", "user.getRecentTracks", "user.getTopArtists", "user.getTopAlbums", "user.getTopTracks", "user.getLovedTracks", "user.getFriends", "user.getTopTags",
  "tag.getInfo", "tag.getTopArtists", "tag.getTopTracks", "tag.getTopAlbums", "chart.getTopArtists", "chart.getTopTracks", "chart.getTopTags"];
