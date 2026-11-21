import { Link } from "react-router-dom";
import { useTitle } from "../lib";

// ---------- developer docs ----------
const METHODS: [string, string[]][] = [
  ["Auth", ["auth.getToken", "auth.getSession", "auth.getMobileSession"]],
  ["Track", ["track.scrobble", "track.updateNowPlaying", "track.love", "track.unlove", "track.getInfo", "track.getSimilar", "track.getTopTags", "track.search", "track.addTags", "track.removeTag"]],
  ["Artist", ["artist.getInfo", "artist.getTopTracks", "artist.getTopAlbums", "artist.getSimilar", "artist.getTopTags", "artist.search", "artist.addTags", "artist.removeTag"]],
  ["Album", ["album.getInfo", "album.getTopTags", "album.search", "album.addTags", "album.removeTag"]],
  ["User", ["user.getInfo", "user.getRecentTracks", "user.getTopArtists", "user.getTopAlbums", "user.getTopTracks", "user.getLovedTracks", "user.getFriends", "user.getTopTags"]],
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
          <h2>Root URL</h2>
          <pre>{origin}/2.0/</pre>
          <p>Send <code>method</code>, <code>api_key</code> and the method's parameters as a query string (reads) or form-encoded POST body (writes). Add <code>format=json</code> for JSON; XML is the default.</p>
          <h2>1. Get an API key</h2>
          <p>Create an API account under <Link to="/settings/applications">Settings → Applications</Link>. You receive an API key and a shared secret.</p>
          <h2>2. Authenticate a user</h2>
          <ol>
            <li>Call <code>auth.getToken</code> (signed).</li>
            <li>Send the user to <code>{origin}/api/auth?api_key=KEY&amp;token=TOKEN</code> to approve access. Optionally add <code>cb=</code> to be redirected back.</li>
            <li>Call <code>auth.getSession</code> with the token (signed) to receive a session key. Session keys do not expire.</li>
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
        </div>
        <aside className="side">
          <h3>Methods</h3>
          {METHODS.map(([group, list]) => <div key={group} className="methods"><h4>{group}</h4><ul className="plain">{list.map(m => <li key={m}><code>{m}</code></li>)}</ul></div>)}
        </aside>
      </div>
    </div>
  );
}
