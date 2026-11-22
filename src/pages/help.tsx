import { Link } from "react-router-dom";
import { Arrow } from "../icons";
import { useTitle } from "../lib";

const SECTIONS: [string, string][] = [
  ["spotify", "Spotify"],
  ["pano-scrobbler", "Pano Scrobbler"],
  ["other-apps", "Other scrobblers"],
  ["manual", "Manual scrobbles and imports"],
];

export function Help() {
  const origin = window.location.origin;
  useTitle("Help");
  const applications = (
    <Link to="/settings/applications">
      Settings
      <Arrow say=", " />
      Applications
    </Link>
  );
  return (
    <div className="wrap page">
      <h1 className="page-title">Scrobbling help</h1>
      <div className="cols">
        <div className="main prose docs">
          <p>Sonosphere records the music you play. Pick whichever of these fits how you listen.</p>
          <h2 id="spotify">Spotify</h2>
          <ol>
            <li>Open {applications}.</li>
            <li>Follow the Spotify steps there to connect your account.</li>
            <li>Play music. New songs show up within about a minute, and nothing needs to stay open on your device.</li>
          </ol>
          <h2 id="pano-scrobbler">Pano Scrobbler</h2>
          <ol>
            <li>In Pano, choose the custom Last.fm-compatible (GNU FM) server option.</li>
            <li>
              Fill in the three fields:
              <ul>
                <li>
                  <b>API URL:</b> <code>{origin}/2.0/</code>
                </li>
                <li>
                  <b>Username:</b> your Sonosphere username
                </li>
                <li>
                  <b>Password:</b> your Sonosphere password
                </li>
              </ul>
            </li>
            <li>Log in. Pano appears under {applications}, where you can disconnect it at any time.</li>
          </ol>
          <p className="note">
            Signed up through another service? Set a password in{" "}
            <Link to="/settings/account">
              Settings
              <Arrow say=", " />
              Account
            </Link>{" "}
            first. You don't need an API account: Pano uses its built-in key and secret <code>panoScrobbler</code>.
          </p>
          <h2 id="other-apps">Other scrobblers</h2>
          <p>Any player that supports the Last.fm 2.0 protocol and lets you change its server can scrobble here.</p>
          <ul>
            <li>
              <b>Server URL:</b> <code>{origin}/2.0/</code>
            </li>
            <li>
              <b>API key and secret:</b> if the app asks for them, create an API account under {applications}.
            </li>
          </ul>
          <p className="note">
            Building your own scrobbler or widget? See the <Link to="/developers">API documentation</Link>.
          </p>
          <h2 id="manual">Manual scrobbles and imports</h2>
          <ul>
            <li>
              Add plays by hand on the <Link to="/scrobble">scrobble page</Link>.
            </li>
            <li>
              Bring over your history from another service under{" "}
              <Link to="/settings/data">
                Settings
                <Arrow say=", " />
                Your data
              </Link>
              .
            </li>
          </ul>
        </div>
        <aside className="side">
          <h3>On this page</h3>
          <ul className="plain">
            {SECTIONS.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`}>{label}</a>
              </li>
            ))}
          </ul>
          <h3>Developers</h3>
          <ul className="plain">
            <li>
              <Link to="/developers">API documentation</Link>
            </li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
