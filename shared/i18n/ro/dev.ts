import type en from "../en/dev";
import type { Translation } from "../core";

export default {
  applications: "Aplicații",
  account: "Cont",
  apiDocumentation: "Documentație API",
  developers: "Dezvoltatori",
  onThisPage: "Pe această pagină",

  apiHeading: "API-ul Sonosphere",
  apiIntro:
    "API-ul urmează protocolul Last.fm 2.0, așa că majoritatea codului de scrobble funcționează schimbând doar URL-ul de bază. Vrei doar să faci scrobble dintr-un player? Vezi {help}.",
  apiHelpLink: "ghidul de scrobble",
  basics: "Noțiuni de bază",
  rootUrl: "URL de bază:",
  basicsSend: "Trimite {method}, {apiKey} și parametrii ca query string (citiri) sau ca POST form-encoded (scrieri).",
  basicsFormat: "Adaugă {format} pentru JSON. XML este implicit.",
  basicsKey: "Obține o cheie și un secret partajat la {applications}.",
  authentication: "Autentificare",
  authWeb:
    "{label} trimite utilizatorul la {url}. Se întoarce cu {token}; schimbă-l cu {getSession} în decurs de o oră. Fără {cb} se folosește callbackul salvat, iar un {cb} dat trebuie să fie pe același site.",
  authWebLabel: "Site web:",
  authDesktop: "{label} apelează {getToken}, trimite utilizatorul la {url}, apoi apelează {getSession}.",
  authDesktopLabel: "Desktop:",
  authScripts: "{label} POST {getMobileSession} cu {username} și {password}.",
  authScriptsLabel: "Scripturi:",
  sessionKeys: "Cheile de sesiune nu expiră. Toate cele trei apeluri sunt semnate.",
  signing: "Semnare",
  signingBody:
    "Sortează după nume toți parametrii, cu excepția {format} și {callback}, unește-i ca {pair}, adaugă secretul la final și trimite digestul MD5 în hex ca {apiSig}.",
  examples: "Exemple",
  batch: "Scrobble-urile în lot folosesc parametri indexați ({artist}, {track}, …), până la 50 per apel.",
  errors: "Erori",
  errorsBody:
    "Eșecurile returnează {shape}: 3 metodă invalidă, 4 autentificare eșuată, 6 parametri invalizi, 9 sesiune invalidă, 10 cheie API invalidă, 13 semnătură invalidă, 14 token neautorizat.",
  lbHeading: "API-ul ListenBrainz",
  lbIntro:
    "API-ul ListenBrainz este servit la {root} cu aceleași căi, corpuri de cerere și răspunsuri, așa că clienții și bibliotecile ListenBrainz funcționează schimbând URL-ul de bază în {origin}.",
  lbTokens:
    "{label} utilizatorii își creează unul la {applications}. Trimite-l ca {header}. Citirile nu au nevoie de el, cu excepția ascultărilor tale private.",
  lbTokensLabel: "Tokenuri:",
  lbErrors: "{label} {shape} cu statusul HTTP corespunzător. Statisticile fără date returnează 204.",
  lbErrorsLabel: "Erori:",
  lbRateLimit: "{label} 100 de cereri la 10 secunde per adresă, raportate în headerele {header}.",
  lbRateLimitLabel: "Limită de cereri:",
  lbRecordingIds:
    "{label} valorile {msid} sunt proprii Sonosphere și au sens doar aici. Un {mbid} este cunoscut după ce un client l-a trimis împreună cu o ascultare.",
  lbRecordingIdsLabel: "ID-uri de înregistrări:",
  lbStats: "{label} sunt live și folosesc UTC. Toate intervalele sunt acceptate, de la {from} la {to}.",
  lbStatsLabel: "Statisticile",
  lbSupported: "Endpointuri acceptate:",
  lbUnavailable:
    "Playlisturile, recomandările, radioul, căutările de metadate și dumpurile de date nu sunt disponibile.",
  npHeading: "API public „ascultă acum”",
  npIntro:
    "Afișează pe un site piesa pe care o ascultă cineva acum. Fără cheie, semnătură sau autentificare, iar cererile cross-origin sunt permise.",
  npSnapshot: "{endpoint}: un singur snapshot JSON",
  npSse: "{endpoint}: Evenimente trimise de server",
  npWs: "{endpoint}: WebSocket",
  npNull: "{nowPlaying} este {null} când nu se ascultă nimic. {album} și {imageUrl} pot fi {null}.",
  npDuration:
    "{duration} este în secunde (0 dacă e necunoscută). {startedAt} este ora Unix a ultimei actualizări, nu o poziție de redare.",
  npStreams:
    "Streamurile trimit starea curentă la conectare, apoi un snapshot la fiecare schimbare. Evenimentele trecute nu sunt retrimise.",
  npUnavailable:
    "Dacă ascultările devin private sau contul dispare, streamurile trimit {unavailable} și se închid. Nu te reconecta după aceea.",
  npPing: "WebSocketurile trimit {ping} la fiecare 15 secunde; nu e nevoie de răspuns.",
  npErrors:
    "Erori: 400 nume greșit, 403 privat, 404 utilizator necunoscut, 429 limită de cereri depășită (cu {retryAfter}).",
  npSpotify:
    "Ascultările de pe Spotify sunt verificate cam o dată pe minut, așa că schimbările pot apărea cu întârziere.",
  otherApis: "Alte API-uri",
  otherApisLb: "API compatibil ListenBrainz",
  otherApisNp: "Snapshoturi „ascultă acum”, SSE și WebSocketuri",
  methods: "Metode",
  groupLabel: "{group}:",
  groupAuth: "Autentificare",
  groupTrack: "Piesă",
  groupArtist: "Artist",
  groupAlbum: "Album",
  groupUser: "Utilizator",
  groupTag: "Etichetă",
  groupChart: "Top",
  groupListens: "Ascultări",
  groupFeedback: "Comentarii",
  groupSocial: "Social",
  groupUserStats: "Statistici utilizator (GET stats/user/{user}/…)",
  groupSiteStats: "Statistici site (GET stats/sitewide/…)",
  groupListeners: "Ascultători",

  helpHeading: "Ajutor pentru scrobble",
  helpIntro:
    "Sonosphere înregistrează muzica pe care o asculți. Alege varianta care se potrivește felului în care asculți.",
  helpSpotifyOpen: "Deschide {applications}.",
  helpSpotifyFollow: "Urmează pașii pentru Spotify de acolo ca să-ți conectezi contul.",
  helpSpotifyPlay:
    "Ascultă muzică. Piesele noi apar în aproximativ un minut și nu trebuie să rămână nimic deschis pe dispozitivul tău.",
  helpPanoServer: "În Pano, alege opțiunea de server personalizat compatibil Last.fm (GNU FM).",
  helpPanoFields: "Completează cele trei câmpuri:",
  helpPanoApiUrl: "URL API:",
  helpPanoUsername: "{label} numele tău de utilizator Sonosphere",
  helpPanoUsernameLabel: "Nume de utilizator:",
  helpPanoPassword: "{label} parola ta Sonosphere",
  helpPanoPasswordLabel: "Parolă:",
  helpPanoLogIn: "Autentifică-te. Pano apare la {applications}, de unde îl poți deconecta oricând.",
  helpPanoNote:
    "Te-ai înscris prin alt serviciu? Setează mai întâi o parolă în {account}. Nu ai nevoie de un cont API: Pano folosește cheia și secretul integrate {secret}.",
  helpListenBrainz: "Aplicații ListenBrainz",
  helpLbIntro:
    "Playerele și aplicațiile de scrobble care acceptă ListenBrainz (multi-scrobbler, Navidrome, pluginuri Jellyfin, Pano și altele) pot trimite ascultările aici.",
  helpLbOpen: "Deschide {applications} și alege {button}. Copiază tokenul: este afișat o singură dată.",
  helpLbCreateToken: "Creează token ListenBrainz",
  helpLbServer:
    "În aplicație, setează serverul sau URL-ul API ListenBrainz la {origin} și lipește tokenul. Dacă aplicația cere adresa API completă, folosește {full}.",
  helpLbPlay: "Ascultă muzică. Tokenul apare la {applications}, de unde îl poți deconecta oricând.",
  helpNavidromeConfig:
    "În configurația Navidrome, setează {option} (sau variabila de mediu {env}) la {url}, apoi repornește Navidrome.",
  helpNavidromeLink:
    "În Navidrome, deschide setările personale, activează scrobbling-ul către ListenBrainz și lipește tokenul.",
  helpNavidromeNote:
    "URL-ul de bază se aplică întregului server Navidrome: oricine activează scrobbling-ul către ListenBrainz își trimite ascultările aici, fiecare cu tokenul propriu.",
  helpJellyfinRepo: "În panoul Jellyfin, deschide Plugins, apoi fila Repositories, și adaugă {repo}.",
  helpJellyfinInstall: "Instalează pluginul ListenBrainz din catalog și repornește Jellyfin.",
  helpJellyfinUrl: "În setările pluginului, în fila General, setează {setting} la {url} și salvează.",
  helpJellyfinUser:
    "În fila User Config, alege utilizatorul tău, lipește tokenul în {field}, bifează {enable} și salvează.",
  helpPlexIntro:
    "Plex nu poate trimite singur ascultările către alt server, așa că rulează {app} alături ca să le transmită.",
  helpPlexSource: "Adaugă Plex ca sursă: setează {url} la adresa serverului tău Plex și {token} la tokenul tău Plex.",
  helpPlexClient:
    "Adaugă un client ListenBrainz: setează {url} la {origin}, {token} la tokenul tău și {user} la numele tău de utilizator Sonosphere.",
  helpPlexPlay: "Repornește multi-scrobbler și redă ceva în Plex.",
  helpWebScrobblerIntro: "Web Scrobbler este o extensie de browser care face scrobbling de pe site-uri de muzică.",
  helpWebScrobblerEdit: "În opțiunile Web Scrobbler, găsește ListenBrainz printre conturi și editează-i proprietățile.",
  helpWebScrobblerFields: "Setează URL-ul API la {url} și tokenul de utilizator la tokenul tău, apoi salvează.",
  helpOtherApps: "Alte aplicații de scrobble",
  helpOtherIntro:
    "Orice player care acceptă protocolul Last.fm 2.0 și îți permite să-i schimbi serverul poate face scrobble aici.",
  helpOtherServerUrl: "URL server:",
  helpOtherKey: "{label} dacă aplicația le cere, creează un cont API la {applications}.",
  helpOtherKeyLabel: "Cheie și secret API:",
  helpOwnScrobbler: "Îți construiești propria aplicație de scrobble sau un widget? Vezi {docs}.",
  helpManual: "Scrobble manual și importuri",
  helpManualAdd: "Adaugă ascultări de mână pe {scrobble}.",
  helpScrobblePage: "pagina de scrobble",
  helpManualImport: "Adu-ți istoricul folosind {import}.",
  helpImportLink: "Importă istoricul ascultărilor",

  changelogHeading: "Noutăți",
  changelogManage: "Gestionează postările",
  changelogNew: "Postare nouă",
  changelogEdit: "Editează",
  changelogEmpty: "Încă nu există postări cu noutăți.",
} satisfies Translation<typeof en>;
