import { createHash } from "node:crypto";
import { findAlbum, findArtist, findItem, findTag, findTrack, hasLoved } from "../catalog/repo";
import { mbidOfAlbum, mbidOfArtist } from "../corrections/service";
import { range } from "../listening/period";
import { counts, nowPlaying, recent, setLoved, top } from "../listening/repo";
import { resolve, scrobbleMany, setNowPlaying, type ScrobbleInput } from "../listening/service";
import { similarArtists, similarTracks } from "../recommend/service";
import { confirmed } from "../guards";
import { fail as refuse, limit } from "../http";
import { addTags, removeTag, taggerCount, taggingCount, topTags } from "../tags/repo";
import { namesFrom } from "../tags/service";
import { limit as trustLimit } from "../trust/service";
import { findById, findByName, followingCount, lovedCount, type User } from "../users/repo";
import { like, now, norm, rid } from "../util";
import { latestWiki } from "../wiki/repo";
import * as repo from "./repo";

export class ApiError extends Error {
  constructor(
    public code: number,
    message: string
  ) {
    super(message);
  }
}

function fail(code: number, message: string): never {
  throw new ApiError(code, message);
}

// A JSON body can put anything in the parameters, so nothing is assumed to be a string.
export type Params = Record<string, unknown>;
export type Reply = Record<string, unknown>;
type Page = { limit: number; page: number; offset: number };
type Call = { p: Params; origin: string; app: repo.App; pg: Page };
type Method = (c: Call) => Promise<Reply>;

function text(v: unknown): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  throw new TypeError("Expected a text parameter");
}

// Numbers match the stored key with the same digits.
const key = (v: unknown): string => (typeof v === "number" && v ? String(v) : text(v));

function page(p: Params, def = 50): Page {
  const limit = Math.min(1000, Math.max(1, Number(p.limit) || def));
  const pg = Math.max(1, Number(p.page) || 1);
  return { limit, page: pg, offset: (pg - 1) * limit };
}

function period(p: Params, name: unknown = p.period): [number, number] {
  const query = new URLSearchParams({
    period: String(name || "overall"),
    from: String(p.from || ""),
    to: String(p.to || ""),
  });
  return range(query);
}

const md5 = (s: string) => createHash("md5").update(s, "utf8").digest("hex");
const UNSIGNED = ["format", "callback", "api_sig"];

function signed({ p, app }: Call): void {
  const base = Object.keys(p)
    .filter((k) => !UNSIGNED.includes(k))
    .sort()
    .map((k) => k + String(p[k]))
    .join("");
  if (md5(base + app.secret) !== String(p.api_sig || "").toLowerCase()) fail(13, "Invalid method signature supplied");
}

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

const artistOf = async (p: Params) =>
  (await findArtist(text(p.artist))) ?? fail(6, "The artist you supplied could not be found");
const trackOf = async (p: Params) => (await findTrack(text(p.artist), text(p.track))) ?? fail(6, "Track not found");
const albumOf = async (p: Params) => (await findAlbum(text(p.artist), text(p.album))) ?? fail(6, "Album not found");
const tagOf = async (p: Params) => (await findTag(text(p.tag))) ?? fail(6, "Tag not found");

async function userOf(name: unknown, fallback?: number): Promise<User> {
  let u: User | null = null;
  if (name) u = await findByName(text(name));
  else if (fallback) u = await findById(fallback);
  return u ?? fail(6, "User not found");
}

// An empty chart for someone who keeps their listening private, or undefined when it may be read.
const shut = (u: User) => (u.privateListening ? { items: [], total: 0 } : undefined);

const listeningOpen = (u: User, me: number | undefined) => u.id === me || !(u.privateListening || u.banned);

// As in the main search, % and _ are plain characters.
// A single character matches most of the catalogue, so it only finds exact names.
function searchFor(v: unknown): string {
  const q = norm(text(v)) || fail(6, "Invalid parameters - Your request is missing a required parameter");
  const pattern = like(q);
  return q.length < 2 ? pattern.slice(1, -1) : pattern;
}

const enc = (s: string) => encodeURIComponent(s).replace(/%20/g, "+");

function img(id: string | null, origin: string) {
  return ["small", "medium", "large", "extralarge"].map((size) => {
    const small = size === "small" || size === "medium" ? "?s=small" : "";
    return { "#text": id ? `${origin}/api/image/${id}${small}` : "", size };
  });
}

const attr = (extra: Record<string, string>, pg: Page, total: number) => ({
  ...extra,
  page: String(pg.page),
  perPage: String(pg.limit),
  totalPages: String(Math.ceil(total / pg.limit)),
  total: String(total),
});

const ranked = <T extends object>(items: T[], pg: Page) =>
  items.map((x, i) => ({ ...x, "@attr": { rank: String(pg.offset + i + 1) } }));

// e.g. "20 Nov 2026, 10:23"
const shortDate = (seconds: number) => new Date(seconds * 1000).toUTCString().slice(5, 22);
const longDate = (seconds: number) => new Date(seconds * 1000).toUTCString();

type ArtistRow = { name: string; image: string | null; playcount?: number; listeners?: number };
type TrackRow = {
  title: string;
  duration: number;
  artist: string;
  image: string | null;
  playcount?: number;
  listeners?: number;
};
type AlbumRow = { title: string; artist: string; image: string | null; playcount?: number };
type PlayRow = { title: string; artist: string; album: string | null; image: string | null };

const artistUrl = (c: Call, artist: string) => `${c.origin}/music/${enc(artist)}`;
const trackUrl = (c: Call, artist: string, title: string) => `${c.origin}/music/${enc(artist)}/_/${enc(title)}`;
const albumUrl = (c: Call, artist: string, title: string) => `${c.origin}/music/${enc(artist)}/${enc(title)}`;
const tagUrl = (c: Call, name: string) => `${c.origin}/tag/${enc(name)}`;
const userUrl = (c: Call, username: string) => `${c.origin}/user/${username}`;

const artistShape = (c: Call) => (a: ArtistRow) => ({
  name: a.name,
  playcount: String(a.playcount ?? 0),
  listeners: String(a.listeners ?? 0),
  mbid: "",
  url: artistUrl(c, a.name),
  image: img(a.image, c.origin),
});

const trackShape = (c: Call) => (t: TrackRow) => ({
  name: t.title,
  duration: String(t.duration || 0),
  playcount: String(t.playcount ?? 0),
  listeners: String(t.listeners ?? 0),
  mbid: "",
  url: trackUrl(c, t.artist, t.title),
  artist: { name: t.artist, mbid: "", url: artistUrl(c, t.artist) },
  image: img(t.image, c.origin),
});

const albumShape = (c: Call) => (a: AlbumRow) => ({
  name: a.title,
  playcount: String(a.playcount ?? 0),
  mbid: "",
  url: albumUrl(c, a.artist, a.title),
  artist: { name: a.artist, mbid: "", url: artistUrl(c, a.artist) },
  image: img(a.image, c.origin),
});

const playShape = (c: Call, t: PlayRow, when: Reply) => ({
  artist: { "#text": t.artist, mbid: "" },
  name: t.title,
  album: { "#text": t.album || "", mbid: "" },
  mbid: "",
  streamable: "0",
  url: trackUrl(c, t.artist, t.title),
  image: img(t.image, c.origin),
  // always empty, but clients expect the element
  loved: undefined,
  ...when,
});

async function tagsShape(c: Call, type: string, id: number) {
  const rows = await topTags(type, id, 50);
  return { tag: rows.map((t) => ({ name: t.name, count: t.count, url: tagUrl(c, t.name) })) };
}

function wikiShape(wiki: { content: string; createdAt: number } | null) {
  if (!wiki) return undefined;
  return { published: longDate(wiki.createdAt), summary: wiki.content.slice(0, 300), content: wiki.content };
}

const echoed = (v: unknown) => ({ "#text": v || "", corrected: "0" });

async function tagMutation(c: Call, type: string, id: number, remove: boolean): Promise<Reply> {
  const uid = await session(c);
  if (remove) {
    await removeTag(uid, type, id, text(c.p.tag));
    return {};
  }
  const u = await userOf(undefined, uid);
  if (u.suspended) refuse(403, "accountSuspendedFromPosting");
  confirmed(u);
  await trustLimit(u, `tag:${u.id}`, 100, 3600, "tooManyTagEdits");
  await addTags(u.id, type, id, namesFrom(c.p.tags));
  return {};
}

function searchResults(query: unknown, matches: Reply) {
  return { ...matches, "@attr": { for: query || "" } };
}

// One scrobble as artist/track/..., or a batch as artist[0]/track[0]/... up to 50.
export function scrobbleInputs(p: Params): ScrobbleInput[] {
  const idx =
    p.artist !== undefined
      ? [""]
      : Array.from({ length: 50 }, (_, i) => `[${i}]`).filter((i) => p["artist" + i] !== undefined);
  return idx.map((i) => ({
    artist: p["artist" + i],
    track: p["track" + i],
    album: p["album" + i],
    timestamp: p["timestamp" + i],
    duration: p["duration" + i],
  }));
}

const methods: Record<string, Method> = {
  "auth.gettoken": async (c) => {
    signed(c);
    const token = rid(16);
    await repo.createToken(token, c.app.id);
    return { token };
  },
  "auth.getsession": async (c) => {
    signed(c);
    const t = (await repo.findToken(key(c.p.token), c.app.id)) ?? fail(4, "Invalid authentication token supplied");
    if (!t.userId) fail(14, "This token has not been authorized");
    if (t.createdAt < now() - 3600) fail(15, "This token has expired");
    if (!(await repo.takeToken(key(c.p.token)))) fail(4, "Invalid authentication token supplied");
    return newSession(c, t.userId);
  },
  "auth.getmobilesession": async (c) => {
    signed(c);
    const name = text(c.p.username);
    const u = await findByName(name);
    await limit(u ? `login-id:${u.id}` : `login-as:${norm(name)}`, 30, 3600);
    const ok = u && !u.banned && !!u.passwordHash && (await Bun.password.verify(text(c.p.password), u.passwordHash));
    if (!ok) fail(4, "Authentication Failed - You do not have permissions to access the service");
    return newSession(c, u.id);
  },

  "track.scrobble": async (c) => {
    const uid = await session(c);
    const inputs = scrobbleInputs(c.p);
    if (!inputs.length) fail(6, "Invalid parameters - Your request is missing a required parameter");
    const results = await scrobbleMany(uid, inputs, "api:" + c.app.name.slice(0, 16));
    const out = inputs.map((input, n) => {
      const r = results[n];
      let refused: string | null = null;
      if (!r) refused = "Artist and track are required";
      else if (!r.accepted) refused = r.reason;
      return {
        artist: echoed(input.artist),
        track: echoed(input.track),
        album: echoed(input.album),
        albumArtist: echoed(""),
        timestamp: String(input.timestamp || ""),
        ignoredMessage: { "#text": refused ?? "", code: refused === null ? "0" : "1" },
      };
    });
    const accepted = out.filter((o) => o.ignoredMessage.code === "0").length;
    return {
      scrobbles: {
        scrobble: out.length === 1 ? out[0] : out,
        "@attr": { accepted, ignored: out.length - accepted },
      },
    };
  },
  "track.updatenowplaying": async (c) => {
    const uid = await session(c);
    const p = c.p;
    const saved = await setNowPlaying(uid, { artist: p.artist, track: p.track, album: p.album, duration: p.duration });
    if (!saved) fail(6, "Invalid parameters - artist and track are required");
    return {
      nowplaying: {
        artist: { "#text": p.artist, corrected: "0" },
        track: { "#text": p.track, corrected: "0" },
        album: echoed(p.album),
        ignoredMessage: { "#text": "", code: "0" },
      },
    };
  },
  "track.love": async (c) => {
    const uid = await session(c);
    const p = c.p;
    const r =
      (await resolve({ artist: p.artist, track: p.track, album: p.album, duration: p.duration })) ??
      fail(6, "Invalid parameters");
    await setLoved(uid, r.trackId, true);
    return {};
  },
  "track.unlove": async (c) => {
    const uid = await session(c);
    const t = await trackOf(c.p);
    await setLoved(uid, t.id, false);
    return {};
  },
  "artist.addtags": async (c) => tagMutation(c, "artist", (await artistOf(c.p)).id, false),
  "artist.removetag": async (c) => tagMutation(c, "artist", (await artistOf(c.p)).id, true),
  "album.addtags": async (c) => tagMutation(c, "album", (await albumOf(c.p)).id, false),
  "album.removetag": async (c) => tagMutation(c, "album", (await albumOf(c.p)).id, true),
  "track.addtags": async (c) => tagMutation(c, "track", (await trackOf(c.p)).id, false),
  "track.removetag": async (c) => tagMutation(c, "track", (await trackOf(c.p)).id, true),

  "user.getinfo": async (c) => {
    const me = c.p.sk ? await session(c) : undefined;
    const u = await userOf(c.p.user, me);
    const hidden = u.privateListening && u.id !== me;
    const n = hidden ? { playcount: 0, artists: 0, albums: 0, tracks: 0 } : await counts({ userId: u.id });
    return {
      user: {
        name: u.username,
        realname: u.realname,
        country: u.country,
        url: userUrl(c, u.username),
        playcount: String(n.playcount),
        artist_count: String(n.artists),
        album_count: String(n.albums),
        track_count: String(n.tracks),
        image: img(u.imageId, c.origin),
        registered: { unixtime: String(u.registeredAt), "#text": u.registeredAt },
        subscriber: "0",
        type: "user",
      },
    };
  },
  "user.getrecenttracks": async (c) => {
    const u = await userOf(c.p.user);
    const [from, to] = period(c.p, "overall");
    if (u.hideRecent || u.privateListening) {
      return { recenttracks: { track: [], "@attr": attr({ user: u.username }, c.pg, 0) } };
    }
    const r = await recent({ userId: u.id, from, to }, c.pg.limit, c.pg.offset);
    const np = c.pg.page === 1 ? await nowPlaying(u.id) : null;
    const plays = r.items.map((t) =>
      playShape(c, t, { date: { uts: String(t.playedAt), "#text": shortDate(t.playedAt) } })
    );
    const track = np ? [playShape(c, np, { "@attr": { nowplaying: "true" } }), ...plays] : plays;
    return { recenttracks: { track, "@attr": attr({ user: u.username }, c.pg, r.total) } };
  },
  "user.gettopartists": async (c) => {
    const u = await userOf(c.p.user);
    const [from, to] = period(c.p);
    const r = shut(u) ?? (await top("artists", { userId: u.id, from, to }, c.pg.limit, c.pg.offset));
    return {
      topartists: {
        artist: ranked(r.items.map(artistShape(c)), c.pg),
        "@attr": attr({ user: u.username }, c.pg, r.total),
      },
    };
  },
  "user.gettopalbums": async (c) => {
    const u = await userOf(c.p.user);
    const [from, to] = period(c.p);
    const r = shut(u) ?? (await top("albums", { userId: u.id, from, to }, c.pg.limit, c.pg.offset));
    return {
      topalbums: {
        album: ranked(r.items.map(albumShape(c)), c.pg),
        "@attr": attr({ user: u.username }, c.pg, r.total),
      },
    };
  },
  "user.gettoptracks": async (c) => {
    const u = await userOf(c.p.user);
    const [from, to] = period(c.p);
    const r = shut(u) ?? (await top("tracks", { userId: u.id, from, to }, c.pg.limit, c.pg.offset));
    return {
      toptracks: {
        track: ranked(r.items.map(trackShape(c)), c.pg),
        "@attr": attr({ user: u.username }, c.pg, r.total),
      },
    };
  },
  "user.getlovedtracks": async (c) => {
    const u = await userOf(c.p.user);
    const hidden = !!shut(u);
    const total = hidden ? 0 : await lovedCount(u.id);
    const rows = hidden ? [] : await repo.lovedPage(u.id, c.pg.limit, c.pg.offset);
    const track = rows.map((t) => ({ ...trackShape(c)(t), date: { uts: String(t.at), "#text": shortDate(t.at) } }));
    return { lovedtracks: { track, "@attr": attr({ user: u.username }, c.pg, total) } };
  },
  "user.getfriends": async (c) => {
    const u = await userOf(c.p.user);
    const total = await followingCount(u.id);
    const rows = await repo.friendsPage(u.id, c.pg.limit, c.pg.offset);
    const user = rows.map((f) => ({
      name: f.username,
      realname: f.realname,
      country: f.country,
      url: userUrl(c, f.username),
      image: img(f.imageId, c.origin),
      registered: { unixtime: String(f.registeredAt) },
    }));
    return { friends: { user, "@attr": attr({ user: u.username }, c.pg, total) } };
  },
  "user.gettoptags": async (c) => {
    const u = await userOf(c.p.user);
    const rows = (await tagsOpen(c, u)) ? await repo.userTopTags(u.id, c.pg.limit) : [];
    return { toptags: { tag: rows.map((t) => ({ name: t.name, count: String(t.count), url: tagUrl(c, t.name) })) } };
  },

  "artist.getinfo": async (c) => {
    const me = c.p.sk ? await session(c) : undefined;
    const a = await artistOf(c.p);
    const n = await counts({ artistId: a.id });
    const wiki = await latestWiki("artist", a.id);
    const listener = c.p.username ? await userOf(c.p.username) : null;
    let mine = {};
    if (listener && listeningOpen(listener, me)) {
      const theirs = await counts({ artistId: a.id, userId: listener.id });
      mine = { userplaycount: String(theirs.playcount) };
    }
    const similar = (await similarArtists(a.id, 5)).map((s) => ({
      name: s.name,
      url: artistUrl(c, s.name),
      image: img(s.image, c.origin),
    }));
    const content = wiki?.content || "";
    return {
      artist: {
        name: a.name,
        mbid: mbidOfArtist(a.name),
        url: artistUrl(c, a.name),
        image: img(a.imageId, c.origin),
        streamable: "0",
        ontour: "0",
        stats: { listeners: String(n.listeners), playcount: String(n.playcount), ...mine },
        similar: { artist: similar },
        tags: await tagsShape(c, "artist", a.id),
        bio: { published: wiki ? longDate(wiki.createdAt) : "", summary: content.slice(0, 300), content },
      },
    };
  },
  "artist.gettoptracks": async (c) => {
    const a = await artistOf(c.p);
    const r = await top("tracks", { artistId: a.id, global: true }, c.pg.limit, c.pg.offset);
    return {
      toptracks: { track: ranked(r.items.map(trackShape(c)), c.pg), "@attr": attr({ artist: a.name }, c.pg, r.total) },
    };
  },
  "artist.gettopalbums": async (c) => {
    const a = await artistOf(c.p);
    const r = await top("albums", { artistId: a.id, global: true }, c.pg.limit, c.pg.offset);
    return { topalbums: { album: r.items.map(albumShape(c)), "@attr": attr({ artist: a.name }, c.pg, r.total) } };
  },
  "artist.getsimilar": async (c) => {
    const a = await artistOf(c.p);
    const similar = await similarArtists(a.id, Math.min(100, c.pg.limit));
    const artist = similar.map((s) => ({ ...artistShape(c)(s), match: String(Number(s.match).toFixed(6)) }));
    return { similarartists: { artist, "@attr": { artist: a.name } } };
  },
  "artist.gettoptags": async (c) => {
    const a = await artistOf(c.p);
    return { toptags: { ...(await tagsShape(c, "artist", a.id)), "@attr": { artist: a.name } } };
  },
  "artist.search": async (c) => {
    const pattern = searchFor(c.p.artist);
    const rows = await repo.searchArtists(pattern, c.pg.limit, c.pg.offset);
    return {
      results: searchResults(c.p.artist, {
        "opensearch:totalResults": String(await repo.countArtists(pattern)),
        "opensearch:startIndex": String(c.pg.offset),
        "opensearch:itemsPerPage": String(c.pg.limit),
        artistmatches: { artist: rows.map(artistShape(c)) },
      }),
    };
  },

  "album.getinfo": async (c) => {
    const al = await albumOf(c.p);
    const n = await counts({ albumId: al.id });
    const wiki = await latestWiki("album", al.id);
    const list = await repo.albumTrackList(al.id);
    const track = list.map((t) => ({
      name: t.title,
      duration: t.duration,
      url: trackUrl(c, al.artist, t.title),
      "@attr": { rank: t.position },
      artist: { name: al.artist, url: artistUrl(c, al.artist) },
    }));
    return {
      album: {
        name: al.title,
        artist: al.artist,
        mbid: mbidOfAlbum(al.artist, al.title),
        url: albumUrl(c, al.artist, al.title),
        image: img(al.imageId, c.origin),
        listeners: String(n.listeners),
        playcount: String(n.playcount),
        tracks: { track },
        tags: await tagsShape(c, "album", al.id),
        wiki: wikiShape(wiki),
      },
    };
  },
  "album.gettoptags": async (c) => {
    const al = await albumOf(c.p);
    return { toptags: { ...(await tagsShape(c, "album", al.id)), "@attr": { artist: al.artist, album: al.title } } };
  },
  "album.search": async (c) => {
    const pattern = searchFor(c.p.album);
    const rows = await repo.searchAlbums(pattern, c.pg.limit, c.pg.offset);
    const album = rows.map((a) => ({
      name: a.title,
      artist: a.artist,
      url: albumUrl(c, a.artist, a.title),
      image: img(a.image, c.origin),
    }));
    return {
      results: searchResults(c.p.album, {
        "opensearch:totalResults": String(await repo.countAlbums(pattern)),
        albummatches: { album },
      }),
    };
  },

  "track.getinfo": async (c) => {
    const me = c.p.sk ? await session(c) : undefined;
    const t = await trackOf(c.p);
    const n = await counts({ trackId: t.id });
    const wiki = await latestWiki("track", t.id);
    const al = t.albumId ? await findItem("album", t.albumId) : null;
    const listener = c.p.username ? await userOf(c.p.username) : null;
    let mine = {};
    if (listener && listeningOpen(listener, me)) {
      const theirs = await counts({ trackId: t.id, userId: listener.id });
      mine = {
        userplaycount: String(theirs.playcount),
        userloved: (await hasLoved(listener.id, t.id)) ? "1" : "0",
      };
    }
    return {
      track: {
        name: t.title,
        mbid: "",
        url: trackUrl(c, t.artist, t.title),
        duration: String(t.duration * 1000),
        listeners: String(n.listeners),
        playcount: String(n.playcount),
        artist: { name: t.artist, url: artistUrl(c, t.artist) },
        album: al ? { artist: t.artist, title: al.title, image: img(al.imageId, c.origin) } : undefined,
        ...mine,
        toptags: await tagsShape(c, "track", t.id),
        wiki: wikiShape(wiki),
      },
    };
  },
  "track.getsimilar": async (c) => {
    const t = await trackOf(c.p);
    const similar = await similarTracks(t.id, t.artistId, 0, Math.min(50, c.pg.limit));
    return { similartracks: { track: similar.map(trackShape(c)), "@attr": { artist: t.artist } } };
  },
  "track.gettoptags": async (c) => {
    const t = await trackOf(c.p);
    return { toptags: { ...(await tagsShape(c, "track", t.id)), "@attr": { artist: t.artist, track: t.title } } };
  },
  "track.search": async (c) => {
    const pattern = searchFor(c.p.track);
    const artist = c.p.artist ? norm(text(c.p.artist)) : null;
    const rows = await repo.searchTracks(pattern, artist, c.pg.limit, c.pg.offset);
    const track = rows.map((t) => ({
      name: t.title,
      artist: t.artist,
      url: trackUrl(c, t.artist, t.title),
      listeners: String(t.listeners),
      image: img(t.image, c.origin),
    }));
    return { results: searchResults(c.p.track, { trackmatches: { track } }) };
  },

  "tag.getinfo": async (c) => {
    const g = await tagOf(c.p);
    const wiki = await latestWiki("tag", g.id);
    const content = wiki?.content || "";
    return {
      tag: {
        name: g.name,
        total: await taggingCount(g.id),
        reach: await taggerCount(g.id),
        wiki: { summary: content.slice(0, 300), content },
      },
    };
  },
  "tag.gettopartists": async (c) => {
    const g = await tagOf(c.p);
    const rows = await repo.tagTopArtists(g.id, c.pg.limit, c.pg.offset);
    const artist = rows.map((a) => artistShape(c)({ name: a.name, image: a.image }));
    return { topartists: { artist: ranked(artist, c.pg), "@attr": { tag: g.name } } };
  },
  "tag.gettoptracks": async (c) => {
    const g = await tagOf(c.p);
    const artistIds = await repo.taggedArtistIds(g.id);
    const r = await top("tracks", { artistIds, global: true }, c.pg.limit, c.pg.offset);
    return { tracks: { track: ranked(r.items.map(trackShape(c)), c.pg), "@attr": { tag: g.name } } };
  },
  "tag.gettopalbums": async (c) => {
    const g = await tagOf(c.p);
    const artistIds = await repo.taggedArtistIds(g.id);
    const r = await top("albums", { artistIds, global: true }, c.pg.limit, c.pg.offset);
    return { albums: { album: ranked(r.items.map(albumShape(c)), c.pg), "@attr": { tag: g.name } } };
  },
  "chart.gettopartists": async (c) => {
    const r = await top("artists", { global: true }, c.pg.limit, c.pg.offset);
    return { artists: { artist: r.items.map(artistShape(c)), "@attr": attr({}, c.pg, r.total) } };
  },
  "chart.gettoptracks": async (c) => {
    const r = await top("tracks", { global: true }, c.pg.limit, c.pg.offset);
    return { tracks: { track: r.items.map(trackShape(c)), "@attr": attr({}, c.pg, r.total) } };
  },
  "chart.gettoptags": async (c) => {
    const rows = await repo.chartTopTags(c.pg.limit, c.pg.offset);
    const tag = rows.map((t) => ({
      name: t.name,
      url: tagUrl(c, t.name),
      reach: String(t.reach),
      taggings: String(t.taggings),
    }));
    return { tags: { tag } };
  },
};

export async function call(p: Params, origin: string): Promise<Reply> {
  const app =
    (await repo.appByKey(key(p.api_key))) ??
    fail(10, "Invalid API key - You must be granted a valid key by this service");
  const name = String(p.method || "").toLowerCase();
  const method = Object.hasOwn(methods, name) ? methods[name] : undefined;
  if (!method) fail(3, "Invalid Method - No method with that name in this package");
  return method({ p, origin, app, pg: page(p) });
}
