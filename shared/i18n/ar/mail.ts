import type en from "../en/mail";
import type { Translation } from "../core";

export default {
  pasteLink: "أو الصق هذا الرابط في متصفحك:",
  manageEmails: "اختر الرسائل التي تصلك",
  manageEmailsLine: "اختر الرسائل التي تصلك: {url}",
  footer: "تصلك هذه الرسالة لأن لديك حسابًا على {site}.",
  quoted: "«{text}»",

  verifySubject: "أكّد بريدك الإلكتروني على Sonosphere",
  verifyHeading: "مرحبًا {username}، أكّد بريدك الإلكتروني",
  verifyBody:
    "شكرًا لانضمامك إلى Sonosphere. أكّد أن هذا عنوان بريدك الإلكتروني لتتمكن من استعادة حسابك إن نسيت كلمة المرور يومًا.",
  verifyButton: "تأكيد البريد الإلكتروني",
  verifyNote:
    "يعمل الرابط لمدة 3 أيام، ويمكنك طلب رابط جديد من الإعدادات. تُحذف الحسابات غير المؤكدة خلال {days} يومًا. إن لم تكن أنت من سجّل، فتجاهل هذه الرسالة وسيُزال الحساب.",

  welcomeSubject: "مرحبًا بك في Sonosphere",
  welcomeHeading: "أهلًا بك يا {username}",
  welcomeIntro: "تم تأكيد بريدك الإلكتروني وحسابك جاهز. إليك بعض الأمور لتجربها أولًا:",
  welcomeImport:
    "أحضر سكروبلاتك معك. استورد سجل استماعك من Last.fm أو من ملف، وسيمتلئ ملفك الشخصي وقوائمك وتوصياتك بكل ما استمعت إليه.",
  welcomeImportButton: "استيراد سكروبلاتك",
  welcomeConnect:
    "ثم اربط مشغّلًا لتُسجَّل كل أغنية تشغّلها من الآن فصاعدًا كسكروبل في ملفك الشخصي. يعمل ذلك مع Spotify ومشغّلات سطح المكتب وتطبيقات الهاتف.",
  welcomeConnectButton: "ربط مشغّل",
  welcomeFollow: "تابع أصدقاءك واعثر على من يشبهونك في الذوق: الأشخاص الأقرب إلى ذوقك الموسيقي.",
  welcomeProfile: "ملفك الشخصي: {url}",

  resetSubject: "إعادة تعيين كلمة مرور Sonosphere",
  resetHeading: "أعد تعيين كلمة المرور",
  resetBody: "طلب أحدهم (نأمل أن تكون أنت) إعادة تعيين كلمة المرور للحساب {username} على Sonosphere.",
  resetButton: "اختيار كلمة مرور جديدة",
  resetNote:
    "يعمل الرابط لمدة ساعة واحدة ولمرة واحدة فقط. إن لم تطلب ذلك، فتجاهل هذه الرسالة: ستبقى كلمة مرورك كما هي.",

  changeSubject: "أكّد بريدك الإلكتروني الجديد على Sonosphere",
  changeHeading: "أكّد بريدك الإلكتروني الجديد",
  changeBody: "طلب {username} على Sonosphere استخدام هذا العنوان من الآن فصاعدًا. أكّده لإتمام التغيير.",
  changeButton: "تأكيد البريد الجديد",
  changeNote: "يعمل الرابط لمدة 3 أيام. إلى أن يُستخدم، يحتفظ الحساب بعنوانه القديم. إن لم تكن أنت، فتجاهل هذه الرسالة.",

  approveSubject: "وافق على تغيير بريدك الإلكتروني على Sonosphere",
  approveHeading: "الموافقة على تغيير البريد",
  approveBody:
    "طلب {username} تغيير البريد الإلكتروني إلى {email}. وافق على ذلك هنا أولًا، ثم سنرسل رابط تحقق إلى العنوان الجديد.",
  approveButton: "الموافقة على تغيير البريد",
  approveNote: "يعمل هذا الرابط لمدة ساعة واحدة. إن لم تطلب هذا التغيير، فلا توافق عليه وغيّر كلمة مرورك.",

  emailChangedSubject: "تم تغيير بريدك الإلكتروني على Sonosphere",
  emailChangedHeading: "تم تغيير بريدك الإلكتروني",
  emailChangedBody:
    "أصبح البريد الإلكتروني للحساب {username} على Sonosphere هو {email}. ستُرسل رسائل الحساب إليه من الآن فصاعدًا.",
  emailChangedWarning:
    "إن لم تُجرِ هذا التغيير بنفسك، فربما يعرف شخص آخر كلمة مرورك. أعد تعيينها من صفحة تسجيل الدخول، وأبلغ فريق إدارة الموقع.",

  passwordChangedSubject: "تم تغيير كلمة مرورك على Sonosphere",
  passwordChangedHeading: "تم تغيير كلمة مرورك",
  passwordChangedBody:
    "تم للتو تغيير كلمة المرور للحساب {username} على Sonosphere، وتسجيل الخروج من جميع الأجهزة الأخرى.",
  passwordSetSubject: "عيّنت كلمة مرور على Sonosphere",
  passwordSetHeading: "عيّنت كلمة مرور",
  passwordSetBody:
    "أصبح للحساب {username} على Sonosphere كلمة مرور. يمكنك تسجيل الدخول بها واستخدامها في تطبيقات السكروبل التي تطلبها. ولا يزال تسجيل الدخول عبر مواقعك الأخرى يعمل أيضًا.",
  notYouReset: "إن لم تكن أنت، فأعد تعيين كلمة مرورك فورًا من صفحة تسجيل الدخول.",
  resetPasswordButton: "إعادة تعيين كلمة المرور",

  digestSubjectDaily: "يومك على Sonosphere: {count} جديد",
  digestSubjectWeekly: "أسبوعك على Sonosphere: {count} جديد",
  digestHeading: "مرحبًا {username}، إليك ما فاتك",
  digestMore: "و{count} غيرها في صندوق الوارد.",
  digestMessages: {
    zero: "{count} رسالة جديدة من {people}",
    one: "{count} رسالة جديدة من {people}",
    two: "{count} رسالتان جديدتان من {people}",
    few: "{count} رسائل جديدة من {people}",
    many: "{count} رسالة جديدة من {people}",
    other: "{count} رسالة جديدة من {people}",
  },
  digestPeople: {
    zero: "{count} شخص",
    one: "{count} شخص",
    two: "{count} شخصين",
    few: "{count} أشخاص",
    many: "{count} شخصًا",
    other: "{count} شخص",
  },
  openInbox: "افتح صندوق الوارد",

  followed: "بدأ {who} بمتابعتك",
  followedBySomeone: "بدأ أحدهم بمتابعتك",
  seeProfile: "عرض ملفه الشخصي",
  wallReply: "ردّ {who} على منشورك في الحائط",
  wallReplyBySomeone: "ردّ أحدهم على منشورك في الحائط",
  wallPost: "كتب {who} على حائطك",
  wallPostBySomeone: "كتب أحدهم على حائطك",
  seeWall: "عرض الحائط",
  commented: "علّق {who} على «{title}»",
  commentedBySomeone: "علّق أحدهم على «{title}»",
  commentedOnJournal: "علّق {who} على «تدوينتك»",
  commentedOnJournalBySomeone: "علّق أحدهم على «تدوينتك»",
  seeComment: "عرض التعليق",
  messageRequest: "أرسل لك {from} طلب مراسلة",
  seeRequest: "عرض الطلب",
  messageSent: "أرسل لك {from} رسالة",
  readIt: "اقرأها",
} satisfies Translation<typeof en>;
