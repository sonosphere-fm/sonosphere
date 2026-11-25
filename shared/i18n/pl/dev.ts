import type en from "../en/dev";
import type { Translation } from "../core";

export default {
  applications: "Aplikacje",
  account: "Konto",
  apiDocumentation: "Dokumentacja API",
  developers: "Dla deweloperów",
  onThisPage: "Na tej stronie",

  apiHeading: "API Sonosphere",
  apiIntro:
    "API działa zgodnie z protokołem Last.fm 2.0, więc większość kodu scrobblerów zadziała po zmianie głównego URL. Chcesz tylko scrobblować z odtwarzacza? Zajrzyj do {help}.",
  apiHelpLink: "pomocy ze scrobblowaniem",
  basics: "Podstawy",
  rootUrl: "Główny URL:",
  basicsSend:
    "Wysyłaj {method}, {apiKey} i parametry jako query string (odczyt) lub POST zakodowany jako formularz (zapis).",
  basicsFormat: "Dodaj {format}, aby dostać JSON. Domyślnie zwracany jest XML.",
  basicsKey: "Klucz i współdzielony sekret dostaniesz w sekcji {applications}.",
  authentication: "Uwierzytelnianie",
  authWeb:
    "{label} przekieruj użytkownika na {url}. Wróci z {token}; wymień go przez {getSession} w ciągu godziny. Bez {cb} używany jest zapisany callback, a podany {cb} musi być w tej samej witrynie.",
  authWebLabel: "WWW:",
  authDesktop: "{label} wywołaj {getToken}, przekieruj użytkownika na {url}, a potem wywołaj {getSession}.",
  authDesktopLabel: "Komputer stacjonarny:",
  authScripts: "{label} wyślij POST {getMobileSession} z {username} i {password}.",
  authScriptsLabel: "Skrypty:",
  sessionKeys: "Klucze sesji nie wygasają. Wszystkie trzy wywołania są podpisywane.",
  signing: "Podpisywanie",
  signingBody:
    "Posortuj wszystkie parametry oprócz {format} i {callback} według nazwy, połącz je jako {pair}, dopisz swój sekret i wyślij skrót MD5 (hex) jako {apiSig}.",
  examples: "Przykłady",
  batch: "Scrobble wsadowe używają indeksowanych parametrów ({artist}, {track}, …), do 50 na wywołanie.",
  errors: "Błędy",
  errorsBody:
    "Błędy zwracają {shape}: 3 nieprawidłowa metoda, 4 nieudane uwierzytelnienie, 6 nieprawidłowe parametry, 9 nieprawidłowa sesja, 10 nieprawidłowy klucz API, 13 nieprawidłowy podpis, 14 nieautoryzowany token.",
  lbHeading: "API ListenBrainz",
  lbIntro:
    "API ListenBrainz jest dostępne pod {root} z tymi samymi ścieżkami, treściami żądań i odpowiedziami, więc klienty i biblioteki ListenBrainz działają po zmianie głównego URL na {origin}.",
  lbTokens:
    "{label} użytkownicy tworzą je w sekcji {applications}. Wysyłaj jako {header}. Odczyt go nie wymaga, chyba że chcesz zobaczyć własne prywatne słuchanie.",
  lbTokensLabel: "Tokeny:",
  lbErrors: "{label} {shape} z odpowiednim statusem HTTP. Statystyki bez danych zwracają 204.",
  lbErrorsLabel: "Błędy:",
  lbRateLimit: "{label} 100 żądań na 10 sekund na adres, podawane w nagłówkach {header}.",
  lbRateLimitLabel: "Limit żądań:",
  lbRecordingIds:
    "{label} wartości {msid} są własne dla Sonosphere i mają znaczenie tylko tutaj. {mbid} jest znany, gdy klient wyśle go z odsłuchaniem.",
  lbRecordingIdsLabel: "ID nagrań:",
  lbStats: "{label} są na żywo i używają UTC. Obsługiwane są wszystkie zakresy, od {from} do {to}.",
  lbStatsLabel: "Statystyki",
  lbSupported: "Obsługiwane endpointy:",
  lbUnavailable: "Playlisty, rekomendacje, radio, wyszukiwanie metadanych i zrzuty danych nie są dostępne.",
  npHeading: "Publiczne API „teraz gra”",
  npIntro:
    "Pokaż aktualny utwór słuchacza na stronie WWW. Bez klucza, podpisu i logowania, a żądania cross-origin są dozwolone.",
  npSnapshot: "{endpoint}: jeden snapshot JSON",
  npSse: "{endpoint}: Zdarzenia wysyłane przez serwer",
  npWs: "{endpoint}: WebSocket",
  npNull: "{nowPlaying} ma wartość {null}, gdy nic nie gra. {album} i {imageUrl} mogą mieć wartość {null}.",
  npDuration:
    "{duration} jest w sekundach (0, jeśli nieznane). {startedAt} to czas Unix ostatniej aktualizacji, a nie pozycja odtwarzania.",
  npStreams:
    "Strumienie wysyłają bieżący stan po połączeniu, a potem snapshot przy każdej zmianie. Wcześniejsze zdarzenia nie są odtwarzane.",
  npUnavailable:
    "Jeśli słuchanie stanie się prywatne lub konto zniknie, strumienie wysyłają {unavailable} i się zamykają. Nie łącz się wtedy ponownie.",
  npPing: "WebSockety wysyłają {ping} co 15 sekund; odpowiedź nie jest potrzebna.",
  npErrors: "Błędy: 400 zła nazwa, 403 prywatne, 404 nieznany użytkownik, 429 limit żądań (z {retryAfter}).",
  npSpotify:
    "Słuchanie w Spotify jest sprawdzane mniej więcej raz na minutę, więc zmiany mogą się pojawiać z takim opóźnieniem.",
  otherApis: "Inne API",
  otherApisLb: "API zgodne z ListenBrainz",
  otherApisNp: "Snapshoty „teraz gra”, SSE i WebSockety",
  methods: "Metody",
  groupLabel: "{group}:",
  groupAuth: "Uwierzytelnianie",
  groupTrack: "Utwór",
  groupArtist: "Wykonawca",
  groupAlbum: "Album",
  groupUser: "Użytkownik",
  groupTag: "Etykieta",
  groupChart: "Listy",
  groupListens: "Odsłuchania",
  groupFeedback: "Opinie",
  groupSocial: "Społeczność",
  groupUserStats: "Statystyki użytkownika (GET stats/user/{user}/…)",
  groupSiteStats: "Statystyki serwisu (GET stats/sitewide/…)",
  groupListeners: "Słuchacze",

  helpHeading: "Pomoc ze scrobblowaniem",
  helpIntro: "Sonosphere zapisuje muzykę, której słuchasz. Wybierz sposób, który pasuje do tego, jak słuchasz.",
  helpSpotifyOpen: "Otwórz {applications}.",
  helpSpotifyFollow: "Wykonaj tam kroki dla Spotify, aby połączyć konto.",
  helpSpotifyPlay:
    "Słuchaj muzyki. Nowe utwory pojawiają się w ciągu mniej więcej minuty i nic nie musi być otwarte na Twoim urządzeniu.",
  helpPanoServer: "W Pano wybierz opcję własnego serwera zgodnego z Last.fm (GNU FM).",
  helpPanoFields: "Wypełnij trzy pola:",
  helpPanoApiUrl: "URL API:",
  helpPanoUsername: "{label} Twoja nazwa użytkownika w Sonosphere",
  helpPanoUsernameLabel: "Nazwa użytkownika:",
  helpPanoPassword: "{label} Twoje hasło w Sonosphere",
  helpPanoPasswordLabel: "Hasło:",
  helpPanoLogIn: "Zaloguj się. Pano pojawi się w sekcji {applications}, gdzie możesz je w każdej chwili rozłączyć.",
  helpPanoNote:
    "Konto założone przez inny serwis? Najpierw ustaw hasło w sekcji {account}. Konto API nie jest potrzebne: Pano używa wbudowanego klucza i sekretu {secret}.",
  helpListenBrainz: "Aplikacje ListenBrainz",
  helpLbIntro:
    "Odtwarzacze i scrobblery obsługujące ListenBrainz (multi-scrobbler, Navidrome, wtyczki Jellyfin, Pano i inne) mogą zamiast tego wysyłać odtworzenia tutaj.",
  helpLbOpen: "Otwórz {applications} i wybierz {button}. Skopiuj token: jest pokazywany tylko raz.",
  helpLbCreateToken: "Utwórz token ListenBrainz",
  helpLbServer:
    "W aplikacji ustaw serwer lub URL API ListenBrainz na {origin} i wklej token. Jeśli aplikacja chce pełnego adresu API, użyj {full}.",
  helpLbPlay: "Słuchaj muzyki. Token pojawi się w sekcji {applications}, gdzie możesz go w każdej chwili rozłączyć.",
  helpNavidromeConfig:
    "W konfiguracji Navidrome ustaw {option} (lub zmienną środowiskową {env}) na {url}, a potem uruchom Navidrome ponownie.",
  helpNavidromeLink: "W Navidrome otwórz ustawienia osobiste, włącz scrobblowanie do ListenBrainz i wklej token.",
  helpNavidromeNote:
    "Bazowy URL dotyczy całego serwera Navidrome: każdy, kto włączy scrobblowanie do ListenBrainz, wysyła odtworzenia tutaj, każdy z własnym tokenem.",
  helpJellyfinRepo: "W panelu Jellyfin otwórz Wtyczki, potem kartę Repozytoria, i dodaj {repo}.",
  helpJellyfinInstall: "Zainstaluj wtyczkę ListenBrainz z katalogu i uruchom Jellyfin ponownie.",
  helpJellyfinUrl: "W ustawieniach wtyczki, na karcie General, ustaw {setting} na {url} i zapisz.",
  helpJellyfinUser:
    "Na karcie User Config wybierz swojego użytkownika, wklej token w {field}, zaznacz {enable} i zapisz.",
  helpPlexIntro: "Plex nie umie sam wysyłać odtworzeń na inny serwer, więc uruchom obok {app}, który je przekaże.",
  helpPlexSource: "Dodaj Plex jako źródło: ustaw {url} na adres swojego serwera Plex, a {token} na swój token Plex.",
  helpPlexClient:
    "Dodaj klienta ListenBrainz: ustaw {url} na {origin}, {token} na swój token, a {user} na swoją nazwę użytkownika Sonosphere.",
  helpPlexPlay: "Uruchom ponownie multi-scrobbler i odtwórz coś w Plex.",
  helpWebScrobblerIntro: "Web Scrobbler to rozszerzenie przeglądarki, które scrobbluje z serwisów muzycznych.",
  helpWebScrobblerEdit: "W opcjach Web Scrobbler znajdź ListenBrainz wśród kont i edytuj jego właściwości.",
  helpWebScrobblerFields: "Ustaw adres API na {url}, a token użytkownika na swój token, i zapisz.",
  helpOtherApps: "Inne scrobblery",
  helpOtherIntro:
    "Każdy odtwarzacz, który obsługuje protokół Last.fm 2.0 i pozwala zmienić serwer, może tu scrobblować.",
  helpOtherServerUrl: "URL serwera:",
  helpOtherKey: "{label} jeśli aplikacja o nie prosi, utwórz konto API w sekcji {applications}.",
  helpOtherKeyLabel: "Klucz API i sekret:",
  helpOwnScrobbler: "Tworzysz własny scrobbler lub widżet? Zobacz: {docs}.",
  helpManual: "Ręczne scrobble i importy",
  helpManualAdd: "Dodawaj odtworzenia ręcznie na {scrobble}.",
  helpScrobblePage: "stronie scrobblowania",
  helpManualImport: "Przenieś swoją historię przez {import}.",
  helpImportLink: "Import historii słuchania",

  changelogHeading: "Lista zmian",
  changelogManage: "Zarządzaj wpisami",
  changelogNew: "Nowy wpis",
  changelogEdit: "Edytuj",
  changelogEmpty: "Brak wpisów na liście zmian.",
} satisfies Translation<typeof en>;
