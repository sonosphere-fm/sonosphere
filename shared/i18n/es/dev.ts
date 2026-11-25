import type en from "../en/dev";
import type { Translation } from "../core";

export default {
  applications: "Aplicaciones",
  account: "Cuenta",
  apiDocumentation: "Documentación de la API",
  developers: "Desarrolladores",
  onThisPage: "En esta página",

  apiHeading: "API de Sonosphere",
  apiIntro:
    "La API sigue el protocolo Last.fm 2.0, así que la mayoría del código de scrobblers funciona cambiando la URL raíz. ¿Solo quieres scrobblear desde un reproductor? Consulta la {help}.",
  apiHelpLink: "ayuda para scrobblear",
  basics: "Lo básico",
  rootUrl: "URL raíz:",
  basicsSend:
    "Envía {method}, {apiKey} y los parámetros como query string (lecturas) o como POST codificado como formulario (escrituras).",
  basicsFormat: "Añade {format} para JSON. XML es el formato por defecto.",
  basicsKey: "Consigue una clave y un secreto compartido en {applications}.",
  authentication: "Autenticación",
  authWeb:
    "{label} envía al usuario a {url}. Vuelve con {token}; cámbialo con {getSession} antes de una hora. Sin {cb} se usa tu callback guardado, y un {cb} indicado debe estar en el mismo sitio.",
  authWebLabel: "Web:",
  authDesktop: "{label} llama a {getToken}, envía al usuario a {url} y luego llama a {getSession}.",
  authDesktopLabel: "Escritorio:",
  authScripts: "{label} haz POST a {getMobileSession} con {username} y {password}.",
  authScriptsLabel: "Scripts:",
  sessionKeys: "Las claves de sesión no caducan. Las tres llamadas van firmadas.",
  signing: "Firma",
  signingBody:
    "Ordena por nombre todos los parámetros excepto {format} y {callback}, únelos como {pair}, añade tu secreto al final y envía el resumen MD5 en hexadecimal como {apiSig}.",
  examples: "Ejemplos",
  batch: "Los scrobbles por lotes usan parámetros indexados ({artist}, {track}, …), hasta 50 por llamada.",
  errors: "Errores",
  errorsBody:
    "Los fallos devuelven {shape}: 3 método no válido, 4 autenticación fallida, 6 parámetros no válidos, 9 sesión no válida, 10 clave de API no válida, 13 firma no válida, 14 token no autorizado.",
  lbHeading: "API de ListenBrainz",
  lbIntro:
    "La API de ListenBrainz se sirve en {root} con las mismas rutas, cuerpos de solicitud y respuestas, así que los clientes y bibliotecas de ListenBrainz funcionan cambiando la URL raíz a {origin}.",
  lbTokens:
    "{label} los usuarios crean uno en {applications}. Envíalo como {header}. Las lecturas no lo necesitan, salvo para ver tu propia escucha privada.",
  lbTokensLabel: "Tokens:",
  lbErrors: "{label} {shape} con el código HTTP correspondiente. Las estadísticas sin datos devuelven 204.",
  lbErrorsLabel: "Errores:",
  lbRateLimit: "{label} 100 solicitudes cada 10 segundos por dirección, indicado en las cabeceras {header}.",
  lbRateLimitLabel: "Límite de solicitudes:",
  lbRecordingIds:
    "{label} los valores {msid} son propios de Sonosphere y solo tienen sentido aquí. Un {mbid} se conoce cuando un cliente lo ha enviado con una escucha.",
  lbRecordingIdsLabel: "IDs de grabación:",
  lbStats: "{label} son en vivo y usan UTC. Se admiten todos los rangos, de {from} a {to}.",
  lbStatsLabel: "Las estadísticas",
  lbSupported: "Endpoints compatibles:",
  lbUnavailable:
    "No están disponibles las playlists, recomendaciones, radio, consultas de metadatos ni volcados de datos.",
  npHeading: "API pública de lo que suena ahora",
  npIntro:
    "Muestra en una web la canción que alguien está escuchando. Sin clave, firma ni inicio de sesión, y se permiten solicitudes de otros orígenes.",
  npSnapshot: "{endpoint}: una instantánea JSON",
  npSse: "{endpoint}: Server-Sent Events",
  npWs: "{endpoint}: WebSocket",
  npNull: "{nowPlaying} es {null} cuando no suena nada. {album} y {imageUrl} pueden ser {null}.",
  npDuration:
    "{duration} va en segundos (0 si se desconoce). {startedAt} es la hora Unix de la última actualización, no una posición de reproducción.",
  npStreams:
    "Los streams envían el estado actual al conectar y luego una instantánea en cada cambio. No se reenvían eventos pasados.",
  npUnavailable:
    "Si la escucha pasa a ser privada o la cuenta desaparece, los streams envían {unavailable} y se cierran. No vuelvas a conectar después.",
  npPing: "Los WebSockets envían {ping} cada 15 segundos; no hace falta responder.",
  npErrors:
    "Errores: 400 nombre incorrecto, 403 privado, 404 usuario desconocido, 429 límite de solicitudes (con {retryAfter}).",
  npSpotify:
    "La escucha en Spotify se comprueba aproximadamente una vez por minuto, así que los cambios pueden tardar eso en aparecer.",
  otherApis: "Otras API",
  otherApisLb: "API compatible con ListenBrainz",
  otherApisNp: "Instantáneas de lo que suena ahora, SSE y WebSockets",
  methods: "Métodos",
  groupLabel: "{group}:",
  groupAuth: "Autenticación",
  groupTrack: "Canción",
  groupArtist: "Artista",
  groupAlbum: "Álbum",
  groupUser: "Usuario",
  groupTag: "Etiqueta",
  groupChart: "Listas",
  groupListens: "Escuchas",
  groupFeedback: "Valoraciones",
  groupSocial: "Social",
  groupUserStats: "Estadísticas de usuario (GET stats/user/{user}/…)",
  groupSiteStats: "Estadísticas del sitio (GET stats/sitewide/…)",
  groupListeners: "Oyentes",

  helpHeading: "Ayuda para scrobblear",
  helpIntro: "Sonosphere registra la música que escuchas. Elige la opción que mejor encaje con cómo escuchas.",
  helpSpotifyOpen: "Abre {applications}.",
  helpSpotifyFollow: "Sigue allí los pasos de Spotify para conectar tu cuenta.",
  helpSpotifyPlay:
    "Pon música. Las canciones nuevas aparecen en aproximadamente un minuto y no hace falta dejar nada abierto en tu dispositivo.",
  helpPanoServer: "En Pano, elige la opción de servidor personalizado compatible con Last.fm (GNU FM).",
  helpPanoFields: "Rellena los tres campos:",
  helpPanoApiUrl: "URL de la API:",
  helpPanoUsername: "{label} tu nombre de usuario de Sonosphere",
  helpPanoUsernameLabel: "Usuario:",
  helpPanoPassword: "{label} tu contraseña de Sonosphere",
  helpPanoPasswordLabel: "Contraseña:",
  helpPanoLogIn: "Inicia sesión. Pano aparece en {applications}, donde puedes desconectarlo cuando quieras.",
  helpPanoNote:
    "¿Te registraste con otro servicio? Primero pon una contraseña en {account}. No necesitas una cuenta de API: Pano usa su clave y secreto integrados {secret}.",
  helpListenBrainz: "Apps de ListenBrainz",
  helpLbIntro:
    "Los reproductores y scrobblers compatibles con ListenBrainz (multi-scrobbler, Navidrome, plugins de Jellyfin, Pano y otros) también pueden enviar escuchas aquí.",
  helpLbOpen: "Abre {applications} y elige {button}. Copia el token: solo se muestra una vez.",
  helpLbCreateToken: "Crear token de ListenBrainz",
  helpLbServer:
    "En la app, pon {origin} como servidor o URL de la API de ListenBrainz y pega el token. Si la app pide la dirección completa de la API, usa {full}.",
  helpLbPlay: "Pon música. El token aparece en {applications}, donde puedes desconectarlo cuando quieras.",
  helpNavidromeConfig:
    "En la configuración de Navidrome, pon {option} (o la variable de entorno {env}) en {url} y reinicia Navidrome.",
  helpNavidromeLink: "En Navidrome, abre tus ajustes personales, activa el scrobbling a ListenBrainz y pega el token.",
  helpNavidromeNote:
    "La URL base se aplica a todo el servidor de Navidrome: quien active el scrobbling a ListenBrainz enviará sus escuchas aquí, cada uno con su propio token.",
  helpJellyfinRepo: "En el panel de Jellyfin, abre Plugins, luego la pestaña Repositorios, y añade {repo}.",
  helpJellyfinInstall: "Instala el plugin ListenBrainz desde el catálogo y reinicia Jellyfin.",
  helpJellyfinUrl: "En los ajustes del plugin, en la pestaña General, pon {setting} en {url} y guarda.",
  helpJellyfinUser: "En la pestaña User Config, elige tu usuario, pega el token en {field}, marca {enable} y guarda.",
  helpPlexIntro:
    "Plex no puede enviar escuchas a otro servidor por sí mismo, así que ejecuta {app} a su lado para reenviarlas.",
  helpPlexSource:
    "Añade Plex como fuente: pon {url} con la dirección de tu servidor Plex y {token} con tu token de Plex.",
  helpPlexClient:
    "Añade un cliente ListenBrainz: pon {url} en {origin}, {token} con tu token y {user} con tu nombre de usuario de Sonosphere.",
  helpPlexPlay: "Reinicia multi-scrobbler y reproduce algo en Plex.",
  helpWebScrobblerIntro: "Web Scrobbler es una extensión del navegador que hace scrobbling desde sitios web de música.",
  helpWebScrobblerEdit:
    "En las opciones de Web Scrobbler, busca ListenBrainz entre las cuentas y edita sus propiedades.",
  helpWebScrobblerFields: "Pon la URL de la API en {url} y el token de usuario con tu token, y guarda.",
  helpOtherApps: "Otros scrobblers",
  helpOtherIntro:
    "Cualquier reproductor que admita el protocolo Last.fm 2.0 y permita cambiar su servidor puede scrobblear aquí.",
  helpOtherServerUrl: "URL del servidor:",
  helpOtherKey: "{label} si la app los pide, crea una cuenta de API en {applications}.",
  helpOtherKeyLabel: "Clave y secreto de API:",
  helpOwnScrobbler: "¿Estás creando tu propio scrobbler o widget? Consulta la {docs}.",
  helpManual: "Scrobbles manuales e importaciones",
  helpManualAdd: "Añade escuchas a mano en la {scrobble}.",
  helpScrobblePage: "página de scrobble",
  helpManualImport: "Trae tu historial con {import}.",
  helpImportLink: "Importar historial de escucha",

  changelogHeading: "Novedades",
  changelogManage: "Gestionar entradas",
  changelogNew: "Nueva entrada",
  changelogEdit: "Editar",
  changelogEmpty: "Aún no hay entradas de novedades.",
} satisfies Translation<typeof en>;
