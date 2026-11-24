import { Link } from "react-router-dom";
import { type MessageKey, t, tx } from "../i18n";
import { Arrow } from "../icons";
import { TITLES, useTitle } from "../lib";

const METHODS: [MessageKey, string[]][] = [
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
const LB_ENDPOINTS: [MessageKey, string[]][] = [
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

export function ApplicationsLink() {
  return (
    <Link to="/settings/applications">
      {t("common.settings")}
      <Arrow say=", " />
      {t("dev.applications")}
    </Link>
  );
}

export function Developers() {
  const origin = window.location.origin;
  useTitle(TITLES.developers);
  return (
    <div className="wrap page docs-page">
      <h1 className="page-title">{t("dev.apiHeading")}</h1>
      <div className="cols">
        <div className="main prose docs">
          <p>{tx("dev.apiIntro", { help: <Link to="/help">{t("dev.apiHelpLink")}</Link> })}</p>
          <h2>{t("dev.basics")}</h2>
          <ul>
            <li>
              <b>{t("dev.rootUrl")}</b> <code>{origin}/2.0/</code>
            </li>
            <li>{tx("dev.basicsSend", { method: <code>method</code>, apiKey: <code>api_key</code> })}</li>
            <li>{tx("dev.basicsFormat", { format: <code>format=json</code> })}</li>
            <li>{tx("dev.basicsKey", { applications: <ApplicationsLink /> })}</li>
          </ul>
          <h2>{t("dev.authentication")}</h2>
          <ul>
            <li>
              {tx("dev.authWeb", {
                label: <b>{t("dev.authWebLabel")}</b>,
                url: <code>/api/auth?api_key=KEY&amp;cb=URL</code>,
                token: <code>?token=TOKEN</code>,
                getSession: <code>auth.getSession</code>,
                cb: <code>cb</code>,
              })}
            </li>
            <li>
              {tx("dev.authDesktop", {
                label: <b>{t("dev.authDesktopLabel")}</b>,
                getToken: <code>auth.getToken</code>,
                url: <code>/api/auth?api_key=KEY&amp;token=TOKEN</code>,
                getSession: <code>auth.getSession</code>,
              })}
            </li>
            <li>
              {tx("dev.authScripts", {
                label: <b>{t("dev.authScriptsLabel")}</b>,
                getMobileSession: <code>auth.getMobileSession</code>,
                username: <code>username</code>,
                password: <code>password</code>,
              })}
            </li>
          </ul>
          <p>{t("dev.sessionKeys")}</p>
          <h2>{t("dev.signing")}</h2>
          <p>
            {tx("dev.signingBody", {
              format: <code>format</code>,
              callback: <code>callback</code>,
              pair: <code>name + value</code>,
              apiSig: <code>api_sig</code>,
            })}
          </p>
          <h2>{t("dev.examples")}</h2>
          <pre>{`# scrobble (macOS: md5 -q)
KEY=your_api_key; SECRET=your_shared_secret; SK=session_key; TS=$(date +%s)
SIG=$(printf 'api_key%sartistGlass Harbormethodtrack.scrobblesk%stimestamp%strackWhen the Echoes Come%s' \\
  "$KEY" "$SK" "$TS" "$SECRET" | md5sum | cut -d' ' -f1)
curl -X POST ${origin}/2.0/ -d method=track.scrobble -d api_key=$KEY -d sk=$SK -d timestamp=$TS \\
  --data-urlencode "artist=Glass Harbor" --data-urlencode "track=When the Echoes Come" -d api_sig=$SIG -d format=json

# read
curl "${origin}/2.0/?method=user.getRecentTracks&user=USERNAME&api_key=KEY&format=json"`}</pre>
          <p>{tx("dev.batch", { artist: <code>artist[0]</code>, track: <code>track[0]</code> })}</p>
          <h2>{t("dev.errors")}</h2>
          <p>{tx("dev.errorsBody", { shape: <code>{`{"error": code, "message": "…"}`}</code> })}</p>
          <h2 id="listenbrainz">{t("dev.lbHeading")}</h2>
          <p>{tx("dev.lbIntro", { root: <code>{origin}/1/</code>, origin: <code>{origin}</code> })}</p>
          <ul>
            <li>
              {tx("dev.lbTokens", {
                label: <b>{t("dev.lbTokensLabel")}</b>,
                applications: <ApplicationsLink />,
                header: <code>Authorization: Token TOKEN</code>,
              })}
            </li>
            <li>
              {tx("dev.lbErrors", {
                label: <b>{t("dev.lbErrorsLabel")}</b>,
                shape: <code>{`{"code": 400, "error": "…"}`}</code>,
              })}
            </li>
            <li>
              {tx("dev.lbRateLimit", { label: <b>{t("dev.lbRateLimitLabel")}</b>, header: <code>X-RateLimit-*</code> })}
            </li>
            <li>
              {tx("dev.lbRecordingIds", {
                label: <b>{t("dev.lbRecordingIdsLabel")}</b>,
                msid: <code>recording_msid</code>,
                mbid: <code>recording_mbid</code>,
              })}
            </li>
            <li>
              {tx("dev.lbStats", {
                label: <b>{t("dev.lbStatsLabel")}</b>,
                from: <code>this_week</code>,
                to: <code>all_time</code>,
              })}
            </li>
          </ul>
          <pre>{`# submit a listen
curl -X POST ${origin}/1/submit-listens \\
  -H "Authorization: Token TOKEN" -H "Content-Type: application/json" \\
  -d '{"listen_type": "single", "payload": [{"listened_at": '$(date +%s)',
       "track_metadata": {"artist_name": "Glass Harbor", "track_name": "When the Echoes Come"}}]}'

# read
curl "${origin}/1/user/USERNAME/listens?count=10"`}</pre>
          <p>{t("dev.lbSupported")}</p>
          <ul>
            {LB_ENDPOINTS.map(([group, list]) => (
              <li key={group}>
                <b>{t("dev.groupLabel", { group: t(group) })}</b>{" "}
                {list.map((e, i) => (
                  <span key={e}>
                    {i > 0 && ", "}
                    <code>{e}</code>
                  </span>
                ))}
              </li>
            ))}
          </ul>
          <p>{t("dev.lbUnavailable")}</p>
          <h2 id="public-now-playing">{t("dev.npHeading")}</h2>
          <p>{t("dev.npIntro")}</p>
          <ul>
            <li>{tx("dev.npSnapshot", { endpoint: <code>GET /api/user/nowplaying?name=USERNAME</code> })}</li>
            <li>{tx("dev.npSse", { endpoint: <code>GET /api/user/nowplaying/stream?name=USERNAME</code> })}</li>
            <li>{tx("dev.npWs", { endpoint: <code>/api/user/nowplaying/ws?name=USERNAME</code> })}</li>
          </ul>
          <pre>
            {JSON.stringify(
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
            )}
          </pre>
          <ul>
            <li>
              {tx("dev.npNull", {
                nowPlaying: <code>nowPlaying</code>,
                null: <code>null</code>,
                album: <code>album</code>,
                imageUrl: <code>imageUrl</code>,
              })}
            </li>
            <li>{tx("dev.npDuration", { duration: <code>duration</code>, startedAt: <code>startedAt</code> })}</li>
            <li>{t("dev.npStreams")}</li>
            <li>{tx("dev.npUnavailable", { unavailable: <code>unavailable</code> })}</li>
            <li>{tx("dev.npPing", { ping: <code>{`{"t":"ping"}`}</code> })}</li>
            <li>{tx("dev.npErrors", { retryAfter: <code>Retry-After</code> })}</li>
            <li>{t("dev.npSpotify")}</li>
          </ul>
          <pre>{`const url = new URL("${origin}/api/user/nowplaying/stream");
url.searchParams.set("name", "USERNAME");
const stream = new EventSource(url);
stream.addEventListener("nowplaying", e => {
  const { nowPlaying } = JSON.parse(e.data);
  label.textContent = nowPlaying ? nowPlaying.artist + " - " + nowPlaying.title : "Not listening";
});
stream.addEventListener("unavailable", () => stream.close());`}</pre>
        </div>
        <aside className="side">
          <h3>{t("dev.otherApis")}</h3>
          <ul className="plain">
            <li>
              <a href="#listenbrainz">{t("dev.otherApisLb")}</a>
            </li>
            <li>
              <a href="#public-now-playing">{t("dev.otherApisNp")}</a>
            </li>
          </ul>
          <h3>{t("dev.methods")}</h3>
          {METHODS.map(([group, list]) => (
            <div key={group} className="methods">
              <h4>{t(group)}</h4>
              <ul className="plain">
                {list.map((m) => (
                  <li key={m}>
                    <code>{m}</code>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
