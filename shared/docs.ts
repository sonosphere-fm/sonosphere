import type en from "./i18n/en/index";
import { lookup, pick, type Key, type Locale, type Namespace } from "./i18n/core";

export type DocKey = Key<typeof en>;
export type Span =
  | string
  | Span[]
  | { t: DocKey; with?: Record<string, Span> }
  | { code: string }
  | { b: Span }
  | { to: string; label: Span }
  | { href: string; label: Span }
  | { arrow: true };
type Nested = { text: Span; list: Item[] };
export type Item = Span | Nested;
export type Block =
  | { h2: Span; id?: string }
  | { p: Span; note?: boolean }
  | { ul: Item[] }
  | { ol: Item[] }
  | { pre: string; lang: string };
export type DocPage = { path: "/developers" | "/help"; title: DocKey; body: Block[]; reference: Block[] };

export const isNested = (item: Item): item is Nested =>
  typeof item === "object" && !Array.isArray(item) && "list" in item;

export function interpolate(template: string, params?: Record<string, Span>): Span[] {
  if (!params) return [template];
  return template.split(/\{(\w+)\}/g).map((part, i) => (i % 2 ? (params[part] ?? `{${part}}`) : part));
}

export const catalogText = (locale: Locale, catalog: Record<string, Namespace>) => (key: DocKey) =>
  pick(locale, lookup(catalog, key)!, undefined);

const tr = (key: DocKey, params?: Record<string, Span>): Span => ({ t: key, with: params });
const code = (s: string): Span => ({ code: s });
const b = (s: Span): Span => ({ b: s });
const settingsLink = (to: string, page: DocKey): Span => ({
  to,
  label: [tr("common.settings"), { arrow: true }, tr(page)],
});
const applications = settingsLink("/settings/applications", "dev.applications");
const listenToken = tr("dev.helpLbOpen", { applications, button: b(tr("dev.helpLbCreateToken")) });
const codeList = (list: string[]) => list.flatMap((item, i) => (i ? [", ", code(item)] : [code(item)]));
const groups = (list: [DocKey, string[]][]): Item[] =>
  list.map(([group, items]) => [b(tr("dev.groupLabel", { group: tr(group) })), " ", ...codeList(items)]);

export const METHODS: [DocKey, string[]][] = [
  ["dev.groupAuth", ["auth.getToken", "auth.getSession", "auth.getMobileSession"]],
  [
    "dev.groupTrack",
    [
      "track.scrobble",
      "track.updateNowPlaying",
      "track.love",
      "track.unlove",
      "track.getInfo",
      "track.getSimilar",
      "track.getTopTags",
      "track.search",
      "track.addTags",
      "track.removeTag",
    ],
  ],
  [
    "dev.groupArtist",
    [
      "artist.getInfo",
      "artist.getTopTracks",
      "artist.getTopAlbums",
      "artist.getSimilar",
      "artist.getTopTags",
      "artist.search",
      "artist.addTags",
      "artist.removeTag",
    ],
  ],
  ["dev.groupAlbum", ["album.getInfo", "album.getTopTags", "album.search", "album.addTags", "album.removeTag"]],
  [
    "dev.groupUser",
    [
      "user.getInfo",
      "user.getRecentTracks",
      "user.getTopArtists",
      "user.getTopAlbums",
      "user.getTopTracks",
      "user.getLovedTracks",
      "user.getFriends",
      "user.getTopTags",
    ],
  ],
  ["dev.groupTag", ["tag.getInfo", "tag.getTopArtists", "tag.getTopTracks", "tag.getTopAlbums"]],
  ["dev.groupChart", ["chart.getTopArtists", "chart.getTopTracks", "chart.getTopTags"]],
];

const LB_ENDPOINTS: [DocKey, string[]][] = [
  ["dev.groupAuth", ["GET validate-token"]],
  [
    "dev.groupListens",
    [
      "POST submit-listens",
      "POST delete-listen",
      "GET user/{user}/listens",
      "GET user/{user}/listen-count",
      "GET user/{user}/playing-now",
      "GET POST latest-import",
    ],
  ],
  [
    "dev.groupFeedback",
    [
      "POST feedback/recording-feedback",
      "GET feedback/user/{user}/get-feedback",
      "GET POST feedback/user/{user}/get-feedback-for-recordings",
      "GET feedback/recording/{msid}/get-feedback",
      "GET feedback/recording/{mbid}/get-feedback-mbid",
    ],
  ],
  [
    "dev.groupSocial",
    [
      "GET user/{user}/followers",
      "GET user/{user}/following",
      "POST user/{user}/follow",
      "POST user/{user}/unfollow",
      "GET user/{user}/similar-users",
      "GET user/{user}/similar-to/{other}",
      "GET user/{user}/services",
      "GET search/users",
    ],
  ],
  [
    "dev.groupUserStats",
    ["artists", "releases", "release-groups", "recordings", "listening-activity", "daily-activity"],
  ],
  ["dev.groupSiteStats", ["artists", "releases", "release-groups", "recordings"]],
  ["dev.groupListeners", ["GET stats/artist/{mbid}/listeners", "GET stats/release-group/{mbid}/listeners"]],
];

export function developerDocs(origin: string): DocPage {
  return {
    path: "/developers",
    title: "dev.apiHeading",
    body: [
      { p: tr("dev.apiIntro", { help: { to: "/help", label: tr("dev.apiHelpLink") } }) },
      { p: { href: "/llms.txt", label: "llms.txt" } },
      { h2: tr("dev.basics") },
      {
        ul: [
          [b(tr("dev.rootUrl")), " ", code(`${origin}/2.0/`)],
          tr("dev.basicsSend", { method: code("method"), apiKey: code("api_key") }),
          tr("dev.basicsFormat", { format: code("format=json") }),
          tr("dev.basicsKey", { applications }),
        ],
      },
      { h2: tr("dev.authentication") },
      {
        ul: [
          tr("dev.authWeb", {
            label: b(tr("dev.authWebLabel")),
            url: code("/api/auth?api_key=KEY&cb=URL"),
            token: code("?token=TOKEN"),
            getSession: code("auth.getSession"),
            cb: code("cb"),
          }),
          tr("dev.authDesktop", {
            label: b(tr("dev.authDesktopLabel")),
            getToken: code("auth.getToken"),
            url: code("/api/auth?api_key=KEY&token=TOKEN"),
            getSession: code("auth.getSession"),
          }),
          tr("dev.authScripts", {
            label: b(tr("dev.authScriptsLabel")),
            getMobileSession: code("auth.getMobileSession"),
            username: code("username"),
            password: code("password"),
          }),
        ],
      },
      { p: tr("dev.sessionKeys") },
      { h2: tr("dev.signing") },
      {
        p: tr("dev.signingBody", {
          format: code("format"),
          callback: code("callback"),
          pair: code("name + value"),
          apiSig: code("api_sig"),
        }),
      },
      { h2: tr("dev.examples") },
      {
        lang: "sh",
        pre: `# scrobble (macOS: md5 -q)
KEY=your_api_key; SECRET=your_shared_secret; SK=session_key; TS=$(date +%s)
SIG=$(printf 'api_key%sartistGlass Harbormethodtrack.scrobblesk%stimestamp%strackWhen the Echoes Come%s' \\
  "$KEY" "$SK" "$TS" "$SECRET" | md5sum | cut -d' ' -f1)
curl -X POST ${origin}/2.0/ -d method=track.scrobble -d api_key=$KEY -d sk=$SK -d timestamp=$TS \\
  --data-urlencode "artist=Glass Harbor" --data-urlencode "track=When the Echoes Come" -d api_sig=$SIG -d format=json

# read
curl "${origin}/2.0/?method=user.getRecentTracks&user=USERNAME&api_key=KEY&format=json"`,
      },
      { p: tr("dev.batch", { artist: code("artist[0]"), track: code("track[0]") }) },
      { h2: tr("dev.errors") },
      { p: tr("dev.errorsBody", { shape: code(`{"error": code, "message": "…"}`) }) },
      { h2: tr("dev.lbHeading"), id: "listenbrainz" },
      { p: tr("dev.lbIntro", { root: code(`${origin}/1/`), origin: code(origin) }) },
      {
        ul: [
          tr("dev.lbTokens", {
            label: b(tr("dev.lbTokensLabel")),
            applications,
            header: code("Authorization: Token TOKEN"),
          }),
          tr("dev.lbErrors", { label: b(tr("dev.lbErrorsLabel")), shape: code(`{"code": 400, "error": "…"}`) }),
          tr("dev.lbRateLimit", { label: b(tr("dev.lbRateLimitLabel")), header: code("X-RateLimit-*") }),
          tr("dev.lbRecordingIds", {
            label: b(tr("dev.lbRecordingIdsLabel")),
            msid: code("recording_msid"),
            mbid: code("recording_mbid"),
          }),
          tr("dev.lbStats", { label: b(tr("dev.lbStatsLabel")), from: code("this_week"), to: code("all_time") }),
        ],
      },
      {
        lang: "sh",
        pre: `# submit a listen
curl -X POST ${origin}/1/submit-listens \\
  -H "Authorization: Token TOKEN" -H "Content-Type: application/json" \\
  -d '{"listen_type": "single", "payload": [{"listened_at": '$(date +%s)',
       "track_metadata": {"artist_name": "Glass Harbor", "track_name": "When the Echoes Come"}}]}'

# read
curl "${origin}/1/user/USERNAME/listens?count=10"`,
      },
      { p: tr("dev.lbSupported") },
      { ul: groups(LB_ENDPOINTS) },
      { p: tr("dev.lbUnavailable") },
      { h2: tr("dev.npHeading"), id: "public-now-playing" },
      { p: tr("dev.npIntro") },
      {
        ul: [
          tr("dev.npSnapshot", { endpoint: code("GET /api/user/nowplaying?name=USERNAME") }),
          tr("dev.npSse", { endpoint: code("GET /api/user/nowplaying/stream?name=USERNAME") }),
          tr("dev.npWs", { endpoint: code("/api/user/nowplaying/ws?name=USERNAME") }),
        ],
      },
      {
        lang: "json",
        pre: JSON.stringify(
          {
            t: "nowplaying",
            user: { username: "USERNAME" },
            nowPlaying: {
              trackId: 123,
              title: "When the Echoes Come",
              artist: "Glass Harbor",
              album: "Night Signals",
              duration: 210,
              startedAt: 1795219200,
              imageUrl: `${origin}/api/image/IMAGE_ID`,
            },
          },
          null,
          2
        ),
      },
      {
        ul: [
          tr("dev.npNull", {
            nowPlaying: code("nowPlaying"),
            null: code("null"),
            album: code("album"),
            imageUrl: code("imageUrl"),
          }),
          tr("dev.npDuration", { duration: code("duration"), startedAt: code("startedAt") }),
          tr("dev.npStreams"),
          tr("dev.npUnavailable", { unavailable: code("unavailable") }),
          tr("dev.npPing", { ping: code(`{"t":"ping"}`) }),
          tr("dev.npErrors", { retryAfter: code("Retry-After") }),
          tr("dev.npSpotify"),
        ],
      },
      {
        lang: "js",
        pre: `const url = new URL("${origin}/api/user/nowplaying/stream");
url.searchParams.set("name", "USERNAME");
const stream = new EventSource(url);
stream.addEventListener("nowplaying", e => {
  const { nowPlaying } = JSON.parse(e.data);
  label.textContent = nowPlaying ? nowPlaying.artist + " - " + nowPlaying.title : "Not listening";
});
stream.addEventListener("unavailable", () => stream.close());`,
      },
    ],
    reference: [{ h2: tr("dev.methods") }, { ul: groups(METHODS) }],
  };
}

export function helpDocs(origin: string): DocPage {
  return {
    path: "/help",
    title: "dev.helpHeading",
    body: [
      { p: tr("dev.helpIntro") },
      { h2: "Spotify", id: "spotify" },
      { ol: [tr("dev.helpSpotifyOpen", { applications }), tr("dev.helpSpotifyFollow"), tr("dev.helpSpotifyPlay")] },
      { h2: "Pano Scrobbler", id: "pano-scrobbler" },
      {
        ol: [
          tr("dev.helpPanoServer"),
          {
            text: tr("dev.helpPanoFields"),
            list: [
              [b(tr("dev.helpPanoApiUrl")), " ", code(`${origin}/2.0/`)],
              tr("dev.helpPanoUsername", { label: b(tr("dev.helpPanoUsernameLabel")) }),
              tr("dev.helpPanoPassword", { label: b(tr("dev.helpPanoPasswordLabel")) }),
            ],
          },
          tr("dev.helpPanoLogIn", { applications }),
        ],
      },
      {
        note: true,
        p: tr("dev.helpPanoNote", {
          account: settingsLink("/settings/account", "dev.account"),
          secret: code("panoScrobbler"),
        }),
      },
      { h2: tr("dev.helpListenBrainz"), id: "listenbrainz" },
      { p: tr("dev.helpLbIntro") },
      {
        ol: [
          listenToken,
          tr("dev.helpLbServer", { origin: code(origin), full: code(`${origin}/1/`) }),
          tr("dev.helpLbPlay", { applications }),
        ],
      },
      { h2: "Navidrome", id: "navidrome" },
      {
        ol: [
          tr("dev.helpNavidromeConfig", {
            option: code("ListenBrainz.BaseURL"),
            env: code("ND_LISTENBRAINZ_BASEURL"),
            url: code(`${origin}/1/`),
          }),
          listenToken,
          tr("dev.helpNavidromeLink"),
        ],
      },
      { note: true, p: tr("dev.helpNavidromeNote") },
      { h2: "Jellyfin", id: "jellyfin" },
      {
        ol: [
          tr("dev.helpJellyfinRepo", { repo: code("https://repo.xkrivo.net/jellyfin/manifest.json") }),
          tr("dev.helpJellyfinInstall"),
          listenToken,
          tr("dev.helpJellyfinUrl", { setting: b("ListenBrainz API URL"), url: code(origin) }),
          tr("dev.helpJellyfinUser", {
            field: b("ListenBrainz API token"),
            enable: b("Enable submitting listens"),
          }),
        ],
      },
      { h2: "Plex", id: "plex" },
      {
        p: tr("dev.helpPlexIntro", {
          app: { href: "https://foxxmd.github.io/multi-scrobbler/", label: "multi-scrobbler" },
        }),
      },
      {
        ol: [
          listenToken,
          tr("dev.helpPlexSource", { url: code("PLEX_URL"), token: code("PLEX_TOKEN") }),
          tr("dev.helpPlexClient", {
            url: code("LZ_URL"),
            origin: code(origin),
            token: code("LZ_TOKEN"),
            user: code("LZ_USER"),
          }),
          tr("dev.helpPlexPlay"),
        ],
      },
      { h2: "Web Scrobbler", id: "web-scrobbler" },
      { p: tr("dev.helpWebScrobblerIntro") },
      {
        ol: [
          listenToken,
          tr("dev.helpWebScrobblerEdit"),
          tr("dev.helpWebScrobblerFields", { url: code(`${origin}/1/submit-listens`) }),
        ],
      },
      { h2: tr("dev.helpOtherApps"), id: "other-apps" },
      { p: tr("dev.helpOtherIntro") },
      {
        ul: [
          [b(tr("dev.helpOtherServerUrl")), " ", code(`${origin}/2.0/`)],
          tr("dev.helpOtherKey", { label: b(tr("dev.helpOtherKeyLabel")), applications }),
        ],
      },
      {
        note: true,
        p: tr("dev.helpOwnScrobbler", { docs: { to: "/developers", label: tr("dev.apiDocumentation") } }),
      },
      { h2: tr("dev.helpManual"), id: "manual" },
      {
        ul: [
          tr("dev.helpManualAdd", { scrobble: { to: "/scrobble", label: tr("dev.helpScrobblePage") } }),
          tr("dev.helpManualImport", { import: { to: "/import", label: tr("dev.helpImportLink") } }),
        ],
      },
    ],
    reference: [],
  };
}

export const docPages = (origin: string) => [developerDocs(origin), helpDocs(origin)];
