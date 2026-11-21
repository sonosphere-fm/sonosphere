import { Link } from "react-router-dom";
import { Arrow } from "../icons";
import { useTitle } from "../lib";

const METHODS: [string, string[]][] = [
  ["Auth", ["auth.getToken", "auth.getSession", "auth.getMobileSession"]],
  ["Track", [
    "track.scrobble", "track.updateNowPlaying", "track.love", "track.unlove", "track.getInfo",
    "track.getSimilar", "track.getTopTags", "track.search", "track.addTags", "track.removeTag",
  ]],
  ["Artist", [
    "artist.getInfo", "artist.getTopTracks", "artist.getTopAlbums", "artist.getSimilar",
    "artist.getTopTags", "artist.search", "artist.addTags", "artist.removeTag",
  ]],
  ["Album", ["album.getInfo", "album.getTopTags", "album.search", "album.addTags", "album.removeTag"]],
  ["User", [
    "user.getInfo", "user.getRecentTracks", "user.getTopArtists", "user.getTopAlbums",
    "user.getTopTracks", "user.getLovedTracks", "user.getFriends", "user.getTopTags",
  ]],
  ["Tag", ["tag.getInfo", "tag.getTopArtists", "tag.getTopTracks", "tag.getTopAlbums"]],
  ["Chart", ["chart.getTopArtists", "chart.getTopTracks", "chart.getTopTags"]],
];
export function Developers() {
  const origin = window.location.origin;
  useTitle("API");
  return (
    <div className="wrap page">
      <h1 className="page-title">Sonosphere API</h1>
      <div className="cols">
        <div className="main prose docs">
          <p>Sonosphere exposes a web-service API that follows the Last.fm 2.0 protocol, so existing scrobbler code usually works by pointing it at a different root URL.</p>
          <p>For a live “now playing” widget on your website, use the <a href="#public-now-playing">public now-playing API</a>. JSON, Server-Sent Events and WebSockets are available without an API key or login, including from other websites.</p>
          <h2>Root URL</h2>
          <pre>{origin}/2.0/</pre>
          <p>Send <code>method</code>, <code>api_key</code> and the method's parameters as a query string (reads) or form-encoded POST body (writes). Add <code>format=json</code> for JSON; XML is the default.</p>
          <h2>1. Get an API key</h2>
          <p>Using Pano Scrobbler? Follow the <a href="#pano-scrobbler">Pano setup instructions</a> below; it has a built-in application registration.</p>
          <p>Create an API account under <Link to="/settings/applications">Settings<Arrow say=", " />Applications</Link>. You receive an API key and a shared secret.</p>
          <h2>2. Authenticate a user</h2>
          <h3>Web applications</h3>
          <ol>
            <li>Send the user to <code>{origin}/api/auth?api_key=KEY</code>, optionally with <code>&amp;cb=URL</code>. Without <code>cb</code>, the callback URL saved with your API account is used. If you saved one, <code>cb</code> must be on the same site.</li>
            <li>Once they approve, they are sent to the callback with <code>?token=TOKEN</code> added.</li>
            <li>Call <code>auth.getSession</code> with that token (signed) within an hour to receive a session key. Session keys do not expire.</li>
          </ol>
          <h3>Desktop applications</h3>
          <ol>
            <li>Call <code>auth.getToken</code> (signed).</li>
            <li>Send the user to <code>{origin}/api/auth?api_key=KEY&amp;token=TOKEN</code> to approve access. A <code>cb</code> or saved callback URL sends them back afterwards; otherwise they are told to return to your app.</li>
            <li>Call <code>auth.getSession</code> with the token (signed) to receive a session key.</li>
          </ol>
          <p>Scripts and desktop apps can instead call <code>auth.getMobileSession</code> with <code>username</code> and <code>password</code> over POST.</p>
          <h2>3. Sign your calls</h2>
          <p>For every call that needs a signature, sort all parameters except <code>format</code> and <code>callback</code> by name, concatenate them as <code>name + value</code>, append your shared secret, and send the MD5 hex digest as <code>api_sig</code>.</p>
          <h2>Example: scrobble a track</h2>
          <pre>{`KEY=your_api_key; SECRET=your_shared_secret; SK=session_key
TS=$(date +%s)
SIG=$(printf 'api_key%sartistGlass Harbormethodtrack.scrobblesk%stimestamp%strackWhen the Echoes Come%s' \\
  "$KEY" "$SK" "$TS" "$SECRET" | md5sum | cut -d' ' -f1)   # macOS: md5 -q
curl -X POST ${origin}/2.0/ \\
  -d method=track.scrobble -d api_key=$KEY -d sk=$SK -d timestamp=$TS \\
  --data-urlencode "artist=Glass Harbor" --data-urlencode "track=When the Echoes Come" \\
  -d api_sig=$SIG -d format=json`}</pre>
          <p>Batch scrobbles use indexed parameters (<code>artist[0]</code>, <code>track[0]</code>, <code>timestamp[0]</code>, …), up to 50 per call.</p>
          <h2>Example: read data</h2>
          <pre>{`curl "${origin}/2.0/?method=user.getRecentTracks&user=USERNAME&api_key=KEY&format=json"`}</pre>
          <h2>Errors</h2>
          <p>Failures return <code>{`{"error": code, "message": "…"}`}</code> using the familiar codes: 3 invalid method, 4 authentication failed, 6 invalid parameters, 9 invalid session key, 10 invalid API key, 13 invalid signature, 14 unauthorised token.</p>
          <h2 id="pano-scrobbler">Pano Scrobbler setup</h2>
          <p>Choose Pano's custom Last.fm-compatible (GNU FM) server option and fill in these three fields:</p>
          <ul>
            <li>API URL: <code>{origin}/2.0/</code></li>
            <li>Username: your Sonosphere username.</li>
            <li>Password: your Sonosphere password. If you signed up through another service, set a password in <Link to="/settings/account">Settings → Account</Link> first.</li>
          </ul>
          <p>You do not need to create an API account. Pano uses the built-in, case-sensitive application key and signing secret <code>panoScrobbler</code>. Sonosphere verifies its signatures and your password, then issues a session for subsequent requests. You can revoke that session under <Link to="/settings/applications">Settings → Applications</Link>.</p>
          <h2 id="public-now-playing">Public now-playing API</h2>
          <p>Display a listener's current song on your website or in an application. These read-only endpoints require no API key, signature, session or login. They always use public listening visibility, even when the visitor is signed in as the listener.</p>
          <table>
            <thead><tr><th>Endpoint</th><th>Response</th></tr></thead>
            <tbody>
              <tr><td><code>GET /api/user/nowplaying?name=USERNAME</code></td><td>One JSON snapshot</td></tr>
              <tr><td><code>GET /api/user/nowplaying/stream?name=USERNAME</code></td><td>SSE stream for EventSource</td></tr>
              <tr><td><code>/api/user/nowplaying/ws?name=USERNAME</code></td><td>WebSocket stream</td></tr>
            </tbody>
          </table>
          <p>The <code>name</code> parameter is required and is case-insensitive. URL-encode it. Both streams send the current state immediately, then a new snapshot whenever that state changes. You do not need to send a subscription command or fetch another endpoint.</p>
          <h3>Response format</h3>
          <pre>{JSON.stringify({
            t: "nowplaying",
            user: { username: "USERNAME" },
            nowPlaying: { trackId: 123, title: "When the Echoes Come", artist: "Glass Harbor", album: "Night Signals", duration: 210, startedAt: 1795219200, imageUrl: `${origin}/api/image/IMAGE_ID` },
          }, null, 2)}</pre>
          <p><code>nowPlaying</code> is <code>null</code> when nothing is currently playing, including after a stop or expiry. <code>duration</code> is in seconds (0 means unknown); <code>startedAt</code> is a Unix timestamp in seconds for the latest now-playing update. It is not a playback-position clock. <code>album</code> and <code>imageUrl</code> can be <code>null</code>. Artwork URLs are absolute, so they work in an image element on another website.</p>
          <h3>Embed on your website with SSE</h3>
          <p>SSE works with the browser's built-in <code>EventSource</code>, which reconnects automatically. Listen for the named <code>nowplaying</code> event:</p>
          <pre>{`<p id="now-playing">Loading current song…</p>
<script>
  const label = document.getElementById("now-playing");
  const url = new URL("${origin}/api/user/nowplaying/stream");
  url.searchParams.set("name", "USERNAME");
  const stream = new EventSource(url);

  stream.addEventListener("nowplaying", event => {
    const { user, nowPlaying } = JSON.parse(event.data);
    label.textContent = nowPlaying
      ? user.username + " is listening to " + nowPlaying.artist + " — " + nowPlaying.title
      : user.username + " is not listening right now";
  });

  stream.addEventListener("unavailable", () => {
    label.textContent = "Listening activity is unavailable";
    stream.close();
  });

  stream.onerror = () => {
    label.textContent = "Listening activity is temporarily unavailable";
  };
  window.addEventListener("pagehide", () => stream.close(), { once: true });
</script>`}</pre>
          <h3>WebSocket alternative</h3>
          <pre>{`const url = new URL("${origin}/api/user/nowplaying/ws");
url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
url.searchParams.set("name", "USERNAME");
const socket = new WebSocket(url);

socket.addEventListener("message", event => {
  const data = JSON.parse(event.data);
  if (data.t === "nowplaying") {
    console.log(data.user.username, data.nowPlaying);
  } else if (data.t === "unavailable") {
    console.log("Listening activity is unavailable");
    socket.close();
  }
  // Ignore { t: "ping" } keepalives; no reply is required.
});
window.addEventListener("pagehide", () => socket.close(), { once: true });`}</pre>
          <p>The public WebSocket accepts connections from other origins and from clients without an <code>Origin</code> header. It is receive-only. Use a reconnect delay with exponential backoff if you implement reconnection, and stop reconnecting after an <code>unavailable</code> event. The app's <code>/api/ws</code> endpoint remains restricted to the Sonosphere origin.</p>
          <h3>Read a snapshot</h3>
          <pre>{`const url = new URL("${origin}/api/user/nowplaying");
url.searchParams.set("name", "USERNAME");
const response = await fetch(url, { credentials: "omit" });
if (!response.ok) throw new Error("Now playing unavailable: " + response.status);
const data = await response.json();`}</pre>
          <h3>CORS, privacy and connection behavior</h3>
          <p>JSON and SSE responses include <code>Access-Control-Allow-Origin: *</code> and support <code>OPTIONS</code> preflight requests. Send requests without credentials; credentialed CORS requests are not supported. WebSockets use their own cross-origin handshake rather than CORS.</p>
          <p>Hidden recent listening and private listening are not exposed. Requests return 400 for a missing or invalid name, 403 for private listening, 404 for an unknown or banned account, and 429 when request or connection limits are reached. HTTP errors use <code>{`{"error": "…"}`}</code>; rate-limit responses include <code>Retry-After</code> in seconds.</p>
          <p>Open streams recheck public visibility on updates and at least every 15 seconds. If listening becomes private or the account becomes unavailable, the stream sends <code>{`{"t":"unavailable"}`}</code> (an <code>unavailable</code> SSE event) and closes. SSE sends comment keepalives; WebSockets send <code>{`{"t":"ping"}`}</code> every 15 seconds. Each reconnection starts with the latest snapshot; past events are not replayed and <code>Last-Event-ID</code> is not used.</p>
          <p>Updates are pushed when Sonosphere receives listening activity. Spotify currently checks for the playing song about once a minute, so a Spotify song change may take that long to appear. These streams report now-playing state; they do not expose a user's full scrobble history.</p>
        </div>
        <aside className="side">
          <h3>Public live API</h3>
          <ul className="plain"><li><a href="#public-now-playing">Now-playing snapshots, SSE and WebSockets</a></li></ul>
          <h3>Methods</h3>
          {METHODS.map(([group, list]) => (
            <div key={group} className="methods">
              <h4>{group}</h4>
              <ul className="plain">{list.map(m => <li key={m}><code>{m}</code></li>)}</ul>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
