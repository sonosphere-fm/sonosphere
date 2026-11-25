import type en from "../en/dev";
import type { Translation } from "../core";

export default {
  applications: "Uygulamalar",
  account: "Hesap",
  apiDocumentation: "API belgeleri",
  developers: "Geliştiriciler",
  onThisPage: "Bu sayfada",

  apiHeading: "Sonosphere API'si",
  apiIntro:
    "API, Last.fm 2.0 protokolünü izler; bu yüzden çoğu scrobbler kodu yalnızca kök URL değiştirilerek çalışır. Sadece bir oynatıcıdan scrobble etmek mi istiyorsun? {help} sayfasına bak.",
  apiHelpLink: "scrobble yardımı",
  basics: "Temel bilgiler",
  rootUrl: "Kök URL:",
  basicsSend: "{method}, {apiKey} ve parametreleri sorgu dizesi (okuma) ya da form kodlu POST (yazma) olarak gönder.",
  basicsFormat: "JSON için {format} ekle. Varsayılan XML'dir.",
  basicsKey: "Anahtar ve paylaşılan gizli anahtarı şuradan al: {applications}.",
  authentication: "Kimlik doğrulama",
  authWeb:
    "{label} kullanıcıyı {url} adresine gönder. Kullanıcı {token} ile döner; bunu bir saat içinde {getSession} ile takas et. {cb} verilmezse kayıtlı callback kullanılır; verilen {cb} aynı sitede olmalıdır.",
  authWebLabel: "Web:",
  authDesktop: "{label} {getToken} çağır, kullanıcıyı {url} adresine gönder, sonra {getSession} çağır.",
  authDesktopLabel: "Masaüstü:",
  authScripts: "{label} {username} ve {password} ile {getMobileSession} adresine POST yap.",
  authScriptsLabel: "Betikler:",
  sessionKeys: "Oturum anahtarlarının süresi dolmaz. Üç çağrının tamamı imzalıdır.",
  signing: "İmzalama",
  signingBody:
    "{format} ve {callback} dışındaki tüm parametreleri ada göre sırala, {pair} biçiminde birleştir, sonuna gizli anahtarını ekle ve MD5 hex özetini {apiSig} olarak gönder.",
  examples: "Örnekler",
  batch: "Toplu scrobble'lar indeksli parametreler ({artist}, {track}, …) kullanır, çağrı başına en fazla 50.",
  errors: "Hatalar",
  errorsBody:
    "Başarısız istekler {shape} döndürür: 3 geçersiz yöntem, 4 kimlik doğrulama başarısız, 6 geçersiz parametreler, 9 geçersiz oturum, 10 geçersiz API anahtarı, 13 geçersiz imza, 14 yetkisiz token.",
  lbHeading: "ListenBrainz API'si",
  lbIntro:
    "ListenBrainz API, {root} altında aynı yollar, istek gövdeleri ve yanıtlarla sunulur; bu yüzden ListenBrainz istemcileri ve kütüphaneleri kök URL {origin} olarak değiştirilince çalışır.",
  lbTokens:
    "{label} kullanıcılar bunu {applications} altında oluşturur. {header} olarak gönder. Okuma için gerekmez, yalnızca kendi gizli dinlemelerini görmek için gerekir.",
  lbTokensLabel: "Token'lar:",
  lbErrors: "{label} eşleşen HTTP durum koduyla {shape}. Gösterecek bir şeyi olmayan istatistikler 204 döndürür.",
  lbErrorsLabel: "Hatalar:",
  lbRateLimit: "{label} adres başına 10 saniyede 100 istek; {header} başlıklarında bildirilir.",
  lbRateLimitLabel: "Hız sınırı:",
  lbRecordingIds:
    "{label} {msid} değerleri Sonosphere'e özgüdür ve yalnızca burada anlam taşır. Bir {mbid}, bir istemci onu bir dinlemeyle gönderdiğinde bilinir.",
  lbRecordingIdsLabel: "Kayıt ID'leri:",
  lbStats: "{label} canlıdır ve UTC kullanır. {from} ile {to} arasındaki tüm aralıklar desteklenir.",
  lbStatsLabel: "İstatistikler",
  lbSupported: "Desteklenen uç noktalar:",
  lbUnavailable: "Çalma listeleri, öneriler, radyo, meta veri sorguları ve veri dökümleri kullanılamaz.",
  npHeading: "Herkese açık şimdi çalıyor API'si",
  npIntro:
    "Bir dinleyicinin o an çaldığı şarkıyı bir web sitesinde göster. Anahtar, imza veya giriş gerekmez; çapraz kaynak isteklerine izin verilir.",
  npSnapshot: "{endpoint}: tek bir JSON anlık görüntüsü",
  npSse: "{endpoint}: Sunucu Tarafından Gönderilen Olaylar",
  npWs: "{endpoint}: WebSocket",
  npNull: "Hiçbir şey çalmıyorsa {nowPlaying} değeri {null} olur. {album} ve {imageUrl} {null} olabilir.",
  npDuration:
    "{duration} saniye cinsindendir (bilinmiyorsa 0). {startedAt} son güncellemenin Unix zamanıdır, çalma konumu değildir.",
  npStreams:
    "Akışlar bağlanınca mevcut durumu, ardından her değişiklikte bir anlık görüntü gönderir. Geçmiş olaylar yeniden gönderilmez.",
  npUnavailable:
    "Dinleme gizliye alınırsa ya da hesap kaldırılırsa akışlar {unavailable} gönderip kapanır. Bundan sonra yeniden bağlanma.",
  npPing: "WebSocket'ler her 15 saniyede bir {ping} gönderir; yanıt gerekmez.",
  npErrors: "Hatalar: 400 hatalı ad, 403 gizli, 404 bilinmeyen kullanıcı, 429 hız sınırı ({retryAfter} ile).",
  npSpotify:
    "Spotify dinlemeleri yaklaşık dakikada bir kontrol edilir, bu yüzden değişikliklerin görünmesi o kadar sürebilir.",
  otherApis: "Diğer API'ler",
  otherApisLb: "ListenBrainz uyumlu API",
  otherApisNp: "Şimdi çalıyor anlık görüntüleri, SSE ve WebSocket'ler",
  methods: "Yöntemler",
  groupLabel: "{group}:",
  groupAuth: "Kimlik doğrulama",
  groupTrack: "Parça",
  groupArtist: "Sanatçı",
  groupAlbum: "Albüm",
  groupUser: "Kullanıcı",
  groupTag: "Etiket",
  groupChart: "Liste",
  groupListens: "Dinlemeler",
  groupFeedback: "Geri bildirim",
  groupSocial: "Sosyal",
  groupUserStats: "Kullanıcı istatistikleri (GET stats/user/{user}/…)",
  groupSiteStats: "Site istatistikleri (GET stats/sitewide/…)",
  groupListeners: "Dinleyiciler",

  helpHeading: "Scrobble yardımı",
  helpIntro: "Sonosphere çaldığın müziği kaydeder. Bunlardan nasıl dinlediğine uyanı seç.",
  helpSpotifyOpen: "Şunu aç: {applications}.",
  helpSpotifyFollow: "Hesabını bağlamak için oradaki Spotify adımlarını izle.",
  helpSpotifyPlay:
    "Müzik çal. Yeni şarkılar yaklaşık bir dakika içinde görünür; cihazında hiçbir şeyin açık kalması gerekmez.",
  helpPanoServer: "Pano'da özel Last.fm uyumlu (GNU FM) sunucu seçeneğini seç.",
  helpPanoFields: "Üç alanı doldur:",
  helpPanoApiUrl: "API URL'si:",
  helpPanoUsername: "{label} Sonosphere kullanıcı adın",
  helpPanoUsernameLabel: "Kullanıcı adı:",
  helpPanoPassword: "{label} Sonosphere şifren",
  helpPanoPasswordLabel: "Şifre:",
  helpPanoLogIn:
    "Giriş yap. Pano, {applications} altında görünür; bağlantısını istediğin zaman oradan kaldırabilirsin.",
  helpPanoNote:
    "Başka bir hizmet üzerinden mi kaydoldun? Önce {account} bölümünde bir şifre belirle. API hesabına ihtiyacın yok: Pano yerleşik anahtarını ve gizli anahtarını {secret} kullanır.",
  helpListenBrainz: "ListenBrainz uygulamaları",
  helpLbIntro:
    "ListenBrainz'i destekleyen oynatıcılar ve scrobbler'lar (multi-scrobbler, Navidrome, Jellyfin eklentileri, Pano ve diğerleri) dinlemeleri bunun yerine buraya gönderebilir.",
  helpLbOpen: "{applications} sayfasını aç ve {button} seçeneğini seç. Token'ı kopyala: yalnızca bir kez gösterilir.",
  helpLbCreateToken: "ListenBrainz token'ı oluştur",
  helpLbServer:
    "Uygulamada ListenBrainz sunucusunu veya API URL'sini {origin} olarak ayarla ve token'ı yapıştır. Uygulama tam API adresini istiyorsa {full} kullan.",
  helpLbPlay: "Müzik çal. Token {applications} altında görünür; bağlantısını istediğin zaman oradan kaldırabilirsin.",
  helpNavidromeConfig:
    "Navidrome yapılandırmasında {option} (veya {env} ortam değişkeni) değerini {url} yapın, ardından Navidrome'u yeniden başlatın.",
  helpNavidromeLink: "Navidrome'da kişisel ayarlarınızı açın, ListenBrainz'e scrobble'ı açın ve jetonu yapıştırın.",
  helpNavidromeNote:
    "Temel URL tüm Navidrome sunucusu için geçerlidir: ListenBrainz scrobble'ını açan herkes dinlemelerini, her biri kendi jetonuyla buraya gönderir.",
  helpJellyfinRepo: "Jellyfin panelinde Eklentiler'i, ardından Depolar sekmesini açın ve {repo} ekleyin.",
  helpJellyfinInstall: "ListenBrainz eklentisini katalogdan kurun ve Jellyfin'i yeniden başlatın.",
  helpJellyfinUrl: "Eklenti ayarlarında, General sekmesinde {setting} değerini {url} yapın ve kaydedin.",
  helpJellyfinUser:
    "User Config sekmesinde kullanıcınızı seçin, jetonu {field} alanına yapıştırın, {enable} seçeneğini işaretleyin ve kaydedin.",
  helpPlexIntro:
    "Plex dinlemeleri kendi başına başka bir sunucuya gönderemez, bu yüzden onları iletmesi için yanında {app} çalıştırın.",
  helpPlexSource:
    "Plex'i kaynak olarak ekleyin: {url} değerini Plex sunucunuzun adresi, {token} değerini Plex jetonunuz yapın.",
  helpPlexClient:
    "Bir ListenBrainz istemcisi ekleyin: {url} değerini {origin}, {token} değerini jetonunuz, {user} değerini Sonosphere kullanıcı adınız yapın.",
  helpPlexPlay: "multi-scrobbler'ı yeniden başlatın ve Plex'te bir şey çalın.",
  helpWebScrobblerIntro: "Web Scrobbler, müzik sitelerinden scrobble yapan bir tarayıcı eklentisidir.",
  helpWebScrobblerEdit:
    "Web Scrobbler seçeneklerinde hesaplar arasında ListenBrainz'i bulun ve özelliklerini düzenleyin.",
  helpWebScrobblerFields: "API URL'sini {url}, kullanıcı jetonunu kendi jetonunuz yapın ve kaydedin.",
  helpOtherApps: "Diğer scrobbler'lar",
  helpOtherIntro:
    "Last.fm 2.0 protokolünü destekleyen ve sunucusunu değiştirmene izin veren her oynatıcı buraya scrobble edebilir.",
  helpOtherServerUrl: "Sunucu URL'si:",
  helpOtherKey: "{label} uygulama isterse {applications} altında bir API hesabı oluştur.",
  helpOtherKeyLabel: "API anahtarı ve gizli anahtar:",
  helpOwnScrobbler: "Kendi scrobbler'ını ya da widget'ını mı yapıyorsun? Şuna göz at: {docs}.",
  helpManual: "Elle scrobble ve içe aktarma",
  helpManualAdd: "Dinlemeleri {scrobble} üzerinden elle ekle.",
  helpScrobblePage: "scrobble sayfası",
  helpManualImport: "Geçmişini taşımak için şunu kullan: {import}.",
  helpImportLink: "Dinleme geçmişini içe aktar",

  changelogHeading: "Değişiklik günlüğü",
  changelogManage: "Gönderileri yönet",
  changelogNew: "Yeni gönderi",
  changelogEdit: "Düzenle",
  changelogEmpty: "Henüz değişiklik günlüğü gönderisi yok.",
} satisfies Translation<typeof en>;
