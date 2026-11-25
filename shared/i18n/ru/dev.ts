import type en from "../en/dev";
import type { Translation } from "../core";

export default {
  applications: "Приложения",
  account: "Аккаунт",
  apiDocumentation: "Документация API",
  developers: "Разработчикам",
  onThisPage: "На этой странице",

  apiHeading: "API Sonosphere",
  apiIntro:
    "API следует протоколу Last.fm 2.0, поэтому большинство кода скробблеров работает после замены корневого URL. Хочешь просто скробблить из плеера? Загляни в {help}.",
  apiHelpLink: "помощь со скробблингом",
  basics: "Основы",
  rootUrl: "Корневой URL:",
  basicsSend:
    "Передавай {method}, {apiKey} и параметры в строке запроса (чтение) или в POST с form-encoded телом (запись).",
  basicsFormat: "Добавь {format}, чтобы получить JSON. По умолчанию XML.",
  basicsKey: "Ключ и общий секрет можно получить в разделе {applications}.",
  authentication: "Аутентификация",
  authWeb:
    "{label} отправь пользователя на {url}. Он вернётся с {token}; обменяй его через {getSession} в течение часа. Без {cb} используется сохранённый callback, а переданный {cb} должен быть на том же сайте.",
  authWebLabel: "Веб:",
  authDesktop: "{label} вызови {getToken}, отправь пользователя на {url}, затем вызови {getSession}.",
  authDesktopLabel: "Десктоп:",
  authScripts: "{label} отправь POST {getMobileSession} с {username} и {password}.",
  authScriptsLabel: "Скрипты:",
  sessionKeys: "Ключи сессии не истекают. Все три вызова подписываются.",
  signing: "Подпись",
  signingBody:
    "Отсортируй все параметры, кроме {format} и {callback}, по имени, склей их как {pair}, добавь в конец свой секрет и передай MD5-хеш в hex как {apiSig}.",
  examples: "Примеры",
  batch: "Пакетные скробблы используют индексированные параметры ({artist}, {track}, …), до 50 за вызов.",
  errors: "Ошибки",
  errorsBody:
    "При сбое возвращается {shape}: 3 неверный метод, 4 ошибка аутентификации, 6 неверные параметры, 9 неверная сессия, 10 неверный ключ API, 13 неверная подпись, 14 неавторизованный токен.",
  lbHeading: "API ListenBrainz",
  lbIntro:
    "API ListenBrainz доступен по адресу {root} с теми же путями, телами запросов и ответами, поэтому клиенты и библиотеки ListenBrainz работают после замены корневого URL на {origin}.",
  lbTokens:
    "{label} пользователи создают их в разделе {applications}. Передавай токен как {header}. Для чтения токен не нужен, кроме просмотра своих скрытых прослушиваний.",
  lbTokensLabel: "Токены:",
  lbErrors: "{label} {shape} с соответствующим HTTP-статусом. Статистика без данных возвращает 204.",
  lbErrorsLabel: "Ошибки:",
  lbRateLimit: "{label} 100 запросов за 10 секунд с одного адреса, данные в заголовках {header}.",
  lbRateLimitLabel: "Лимит запросов:",
  lbRecordingIds:
    "{label} значения {msid} принадлежат Sonosphere и имеют смысл только здесь. {mbid} становится известен, когда клиент передаст его вместе с прослушиванием.",
  lbRecordingIdsLabel: "ID записей:",
  lbStats: "{label} считается в реальном времени и использует UTC. Поддерживаются все диапазоны, от {from} до {to}.",
  lbStatsLabel: "Статистика",
  lbSupported: "Поддерживаемые эндпоинты:",
  lbUnavailable: "Плейлисты, рекомендации, радио, поиск метаданных и дампы данных недоступны.",
  npHeading: "Публичный API «сейчас играет»",
  npIntro: "Показывай текущую песню слушателя на сайте. Без ключа, подписи и входа, кросс-доменные запросы разрешены.",
  npSnapshot: "{endpoint}: один снимок в JSON",
  npSse: "{endpoint}: События, отправляемые сервером",
  npWs: "{endpoint}: WebSocket",
  npNull: "{nowPlaying} равен {null}, когда ничего не играет. {album} и {imageUrl} могут быть {null}.",
  npDuration:
    "{duration} указывается в секундах (0, если неизвестно). {startedAt} - Unix-время последнего обновления, а не позиция воспроизведения.",
  npStreams:
    "Потоки при подключении отправляют текущее состояние, а затем снимок при каждом изменении. Прошлые события не повторяются.",
  npUnavailable:
    "Если прослушивания стали скрытыми или аккаунт удалён, потоки отправляют {unavailable} и закрываются. После этого не переподключайся.",
  npPing: "WebSocket отправляет {ping} каждые 15 секунд; отвечать не нужно.",
  npErrors: "Ошибки: 400 неверное имя, 403 скрыто, 404 неизвестный пользователь, 429 превышен лимит (с {retryAfter}).",
  npSpotify:
    "Прослушивания в Spotify проверяются примерно раз в минуту, поэтому изменения могут появляться с такой задержкой.",
  otherApis: "Другие API",
  otherApisLb: "API, совместимый с ListenBrainz",
  otherApisNp: "Снимки «сейчас играет», SSE и WebSocket",
  methods: "Методы",
  groupLabel: "{group}:",
  groupAuth: "Аутентификация",
  groupTrack: "Трек",
  groupArtist: "Исполнитель",
  groupAlbum: "Альбом",
  groupUser: "Пользователь",
  groupTag: "Тег",
  groupChart: "Чарт",
  groupListens: "Прослушивания",
  groupFeedback: "Отзывы",
  groupSocial: "Социальное",
  groupUserStats: "Статистика пользователя (GET stats/user/{user}/…)",
  groupSiteStats: "Статистика сайта (GET stats/sitewide/…)",
  groupListeners: "Слушатели",

  helpHeading: "Помощь со скробблингом",
  helpIntro: "Sonosphere записывает музыку, которую ты слушаешь. Выбери способ, который подходит тебе.",
  helpSpotifyOpen: "Открой {applications}.",
  helpSpotifyFollow: "Следуй инструкциям для Spotify, чтобы подключить аккаунт.",
  helpSpotifyPlay:
    "Включай музыку. Новые песни появляются примерно в течение минуты, и на устройстве ничего не нужно держать открытым.",
  helpPanoServer: "В Pano выбери вариант со своим сервером, совместимым с Last.fm (GNU FM).",
  helpPanoFields: "Заполни три поля:",
  helpPanoApiUrl: "URL API:",
  helpPanoUsername: "{label} твоё имя пользователя Sonosphere",
  helpPanoUsernameLabel: "Имя пользователя:",
  helpPanoPassword: "{label} твой пароль Sonosphere",
  helpPanoPasswordLabel: "Пароль:",
  helpPanoLogIn: "Войди. Pano появится в разделе {applications}, где его можно отключить в любой момент.",
  helpPanoNote:
    "Аккаунт создан через другой сервис? Сначала задай пароль в разделе {account}. Аккаунт API не нужен: Pano использует встроенные ключ и секрет {secret}.",
  helpListenBrainz: "Приложения ListenBrainz",
  helpLbIntro:
    "Плееры и скробблеры с поддержкой ListenBrainz (multi-scrobbler, Navidrome, плагины Jellyfin, Pano и другие) могут отправлять прослушивания сюда.",
  helpLbOpen: "Открой {applications} и выбери {button}. Скопируй токен: он показывается только один раз.",
  helpLbCreateToken: "Создать токен ListenBrainz",
  helpLbServer:
    "В приложении укажи {origin} как сервер или API URL ListenBrainz и вставь токен. Если приложению нужен полный адрес API, используй {full}.",
  helpLbPlay: "Включай музыку. Токен появится в разделе {applications}, где его можно отключить в любой момент.",
  helpNavidromeConfig:
    "В конфигурации Navidrome задайте {option} (или переменную окружения {env}) равным {url} и перезапустите Navidrome.",
  helpNavidromeLink: "В Navidrome откройте личные настройки, включите скробблинг в ListenBrainz и вставьте токен.",
  helpNavidromeNote:
    "Базовый URL действует для всего сервера Navidrome: все, кто включит скробблинг в ListenBrainz, будут отправлять прослушивания сюда, каждый со своим токеном.",
  helpJellyfinRepo: "В панели Jellyfin откройте «Плагины», затем вкладку «Репозитории» и добавьте {repo}.",
  helpJellyfinInstall: "Установите плагин ListenBrainz из каталога и перезапустите Jellyfin.",
  helpJellyfinUrl: "В настройках плагина на вкладке General задайте {setting} равным {url} и сохраните.",
  helpJellyfinUser:
    "На вкладке User Config выберите своего пользователя, вставьте токен в {field}, отметьте {enable} и сохраните.",
  helpPlexIntro:
    "Plex сам не умеет отправлять прослушивания на другой сервер, поэтому запустите рядом {app}, чтобы он их передавал.",
  helpPlexSource:
    "Добавьте Plex как источник: задайте {url} равным адресу вашего сервера Plex, а {token} равным вашему токену Plex.",
  helpPlexClient:
    "Добавьте клиент ListenBrainz: задайте {url} равным {origin}, {token} равным вашему токену, а {user} равным вашему имени пользователя Sonosphere.",
  helpPlexPlay: "Перезапустите multi-scrobbler и включите что-нибудь в Plex.",
  helpWebScrobblerIntro: "Web Scrobbler это расширение браузера, которое скробблит с музыкальных сайтов.",
  helpWebScrobblerEdit: "В настройках Web Scrobbler найдите ListenBrainz среди аккаунтов и измените его свойства.",
  helpWebScrobblerFields: "Укажите в адресе API {url}, а в токене пользователя ваш токен, и сохраните.",
  helpOtherApps: "Другие скробблеры",
  helpOtherIntro:
    "Скробблить сюда может любой плеер, который поддерживает протокол Last.fm 2.0 и позволяет сменить сервер.",
  helpOtherServerUrl: "URL сервера:",
  helpOtherKey: "{label} если приложение их просит, создай аккаунт API в разделе {applications}.",
  helpOtherKeyLabel: "Ключ API и секрет:",
  helpOwnScrobbler: "Делаешь свой скробблер или виджет? Тебе поможет {docs}.",
  helpManual: "Ручные скробблы и импорт",
  helpManualAdd: "Добавляй прослушивания вручную на {scrobble}.",
  helpScrobblePage: "странице скробблинга",
  helpManualImport: "Перенеси свою историю через {import}.",
  helpImportLink: "импорт истории прослушиваний",

  changelogHeading: "Список изменений",
  changelogManage: "Управление записями",
  changelogNew: "Новая запись",
  changelogEdit: "Изменить",
  changelogEmpty: "Записей в списке изменений пока нет.",
} satisfies Translation<typeof en>;
