import type en from "../en/mail";
import type { Translation } from "../core";

export default {
  pasteLink: "Sau copiază asta în browser:",
  manageEmails: "Alege ce emailuri primești",
  manageEmailsLine: "Alege ce emailuri primești: {url}",
  footer: "Primești acest mesaj pentru că ai un cont pe {site}.",
  quoted: "„{text}”",

  verifySubject: "Confirmă-ți adresa de email pentru Sonosphere",
  verifyHeading: "Salut, {username}, confirmă-ți adresa de email",
  verifyBody:
    "Mulțumim că te-ai alăturat Sonosphere. Confirmă că aceasta este adresa ta de email, ca să poți intra din nou în cont dacă îți uiți vreodată parola.",
  verifyButton: "Confirmă emailul",
  verifyNote:
    "Linkul funcționează 3 zile; poți cere unul nou din Setări. Conturile neconfirmate în {days} zile sunt șterse. Dacă nu tu te-ai înregistrat, ignoră acest mesaj și contul va fi eliminat.",

  welcomeSubject: "Bun venit pe Sonosphere",
  welcomeHeading: "Bun venit, {username}",
  welcomeIntro: "Adresa ta de email este confirmată și contul e gata. Câteva lucruri de încercat mai întâi:",
  welcomeImport:
    "Adu-ți scrobble-urile cu tine. Importă istoricul de ascultări din Last.fm sau dintr-un fișier, iar profilul, topurile și recomandările se completează din tot ce ai ascultat.",
  welcomeImportButton: "Importă-ți scrobble-urile",
  welcomeConnect:
    "Apoi conectează un player, ca fiecare piesă pe care o asculți de acum înainte să ajungă ca scrobble pe profilul tău. Merg Spotify, playerele de desktop și aplicațiile de telefon.",
  welcomeConnectButton: "Conectează un player",
  welcomeFollow:
    "Urmărește-ți prietenii și găsește-ți sufletele pereche muzicale: oamenii cu gusturile cele mai apropiate de ale tale.",
  welcomeProfile: "Profilul tău: {url}",

  resetSubject: "Resetează-ți parola Sonosphere",
  resetHeading: "Resetează-ți parola",
  resetBody: "Cineva (sperăm că tu) a cerut resetarea parolei pentru {username} pe Sonosphere.",
  resetButton: "Alege o parolă nouă",
  resetNote:
    "Linkul funcționează o oră și o singură dată. Dacă nu ai cerut asta, ignoră acest mesaj: parola ta rămâne neschimbată.",

  changeSubject: "Confirmă noua adresă de email pentru Sonosphere",
  changeHeading: "Confirmă noua adresă de email",
  changeBody:
    "{username} de pe Sonosphere a cerut să folosească această adresă de acum înainte. Confirm-o pentru a face schimbarea.",
  changeButton: "Confirmă noul email",
  changeNote:
    "Linkul funcționează 3 zile. Până este folosit, contul păstrează vechea adresă. Dacă nu ai fost tu, ignoră acest mesaj.",

  approveSubject: "Aprobă schimbarea adresei de email Sonosphere",
  approveHeading: "Aprobă schimbarea adresei de email",
  approveBody:
    "{username} a cerut schimbarea adresei de email în {email}. Aprob-o mai întâi aici; apoi vom trimite un link de verificare la noua adresă.",
  approveButton: "Aprobă schimbarea",
  approveNote: "Acest link funcționează o oră. Dacă nu ai cerut această schimbare, nu o aproba și schimbă-ți parola.",

  emailChangedSubject: "Adresa ta de email Sonosphere a fost schimbată",
  emailChangedHeading: "Adresa ta de email a fost schimbată",
  emailChangedBody:
    "Adresa de email pentru {username} pe Sonosphere este acum {email}. De acum înainte, mesajele despre cont vor ajunge acolo.",
  emailChangedWarning:
    "Dacă nu tu ai făcut această schimbare, este posibil ca altcineva să-ți știe parola. Reseteaz-o de pe pagina de autentificare și anunță echipa site-ului.",

  passwordChangedSubject: "Parola ta Sonosphere a fost schimbată",
  passwordChangedHeading: "Parola ta a fost schimbată",
  passwordChangedBody:
    "Parola pentru {username} pe Sonosphere tocmai a fost schimbată, iar toate celelalte dispozitive au fost deconectate.",
  passwordSetSubject: "Ți-ai setat o parolă pe Sonosphere",
  passwordSetHeading: "Ți-ai setat o parolă",
  passwordSetBody:
    "{username} de pe Sonosphere are acum o parolă. Te poți autentifica cu ea și o poți folosi în aplicațiile de scrobbling care cer una. Autentificarea prin celelalte site-uri funcționează în continuare.",
  notYouReset: "Dacă nu ai fost tu, resetează-ți imediat parola de pe pagina de autentificare.",
  resetPasswordButton: "Resetează parola",

  digestSubjectDaily: "Ziua ta pe Sonosphere: noutăți ({count})",
  digestSubjectWeekly: "Săptămâna ta pe Sonosphere: noutăți ({count})",
  digestHeading: "Salut, {username}, iată ce ai pierdut",
  digestMore: "Și încă {count} în inbox.",
  digestMessages: {
    one: "{count} mesaj nou de la {people}",
    few: "{count} mesaje noi de la {people}",
    other: "{count} de mesaje noi de la {people}",
  },
  digestPeople: { one: "{count} persoană", few: "{count} persoane", other: "{count} de persoane" },
  openInbox: "Deschide inboxul",

  followed: "{who} a început să te urmărească",
  followedBySomeone: "Cineva a început să te urmărească",
  seeProfile: "Vezi profilul",
  wallReply: "{who} a răspuns la postarea ta de pe perete",
  wallReplyBySomeone: "Cineva a răspuns la postarea ta de pe perete",
  wallPost: "{who} a scris pe peretele tău",
  wallPostBySomeone: "Cineva a scris pe peretele tău",
  seeWall: "Vezi peretele",
  commented: "{who} a comentat la „{title}”",
  commentedBySomeone: "Cineva a comentat la „{title}”",
  commentedOnJournal: "{who} a comentat la „postarea ta din jurnal”",
  commentedOnJournalBySomeone: "Cineva a comentat la „postarea ta din jurnal”",
  seeComment: "Vezi comentariul",
  messageRequest: "{from} ți-a trimis o cerere de mesaj",
  seeRequest: "Vezi cererea",
  messageSent: "{from} ți-a trimis un mesaj",
  readIt: "Citește-l",
} satisfies Translation<typeof en>;
