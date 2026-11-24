import { Link } from "react-router-dom";
import { t, tx } from "../i18n";
import { Arrow } from "../icons";
import { TITLES, useTitle } from "../lib";
import { ApplicationsLink } from "./developers";

const sections = (): [string, string][] => [
  ["spotify", "Spotify"],
  ["pano-scrobbler", "Pano Scrobbler"],
  ["listenbrainz", t("dev.helpListenBrainz")],
  ["other-apps", t("dev.helpOtherApps")],
  ["manual", t("dev.helpManual")],
];

export function Help() {
  const origin = window.location.origin;
  useTitle(TITLES.help);
  const applications = <ApplicationsLink />;
  return (
    <div className="wrap page docs-page">
      <h1 className="page-title">{t("dev.helpHeading")}</h1>
      <div className="cols">
        <div className="main prose docs">
          <p>{t("dev.helpIntro")}</p>
          <h2 id="spotify">Spotify</h2>
          <ol>
            <li>{tx("dev.helpSpotifyOpen", { applications })}</li>
            <li>{t("dev.helpSpotifyFollow")}</li>
            <li>{t("dev.helpSpotifyPlay")}</li>
          </ol>
          <h2 id="pano-scrobbler">Pano Scrobbler</h2>
          <ol>
            <li>{t("dev.helpPanoServer")}</li>
            <li>
              {t("dev.helpPanoFields")}
              <ul>
                <li>
                  <b>{t("dev.helpPanoApiUrl")}</b> <code>{origin}/2.0/</code>
                </li>
                <li>{tx("dev.helpPanoUsername", { label: <b>{t("dev.helpPanoUsernameLabel")}</b> })}</li>
                <li>{tx("dev.helpPanoPassword", { label: <b>{t("dev.helpPanoPasswordLabel")}</b> })}</li>
              </ul>
            </li>
            <li>{tx("dev.helpPanoLogIn", { applications })}</li>
          </ol>
          <p className="note">
            {tx("dev.helpPanoNote", {
              account: (
                <Link to="/settings/account">
                  {t("common.settings")}
                  <Arrow say=", " />
                  {t("dev.account")}
                </Link>
              ),
              secret: <code>panoScrobbler</code>,
            })}
          </p>
          <h2 id="listenbrainz">{t("dev.helpListenBrainz")}</h2>
          <p>{t("dev.helpLbIntro")}</p>
          <ol>
            <li>{tx("dev.helpLbOpen", { applications, button: <b>{t("dev.helpLbCreateToken")}</b> })}</li>
            <li>{tx("dev.helpLbServer", { origin: <code>{origin}</code>, full: <code>{origin}/1/</code> })}</li>
            <li>{tx("dev.helpLbPlay", { applications })}</li>
          </ol>
          <h2 id="other-apps">{t("dev.helpOtherApps")}</h2>
          <p>{t("dev.helpOtherIntro")}</p>
          <ul>
            <li>
              <b>{t("dev.helpOtherServerUrl")}</b> <code>{origin}/2.0/</code>
            </li>
            <li>{tx("dev.helpOtherKey", { label: <b>{t("dev.helpOtherKeyLabel")}</b>, applications })}</li>
          </ul>
          <p className="note">
            {tx("dev.helpOwnScrobbler", { docs: <Link to="/developers">{t("dev.apiDocumentation")}</Link> })}
          </p>
          <h2 id="manual">{t("dev.helpManual")}</h2>
          <ul>
            <li>{tx("dev.helpManualAdd", { scrobble: <Link to="/scrobble">{t("dev.helpScrobblePage")}</Link> })}</li>
            <li>{tx("dev.helpManualImport", { import: <Link to="/import">{t("dev.helpImportLink")}</Link> })}</li>
          </ul>
        </div>
        <aside className="side">
          <h3>{t("dev.onThisPage")}</h3>
          <ul className="plain">
            {sections().map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`}>{label}</a>
              </li>
            ))}
          </ul>
          <h3>{t("dev.developers")}</h3>
          <ul className="plain">
            <li>
              <Link to="/developers">{t("dev.apiDocumentation")}</Link>
            </li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
