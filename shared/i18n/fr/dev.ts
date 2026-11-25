import type en from "../en/dev";
import type { Translation } from "../core";

export default {
  applications: "Applications",
  account: "Compte",
  apiDocumentation: "Documentation de l'API",
  developers: "Développeurs",
  onThisPage: "Sur cette page",

  apiHeading: "API Sonosphere",
  apiIntro:
    "L'API suit le protocole Last.fm 2.0 : la plupart du code de scrobbling fonctionne en changeant simplement l'URL racine. Tu veux juste scrobbler depuis un lecteur ? Consulte l'{help}.",
  apiHelpLink: "aide au scrobbling",
  basics: "Bases",
  rootUrl: "URL racine :",
  basicsSend:
    "Envoie {method}, {apiKey} et les paramètres en query string (lectures) ou en POST form-encoded (écritures).",
  basicsFormat: "Ajoute {format} pour du JSON. Le XML est le format par défaut.",
  basicsKey: "Obtiens une clé et un secret partagé dans {applications}.",
  authentication: "Authentification",
  authWeb:
    "{label} envoie l'utilisateur vers {url}. Il revient avec {token} ; échange-le avec {getSession} dans l'heure. Sans {cb}, ton callback enregistré est utilisé, et un {cb} fourni doit être sur le même site.",
  authWebLabel: "Web :",
  authDesktop: "{label} appelle {getToken}, envoie l'utilisateur vers {url}, puis appelle {getSession}.",
  authDesktopLabel: "Bureau :",
  authScripts: "{label} envoie un POST {getMobileSession} avec {username} et {password}.",
  authScriptsLabel: "Scripts :",
  sessionKeys: "Les clés de session n'expirent pas. Les trois appels sont signés.",
  signing: "Signature",
  signingBody:
    "Trie tous les paramètres sauf {format} et {callback} par nom, joins-les sous la forme {pair}, ajoute ton secret à la fin et envoie l'empreinte MD5 en hexadécimal comme {apiSig}.",
  examples: "Exemples",
  batch: "Les scrobbles groupés utilisent des paramètres indexés ({artist}, {track}, …), jusqu'à 50 par appel.",
  errors: "Erreurs",
  errorsBody:
    "Les échecs renvoient {shape} : 3 méthode invalide, 4 échec d'authentification, 6 paramètres invalides, 9 session invalide, 10 clé d'API invalide, 13 signature invalide, 14 jeton non autorisé.",
  lbHeading: "API ListenBrainz",
  lbIntro:
    "L'API ListenBrainz est servie sur {root} avec les mêmes chemins, corps de requête et réponses : les clients et bibliothèques ListenBrainz fonctionnent en changeant l'URL racine pour {origin}.",
  lbTokens:
    "{label} les utilisateurs en créent un dans {applications}. Envoie-le dans {header}. Les lectures n'en ont pas besoin, sauf pour voir tes propres écoutes privées.",
  lbTokensLabel: "Jetons :",
  lbErrors: "{label} {shape} avec le statut HTTP correspondant. Les stats sans données renvoient 204.",
  lbErrorsLabel: "Erreurs :",
  lbRateLimit: "{label} 100 requêtes par tranche de 10 secondes par adresse, indiquées dans les en-têtes {header}.",
  lbRateLimitLabel: "Limite de débit :",
  lbRecordingIds:
    "{label} les valeurs {msid} sont propres à Sonosphere et n'ont de sens qu'ici. Un {mbid} est connu dès qu'un client l'a envoyé avec une écoute.",
  lbRecordingIdsLabel: "Identifiants d'enregistrement :",
  lbStats: "Les {label} sont en temps réel et en UTC. Toutes les plages sont prises en charge, de {from} à {to}.",
  lbStatsLabel: "stats",
  lbSupported: "Points d'accès pris en charge :",
  lbUnavailable:
    "Les playlists, recommandations, radios, recherches de métadonnées et dumps de données ne sont pas disponibles.",
  npHeading: "API publique « en écoute »",
  npIntro:
    "Affiche le morceau en cours d'un auditeur sur un site web. Pas de clé, de signature ni de connexion, et les requêtes cross-origin sont autorisées.",
  npSnapshot: "{endpoint} : un instantané JSON",
  npSse: "{endpoint} : Server-Sent Events",
  npWs: "{endpoint} : WebSocket",
  npNull: "{nowPlaying} vaut {null} quand rien n'est en lecture. {album} et {imageUrl} peuvent valoir {null}.",
  npDuration:
    "{duration} est en secondes (0 si inconnue). {startedAt} est l'heure Unix de la dernière mise à jour, pas une position de lecture.",
  npStreams:
    "Les flux envoient l'état actuel à la connexion, puis un instantané à chaque changement. Les événements passés ne sont pas rejoués.",
  npUnavailable:
    "Si les écoutes deviennent privées ou si le compte disparaît, les flux envoient {unavailable} et se ferment. Ne te reconnecte pas ensuite.",
  npPing: "Les WebSockets envoient {ping} toutes les 15 secondes ; aucune réponse n'est nécessaire.",
  npErrors:
    "Erreurs : 400 nom invalide, 403 privé, 404 utilisateur inconnu, 429 limite de débit atteinte (avec {retryAfter}).",
  npSpotify:
    "Les écoutes Spotify sont vérifiées environ une fois par minute, les changements peuvent donc mettre ce temps à apparaître.",
  otherApis: "Autres API",
  otherApisLb: "API compatible ListenBrainz",
  otherApisNp: "Instantanés « en écoute », SSE et WebSockets",
  methods: "Méthodes",
  groupLabel: "{group} :",
  groupAuth: "Auth",
  groupTrack: "Titre",
  groupArtist: "Artiste",
  groupAlbum: "Album",
  groupUser: "Utilisateur",
  groupTag: "Balise",
  groupChart: "Classement",
  groupListens: "Écoutes",
  groupFeedback: "Avis",
  groupSocial: "Réseaux sociaux",
  groupUserStats: "Stats utilisateur (GET stats/user/{user}/…)",
  groupSiteStats: "Stats du site (GET stats/sitewide/…)",
  groupListeners: "Auditeurs",

  helpHeading: "Aide au scrobbling",
  helpIntro: "Sonosphere enregistre la musique que tu écoutes. Choisis l'option qui correspond à ta façon d'écouter.",
  helpSpotifyOpen: "Ouvre {applications}.",
  helpSpotifyFollow: "Suis les étapes Spotify indiquées pour connecter ton compte.",
  helpSpotifyPlay:
    "Écoute de la musique. Les nouveaux morceaux apparaissent en une minute environ, et rien n'a besoin de rester ouvert sur ton appareil.",
  helpPanoServer: "Dans Pano, choisis l'option de serveur personnalisé compatible Last.fm (GNU FM).",
  helpPanoFields: "Remplis les trois champs :",
  helpPanoApiUrl: "URL de l'API :",
  helpPanoUsername: "{label} ton nom d'utilisateur Sonosphere",
  helpPanoUsernameLabel: "Nom d'utilisateur :",
  helpPanoPassword: "{label} ton mot de passe Sonosphere",
  helpPanoPasswordLabel: "Mot de passe :",
  helpPanoLogIn: "Connecte-toi. Pano apparaît dans {applications}, où tu peux le déconnecter à tout moment.",
  helpPanoNote:
    "Inscrit via un autre service ? Définis d'abord un mot de passe dans {account}. Pas besoin de compte API : Pano utilise sa clé et son secret intégrés {secret}.",
  helpListenBrainz: "Applis ListenBrainz",
  helpLbIntro:
    "Les lecteurs et scrobblers compatibles ListenBrainz (multi-scrobbler, Navidrome, plugins Jellyfin, Pano et d'autres) peuvent envoyer leurs écoutes ici à la place.",
  helpLbOpen: "Ouvre {applications} et choisis {button}. Copie le jeton : il ne s'affiche qu'une fois.",
  helpLbCreateToken: "Créer un jeton ListenBrainz",
  helpLbServer:
    "Dans l'appli, règle le serveur ou l'URL d'API ListenBrainz sur {origin} et colle le jeton. Si l'appli demande l'adresse complète de l'API, utilise {full}.",
  helpLbPlay: "Écoute de la musique. Le jeton apparaît dans {applications}, où tu peux le déconnecter à tout moment.",
  helpNavidromeConfig:
    "Dans la configuration de Navidrome, réglez {option} (ou la variable d'environnement {env}) sur {url}, puis redémarrez Navidrome.",
  helpNavidromeLink:
    "Dans Navidrome, ouvrez vos paramètres personnels, activez le scrobbling vers ListenBrainz et collez le jeton.",
  helpNavidromeNote:
    "L'URL de base s'applique à tout le serveur Navidrome : chaque personne qui active le scrobbling ListenBrainz envoie ses écoutes ici, avec son propre jeton.",
  helpJellyfinRepo: "Dans le tableau de bord de Jellyfin, ouvrez Plugins, puis l'onglet Dépôts, et ajoutez {repo}.",
  helpJellyfinInstall: "Installez le plugin ListenBrainz depuis le catalogue et redémarrez Jellyfin.",
  helpJellyfinUrl: "Dans les paramètres du plugin, onglet General, réglez {setting} sur {url} et enregistrez.",
  helpJellyfinUser:
    "Dans l'onglet User Config, choisissez votre utilisateur, collez le jeton dans {field}, cochez {enable} et enregistrez.",
  helpPlexIntro:
    "Plex ne peut pas envoyer les écoutes à un autre serveur tout seul : lancez {app} à côté pour les transmettre.",
  helpPlexSource:
    "Ajoutez Plex comme source : réglez {url} sur l'adresse de votre serveur Plex et {token} sur votre jeton Plex.",
  helpPlexClient:
    "Ajoutez un client ListenBrainz : réglez {url} sur {origin}, {token} sur votre jeton et {user} sur votre nom d'utilisateur Sonosphere.",
  helpPlexPlay: "Redémarrez multi-scrobbler et lancez une lecture dans Plex.",
  helpWebScrobblerIntro: "Web Scrobbler est une extension de navigateur qui scrobble depuis les sites de musique.",
  helpWebScrobblerEdit:
    "Dans les options de Web Scrobbler, trouvez ListenBrainz parmi les comptes et modifiez ses propriétés.",
  helpWebScrobblerFields: "Réglez l'URL de l'API sur {url} et le jeton utilisateur sur votre jeton, puis enregistrez.",
  helpOtherApps: "Autres scrobblers",
  helpOtherIntro:
    "Tout lecteur compatible avec le protocole Last.fm 2.0 et qui permet de changer de serveur peut scrobbler ici.",
  helpOtherServerUrl: "URL du serveur :",
  helpOtherKey: "{label} si l'appli les demande, crée un compte API dans {applications}.",
  helpOtherKeyLabel: "Clé et secret d'API :",
  helpOwnScrobbler: "Tu crées ton propre scrobbler ou widget ? Consulte la {docs}.",
  helpManual: "Scrobbles manuels et importations",
  helpManualAdd: "Ajoute des écoutes à la main sur la {scrobble}.",
  helpScrobblePage: "page de scrobble",
  helpManualImport: "Récupère ton historique avec {import}.",
  helpImportLink: "Importer l'historique d'écoute",

  changelogHeading: "Nouveautés",
  changelogManage: "Gérer les billets",
  changelogNew: "Nouveau billet",
  changelogEdit: "Modifier",
  changelogEmpty: "Aucun billet de nouveautés pour l'instant.",
} satisfies Translation<typeof en>;
