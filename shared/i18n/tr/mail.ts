import type en from "../en/mail";
import type { Translation } from "../core";

export default {
  pasteLink: "Ya da bunu tarayıcına yapıştır:",
  manageEmails: "Hangi e-postaları alacağını seç",
  manageEmailsLine: "Hangi e-postaları alacağını seç: {url}",
  footer: "Bu e-postayı {site} üzerindeki hesabın nedeniyle alıyorsun.",
  quoted: "“{text}”",

  verifySubject: "Sonosphere için e-postanı onayla",
  verifyHeading: "Merhaba {username}, e-postanı onayla",
  verifyBody:
    "Sonosphere'e katıldığın için teşekkürler. Şifreni unutursan hesabına geri dönebilmen için bu e-posta adresinin sana ait olduğunu onayla.",
  verifyButton: "E-postayı onayla",
  verifyNote:
    "Bağlantı 3 gün geçerli; Ayarlar'dan yenisini isteyebilirsin. {days} gün içinde onaylanmayan hesaplar silinir. Kaydolan sen değilsen bu mesajı yok say, hesap kaldırılacak.",

  purgeSubject: { one: "Sonosphere hesabın {count} gün içinde silinecek", other: "Sonosphere hesabın {count} gün içinde silinecek" },
  purgeHeading: "Merhaba {username}, hesabın silinmek üzere",
  purgeBody: {
    one: "E-posta adresini henüz onaylamadın. {count} gün içinde onaylamazsan hesabın ve içindeki her şey kalıcı olarak silinecek.",
    other:
      "E-posta adresini henüz onaylamadın. {count} gün içinde onaylamazsan hesabın ve içindeki her şey kalıcı olarak silinecek.",
  },
  purgeNote: "Kaydolan sen değilsen bu mesajı yok say, hesap kaldırılacak.",

  welcomeSubject: "Sonosphere'e hoş geldin",
  welcomeHeading: "Hoş geldin, {username}",
  welcomeIntro: "E-postan onaylandı ve hesabın hazır. İlk olarak deneyebileceğin birkaç şey:",
  welcomeImport:
    "Scrobble'larını yanında getir. Dinleme geçmişini Last.fm'den ya da bir dosyadan içe aktar; profilin, listelerin ve önerilerin bugüne kadar dinlediğin her şeyle dolsun.",
  welcomeImportButton: "Scrobble'larını içe aktar",
  welcomeConnect:
    "Sonra bir oynatıcı bağla, böylece bundan sonra çaldığın her şarkı profiline scrobble edilsin. Spotify, masaüstü oynatıcılar ve telefon uygulamaları çalışır.",
  welcomeConnectButton: "Oynatıcı bağla",
  welcomeFollow: "Arkadaşlarını takip et ve müzik zevki sana en yakın olan kişileri, yani ruh ikizlerini bul.",
  welcomeProfile: "Profilin: {url}",

  resetSubject: "Sonosphere şifreni sıfırla",
  resetHeading: "Şifreni sıfırla",
  resetBody: "Biri (umarız sensin) Sonosphere'deki {username} hesabının şifresini sıfırlamak istedi.",
  resetButton: "Yeni şifre seç",
  resetNote:
    "Bağlantı bir saat geçerli ve yalnızca bir kez kullanılabilir. Bunu sen istemediysen bu mesajı yok say: şifren olduğu gibi kalır.",

  changeSubject: "Sonosphere için yeni e-postanı onayla",
  changeHeading: "Yeni e-postanı onayla",
  changeBody:
    "Sonosphere'deki {username} hesabı bundan sonra bu adresi kullanmak istedi. Değişikliği yapmak için onayla.",
  changeButton: "Yeni e-postayı onayla",
  changeNote: "Bağlantı 3 gün geçerli. Kullanılana kadar hesap eski adresini korur. Bu sen değilsen bu mesajı yok say.",

  approveSubject: "Sonosphere e-posta değişikliğini onayla",
  approveHeading: "E-posta değişikliğini onayla",
  approveBody:
    "{username} hesabı için e-posta adresinin {email} olarak değiştirilmesi istendi. Önce buradan onayla; sonra yeni adrese bir doğrulama bağlantısı göndereceğiz.",
  approveButton: "E-posta değişikliğini onayla",
  approveNote: "Bu bağlantı bir saat geçerli. Bu değişikliği sen istemediysen onaylama ve şifreni değiştir.",

  emailChangedSubject: "Sonosphere e-postan değiştirildi",
  emailChangedHeading: "E-postan değiştirildi",
  emailChangedBody:
    "Sonosphere'deki {username} hesabının e-posta adresi artık {email}. Hesapla ilgili e-postalar bundan sonra oraya gidecek.",
  emailChangedWarning:
    "Bu değişikliği sen yapmadıysan şifren başka birinin elinde olabilir. Giriş sayfasından sıfırla ve site ekibine haber ver.",

  passwordChangedSubject: "Sonosphere şifren değiştirildi",
  passwordChangedHeading: "Şifren değiştirildi",
  passwordChangedBody:
    "Sonosphere'deki {username} hesabının şifresi az önce değiştirildi ve diğer tüm cihazlarda oturum kapatıldı.",
  passwordSetSubject: "Sonosphere'de bir şifre belirledin",
  passwordSetHeading: "Bir şifre belirledin",
  passwordSetBody:
    "Sonosphere'deki {username} hesabının artık bir şifresi var. Bu şifreyle giriş yapabilir, şifre isteyen scrobbler uygulamalarında kullanabilirsin. Diğer sitelerinle giriş yapmak da çalışmaya devam ediyor.",
  notYouReset: "Bu sen değilsen şifreni hemen giriş sayfasından sıfırla.",
  resetPasswordButton: "Şifreyi sıfırla",

  digestSubjectDaily: "Sonosphere'de günün: {count} yeni",
  digestSubjectWeekly: "Sonosphere'de haftan: {count} yeni",
  digestHeading: "Merhaba {username}, kaçırdıkların burada",
  digestMore: "Gelen kutunda {count} tane daha var.",
  digestMessages: {
    one: "{people} sana {count} yeni mesaj gönderdi",
    other: "{people} sana {count} yeni mesaj gönderdi",
  },
  digestPeople: { one: "{count} kişi", other: "{count} kişi" },
  openInbox: "Gelen kutunu aç",

  followed: "{who} seni takip etmeye başladı",
  followedBySomeone: "Biri seni takip etmeye başladı",
  seeProfile: "Profiline bak",
  wallReply: "{who} duvar gönderini yanıtladı",
  wallReplyBySomeone: "Biri duvar gönderini yanıtladı",
  wallPost: "{who} duvarına yazdı",
  wallPostBySomeone: "Biri duvarına yazdı",
  seeWall: "Duvara bak",
  commented: "{who}, “{title}” için yorum yaptı",
  commentedBySomeone: "Biri “{title}” için yorum yaptı",
  commentedOnJournal: "{who}, “günlük yazın” için yorum yaptı",
  commentedOnJournalBySomeone: "Biri “günlük yazın” için yorum yaptı",
  seeComment: "Yoruma bak",
  messageRequest: "{from} sana bir mesaj isteği gönderdi",
  seeRequest: "İsteğe bak",
  messageSent: "{from} sana bir mesaj gönderdi",
  readIt: "Oku",
} satisfies Translation<typeof en>;
