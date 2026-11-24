import type en from "../en/mail";
import type { Translation } from "../core";

export default {
  pasteLink: "Eller klistra in det här i din webbläsare:",
  manageEmails: "Välj vilka mejl du får",
  manageEmailsLine: "Välj vilka mejl du får: {url}",
  footer: "Du får det här eftersom du har ett konto på {site}.",
  quoted: "”{text}”",

  verifySubject: "Bekräfta din e-postadress för Sonosphere",
  verifyHeading: "Hej {username}, bekräfta din e-postadress",
  verifyBody:
    "Tack för att du gick med i Sonosphere. Bekräfta att det här är din e-postadress så att du kan komma tillbaka in på kontot om du glömmer lösenordet.",
  verifyButton: "Bekräfta e-postadress",
  verifyNote:
    "Länken fungerar i 3 dagar; du kan be om en ny under Inställningar. Konton som inte bekräftas inom {days} dagar tas bort. Om du inte har registrerat dig kan du strunta i det här meddelandet, så tas kontot bort.",

  welcomeSubject: "Välkommen till Sonosphere",
  welcomeHeading: "Välkommen, {username}",
  welcomeIntro: "Din e-postadress är bekräftad och kontot är klart. Några saker att testa först:",
  welcomeImport:
    "Ta med dig dina scrobblingar. Importera din lyssningshistorik från Last.fm eller en fil, så fylls din profil, dina topplistor och rekommendationer i med allt du har spelat.",
  welcomeImportButton: "Importera dina scrobblingar",
  welcomeConnect:
    "Anslut sedan en spelare så att varje låt du spelar från och med nu scrobblas till din profil. Spotify, datorspelare och mobilappar fungerar allihop.",
  welcomeConnectButton: "Anslut en spelare",
  welcomeFollow: "Följ vänner och hitta dina musiktvillingar: personer vars smak ligger närmast din.",
  welcomeProfile: "Din profil: {url}",

  resetSubject: "Återställ ditt lösenord för Sonosphere",
  resetHeading: "Återställ ditt lösenord",
  resetBody: "Någon (förhoppningsvis du) bad om att återställa lösenordet för {username} på Sonosphere.",
  resetButton: "Välj ett nytt lösenord",
  resetNote:
    "Länken fungerar i en timme och bara en gång. Om du inte bad om det här kan du strunta i meddelandet: ditt lösenord förblir som det är.",

  changeSubject: "Bekräfta din nya e-postadress för Sonosphere",
  changeHeading: "Bekräfta din nya e-postadress",
  changeBody:
    "{username} på Sonosphere vill använda den här adressen från och med nu. Bekräfta den för att genomföra ändringen.",
  changeButton: "Bekräfta ny e-postadress",
  changeNote:
    "Länken fungerar i 3 dagar. Tills den används behåller kontot sin gamla adress. Om det inte var du kan du strunta i det här meddelandet.",

  approveSubject: "Godkänn bytet av e-postadress på Sonosphere",
  approveHeading: "Godkänn byte av e-postadress",
  approveBody:
    "{username} har begärt att byta e-postadress till {email}. Godkänn det här först; sedan skickar vi en verifieringslänk till den nya adressen.",
  approveButton: "Godkänn byte av e-postadress",
  approveNote:
    "Länken fungerar i en timme. Om du inte har begärt den här ändringen ska du inte godkänna den, och byt lösenord.",

  emailChangedSubject: "Din e-postadress på Sonosphere har ändrats",
  emailChangedHeading: "Din e-postadress har ändrats",
  emailChangedBody:
    "E-postadressen för {username} på Sonosphere är nu {email}. Mejl om kontot skickas dit från och med nu.",
  emailChangedWarning:
    "Om du inte gjorde den här ändringen kan någon annan ha ditt lösenord. Återställ det från inloggningssidan och meddela teamet.",

  passwordChangedSubject: "Ditt lösenord på Sonosphere har ändrats",
  passwordChangedHeading: "Ditt lösenord har ändrats",
  passwordChangedBody: "Lösenordet för {username} på Sonosphere ändrades precis, och alla andra enheter loggades ut.",
  passwordSetSubject: "Du har ställt in ett lösenord på Sonosphere",
  passwordSetHeading: "Du har ställt in ett lösenord",
  passwordSetBody:
    "{username} på Sonosphere har nu ett lösenord. Du kan logga in med det och använda det i scrobblingsappar som ber om ett. Inloggning via dina andra tjänster fungerar fortfarande också.",
  notYouReset: "Om det inte var du, återställ ditt lösenord direkt från inloggningssidan.",
  resetPasswordButton: "Återställ lösenord",

  digestSubjectDaily: "Din dag på Sonosphere: {count} nya",
  digestSubjectWeekly: "Din vecka på Sonosphere: {count} nya",
  digestHeading: "Hej {username}, det här har du missat",
  digestMore: "Och {count} till i din inkorg.",
  digestMessages: { one: "{count} nytt meddelande från {people}", other: "{count} nya meddelanden från {people}" },
  digestPeople: { one: "{count} person", other: "{count} personer" },
  openInbox: "Öppna din inkorg",

  followed: "{who} började följa dig",
  followedBySomeone: "Någon började följa dig",
  seeProfile: "Se profilen",
  wallReply: "{who} svarade på ditt vägginlägg",
  wallReplyBySomeone: "Någon svarade på ditt vägginlägg",
  wallPost: "{who} skrev på din vägg",
  wallPostBySomeone: "Någon skrev på din vägg",
  seeWall: "Se väggen",
  commented: "{who} kommenterade ”{title}”",
  commentedBySomeone: "Någon kommenterade ”{title}”",
  commentedOnJournal: "{who} kommenterade ”ditt dagboksinlägg”",
  commentedOnJournalBySomeone: "Någon kommenterade ”ditt dagboksinlägg”",
  seeComment: "Se kommentaren",
  messageRequest: "{from} skickade en meddelandeförfrågan till dig",
  seeRequest: "Se förfrågan",
  messageSent: "{from} skickade ett meddelande till dig",
  readIt: "Läs det",
} satisfies Translation<typeof en>;
