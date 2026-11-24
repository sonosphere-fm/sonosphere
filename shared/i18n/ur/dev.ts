import type en from "../en/dev";
import type { Translation } from "../core";

export default {
  applications: "ایپلیکیشنز",
  account: "اکاؤنٹ",
  apiDocumentation: "API دستاویزات",
  developers: "ڈویلپرز",
  onThisPage: "اس صفحے پر",

  apiHeading: "Sonosphere API",
  apiIntro:
    "یہ API، Last.fm 2.0 پروٹوکول پر چلتی ہے، اس لیے زیادہ تر اسکروبلر کوڈ صرف روٹ URL بدلنے سے کام کرتا ہے۔ صرف کسی پلیئر سے اسکروبل کرنا چاہتے ہیں؟ {help} دیکھیں۔",
  apiHelpLink: "اسکروبلنگ میں مدد",
  basics: "بنیادی باتیں",
  rootUrl: "روٹ URL:",
  basicsSend:
    "{method}، {apiKey} اور پیرامیٹرز کو کوئری اسٹرنگ (پڑھنے کے لیے) یا فارم انکوڈڈ POST (لکھنے کے لیے) کے طور پر بھیجیں۔",
  basicsFormat: "JSON کے لیے {format} شامل کریں۔ XML پہلے سے طے شدہ ہے۔",
  basicsKey: "{applications} میں کلید اور مشترکہ سیکرٹ حاصل کریں۔",
  authentication: "تصدیق",
  authWeb:
    "{label} صارف کو {url} پر بھیجیں۔ وہ {token} کے ساتھ واپس آئیں گے؛ ایک گھنٹے کے اندر اسے {getSession} سے تبدیل کریں۔ {cb} کے بغیر آپ کا محفوظ شدہ کال بیک استعمال ہوتا ہے، اور دیا گیا {cb} اسی سائٹ پر ہونا چاہیے۔",
  authWebLabel: "ویب:",
  authDesktop: "{label} {getToken} کال کریں، صارف کو {url} پر بھیجیں، پھر {getSession} کال کریں۔",
  authDesktopLabel: "ڈیسک ٹاپ:",
  authScripts: "{label} {username} اور {password} کے ساتھ {getMobileSession} پر POST کریں۔",
  authScriptsLabel: "اسکرپٹس:",
  sessionKeys: "سیشن کیز کی میعاد ختم نہیں ہوتی۔ تینوں کالز سائن شدہ ہوتی ہیں۔",
  signing: "سائننگ",
  signingBody:
    "{format} اور {callback} کے علاوہ تمام پیرامیٹرز کو نام کے لحاظ سے ترتیب دیں، انہیں {pair} کی صورت میں جوڑیں، آخر میں اپنا سیکرٹ لگائیں، اور MD5 ہیکس ڈائجسٹ کو {apiSig} کے طور پر بھیجیں۔",
  examples: "مثالیں",
  batch: "بیچ اسکروبلز انڈیکس والے پیرامیٹرز ({artist}، {track}، …) استعمال کرتے ہیں، ایک کال میں زیادہ سے زیادہ 50۔",
  errors: "خرابیاں",
  errorsBody:
    "ناکامی پر {shape} واپس آتا ہے: 3 غلط میتھڈ، 4 تصدیق ناکام، 6 غلط پیرامیٹرز، 9 غلط سیشن، 10 غلط API کلید، 13 غلط دستخط، 14 غیر مجاز ٹوکن۔",
  lbHeading: "ListenBrainz API",
  lbIntro:
    "ListenBrainz API، {root} پر انہی پاتھس، ریکویسٹ باڈیز اور جوابات کے ساتھ دستیاب ہے، اس لیے ListenBrainz کلائنٹس اور لائبریریاں روٹ URL کو {origin} میں بدلنے سے کام کرتی ہیں۔",
  lbTokens:
    "{label} صارفین {applications} میں ایک ٹوکن بناتے ہیں۔ اسے {header} کے طور پر بھیجیں۔ پڑھنے کے لیے ٹوکن کی ضرورت نہیں، سوائے اپنی نجی سننے کی سرگرمی دیکھنے کے۔",
  lbTokensLabel: "ٹوکنز:",
  lbErrors: "{label} متعلقہ HTTP اسٹیٹس کے ساتھ {shape}۔ جن اعداد و شمار میں دکھانے کو کچھ نہ ہو وہ 204 لوٹاتے ہیں۔",
  lbErrorsLabel: "خرابیاں:",
  lbRateLimit: "{label} ہر پتے سے ہر 10 سیکنڈ میں 100 درخواستیں، جو {header} ہیڈرز میں بتائی جاتی ہیں۔",
  lbRateLimitLabel: "ریٹ لمٹ:",
  lbRecordingIds:
    "{label} {msid} ویلیوز Sonosphere کی اپنی ہیں اور صرف یہیں معنی رکھتی ہیں۔ کوئی {mbid} تب معلوم ہوتا ہے جب کوئی کلائنٹ اسے کسی لسن کے ساتھ بھیجے۔",
  lbRecordingIdsLabel: "ریکارڈنگ IDs:",
  lbStats: "{label} لائیو ہیں اور UTC استعمال کرتے ہیں۔ {from} سے {to} تک تمام رینجز معاون ہیں۔",
  lbStatsLabel: "اعداد و شمار",
  lbSupported: "معاون اینڈ پوائنٹس:",
  lbUnavailable: "پلے لسٹس، تجاویز، ریڈیو، میٹا ڈیٹا تلاش اور ڈیٹا ڈمپس دستیاب نہیں ہیں۔",
  npHeading: "عوامی ناؤ پلیئنگ API",
  npIntro:
    "کسی ویب سائٹ پر سامع کا موجودہ گانا دکھائیں۔ کوئی کلید، دستخط یا لاگ ان نہیں، اور کراس اوریجن درخواستوں کی اجازت ہے۔",
  npSnapshot: "{endpoint}: ایک JSON اسنیپ شاٹ",
  npSse: "{endpoint}: Server-Sent Events",
  npWs: "{endpoint}: WebSocket",
  npNull: "جب کچھ نہ چل رہا ہو تو {nowPlaying} کی ویلیو {null} ہوتی ہے۔ {album} اور {imageUrl} بھی {null} ہو سکتے ہیں۔",
  npDuration:
    "{duration} سیکنڈز میں ہے (نامعلوم ہو تو 0)۔ {startedAt} تازہ ترین اپ ڈیٹ کا Unix وقت ہے، پلے بیک کی پوزیشن نہیں۔",
  npStreams:
    "اسٹریمز کنیکٹ ہوتے ہی موجودہ حالت بھیجتی ہیں، پھر ہر تبدیلی پر ایک اسنیپ شاٹ۔ گزشتہ ایونٹس دوبارہ نہیں بھیجے جاتے۔",
  npUnavailable:
    "اگر سننے کی سرگرمی نجی ہو جائے یا اکاؤنٹ ختم ہو جائے تو اسٹریمز {unavailable} بھیج کر بند ہو جاتی ہیں۔ اس کے بعد دوبارہ کنیکٹ نہ کریں۔",
  npPing: "WebSockets ہر 15 سیکنڈ میں {ping} بھیجتے ہیں؛ جواب کی ضرورت نہیں۔",
  npErrors: "خرابیاں: 400 غلط نام، 403 نجی، 404 نامعلوم صارف، 429 ریٹ لمٹ ({retryAfter} کے ساتھ)۔",
  npSpotify: "Spotify پر سننے کی سرگرمی تقریباً ہر منٹ چیک ہوتی ہے، اس لیے تبدیلیاں ظاہر ہونے میں اتنا وقت لگ سکتا ہے۔",
  otherApis: "دیگر APIs",
  otherApisLb: "ListenBrainz کے موافق API",
  otherApisNp: "ناؤ پلیئنگ اسنیپ شاٹس، SSE اور WebSockets",
  methods: "میتھڈز",
  groupLabel: "{group}:",
  groupAuth: "تصدیق",
  groupTrack: "ٹریک",
  groupArtist: "آرٹسٹ",
  groupAlbum: "البم",
  groupUser: "صارف",
  groupTag: "ٹیگ",
  groupChart: "چارٹ",
  groupListens: "لسنز",
  groupFeedback: "فیڈ بیک",
  groupSocial: "سوشل",
  groupUserStats: "صارف کے اعداد و شمار (GET stats/user/{user}/…)",
  groupSiteStats: "سائٹ کے اعداد و شمار (GET stats/sitewide/…)",
  groupListeners: "سامعین",

  helpHeading: "اسکروبلنگ میں مدد",
  helpIntro:
    "Sonosphere آپ کا چلایا گیا میوزک ریکارڈ کرتا ہے۔ ان میں سے جو طریقہ آپ کے سننے کے انداز کے مطابق ہو، منتخب کریں۔",
  helpSpotifyOpen: "{applications} کھولیں۔",
  helpSpotifyFollow: "اپنا اکاؤنٹ منسلک کرنے کے لیے وہاں Spotify کے مراحل پر عمل کریں۔",
  helpSpotifyPlay:
    "میوزک چلائیں۔ نئے گانے تقریباً ایک منٹ میں نظر آ جاتے ہیں، اور آپ کی ڈیوائس پر کچھ کھلا رکھنے کی ضرورت نہیں۔",
  helpPanoServer: "Pano میں، حسب ضرورت Last.fm کے موافق (GNU FM) سرور کا آپشن منتخب کریں۔",
  helpPanoFields: "تینوں فیلڈز بھریں:",
  helpPanoApiUrl: "API URL:",
  helpPanoUsername: "{label} آپ کا Sonosphere صارف نام",
  helpPanoUsernameLabel: "صارف نام:",
  helpPanoPassword: "{label} آپ کا Sonosphere پاس ورڈ",
  helpPanoPasswordLabel: "پاس ورڈ:",
  helpPanoLogIn: "لاگ ان کریں۔ Pano، {applications} میں نظر آئے گا، جہاں آپ اسے کسی بھی وقت منقطع کر سکتے ہیں۔",
  helpPanoNote:
    "کسی اور سروس کے ذریعے سائن اپ کیا تھا؟ پہلے {account} میں پاس ورڈ سیٹ کریں۔ آپ کو API اکاؤنٹ کی ضرورت نہیں: Pano اپنی بلٹ اِن کلید اور سیکرٹ {secret} استعمال کرتا ہے۔",
  helpListenBrainz: "ListenBrainz ایپس",
  helpLbIntro:
    "جو پلیئرز اور اسکروبلرز ListenBrainz کو سپورٹ کرتے ہیں (multi-scrobbler، Navidrome، Jellyfin پلگ اِنز، Pano اور دیگر) وہ اس کے بجائے یہاں پلے بھیج سکتے ہیں۔",
  helpLbOpen: "{applications} کھولیں اور {button} منتخب کریں۔ ٹوکن کاپی کر لیں: یہ صرف ایک بار دکھایا جاتا ہے۔",
  helpLbCreateToken: "ListenBrainz ٹوکن بنائیں",
  helpLbServer:
    "ایپ میں ListenBrainz سرور یا API URL کو {origin} پر سیٹ کریں اور ٹوکن پیسٹ کریں۔ اگر ایپ مکمل API پتہ مانگے تو {full} استعمال کریں۔",
  helpLbPlay: "میوزک چلائیں۔ ٹوکن {applications} میں نظر آئے گا، جہاں آپ اسے کسی بھی وقت منقطع کر سکتے ہیں۔",
  helpOtherApps: "دیگر اسکروبلرز",
  helpOtherIntro:
    "کوئی بھی پلیئر جو Last.fm 2.0 پروٹوکول کو سپورٹ کرتا ہو اور سرور بدلنے دیتا ہو، یہاں اسکروبل کر سکتا ہے۔",
  helpOtherServerUrl: "سرور URL:",
  helpOtherKey: "{label} اگر ایپ یہ مانگے تو {applications} میں API اکاؤنٹ بنائیں۔",
  helpOtherKeyLabel: "API کلید اور سیکرٹ:",
  helpOwnScrobbler: "اپنا اسکروبلر یا ویجیٹ بنا رہے ہیں؟ {docs} دیکھیں۔",
  helpManual: "دستی اسکروبلز اور امپورٹس",
  helpManualAdd: "{scrobble} پر خود پلے شامل کریں۔",
  helpScrobblePage: "اسکروبل صفحہ",
  helpManualImport: "{import} کے ذریعے اپنی ہسٹری لے آئیں۔",
  helpImportLink: "سننے کی ہسٹری امپورٹ کریں",

  changelogHeading: "تبدیلیوں کی فہرست",
  changelogManage: "پوسٹس کا انتظام",
  changelogNew: "نئی پوسٹ",
  changelogEdit: "ترمیم",
  changelogEmpty: "ابھی تبدیلیوں کی کوئی پوسٹ نہیں۔",
} satisfies Translation<typeof en>;
