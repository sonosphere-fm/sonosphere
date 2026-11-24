import type en from "../en/mail";
import type { Translation } from "../core";

export default {
  pasteLink: "Atau tempel ini ke perambanmu:",
  manageEmails: "Pilih email yang kamu terima",
  manageEmailsLine: "Pilih email yang kamu terima: {url}",
  footer: "Kamu menerima ini karena memiliki akun di {site}.",
  quoted: "“{text}”",

  verifySubject: "Konfirmasi emailmu untuk Sonosphere",
  verifyHeading: "Hai {username}, konfirmasi emailmu",
  verifyBody:
    "Terima kasih telah bergabung dengan Sonosphere. Konfirmasi ini alamat emailmu agar kamu dapat masuk kembali ke akunmu jika lupa kata sandi.",
  verifyButton: "Konfirmasi email",
  verifyNote:
    "Tautan berlaku 3 hari; kamu dapat meminta yang baru dari Pengaturan. Akun yang tidak dikonfirmasi dalam {days} hari dihapus. Jika kamu tidak mendaftar, abaikan pesan ini dan akun akan dihapus.",

  welcomeSubject: "Selamat datang di Sonosphere",
  welcomeHeading: "Selamat datang, {username}",
  welcomeIntro: "Emailmu dikonfirmasi dan akunmu siap. Beberapa hal untuk dicoba dulu:",
  welcomeImport:
    "Bawa scrobblemu bersamamu. Impor riwayat mendengarkanmu dari Last.fm atau file dan profilmu, tangga dan rekomendasi terisi dari semua yang pernah kamu putar.",
  welcomeImportButton: "Impor scrobblemu",
  welcomeConnect:
    "Lalu hubungkan pemutar agar setiap lagu yang kamu putar mulai sekarang di-scrobble ke profilmu. Spotify, pemutar desktop dan aplikasi ponsel semuanya bekerja.",
  welcomeConnectButton: "Hubungkan pemutar",
  welcomeFollow: "Ikuti teman dan temukan soundalikemu: orang yang selaramu paling dekat.",
  welcomeProfile: "Profilmu: {url}",

  resetSubject: "Atur ulang kata sandi Sonospheremu",
  resetHeading: "Atur ulang kata sandimu",
  resetBody: "Seseorang (semoga kamu) meminta atur ulang kata sandi untuk {username} di Sonosphere.",
  resetButton: "Pilih kata sandi baru",
  resetNote:
    "Tautan berlaku satu jam dan hanya sekali. Jika kamu tidak meminta ini, abaikan pesan ini: kata sandimu tetap seperti semula.",

  changeSubject: "Konfirmasi email baru Sonospheremu",
  changeHeading: "Konfirmasi email barumu",
  changeBody:
    "{username} di Sonosphere meminta menggunakan alamat ini mulai sekarang. Konfirmasi untuk membuat perubahan.",
  changeButton: "Konfirmasi email baru",
  changeNote:
    "Tautan berlaku 3 hari. Sampai digunakan, akun tetap menggunakan alamat lama. Jika ini bukan kamu, abaikan pesan ini.",

  approveSubject: "Setujui perubahan email Sonospheremu",
  approveHeading: "Setujui perubahan email",
  approveBody:
    "{username} meminta perubahan email ke {email}. Setujui di sini dulu; kami kemudian akan mengirim tautan verifikasi ke alamat baru.",
  approveButton: "Setujui perubahan email",
  approveNote:
    "Tautan ini berlaku satu jam. Jika kamu tidak meminta perubahan ini, jangan setujui dan ubah kata sandimu.",

  emailChangedSubject: "Email Sonospheremu diubah",
  emailChangedHeading: "Emailmu diubah",
  emailChangedBody:
    "Email untuk {username} di Sonosphere sekarang {email}. Surat tentang akun akan dikirim ke sana mulai sekarang.",
  emailChangedWarning:
    "Jika kamu tidak membuat perubahan ini, orang lain mungkin memiliki kata sandimu. Atur ulang dari halaman masuk, dan beri tahu staf situs.",

  passwordChangedSubject: "Kata sandi Sonospheremu diubah",
  passwordChangedHeading: "Kata sandimu diubah",
  passwordChangedBody:
    "Kata sandi untuk {username} di Sonosphere baru saja diubah, dan setiap perangkat lain dikeluarkan.",

  passwordSetSubject: "Kamu mengatur kata sandi di Sonosphere",
  passwordSetHeading: "Kamu mengatur kata sandi",
  passwordSetBody:
    "{username} di Sonosphere sekarang memiliki kata sandi. Kamu dapat masuk dengan itu, dan menggunakannya di aplikasi scrobbler yang memintanya. Masuk dengan situs lainmu tetap bekerja.",

  notYouReset: "Jika ini bukan kamu, atur ulang kata sandimu segera dari halaman masuk.",
  resetPasswordButton: "Atur ulang kata sandi",

  digestSubjectDaily: "Harimu di Sonosphere: {count} baru",
  digestSubjectWeekly: "Minggumu di Sonosphere: {count} baru",
  digestHeading: "Hai {username}, ini yang kamu lewatkan",
  digestMore: "Dan {count} lainnya di kotak masukmu.",
  digestMessages: { one: "{count} pesan baru dari {people}", other: "{count} pesan baru dari {people}" },
  digestPeople: { one: "{count} orang", other: "{count} orang" },
  openInbox: "Buka kotak masukmu",

  followed: "{who} mulai mengikutimu",
  followedBySomeone: "Seseorang mulai mengikutimu",
  seeProfile: "Lihat profil mereka",
  wallReply: "{who} membalas pos dindingmu",
  wallReplyBySomeone: "Seseorang membalas pos dindingmu",
  wallPost: "{who} menulis di dindingmu",
  wallPostBySomeone: "Seseorang menulis di dindingmu",
  seeWall: "Lihat dinding",
  commented: "{who} berkomentar di “{title}”",
  commentedBySomeone: "Seseorang berkomentar di “{title}”",
  commentedOnJournal: "{who} berkomentar di “pos jurnalmu”",
  commentedOnJournalBySomeone: "Seseorang berkomentar di “pos jurnalmu”",
  seeComment: "Lihat komentar",
  messageRequest: "{from} mengirim permintaan pesan kepadamu",
  seeRequest: "Lihat permintaan",
  messageSent: "{from} mengirim pesan kepadamu",
  readIt: "Baca",
} satisfies Translation<typeof en>;
