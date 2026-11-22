import { Link } from "react-router-dom";
import { Arrow } from "../icons";
import { useTitle } from "../lib";

const METHODS: [string, string[]][] = [
  ["Auth", ["auth.getToken", "auth.getSession", "auth.getMobileSession"]],
  [
    "Track",
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
    "Artist",
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
  ["Album", ["album.getInfo", "album.getTopTags", "album.search", "album.addTags", "album.removeTag"]],
  [
    "User",
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
  ["Tag", ["tag.getInfo", "tag.getTopArtists", "tag.getTopTracks", "tag.getTopAlbums"]],
  ["Chart", ["chart.getTopArtists", "chart.getTopTracks", "chart.getTopTags"]],
];
export function Developers() {
  const origin = window.location.origin;
  useTitle("API");
  return (
    <div className="wrap page docs-page">
      <h1 className="page-title">Sonosphere API</h1>
      <div className="cols">
        <div className="main prose docs">
          <p>
            The API follows the Last.fm 2.0 protocol, so most scrobbler code works by changing the root URL. Just want
            to scrobble from a player? See the <Link to="/help">scrobbling help</Link>.
          </p>
          <h2>Basics</h2>
          <ul>
            <li>
              <b>Root URL:</b> <code>{origin}/2.0/</code>
            </li>
            <li>
              Send <code>method</code>, <code>api_key</code> and parameters as a query string (reads) or form-encoded
              POST (writes).
            </li>
            <li>
              Add <code>format=json</code> for JSON. XML is the default.
            </li>
            <li>
              Get a key and shared secret under{" "}
              <Link to="/settings/applications">
                Settings
                <Arrow say=", " />
                Applications
              </Link>
              .
            </li>
          </ul>
          <h2>Authentication</h2>
          <ul>
            <li>
              <b>Web:</b> send the user to <code>/api/auth?api_key=KEY&amp;cb=URL</code>. They return with{" "}
              <code>?token=TOKEN</code>; exchange it with <code>auth.getSession</code> within an hour. Without{" "}
              <code>cb</code>, your saved callback is used, and a given <code>cb</code> must be on the same site.
            </li>
            <li>
              <b>Desktop:</b> call <code>auth.getToken</code>, send the user to{" "}
              <code>/api/auth?api_key=KEY&amp;token=TOKEN</code>, then call <code>auth.getSession</code>.
            </li>
            <li>
              <b>Scripts:</b> POST <code>auth.getMobileSession</code> with <code>username</code> and{" "}
              <code>password</code>.
            </li>
          </ul>
          <p>Session keys don't expire. All three calls are signed.</p>
          <h2>Signing</h2>
          <p>
            Sort all parameters except <code>format</code> and <code>callback</code> by name, join them as{" "}
            <code>name + value</code>, append your secret, and send the MD5 hex digest as <code>api_sig</code>.
          </p>
          <h2>Examples</h2>
          <pre>{`# scrobble (macOS: md5 -q)
KEY=your_api_key; SECRET=your_shared_secret; SK=session_key; TS=$(date +%s)
SIG=$(printf 'api_key%sartistGlass Harbormethodtrack.scrobblesk%stimestamp%strackWhen the Echoes Come%s' \\
  "$KEY" "$SK" "$TS" "$SECRET" | md5sum | cut -d' ' -f1)
curl -X POST ${origin}/2.0/ -d method=track.scrobble -d api_key=$KEY -d sk=$SK -d timestamp=$TS \\
  --data-urlencode "artist=Glass Harbor" --data-urlencode "track=When the Echoes Come" -d api_sig=$SIG -d format=json

# read
curl "${origin}/2.0/?method=user.getRecentTracks&user=USERNAME&api_key=KEY&format=json"`}</pre>
          <p>
            Batch scrobbles use indexed parameters (<code>artist[0]</code>, <code>track[0]</code>, …), up to 50 per
            call.
          </p>
          <h2>Errors</h2>
          <p>
            Failures return <code>{`{"error": code, "message": "…"}`}</code>: 3 invalid method, 4 auth failed, 6 invalid
            parameters, 9 invalid session, 10 invalid API key, 13 invalid signature, 14 unauthorised token.
          </p>
          <h2 id="public-now-playing">Public now-playing API</h2>
          <p>
            Show a listener's current song on a website. No key, signature or login, and cross-origin requests are
            allowed.
          </p>
          <ul>
            <li>
              <code>GET /api/user/nowplaying?name=USERNAME</code>: one JSON snapshot
            </li>
            <li>
              <code>GET /api/user/nowplaying/stream?name=USERNAME</code>: Server-Sent Events
            </li>
            <li>
              <code>/api/user/nowplaying/ws?name=USERNAME</code>: WebSocket
            </li>
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
              <code>nowPlaying</code> is <code>null</code> when nothing is playing. <code>album</code> and{" "}
              <code>imageUrl</code> can be <code>null</code>.
            </li>
            <li>
              <code>duration</code> is in seconds (0 if unknown). <code>startedAt</code> is the Unix time of the latest
              update, not a playback position.
            </li>
            <li>
              Streams send the current state on connect, then a snapshot on every change. Past events aren't replayed.
            </li>
            <li>
              If listening turns private or the account goes away, streams send <code>unavailable</code> and close.
              Don't reconnect after that.
            </li>
            <li>
              WebSockets send <code>{`{"t":"ping"}`}</code> every 15 seconds; no reply needed.
            </li>
            <li>
              Errors: 400 bad name, 403 private, 404 unknown user, 429 rate limited (with <code>Retry-After</code>).
            </li>
            <li>Spotify listening is checked about once a minute, so changes can take that long to appear.</li>
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
          <h3>Public live API</h3>
          <ul className="plain">
            <li>
              <a href="#public-now-playing">Now-playing snapshots, SSE and WebSockets</a>
            </li>
          </ul>
          <h3>Methods</h3>
          {METHODS.map(([group, list]) => (
            <div key={group} className="methods">
              <h4>{group}</h4>
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
