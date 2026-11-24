import type en from "../en/dev";
import type { Translation } from "../core";

export default {
  applications: "Anwendungen",
  account: "Konto",
  apiDocumentation: "API-Dokumentation",
  developers: "Entwickler",
  onThisPage: "Auf dieser Seite",

  apiHeading: "Sonosphere-API",
  apiIntro:
    "Die API folgt dem Last.fm-2.0-Protokoll, daher funktioniert der meiste Scrobbler-Code, wenn du die Root-URL änderst. Du willst nur aus einem Player scrobbeln? Sieh dir die {help} an.",
  apiHelpLink: "Hilfe zum Scrobbeln",
  basics: "Grundlagen",
  rootUrl: "Root-URL:",
  basicsSend:
    "Sende {method}, {apiKey} und Parameter als Query-String (Lesen) oder als formularcodiertes POST (Schreiben).",
  basicsFormat: "Füge {format} für JSON hinzu. XML ist der Standard.",
  basicsKey: "Einen Schlüssel und ein Shared Secret bekommst du unter {applications}.",
  authentication: "Authentifizierung",
  authWeb:
    "{label} Leite den Nutzer zu {url} weiter. Er kommt mit {token} zurück; tausche es innerhalb einer Stunde mit {getSession} ein. Ohne {cb} wird dein gespeicherter Callback verwendet, und ein angegebener {cb} muss auf derselben Seite liegen.",
  authWebLabel: "Web:",
  authDesktop: "{label} Rufe {getToken} auf, leite den Nutzer zu {url} weiter und rufe dann {getSession} auf.",
  authDesktopLabel: "Desktop:",
  authScripts: "{label} POST an {getMobileSession} mit {username} und {password}.",
  authScriptsLabel: "Skripte:",
  sessionKeys: "Session-Keys laufen nicht ab. Alle drei Aufrufe werden signiert.",
  signing: "Signieren",
  signingBody:
    "Sortiere alle Parameter außer {format} und {callback} nach Namen, verbinde sie als {pair}, hänge dein Secret an und sende den MD5-Hex-Digest als {apiSig}.",
  examples: "Beispiele",
  batch: "Batch-Scrobbles nutzen indizierte Parameter ({artist}, {track}, …), bis zu 50 pro Aufruf.",
  errors: "Fehler",
  errorsBody:
    "Fehler liefern {shape}: 3 ungültige Methode, 4 Authentifizierung fehlgeschlagen, 6 ungültige Parameter, 9 ungültige Session, 10 ungültiger API-Schlüssel, 13 ungültige Signatur, 14 nicht autorisierter Token.",
  lbHeading: "ListenBrainz-API",
  lbIntro:
    "Die ListenBrainz-API wird unter {root} mit denselben Pfaden, Request-Bodies und Antworten bereitgestellt, daher funktionieren ListenBrainz-Clients und -Bibliotheken, wenn du die Root-URL auf {origin} änderst.",
  lbTokens:
    "{label} Nutzer erstellen einen unter {applications}. Sende ihn als {header}. Zum Lesen braucht man keinen, außer um das eigene private Hörverhalten zu sehen.",
  lbTokensLabel: "Tokens:",
  lbErrors: "{label} {shape} mit dem passenden HTTP-Status. Statistiken ohne Inhalt liefern 204.",
  lbErrorsLabel: "Fehler:",
  lbRateLimit: "{label} 100 Anfragen pro 10 Sekunden pro Adresse, angegeben in den {header}-Headern.",
  lbRateLimitLabel: "Rate-Limit:",
  lbRecordingIds:
    "{label} {msid}-Werte stammen von Sonosphere und haben nur hier Bedeutung. Eine {mbid} ist bekannt, sobald ein Client sie mit einem Listen gesendet hat.",
  lbRecordingIdsLabel: "Recording-IDs:",
  lbStats: "{label} sind live und nutzen UTC. Alle Zeiträume werden unterstützt, von {from} bis {to}.",
  lbStatsLabel: "Statistiken",
  lbSupported: "Unterstützte Endpunkte:",
  lbUnavailable: "Playlists, Empfehlungen, Radio, Metadaten-Abfragen und Daten-Dumps sind nicht verfügbar.",
  npHeading: "Öffentliche Now-Playing-API",
  npIntro:
    "Zeige den aktuellen Song eines Hörers auf einer Website. Kein Schlüssel, keine Signatur, kein Login, und Cross-Origin-Anfragen sind erlaubt.",
  npSnapshot: "{endpoint}: ein JSON-Snapshot",
  npSse: "{endpoint}: Server-Sent Events",
  npWs: "{endpoint}: WebSocket",
  npNull: "{nowPlaying} ist {null}, wenn nichts läuft. {album} und {imageUrl} können {null} sein.",
  npDuration:
    "{duration} ist in Sekunden (0, wenn unbekannt). {startedAt} ist die Unix-Zeit des letzten Updates, keine Wiedergabeposition.",
  npStreams:
    "Streams senden beim Verbinden den aktuellen Zustand und danach bei jeder Änderung einen Snapshot. Vergangene Events werden nicht wiederholt.",
  npUnavailable:
    "Wenn das Hörverhalten privat wird oder das Konto verschwindet, senden Streams {unavailable} und schließen sich. Verbinde dich danach nicht neu.",
  npPing: "WebSockets senden alle 15 Sekunden {ping}; keine Antwort nötig.",
  npErrors:
    "Fehler: 400 ungültiger Name, 403 privat, 404 unbekannter Nutzer, 429 Rate-Limit erreicht (mit {retryAfter}).",
  npSpotify:
    "Spotify-Wiedergaben werden etwa einmal pro Minute geprüft, daher kann es so lange dauern, bis Änderungen erscheinen.",
  otherApis: "Weitere APIs",
  otherApisLb: "ListenBrainz-kompatible API",
  otherApisNp: "Now-Playing-Snapshots, SSE und WebSockets",
  methods: "Methoden",
  groupLabel: "{group}:",
  groupAuth: "Auth",
  groupTrack: "Track",
  groupArtist: "Artist",
  groupAlbum: "Album",
  groupUser: "User",
  groupTag: "Tag",
  groupChart: "Chart",
  groupListens: "Listens",
  groupFeedback: "Feedback",
  groupSocial: "Social",
  groupUserStats: "Nutzerstatistiken (GET stats/user/{user}/…)",
  groupSiteStats: "Seitenstatistiken (GET stats/sitewide/…)",
  groupListeners: "Hörer",

  helpHeading: "Hilfe zum Scrobbeln",
  helpIntro: "Sonosphere zeichnet die Musik auf, die du hörst. Wähl einfach, was zu deiner Art zu hören passt.",
  helpSpotifyOpen: "Öffne {applications}.",
  helpSpotifyFollow: "Folge dort den Spotify-Schritten, um dein Konto zu verbinden.",
  helpSpotifyPlay:
    "Hör Musik. Neue Songs erscheinen innerhalb etwa einer Minute, und auf deinem Gerät muss nichts geöffnet bleiben.",
  helpPanoServer: "Wähle in Pano die Option für einen eigenen Last.fm-kompatiblen Server (GNU FM).",
  helpPanoFields: "Fülle die drei Felder aus:",
  helpPanoApiUrl: "API-URL:",
  helpPanoUsername: "{label} dein Sonosphere-Nutzername",
  helpPanoUsernameLabel: "Nutzername:",
  helpPanoPassword: "{label} dein Sonosphere-Passwort",
  helpPanoPasswordLabel: "Passwort:",
  helpPanoLogIn: "Melde dich an. Pano erscheint unter {applications}, wo du es jederzeit trennen kannst.",
  helpPanoNote:
    "Über einen anderen Dienst registriert? Lege zuerst unter {account} ein Passwort fest. Ein API-Konto brauchst du nicht: Pano nutzt seinen eingebauten Schlüssel und sein Secret {secret}.",
  helpListenBrainz: "ListenBrainz-Apps",
  helpLbIntro:
    "Player und Scrobbler, die ListenBrainz unterstützen (multi-scrobbler, Navidrome, Jellyfin-Plugins, Pano und andere), können ihre Wiedergaben stattdessen hierher senden.",
  helpLbOpen: "Öffne {applications} und wähle {button}. Kopiere den Token: Er wird nur einmal angezeigt.",
  helpLbCreateToken: "ListenBrainz-Token erstellen",
  helpLbServer:
    "Setze in der App den ListenBrainz-Server oder die API-URL auf {origin} und füge den Token ein. Falls die App die vollständige API-Adresse will, nutze {full}.",
  helpLbPlay: "Hör Musik. Der Token erscheint unter {applications}, wo du ihn jederzeit trennen kannst.",
  helpOtherApps: "Andere Scrobbler",
  helpOtherIntro:
    "Jeder Player, der das Last.fm-2.0-Protokoll unterstützt und bei dem du den Server ändern kannst, kann hierher scrobbeln.",
  helpOtherServerUrl: "Server-URL:",
  helpOtherKey: "{label} Falls die App danach fragt, erstelle ein API-Konto unter {applications}.",
  helpOtherKeyLabel: "API-Schlüssel und Secret:",
  helpOwnScrobbler: "Du baust deinen eigenen Scrobbler oder ein Widget? Sieh dir die {docs} an.",
  helpManual: "Manuelle Scrobbles und Importe",
  helpManualAdd: "Füge Wiedergaben von Hand auf der {scrobble} hinzu.",
  helpScrobblePage: "Scrobble-Seite",
  helpManualImport: "Übernimm deinen Verlauf über {import}.",
  helpImportLink: "Hörverlauf importieren",

  changelogHeading: "Änderungsprotokoll",
  changelogManage: "Beiträge verwalten",
  changelogNew: "Neuer Beitrag",
  changelogEdit: "Bearbeiten",
  changelogEmpty: "Noch keine Beiträge im Änderungsprotokoll.",
} satisfies Translation<typeof en>;
