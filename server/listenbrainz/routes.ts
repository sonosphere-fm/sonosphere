// The ListenBrainz API (https://listenbrainz.readthedocs.io/en/latest/users/api/) at /1/, so its clients can
// point at this site. Tokens are API sessions of the built-in "listenbrainz" app.
import * as Sentry from "@sentry/bun";
import { albums, artists, scrobbles, tracks } from "../db/schema";
import { eq } from "drizzle-orm";
import { confirmed } from "../guards";
import { bad, fail, HttpError, ipOf, limit } from "../http";
import { bump } from "../kv";
import { appIdByKey } from "../apps/repo";
import { sessionUser } from "../compat/repo";
import { siteTop, top, counts, nowPlaying, deleteScrobble, setLoved, type Scope } from "../listening/repo";
import { names, OLDEST, scrobbleMany, setNowPlaying, type ScrobbleInput } from "../listening/service";
import { canSee, canSeeCharts } from "../users/service";
import { notify } from "../notifications/repo";
import { neighbours } from "../recommend/service";
import { currentId } from "../site/short";
import { findLink } from "../spotify/repo";
import * as users from "../users/repo";
import { clean, isObject, now, UUID } from "../util";
import { findTrack } from "../catalog/repo";
import { mbdbOn, recordingOf } from "../metadata/mbdb";
import * as repo from "./repo";
import type { TopAlbum, TopArtist, TopList, TopTrack } from "../../shared/listening";

type User = users.User;
type Json = Record<string, unknown>;
type Ctx = { req: Request; q: URLSearchParams; params: string[]; viewer: () => Promise<User | null> };
type Handler = (c: Ctx) => Promise<Json | Json[] | null>;

const routes: { method: string; re: RegExp; run: Handler }[] = [];
const on = (method: string, path: string, run: Handler) =>
  routes.push({ method, re: new RegExp(`^/1${path.replace(/:\w+/g, "([^/]+)")}/?$`), run });

const str = (v: unknown, max = 255) => (typeof v === "string" ? clean(v, max) : "");
const uuid = (v: unknown) => {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  return UUID.test(s) ? s : null;
};

// a recording_msid names one of our tracks, so it survives a round trip without being stored. The metadata lookup
// hands it out as the recording_mbid too when MusicBrainz doesn't know the song, so it is accepted in either field.
const MSID = "5050c000-0000-4000-8000-";
const msid = (trackId: number) => MSID + trackId.toString(16).padStart(12, "0");
const msidTrack = (v: unknown) => {
  const s = uuid(v);
  return s?.startsWith(MSID) ? parseInt(s.slice(MSID.length), 16) || null : null;
};
const mbidOf = (v: unknown) => {
  const s = uuid(v);
  return s?.startsWith(MSID) ? null : s;
};

async function trackOf(recordingMsid: unknown, recordingMbid: unknown): Promise<number | null> {
  const ours = msidTrack(recordingMsid) ?? msidTrack(recordingMbid);
  if (ours) return currentId("track", ours);
  const mbid = mbidOf(recordingMbid);
  return mbid ? repo.trackOfRecording(mbid) : null;
}

function paging(q: URLSearchParams, def: number, max: number) {
  const n = Number(q.get("count") ?? def);
  const o = Number(q.get("offset") ?? 0);
  if (!Number.isInteger(n) || n < 0) bad("invalidCount");
  if (!Number.isInteger(o) || o < 0) bad("invalidOffset");
  return { count: Math.min(n, max), offset: o };
}

const tsParam = (q: URLSearchParams, name: string) => {
  const v = q.get(name);
  if (v === null) return 0;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : bad("tsNotPositiveInteger", { name });
};

async function body(req: Request): Promise<Json> {
  let v: unknown;
  try {
    v = await req.json();
  } catch {
    return bad("cannotParseJsonDocument");
  }
  return isObject(v) ? v : bad("invalidJsonDocumentSubmitted");
}

// --- who is asking ---

let appId: number | null = null;

async function tokenUser(req: Request, q: URLSearchParams): Promise<User | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.replace(/^(token|bearer)\s+/i, "").trim() || q.get("token") || "";
  if (!token) return null;
  appId ??= await appIdByKey("listenbrainz");
  const id = appId && (await sessionUser(token, appId));
  const u = id ? await users.findById(id) : null;
  return u && !u.banned ? u : fail(401, "invalidAuthorizationToken");
}

const authed = async (c: Ctx) => (await c.viewer()) ?? fail(401, "needProvideAuthorizationHeader");

async function named(name: string): Promise<User> {
  const u = await users.findByName(name);
  return u && !u.banned ? u : fail(404, "cannotFindUser", { name });
}

// --- listens ---

type Meta = Omit<repo.Listen, "playedAt">;

function trackMetadata(l: Meta): Json {
  const info: Json = { recording_msid: msid(l.trackId) };
  if (l.duration) info.duration_ms = l.duration * 1000;
  if (l.artistMbid) info.artist_mbids = [l.artistMbid];
  if (l.albumMbid) info.release_group_mbid = l.albumMbid;
  if (l.recordingMbid) info.recording_mbid = l.recordingMbid;
  const m: Json = { artist_name: l.artist, track_name: l.title, additional_info: info };
  if (l.album) m.release_name = l.album;
  return m;
}

const listen = (l: repo.Listen, username: string) => ({
  inserted_at: l.playedAt,
  listened_at: l.playedAt,
  recording_msid: msid(l.trackId),
  user_name: username,
  track_metadata: trackMetadata(l),
});

on("GET", "/validate-token", async (c) => {
  const header = c.req.headers.get("authorization");
  if (!header && !c.q.get("token")) bad("needProvideAuthorizationToken");
  try {
    const u = await c.viewer();
    if (u) return { code: 200, message: "Token valid.", valid: true, user_name: u.username };
  } catch (e) {
    if (!(e instanceof HttpError) || e.status !== 401) throw e;
  }
  return { code: 200, message: "Token invalid.", valid: false };
});

const MAX_LISTENS = 1000;
const TYPES = ["single", "import", "playing_now"];

type Submitted = ScrobbleInput & { mbid: string | null; client: string };

function submitted(l: unknown, type: string): Submitted {
  if (!isObject(l)) return bad("eachListenShouldJsonObject");
  const m = l.track_metadata;
  if (!isObject(m)) return bad("missingTrackMetadata");
  const info = isObject(m.additional_info) ? m.additional_info : {};
  // a shared credit ("Metallica, Joey Jordison") counts for its first artist when the client lists them apart
  const names = Array.isArray(info.artist_names) ? info.artist_names : [];
  const credited = names.length > 1 ? str(names[0]) : "";
  const artist = credited || str(m.artist_name);
  // one id per credited artist, so the first only belongs to the name when it is theirs alone or listed apart
  const ids = Array.isArray(info.artist_mbids) ? info.artist_mbids : [];
  const artistMbid = ids.length === Math.max(names.length, 1) ? mbidOf(ids[0]) : null;
  const track = str(m.track_name);
  if (!artist) bad("missingArtistName");
  if (!track) bad("missingTrackName");
  let timestamp: number | undefined;
  if (type === "playing_now") {
    if (l.listened_at !== undefined) bad("playingNowWithListenedAt");
  } else {
    timestamp = Number(l.listened_at);
    if (!Number.isInteger(timestamp)) bad("listenedAtNotInteger");
    if (timestamp! < OLDEST) bad("listenedAtTooLow");
    if (timestamp! > now() + 3600) bad("listenedAtTooHigh");
  }
  const ms = Number(info.duration_ms);
  const secs = Number(info.duration);
  return {
    artist,
    track,
    album: str(m.release_name),
    timestamp,
    duration: ms > 0 ? Math.round(ms / 1000) : secs > 0 ? Math.round(secs) : 0,
    artistMbid,
    mbid: mbidOf(info.recording_mbid),
    client: str(info.submission_client, 16) || str(info.media_player, 16) || "ListenBrainz",
  };
}

on("POST", "/submit-listens", async (c) => {
  const u = await authed(c);
  const b = await body(c.req);
  const type = String(b.listen_type ?? "");
  if (!TYPES.includes(type)) bad("invalidListenType");
  const payload = Array.isArray(b.payload) ? b.payload : bad("missingPayload");
  if (!payload.length) bad("noListens");
  if (type !== "import" && payload.length !== 1) bad("tooManyListensForType", { type });
  if (payload.length > MAX_LISTENS) bad("tooManyListens", { max: MAX_LISTENS });
  const listens = payload.map((l) => submitted(l, type));

  if (type === "playing_now") {
    const [l] = listens as [Submitted];
    const ref = await setNowPlaying(u.id, l);
    if (ref && l.mbid) await repo.saveRecordingMbids([{ mbid: l.mbid, trackId: ref.trackId }]);
    return { status: "ok" };
  }
  const results = await scrobbleMany(u.id, listens, "lb:" + listens[0]!.client);
  const pairs = [];
  for (const [i, r] of results.entries()) {
    const mbid = listens[i]!.mbid;
    if (r.accepted && mbid) pairs.push({ mbid, trackId: r.trackId });
  }
  await repo.saveRecordingMbids(pairs);
  return { status: "ok" };
});

on("POST", "/delete-listen", async (c) => {
  const u = await authed(c);
  const b = await body(c.req);
  const at = Number(b.listened_at);
  if (!Number.isInteger(at)) bad("listenTimestampMissing");
  const trackId = (await trackOf(b.recording_msid, null)) ?? bad("recordingMsidMissing");
  const id = await repo.scrobbleAt(u.id, trackId, at);
  if (id) await deleteScrobble(u.id, id);
  return { status: "ok" };
});

on("GET", "/user/:name/listens", async (c) => {
  const u = await named(c.params[0]!);
  const min = tsParam(c.q, "min_ts");
  const max = tsParam(c.q, "max_ts");
  const { count } = paging(c.q, 25, 1000);
  const hidden = !canSee(u, await c.viewer());
  const rows = hidden ? [] : await repo.listens(u.id, min, max, count);
  const span = hidden ? { oldest: 0, latest: 0 } : await repo.listenSpan(u.id);
  return {
    payload: {
      count: rows.length,
      latest_listen_ts: span.latest,
      oldest_listen_ts: span.oldest,
      listens: rows.map((l) => listen(l, u.username)),
      user_id: u.username,
    },
  };
});

on("GET", "/user/:name/listen-count", async (c) => {
  const u = await named(c.params[0]!);
  const count = canSee(u, await c.viewer()) ? (await counts({ userId: u.id })).playcount : 0;
  return { payload: { count } };
});

on("GET", "/user/:name/playing-now", async (c) => {
  const u = await named(c.params[0]!);
  const np = canSee(u, await c.viewer()) ? await nowPlaying(u.id) : null;
  const meta = np && (await repo.trackListen(np.trackId));
  const listens = meta ? [{ playing_now: true, track_metadata: trackMetadata(meta) }] : [];
  return { payload: { count: listens.length, listens, playing_now: true, user_id: u.username } };
});

// --- importers ---

const SERVICE = /^[a-z0-9_-]{1,20}$/;
const service = (v: unknown) => {
  const s = String(v ?? "lastfm").toLowerCase();
  return SERVICE.test(s) ? s : bad("invalidService");
};

on("GET", "/latest-import", async (c) => {
  const u = await named(c.q.get("user_name") ?? bad("userNameRequired"));
  return {
    musicbrainz_id: u.username,
    latest_import: await repo.latestImport(u.id, service(c.q.get("service") ?? undefined)),
  };
});

on("POST", "/latest-import", async (c) => {
  const u = await authed(c);
  const b = await body(c.req);
  const ts = Number(b.ts);
  if (!Number.isInteger(ts) || ts < 0) bad("tsValueShouldPositiveInteger");
  await repo.setLatestImport(u.id, service(b.service), ts);
  return { status: "ok" };
});

// --- people ---

on("GET", "/search/users", async (c) => {
  const term = str(c.q.get("search_term"), 64) || bad("searchTermRequired");
  return { users: (await repo.searchUsers(term)).map((u) => ({ user_name: u.username })) };
});

on("GET", "/user/:name/services", async (c) => {
  const u = await named(c.params[0]!);
  const me = await authed(c);
  if (me.id !== u.id) fail(403, "onlySeeOwnServices");
  const link = await findLink(u.id);
  return { user_name: u.username, services: link && !link.broken ? ["spotify"] : [] };
});

on("GET", "/user/:name/similar-users", async (c) => {
  const u = await named(c.params[0]!);
  if (!canSeeCharts(u, await c.viewer())) return null;
  const list = await neighbours(u.id, 50);
  return { payload: list.map((n) => ({ user_name: n.username, similarity: n.match })) };
});

on("GET", "/user/:name/similar-to/:other", async (c) => {
  const u = await named(c.params[0]!);
  const other = await named(c.params[1]!);
  if (!canSeeCharts(u, await c.viewer())) return null;
  const n = (await neighbours(u.id, 50)).find((n) => n.id === other.id);
  if (!n) fail(404, "similarUserNotFound");
  return { payload: { user_name: other.username, similarity: n!.match } };
});

on("GET", "/user/:name/followers", async (c) => {
  const u = await named(c.params[0]!);
  return { followers: (await users.followersOf(u.id)).map((f) => f.username), user: u.username };
});

on("GET", "/user/:name/following", async (c) => {
  const u = await named(c.params[0]!);
  return { following: (await users.followingOf(u.id)).map((f) => f.username), user: u.username };
});

on("POST", "/user/:name/follow", async (c) => {
  const me = await authed(c);
  await limit(`follow:${me.id}`, 100, 3600, "lotFollowsTryAgainWhile");
  const t = await named(c.params[0]!);
  if (t.id === me.id) bad("whoopsCannotFollowYourself");
  confirmed(me);
  if (await users.blockedEither(me.id, t.id)) fail(403, "cantFollowUser");
  if (!(await users.follow(me.id, t.id))) bad("alreadyFollowing", { follower: me.username, followee: t.username });
  await notify(t.id, "follow", me.id);
  return { status: "ok" };
});

on("POST", "/user/:name/unfollow", async (c) => {
  const me = await authed(c);
  const t = await named(c.params[0]!);
  await users.unfollow(me.id, t.id);
  return { status: "ok" };
});

// --- feedback (loves) ---

async function feedback(loves: repo.Love[], withMeta: boolean) {
  const mbids = await repo.recordingsOf(loves.map((l) => l.trackId));
  return Promise.all(
    loves.map(async (l) => {
      const f: Json = {
        created: l.at,
        recording_mbid: mbids.get(l.trackId) ?? null,
        recording_msid: msid(l.trackId),
        score: 1,
        user_id: l.username,
      };
      const meta = withMeta && (await repo.trackListen(l.trackId));
      if (meta) f.track_metadata = trackMetadata(meta);
      return f;
    })
  );
}

const score = (q: URLSearchParams) => {
  const s = q.get("score");
  if (s === null) return null;
  return ["1", "0", "-1"].includes(s) ? Number(s) : bad("invalidScore");
};

on("POST", "/feedback/recording-feedback", async (c) => {
  const u = await authed(c);
  const b = await body(c.req);
  const s = Number(b.score);
  if (![1, 0, -1].includes(s)) bad("invalidScore");
  if (!b.recording_msid && !b.recording_mbid) bad("missingRecordingId");
  const trackId = (await trackOf(b.recording_msid, b.recording_mbid)) ?? bad("unknownRecording");
  await setLoved(u.id, trackId, s === 1);
  return { status: "ok" };
});

on("GET", "/feedback/user/:name/get-feedback", async (c) => {
  const u = await named(c.params[0]!);
  const { count, offset } = paging(c.q, 100, 100);
  const s = score(c.q);
  const shown = canSeeCharts(u, await c.viewer()) && s !== 0 && s !== -1;
  const page = shown ? await repo.lovesOf(u.id, count, offset) : { items: [], total: 0 };
  const items = await feedback(page.items, c.q.get("metadata") === "true");
  return { feedback: items, count: items.length, total_count: page.total, offset };
});

async function forRecordings(c: Ctx, msids: unknown[], mbids: unknown[]) {
  const u = await named(c.params[0]!);
  if (msids.length + mbids.length > 100) bad("tooManyRecordingsAskAbout");
  const asked: { msid: string | null; mbid: string | null; trackId: number | null }[] = [];
  for (const m of msids) asked.push({ msid: uuid(m), mbid: null, trackId: await trackOf(m, null) });
  for (const m of mbids) asked.push({ msid: null, mbid: uuid(m), trackId: await trackOf(null, m) });
  const known = asked.flatMap((a) => (a.trackId ? [a.trackId] : []));
  const loved = canSeeCharts(u, await c.viewer()) ? await repo.lovesAmong(u.id, known) : [];
  const at = new Map(loved.map((l) => [l.trackId, l.at]));
  const feedback = asked.map((a) => ({
    created: (a.trackId && at.get(a.trackId)) || null,
    recording_msid: a.msid,
    recording_mbid: a.mbid,
    score: a.trackId && at.has(a.trackId) ? 1 : 0,
    user_id: u.username,
  }));
  return { feedback };
}

const list = (v: string | null) => (v ? v.split(",").filter(Boolean) : []);

on("GET", "/feedback/user/:name/get-feedback-for-recordings", (c) =>
  forRecordings(
    c,
    [...list(c.q.get("recordings")), ...list(c.q.get("recording_msids"))],
    list(c.q.get("recording_mbids"))
  )
);

on("POST", "/feedback/user/:name/get-feedback-for-recordings", async (c) => {
  const b = await body(c.req);
  const arr = (v: unknown) => (Array.isArray(v) ? v : []);
  return forRecordings(c, arr(b.recording_msids), arr(b.recording_mbids));
});

async function recordingFeedback(c: Ctx, trackId: number | null) {
  const { count, offset } = paging(c.q, 100, 100);
  const s = score(c.q);
  const page = trackId && s !== 0 && s !== -1 ? await repo.loversOf(trackId, count, offset) : { items: [], total: 0 };
  const items = await feedback(page.items, false);
  return { feedback: items, count: items.length, total_count: page.total, offset };
}

on("GET", "/feedback/recording/:msid/get-feedback", async (c) =>
  recordingFeedback(c, await trackOf(c.params[0], null))
);

on("GET", "/feedback/recording/:mbid/get-feedback-mbid", async (c) =>
  recordingFeedback(c, await trackOf(null, c.params[0]))
);

// --- metadata ---

const MAX_LOOKUPS = 100;

// Clients look up the song they're playing to love it, so the now playing update has usually put it in the catalog;
// the MusicBrainz id is remembered for it so the love finds the track.
async function lookup(artist: string, title: string): Promise<Json> {
  const n = await names({ artist, track: title });
  if (!n) return {};
  const ours = await findTrack(n.artist, n.track);
  const mb = mbdbOn ? await recordingOf(n.artist, n.track).catch(() => null) : null;
  if (mb && ours) await repo.saveRecordingMbids([{ mbid: mb.mbid, trackId: ours.id }]);
  if (!mb && !ours) return {};
  const known = ours && (await repo.recordingsOf([ours.id])).get(ours.id);
  return mb
    ? {
        artist_credit_name: mb.artist,
        artist_mbids: [mb.artistMbid],
        recording_mbid: mb.mbid,
        recording_name: mb.title,
      }
    : {
        artist_credit_name: ours!.artist,
        artist_mbids: [],
        recording_mbid: known || msid(ours!.id),
        recording_name: ours!.title,
      };
}

on("GET", "/metadata/lookup", (c) => lookup(str(c.q.get("artist_name")), str(c.q.get("recording_name"))));

on("POST", "/metadata/lookup", async (c) => {
  const b = await body(c.req);
  const asked = Array.isArray(b.recordings) ? b.recordings : bad("invalidJsonDocumentSubmitted");
  if (asked.length > MAX_LOOKUPS) bad("tooManyRecordingsAskAbout");
  return Promise.all(
    asked.map(async (r, index) => {
      const o = isObject(r) ? r : {};
      return { index, ...(await lookup(str(o.artist_name), str(o.recording_name))) };
    })
  );
});

// --- statistics ---

const RANGES = [
  "this_week",
  "this_month",
  "this_year",
  "week",
  "month",
  "quarter",
  "half_yearly",
  "year",
  "all_time",
] as const;
type Range = (typeof RANGES)[number];

/** UTC. The plain ranges are the last whole one; an open range has no `to`. */
function period(r: Range): { from: number; to?: number } {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const t = (yy: number, mm: number, dd = 1) => Date.UTC(yy, mm, dd) / 1000;
  const monday = t(y, m, d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  const q = m - (m % 3);
  const h = m - (m % 6);
  if (r === "this_week") return { from: monday };
  if (r === "this_month") return { from: t(y, m) };
  if (r === "this_year") return { from: t(y, 0) };
  if (r === "week") return { from: monday - 7 * 86400, to: monday };
  if (r === "month") return { from: t(y, m - 1), to: t(y, m) };
  if (r === "quarter") return { from: t(y, q - 3), to: t(y, q) };
  if (r === "half_yearly") return { from: t(y, h - 6), to: t(y, h) };
  if (r === "year") return { from: t(y - 1, 0), to: t(y, 0) };
  return { from: 0 };
}

function rangeOf(q: URLSearchParams) {
  const range = (q.get("range") ?? "all_time") as Range;
  if (!RANGES.includes(range)) bad("invalidRange", { range });
  const p = period(range);
  return { range, ...p, scope: { from: p.from || undefined, to: p.to } satisfies Scope };
}

const KINDS = {
  artists: { list: "artists", total: "total_artist_count" },
  releases: { list: "releases", total: "total_release_count" },
  "release-groups": { list: "release_groups", total: "total_release_group_count" },
  recordings: { list: "recordings", total: "total_recording_count" },
} as const;
type StatKind = keyof typeof KINDS;

async function entries(kind: StatKind, scope: Scope, count: number, offset: number, site: boolean) {
  const load = site ? siteTop : top;
  if (kind === "artists") {
    const r: TopList<TopArtist> = await load("artists", scope, count, offset);
    const mbids = await repo.mbidsOf(
      artists,
      r.items.map((a) => a.id)
    );
    const items = r.items.map((a) => {
      const mbid = mbids.get(a.id) ?? null;
      return { artist_mbid: mbid, artist_mbids: mbid ? [mbid] : [], artist_name: a.name, listen_count: a.playcount };
    });
    return { items, total: r.total };
  }
  if (kind === "recordings") {
    const r: TopList<TopTrack> = await load("tracks", scope, count, offset);
    const ids = r.items.map((t) => t.id);
    const [byArtist, recordings] = await Promise.all([repo.artistMbidsOf(tracks, ids), repo.recordingsOf(ids)]);
    const items = r.items.map((t) => {
      const artistMbid = byArtist.get(t.id);
      return {
        artist_mbids: artistMbid ? [artistMbid] : [],
        artist_name: t.artist,
        listen_count: t.playcount,
        recording_mbid: recordings.get(t.id) ?? null,
        recording_msid: msid(t.id),
        release_mbid: null,
        release_name: t.album,
        track_name: t.title,
      };
    });
    return { items, total: r.total };
  }
  const r: TopList<TopAlbum> = await load("albums", scope, count, offset);
  const ids = r.items.map((a) => a.id);
  const [byArtist, own] = await Promise.all([repo.artistMbidsOf(albums, ids), repo.mbidsOf(albums, ids)]);
  const items = r.items.map((a) => {
    const artistMbid = byArtist.get(a.id);
    const common = { artist_mbids: artistMbid ? [artistMbid] : [], artist_name: a.artist, listen_count: a.playcount };
    if (kind === "releases") return { ...common, release_mbid: null, release_name: a.title };
    return { ...common, release_group_mbid: own.get(a.id) ?? null, release_group_name: a.title };
  });
  return { items, total: r.total };
}

async function stats(c: Ctx, kind: StatKind, u: User | null) {
  const { count, offset } = paging(c.q, 25, 100);
  const { range, from, to, scope } = rangeOf(c.q);
  const r = await entries(kind, u ? { ...scope, userId: u.id } : scope, count, offset, !u);
  if (!r.items.length) return null;
  const k = KINDS[kind];
  const payload: Json = {
    [k.list]: r.items,
    count: r.items.length,
    [k.total]: r.total,
    offset,
    range,
    from_ts: from,
    to_ts: to ?? now(),
    last_updated: now(),
  };
  if (u) payload.user_id = u.username;
  return { payload };
}

for (const kind of Object.keys(KINDS) as StatKind[]) {
  on("GET", `/stats/user/:name/${kind}`, async (c) => {
    const u = await named(c.params[0]!);
    return canSeeCharts(u, await c.viewer()) ? stats(c, kind, u) : null;
  });
  on("GET", `/stats/sitewide/${kind}`, (c) => stats(c, kind, null));
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTHS = "January February March April May June July August September October November December".split(" ");

function bucketOf(range: Range): repo.Bucket {
  if (range === "all_time") return "year";
  if (["this_year", "year", "half_yearly"].includes(range)) return "month";
  return "day";
}

function steps(bucket: repo.Bucket, from: number, to: number) {
  const out: number[] = [];
  const f = new Date(from * 1000);
  const d = new Date(
    Date.UTC(f.getUTCFullYear(), bucket === "year" ? 0 : f.getUTCMonth(), bucket === "day" ? f.getUTCDate() : 1)
  );
  while (d.getTime() / 1000 < to) {
    out.push(d.getTime() / 1000);
    if (bucket === "day") d.setUTCDate(d.getUTCDate() + 1);
    else if (bucket === "month") d.setUTCMonth(d.getUTCMonth() + 1);
    else d.setUTCFullYear(d.getUTCFullYear() + 1);
  }
  return out;
}

function label(bucket: repo.Bucket, ts: number) {
  const d = new Date(ts * 1000);
  const month = MONTHS[d.getUTCMonth()]!;
  if (bucket === "year") return String(d.getUTCFullYear());
  if (bucket === "month") return `${month} ${d.getUTCFullYear()}`;
  return `${DAYS[(d.getUTCDay() + 6) % 7]} ${d.getUTCDate()} ${month} ${d.getUTCFullYear()}`;
}

on("GET", "/stats/user/:name/listening-activity", async (c) => {
  const u = await named(c.params[0]!);
  if (!canSeeCharts(u, await c.viewer())) return null;
  const { range, from: since, to = now() + 1 } = rangeOf(c.q);
  const bucket = bucketOf(range);
  const from = since || (await repo.listenSpan(u.id)).oldest;
  if (!from) return null;
  const plays = new Map([...(await repo.activity(u.id, bucket, from, to))].map((r) => [r.start, r.plays]));
  const starts = steps(bucket, from, to);
  const activity = starts.map((s, i) => ({
    from_ts: s,
    to_ts: (starts[i + 1] ?? to) - 1,
    time_range: label(bucket, s),
    listen_count: plays.get(s) ?? 0,
  }));
  return {
    payload: {
      listening_activity: activity,
      range,
      from_ts: from,
      to_ts: to,
      last_updated: now(),
      user_id: u.username,
    },
  };
});

on("GET", "/stats/user/:name/daily-activity", async (c) => {
  const u = await named(c.params[0]!);
  if (!canSeeCharts(u, await c.viewer())) return null;
  const { range, from, to = now() + 1 } = rangeOf(c.q);
  const rows = [...(await repo.hourly(u.id, from, to))];
  if (!rows.length) return null;
  const daily: Record<string, { hour: number; listen_count: number }[]> = {};
  for (const [i, day] of DAYS.entries()) {
    daily[day] = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      listen_count: rows.find((r) => r.dow === i + 1 && r.hour === hour)?.plays ?? 0,
    }));
  }
  return {
    payload: { daily_activity: daily, range, from_ts: from, to_ts: to, last_updated: now(), user_id: u.username },
  };
});

async function listeners(c: Ctx, table: typeof artists | typeof albums) {
  const mbid = uuid(c.params[0]) ?? bad("invalidMbid");
  const found = (await repo.byMbid(table, mbid)) ?? fail(404, "entityNotFound");
  const { count } = paging(c.q, 25, 100);
  const { range, from, to = now() + 1 } = rangeOf(c.q);
  const where = table === artists ? eq(scrobbles.artistId, found.id) : eq(scrobbles.albumId, found.id);
  const r = await repo.topListeners(where, from, to, count);
  if (!r.items.length) return null;
  const head =
    table === artists
      ? { artist_mbid: mbid, artist_name: found.name }
      : { release_group_mbid: mbid, release_group_name: found.name };
  return {
    payload: {
      ...head,
      listeners: r.items.map((l) => ({ user_name: l.username, listen_count: l.plays })),
      total_listen_count: r.plays,
      total_user_count: r.people,
      range,
      from_ts: from,
      to_ts: to,
      last_updated: now(),
    },
  };
}

on("GET", "/stats/artist/:mbid/listeners", (c) => listeners(c, artists));
on("GET", "/stats/release-group/:mbid/listeners", (c) => listeners(c, albums));

// --- the handler ---

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

const WINDOW = 10;
const PER_WINDOW = 100;

function reply(status: number, body: Json | Json[] | null, rate: Record<string, string>) {
  const headers = { ...CORS, ...rate, "Content-Type": "application/json; charset=utf-8" };
  return new Response(body && JSON.stringify(body), { status: body ? status : 204, headers });
}

export async function handleListenBrainz(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const url = new URL(req.url);

  const t = now();
  const resetAt = (Math.floor(t / WINDOW) + 1) * WINDOW;
  const used = await bump(`lb:${ipOf(req)}:${resetAt}`, 1, WINDOW * 2000);
  const rate = {
    "X-RateLimit-Limit": String(PER_WINDOW),
    "X-RateLimit-Remaining": String(Math.max(0, PER_WINDOW - used)),
    "X-RateLimit-Reset-In": String(resetAt - t),
    "X-RateLimit-Reset": String(resetAt),
  };
  if (used > PER_WINDOW) return reply(429, { code: 429, error: "Rate limit exceeded" }, rate);

  const path = url.pathname.replace(/\/+$/, "");
  const matches = routes.filter((r) => r.re.test(path));
  const route = matches.find((r) => r.method === req.method);
  if (!route) {
    const status = matches.length ? 405 : 404;
    return reply(status, { code: status, error: status === 405 ? "Method not allowed" : "Not found" }, rate);
  }
  let params: string[];
  try {
    params = route.re.exec(path)!.slice(1).map(decodeURIComponent);
  } catch {
    return reply(400, { code: 400, error: "Malformed URL" }, rate);
  }
  let viewer: Promise<User | null> | undefined;
  const c: Ctx = {
    req,
    q: url.searchParams,
    params,
    viewer: () => (viewer ??= tokenUser(req, url.searchParams)),
  };
  try {
    return reply(200, await route.run(c), rate);
  } catch (e) {
    if (e instanceof HttpError) return reply(e.status, { code: e.status, error: e.message }, rate);
    console.error(e);
    Sentry.captureException(e);
    return reply(500, { code: 500, error: "An unknown error occurred." }, rate);
  }
}
