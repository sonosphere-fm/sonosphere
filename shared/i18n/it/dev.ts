import type en from "../en/dev";
import type { Translation } from "../core";

export default {
  applications: "Applicazioni",
  account: "Account",
  apiDocumentation: "Documentazione API",
  developers: "Sviluppatori",
  onThisPage: "In questa pagina",

  apiHeading: "API di Sonosphere",
  apiIntro:
    "L'API segue il protocollo Last.fm 2.0, quindi la maggior parte del codice per scrobbler funziona cambiando l'URL di base. Vuoi solo fare scrobble da un player? Consulta la {help}.",
  apiHelpLink: "guida allo scrobbling",
  basics: "Nozioni di base",
  rootUrl: "URL di base:",
  basicsSend:
    "Invia {method}, {apiKey} e i parametri come query string (letture) o come POST form-encoded (scritture).",
  basicsFormat: "Aggiungi {format} per avere JSON. Il formato predefinito è XML.",
  basicsKey: "Ottieni una chiave e uno shared secret in {applications}.",
  authentication: "Autenticazione",
  authWeb:
    "{label} manda l'utente a {url}. Tornerà con {token}; scambialo con {getSession} entro un'ora. Senza {cb} viene usato il callback salvato, e un {cb} fornito deve essere sullo stesso sito.",
  authWebLabel: "Web:",
  authDesktop: "{label} chiama {getToken}, manda l'utente a {url}, poi chiama {getSession}.",
  authDesktopLabel: "Desktop:",
  authScripts: "{label} fai POST di {getMobileSession} con {username} e {password}.",
  authScriptsLabel: "Script:",
  sessionKeys: "Le chiavi di sessione non scadono. Tutte e tre le chiamate sono firmate.",
  signing: "Firma",
  signingBody:
    "Ordina per nome tutti i parametri tranne {format} e {callback}, uniscili come {pair}, aggiungi in fondo il tuo secret e invia il digest MD5 esadecimale come {apiSig}.",
  examples: "Esempi",
  batch: "Gli scrobble in blocco usano parametri indicizzati ({artist}, {track}, …), fino a 50 per chiamata.",
  errors: "Errori",
  errorsBody:
    "In caso di errore viene restituito {shape}: 3 metodo non valido, 4 autenticazione non riuscita, 6 parametri non validi, 9 sessione non valida, 10 chiave API non valida, 13 firma non valida, 14 token non autorizzato.",
  lbHeading: "API di ListenBrainz",
  lbIntro:
    "L'API di ListenBrainz è servita su {root} con gli stessi percorsi, corpi delle richieste e risposte, quindi client e librerie ListenBrainz funzionano cambiando l'URL di base in {origin}.",
  lbTokens:
    "{label} gli utenti ne creano uno in {applications}. Invialo come {header}. Le letture non lo richiedono, tranne per vedere i propri ascolti privati.",
  lbTokensLabel: "Token:",
  lbErrors: "{label} {shape} con lo stato HTTP corrispondente. Le statistiche senza dati restituiscono 204.",
  lbErrorsLabel: "Errori:",
  lbRateLimit: "{label} 100 richieste ogni 10 secondi per indirizzo, indicate negli header {header}.",
  lbRateLimitLabel: "Limite di richieste:",
  lbRecordingIds:
    "{label} i valori {msid} sono propri di Sonosphere e hanno senso solo qui. Un {mbid} è noto dopo che un client l'ha inviato con un ascolto.",
  lbRecordingIdsLabel: "ID delle registrazioni:",
  lbStats: "{label} sono in tempo reale e usano UTC. Sono supportati tutti gli intervalli, da {from} a {to}.",
  lbStatsLabel: "Le statistiche",
  lbSupported: "Endpoint supportati:",
  lbUnavailable: "Playlist, consigli, radio, ricerche di metadati e dump dei dati non sono disponibili.",
  npHeading: "API pubblica «in ascolto»",
  npIntro:
    "Mostra il brano attuale di un ascoltatore su un sito web. Nessuna chiave, firma o accesso, e le richieste cross-origin sono consentite.",
  npSnapshot: "{endpoint}: una singola istantanea JSON",
  npSse: "{endpoint}: Server-Sent Events",
  npWs: "{endpoint}: WebSocket",
  npNull: "{nowPlaying} è {null} quando non c'è niente in riproduzione. {album} e {imageUrl} possono essere {null}.",
  npDuration:
    "{duration} è in secondi (0 se sconosciuta). {startedAt} è il tempo Unix dell'ultimo aggiornamento, non una posizione di riproduzione.",
  npStreams:
    "Gli stream inviano lo stato attuale alla connessione, poi un'istantanea a ogni cambiamento. Gli eventi passati non vengono ripetuti.",
  npUnavailable:
    "Se gli ascolti diventano privati o l'account viene eliminato, gli stream inviano {unavailable} e si chiudono. Dopo non riconnetterti.",
  npPing: "I WebSocket inviano {ping} ogni 15 secondi; non serve rispondere.",
  npErrors:
    "Errori: 400 nome non valido, 403 privato, 404 utente sconosciuto, 429 troppe richieste (con {retryAfter}).",
  npSpotify:
    "Gli ascolti su Spotify vengono controllati circa una volta al minuto, quindi i cambiamenti possono metterci altrettanto ad apparire.",
  otherApis: "Altre API",
  otherApisLb: "API compatibile con ListenBrainz",
  otherApisNp: "Istantanee «in ascolto», SSE e WebSocket",
  methods: "Metodi",
  groupLabel: "{group}:",
  groupAuth: "Auth",
  groupTrack: "Brano",
  groupArtist: "Artista",
  groupAlbum: "Album",
  groupUser: "Utente",
  groupTag: "Tag",
  groupChart: "Classifica",
  groupListens: "Ascolti",
  groupFeedback: "Feedback",
  groupSocial: "Social",
  groupUserStats: "Statistiche utente (GET stats/user/{user}/…)",
  groupSiteStats: "Statistiche del sito (GET stats/sitewide/…)",
  groupListeners: "Ascoltatori",

  helpHeading: "Guida allo scrobbling",
  helpIntro: "Sonosphere registra la musica che ascolti. Scegli l'opzione più adatta al tuo modo di ascoltare.",
  helpSpotifyOpen: "Apri {applications}.",
  helpSpotifyFollow: "Segui lì i passaggi per Spotify per collegare il tuo account.",
  helpSpotifyPlay:
    "Ascolta musica. I nuovi brani compaiono entro circa un minuto e non serve tenere niente aperto sul tuo dispositivo.",
  helpPanoServer: "In Pano, scegli l'opzione per un server personalizzato compatibile con Last.fm (GNU FM).",
  helpPanoFields: "Compila i tre campi:",
  helpPanoApiUrl: "URL dell'API:",
  helpPanoUsername: "{label} il tuo nome utente Sonosphere",
  helpPanoUsernameLabel: "Nome utente:",
  helpPanoPassword: "{label} la tua password Sonosphere",
  helpPanoPasswordLabel: "Password:",
  helpPanoLogIn: "Accedi. Pano compare in {applications}, dove puoi scollegarlo in qualsiasi momento.",
  helpPanoNote:
    "Ti sei iscritto tramite un altro servizio? Imposta prima una password in {account}. Non ti serve un account API: Pano usa la sua chiave e il suo secret integrati {secret}.",
  helpListenBrainz: "App per ListenBrainz",
  helpLbIntro:
    "I player e gli scrobbler che supportano ListenBrainz (multi-scrobbler, Navidrome, plugin per Jellyfin, Pano e altri) possono inviare qui i loro ascolti.",
  helpLbOpen: "Apri {applications} e scegli {button}. Copia il token: viene mostrato una sola volta.",
  helpLbCreateToken: "Crea token ListenBrainz",
  helpLbServer:
    "Nell'app, imposta il server o l'URL dell'API di ListenBrainz su {origin} e incolla il token. Se l'app vuole l'indirizzo completo dell'API, usa {full}.",
  helpLbPlay: "Ascolta musica. Il token compare in {applications}, dove puoi scollegarlo in qualsiasi momento.",
  helpOtherApps: "Altri scrobbler",
  helpOtherIntro:
    "Qualsiasi player che supporti il protocollo Last.fm 2.0 e ti permetta di cambiare server può fare scrobble qui.",
  helpOtherServerUrl: "URL del server:",
  helpOtherKey: "{label} se l'app li richiede, crea un account API in {applications}.",
  helpOtherKeyLabel: "Chiave API e secret:",
  helpOwnScrobbler: "Stai creando il tuo scrobbler o widget? Consulta la {docs}.",
  helpManual: "Scrobble manuali e importazioni",
  helpManualAdd: "Aggiungi ascolti a mano nella {scrobble}.",
  helpScrobblePage: "pagina di scrobble",
  helpManualImport: "Porta qui la tua cronologia con {import}.",
  helpImportLink: "Importa cronologia di ascolto",

  changelogHeading: "Novità",
  changelogManage: "Gestisci post",
  changelogNew: "Nuovo post",
  changelogEdit: "Modifica",
  changelogEmpty: "Ancora nessun post nelle novità.",
} satisfies Translation<typeof en>;
