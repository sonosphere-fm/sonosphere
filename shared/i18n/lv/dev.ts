import type en from "../en/dev";
import type { Translation } from "../core";

export default {
  applications: "Lietotnes",
  account: "Konts",
  apiDocumentation: "API dokumentācija",
  developers: "Izstrādātājiem",
  onThisPage: "Šajā lapā",

  apiHeading: "Sonosphere API",
  apiIntro:
    "API atbilst Last.fm 2.0 protokolam, tāpēc lielākā daļa skrobleru koda darbojas, nomainot saknes URL. Vienkārši gribi skroblēt no atskaņotāja? Skati {help}.",
  apiHelpLink: "palīdzību skroblēšanā",
  basics: "Pamati",
  rootUrl: "Saknes URL:",
  basicsSend:
    "Sūti {method}, {apiKey} un parametrus kā vaicājuma virkni (lasīšanai) vai formas kodētu POST (rakstīšanai).",
  basicsFormat: "Pievieno {format}, lai saņemtu JSON. Pēc noklusējuma tiek izmantots XML.",
  basicsKey: "Atslēgu un koplietoto noslēpumu vari saņemt sadaļā {applications}.",
  authentication: "Autentifikācija",
  authWeb:
    "{label} novirzi lietotāju uz {url}. Viņš atgriezīsies ar {token}; stundas laikā apmaini to ar {getSession}. Bez {cb} tiek izmantots tavs saglabātais atzvana URL, un norādītajam {cb} jābūt tajā pašā vietnē.",
  authWebLabel: "Tīmeklis:",
  authDesktop: "{label} izsauc {getToken}, novirzi lietotāju uz {url}, pēc tam izsauc {getSession}.",
  authDesktopLabel: "Darbvirsma:",
  authScripts: "{label} sūti POST uz {getMobileSession} ar {username} un {password}.",
  authScriptsLabel: "Skripti:",
  sessionKeys: "Sesijas atslēgām nav derīguma termiņa. Visi trīs izsaukumi ir parakstīti.",
  signing: "Parakstīšana",
  signingBody:
    "Sakārto visus parametrus, izņemot {format} un {callback}, pēc nosaukuma, savieno tos kā {pair}, pievieno savu noslēpumu un sūti MD5 heksadecimālo jaucējvērtību kā {apiSig}.",
  examples: "Piemēri",
  batch: "Skrobļu paketes izmanto indeksētus parametrus ({artist}, {track}, …), līdz 50 vienā izsaukumā.",
  errors: "Kļūdas",
  errorsBody:
    "Kļūdas gadījumā atgriež {shape}: 3 nederīga metode, 4 autentifikācija neizdevās, 6 nederīgi parametri, 9 nederīga sesija, 10 nederīga API atslēga, 13 nederīgs paraksts, 14 neautorizēts žetons.",
  lbHeading: "ListenBrainz API",
  lbIntro:
    "ListenBrainz API ir pieejams adresē {root} ar tiem pašiem ceļiem, pieprasījumu saturu un atbildēm, tāpēc ListenBrainz klienti un bibliotēkas darbojas, nomainot saknes URL uz {origin}.",
  lbTokens:
    "{label} lietotāji tos izveido sadaļā {applications}. Sūti to kā {header}. Lasīšanai tas nav vajadzīgs, izņemot, lai redzētu savu privāto klausīšanos.",
  lbTokensLabel: "Žetoni:",
  lbErrors: "{label} {shape} ar atbilstošu HTTP statusu. Statistika bez datiem atgriež 204.",
  lbErrorsLabel: "Kļūdas:",
  lbRateLimit: "{label} 100 pieprasījumi 10 sekundēs no vienas adreses, norādīti {header} galvenēs.",
  lbRateLimitLabel: "Pieprasījumu limits:",
  lbRecordingIds:
    "{label} {msid} vērtības ir Sonosphere pašu un ir jēgpilnas tikai šeit. {mbid} kļūst zināms, kad klients to ir nosūtījis kopā ar noklausīšanos.",
  lbRecordingIdsLabel: "Ierakstu ID:",
  lbStats: "{label} ir reāllaika un izmanto UTC. Tiek atbalstīti visi diapazoni no {from} līdz {to}.",
  lbStatsLabel: "Statistika",
  lbSupported: "Atbalstītie galapunkti:",
  lbUnavailable: "Atskaņošanas saraksti, ieteikumi, radio, metadatu meklēšana un datu izgāztuves nav pieejami.",
  npHeading: "Publiskais „tagad skan” API",
  npIntro:
    "Parādi klausītāja pašreizējo dziesmu tīmekļa vietnē. Bez atslēgas, paraksta vai pieteikšanās, un starpdomēnu pieprasījumi ir atļauti.",
  npSnapshot: "{endpoint}: viens JSON momentuzņēmums",
  npSse: "{endpoint}: Servera nosūtītie notikumi",
  npWs: "{endpoint}: WebSocket",
  npNull: "{nowPlaying} ir {null}, ja nekas neskan. {album} un {imageUrl} var būt {null}.",
  npDuration:
    "{duration} ir sekundēs (0, ja nav zināms). {startedAt} ir pēdējās atjaunināšanas Unix laiks, nevis atskaņošanas pozīcija.",
  npStreams:
    "Straumes pieslēdzoties nosūta pašreizējo stāvokli, pēc tam momentuzņēmumu pie katras izmaiņas. Pagātnes notikumi netiek atkārtoti.",
  npUnavailable:
    "Ja klausīšanās kļūst privāta vai konts tiek dzēsts, straumes nosūta {unavailable} un aizveras. Pēc tam nepieslēdzies atkārtoti.",
  npPing: "WebSocket ik pēc 15 sekundēm sūta {ping}; atbilde nav vajadzīga.",
  npErrors: "Kļūdas: 400 nederīgs vārds, 403 privāts, 404 nezināms lietotājs, 429 pārsniegts limits (ar {retryAfter}).",
  npSpotify:
    "Spotify klausīšanās tiek pārbaudīta aptuveni reizi minūtē, tāpēc izmaiņas var parādīties ar tādu aizkavi.",
  otherApis: "Citi API",
  otherApisLb: "Ar ListenBrainz saderīgs API",
  otherApisNp: "„Tagad skan” momentuzņēmumi, SSE un WebSocket",
  methods: "Metodes",
  groupLabel: "{group}:",
  groupAuth: "Autentifikācija",
  groupTrack: "Dziesma",
  groupArtist: "Izpildītājs",
  groupAlbum: "Albums",
  groupUser: "Lietotājs",
  groupTag: "Birka",
  groupChart: "Tops",
  groupListens: "Noklausīšanās",
  groupFeedback: "Atsauksmes",
  groupSocial: "Sociālais",
  groupUserStats: "Lietotāja statistika (GET stats/user/{user}/…)",
  groupSiteStats: "Vietnes statistika (GET stats/sitewide/…)",
  groupListeners: "Klausītāji",

  helpHeading: "Palīdzība skroblēšanā",
  helpIntro: "Sonosphere reģistrē mūziku, ko klausies. Izvēlies to, kas atbilst tam, kā tu klausies.",
  helpSpotifyOpen: "Atver {applications}.",
  helpSpotifyFollow: "Izpildi tur norādītos Spotify soļus, lai savienotu savu kontu.",
  helpSpotifyPlay:
    "Klausies mūziku. Jaunas dziesmas parādās aptuveni minūtes laikā, un ierīcē nekam nav jābūt atvērtam.",
  helpPanoServer: "Pano izvēlies pielāgota ar Last.fm saderīga (GNU FM) servera opciju.",
  helpPanoFields: "Aizpildi trīs laukus:",
  helpPanoApiUrl: "API URL:",
  helpPanoUsername: "{label} tavs Sonosphere lietotājvārds",
  helpPanoUsernameLabel: "Lietotājvārds:",
  helpPanoPassword: "{label} tava Sonosphere parole",
  helpPanoPasswordLabel: "Parole:",
  helpPanoLogIn: "Piesakies. Pano parādīsies sadaļā {applications}, kur to jebkurā laikā vari atvienot.",
  helpPanoNote:
    "Reģistrējies caur citu pakalpojumu? Vispirms iestati paroli sadaļā {account}. API konts nav vajadzīgs: Pano izmanto savu iebūvēto atslēgu un noslēpumu {secret}.",
  helpListenBrainz: "ListenBrainz lietotnes",
  helpLbIntro:
    "Atskaņotāji un skrobleri, kas atbalsta ListenBrainz (multi-scrobbler, Navidrome, Jellyfin spraudņi, Pano un citi), var sūtīt atskaņojumus arī šeit.",
  helpLbOpen: "Atver {applications} un izvēlies {button}. Nokopē žetonu: tas tiek parādīts tikai vienu reizi.",
  helpLbCreateToken: "Izveidot ListenBrainz žetonu",
  helpLbServer:
    "Lietotnē iestati ListenBrainz servera vai API URL uz {origin} un ielīmē žetonu. Ja lietotne prasa pilnu API adresi, izmanto {full}.",
  helpLbPlay: "Klausies mūziku. Žetons parādīsies sadaļā {applications}, kur to jebkurā laikā vari atvienot.",
  helpNavidromeConfig:
    "Navidrome konfigurācijā iestatiet {option} (vai vides mainīgo {env}) uz {url} un restartējiet Navidrome.",
  helpNavidromeLink:
    "Navidrome atveriet personiskos iestatījumus, ieslēdziet skroblēšanu uz ListenBrainz un ielīmējiet žetonu.",
  helpNavidromeNote:
    "Bāzes URL attiecas uz visu Navidrome serveri: ikviens, kas ieslēdz skroblēšanu uz ListenBrainz, sūta atskaņojumus šeit, katrs ar savu žetonu.",
  helpJellyfinRepo: "Jellyfin vadības panelī atveriet Plugins, tad cilni Repositories, un pievienojiet {repo}.",
  helpJellyfinInstall: "Instalējiet ListenBrainz spraudni no kataloga un restartējiet Jellyfin.",
  helpJellyfinUrl: "Spraudņa iestatījumu cilnē General iestatiet {setting} uz {url} un saglabājiet.",
  helpJellyfinUser:
    "Cilnē User Config izvēlieties savu lietotāju, ielīmējiet žetonu laukā {field}, atzīmējiet {enable} un saglabājiet.",
  helpPlexIntro: "Plex pats nevar sūtīt atskaņojumus uz citu serveri, tāpēc palaidiet blakus {app}, kas tos pārsūtīs.",
  helpPlexSource:
    "Pievienojiet Plex kā avotu: iestatiet {url} uz sava Plex servera adresi un {token} uz savu Plex žetonu.",
  helpPlexClient:
    "Pievienojiet ListenBrainz klientu: iestatiet {url} uz {origin}, {token} uz savu žetonu un {user} uz savu Sonosphere lietotājvārdu.",
  helpPlexPlay: "Restartējiet multi-scrobbler un atskaņojiet kaut ko Plex.",
  helpWebScrobblerIntro: "Web Scrobbler ir pārlūka paplašinājums, kas skroblē no mūzikas vietnēm.",
  helpWebScrobblerEdit: "Web Scrobbler opcijās kontu sarakstā atrodiet ListenBrainz un rediģējiet tā rekvizītus.",
  helpWebScrobblerFields: "Iestatiet API URL uz {url} un lietotāja žetonu uz savu žetonu, tad saglabājiet.",
  helpOtherApps: "Citi skrobleri",
  helpOtherIntro: "Jebkurš atskaņotājs, kas atbalsta Last.fm 2.0 protokolu un ļauj mainīt serveri, var skroblēt šeit.",
  helpOtherServerUrl: "Servera URL:",
  helpOtherKey: "{label} ja lietotne tos prasa, izveido API kontu sadaļā {applications}.",
  helpOtherKeyLabel: "API atslēga un noslēpums:",
  helpOwnScrobbler: "Veido savu skrobleru vai logrīku? Skati {docs}.",
  helpManual: "Manuāla skroblēšana un imports",
  helpManualAdd: "Pievieno atskaņojumus manuāli {scrobble}.",
  helpScrobblePage: "skroblēšanas lapā",
  helpManualImport: "Pārnes savu vēsturi, izmantojot {import}.",
  helpImportLink: "Klausīšanās vēstures importu",

  changelogHeading: "Izmaiņu žurnāls",
  changelogManage: "Pārvaldīt ierakstus",
  changelogNew: "Jauns ieraksts",
  changelogEdit: "Rediģēt",
  changelogEmpty: "Izmaiņu žurnālā vēl nav ierakstu.",
} satisfies Translation<typeof en>;
