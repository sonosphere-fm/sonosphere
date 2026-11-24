import type en from "../en/mail";
import type { Translation } from "../core";

export default {
  pasteLink: "Oder kopiere das in deinen Browser:",
  manageEmails: "Wähle, welche E-Mails du bekommst",
  manageEmailsLine: "Wähle, welche E-Mails du bekommst: {url}",
  footer: "Du bekommst diese E-Mail wegen eines Kontos bei {site}.",
  quoted: "„{text}“",

  verifySubject: "Bestätige deine E-Mail-Adresse für Sonosphere",
  verifyHeading: "Hallo {username}, bestätige deine E-Mail-Adresse",
  verifyBody:
    "Danke, dass du bei Sonosphere dabei bist. Bestätige, dass das deine E-Mail-Adresse ist, damit du wieder in dein Konto kommst, falls du mal dein Passwort vergisst.",
  verifyButton: "E-Mail bestätigen",
  verifyNote:
    "Der Link ist 3 Tage gültig; einen neuen kannst du in den Einstellungen anfordern. Konten, die nicht innerhalb von {days} Tagen bestätigt werden, werden gelöscht. Wenn du dich nicht registriert hast, ignoriere diese Nachricht und das Konto wird entfernt.",

  purgeSubject: {
    one: "Dein Sonosphere-Konto wird in {count} Tag gelöscht",
    other: "Dein Sonosphere-Konto wird in {count} Tagen gelöscht",
  },
  purgeHeading: "Hallo {username}, dein Konto wird bald gelöscht",
  purgeBody: {
    one: "Du hast deine E-Mail-Adresse noch nicht bestätigt. Wenn du sie nicht innerhalb von {count} Tag bestätigst, werden dein Konto und alle seine Inhalte endgültig gelöscht.",
    other:
      "Du hast deine E-Mail-Adresse noch nicht bestätigt. Wenn du sie nicht innerhalb von {count} Tagen bestätigst, werden dein Konto und alle seine Inhalte endgültig gelöscht.",
  },
  purgeNote: "Wenn du dich nicht registriert hast, ignoriere diese Nachricht und das Konto wird entfernt.",

  welcomeSubject: "Willkommen bei Sonosphere",
  welcomeHeading: "Willkommen, {username}",
  welcomeIntro: "Deine E-Mail-Adresse ist bestätigt und dein Konto ist bereit. Ein paar Dinge zum Ausprobieren:",
  welcomeImport:
    "Nimm deine Scrobbles mit. Importiere deinen Hörverlauf von Last.fm oder aus einer Datei, und dein Profil, deine Charts und Empfehlungen füllen sich mit allem, was du gehört hast.",
  welcomeImportButton: "Scrobbles importieren",
  welcomeConnect:
    "Verbinde dann einen Player, damit ab jetzt jeder Song, den du hörst, in deinem Profil gescrobbelt wird. Spotify, Desktop-Player und Handy-Apps funktionieren alle.",
  welcomeConnectButton: "Player verbinden",
  welcomeFollow: "Folge Freunden und finde deine Soundalikes: Leute, deren Geschmack deinem am nächsten ist.",
  welcomeProfile: "Dein Profil: {url}",

  resetSubject: "Setze dein Sonosphere-Passwort zurück",
  resetHeading: "Passwort zurücksetzen",
  resetBody: "Jemand (hoffentlich du) möchte das Passwort für {username} bei Sonosphere zurücksetzen.",
  resetButton: "Neues Passwort wählen",
  resetNote:
    "Der Link ist eine Stunde und nur einmal gültig. Wenn du das nicht angefordert hast, ignoriere diese Nachricht: Dein Passwort bleibt, wie es ist.",

  changeSubject: "Bestätige deine neue E-Mail-Adresse für Sonosphere",
  changeHeading: "Bestätige deine neue E-Mail-Adresse",
  changeBody:
    "{username} bei Sonosphere möchte ab jetzt diese Adresse verwenden. Bestätige sie, um die Änderung abzuschließen.",
  changeButton: "Neue E-Mail bestätigen",
  changeNote:
    "Der Link ist 3 Tage gültig. Bis er verwendet wird, behält das Konto seine alte Adresse. Wenn du das nicht warst, ignoriere diese Nachricht.",

  approveSubject: "Genehmige die Änderung deiner Sonosphere-E-Mail-Adresse",
  approveHeading: "E-Mail-Änderung genehmigen",
  approveBody:
    "{username} hat eine Änderung der E-Mail-Adresse auf {email} angefordert. Genehmige sie zuerst hier; danach schicken wir einen Bestätigungslink an die neue Adresse.",
  approveButton: "E-Mail-Änderung genehmigen",
  approveNote:
    "Dieser Link ist eine Stunde gültig. Wenn du diese Änderung nicht angefordert hast, genehmige sie nicht und ändere dein Passwort.",

  emailChangedSubject: "Deine Sonosphere-E-Mail-Adresse wurde geändert",
  emailChangedHeading: "Deine E-Mail-Adresse wurde geändert",
  emailChangedBody:
    "Die E-Mail-Adresse für {username} bei Sonosphere lautet jetzt {email}. Post zum Konto geht ab jetzt dorthin.",
  emailChangedWarning:
    "Wenn du diese Änderung nicht vorgenommen hast, kennt vielleicht jemand anderes dein Passwort. Setze es auf der Anmeldeseite zurück und sag dem Team Bescheid.",

  passwordChangedSubject: "Dein Sonosphere-Passwort wurde geändert",
  passwordChangedHeading: "Dein Passwort wurde geändert",
  passwordChangedBody:
    "Das Passwort für {username} bei Sonosphere wurde gerade geändert, und alle anderen Geräte wurden abgemeldet.",
  passwordSetSubject: "Du hast ein Passwort für Sonosphere festgelegt",
  passwordSetHeading: "Du hast ein Passwort festgelegt",
  passwordSetBody:
    "{username} bei Sonosphere hat jetzt ein Passwort. Du kannst dich damit anmelden und es in Scrobbler-Apps verwenden, die danach fragen. Die Anmeldung über deine anderen Konten funktioniert weiterhin.",
  notYouReset: "Wenn du das nicht warst, setze dein Passwort sofort auf der Anmeldeseite zurück.",
  resetPasswordButton: "Passwort zurücksetzen",

  digestSubjectDaily: "Dein Tag auf Sonosphere: {count} neu",
  digestSubjectWeekly: "Deine Woche auf Sonosphere: {count} neu",
  digestHeading: "Hallo {username}, das hast du verpasst",
  digestMore: "Und {count} weitere in deinem Posteingang.",
  digestMessages: { one: "{count} neue Nachricht von {people}", other: "{count} neue Nachrichten von {people}" },
  digestPeople: { one: "{count} Person", other: "{count} Personen" },
  openInbox: "Posteingang öffnen",

  followed: "{who} folgt dir jetzt",
  followedBySomeone: "Jemand folgt dir jetzt",
  seeProfile: "Profil ansehen",
  wallReply: "{who} hat auf deinen Pinnwandbeitrag geantwortet",
  wallReplyBySomeone: "Jemand hat auf deinen Pinnwandbeitrag geantwortet",
  wallPost: "{who} hat auf deine Pinnwand geschrieben",
  wallPostBySomeone: "Jemand hat auf deine Pinnwand geschrieben",
  seeWall: "Pinnwand ansehen",
  commented: "{who} hat „{title}“ kommentiert",
  commentedBySomeone: "Jemand hat „{title}“ kommentiert",
  commentedOnJournal: "{who} hat „deinen Journalbeitrag“ kommentiert",
  commentedOnJournalBySomeone: "Jemand hat „deinen Journalbeitrag“ kommentiert",
  seeComment: "Kommentar ansehen",
  messageRequest: "{from} hat dir eine Nachrichtenanfrage geschickt",
  seeRequest: "Anfrage ansehen",
  messageSent: "{from} hat dir eine Nachricht geschickt",
  readIt: "Lesen",
} satisfies Translation<typeof en>;
