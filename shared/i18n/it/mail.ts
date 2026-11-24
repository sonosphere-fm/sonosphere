import type en from "../en/mail";
import type { Translation } from "../core";

export default {
  pasteLink: "Oppure incolla questo nel browser:",
  manageEmails: "Scegli quali email ricevere",
  manageEmailsLine: "Scegli quali email ricevere: {url}",
  footer: "Ricevi questa email perché hai un account su {site}.",
  quoted: "“{text}”",

  verifySubject: "Conferma la tua email per Sonosphere",
  verifyHeading: "Ciao {username}, conferma la tua email",
  verifyBody:
    "Grazie per esserti iscritto a Sonosphere. Conferma che questo è il tuo indirizzo email, così potrai rientrare nel tuo account se dimentichi la password.",
  verifyButton: "Conferma email",
  verifyNote:
    "Il link è valido per 3 giorni; puoi richiederne uno nuovo dalle Impostazioni. Gli account non confermati entro {days} giorni vengono eliminati. Se non ti sei iscritto, ignora questo messaggio e l’account verrà rimosso.",

  welcomeSubject: "Benvenuto su Sonosphere",
  welcomeHeading: "Benvenuto, {username}",
  welcomeIntro: "La tua email è confermata e il tuo account è pronto. Ecco qualche cosa da provare subito:",
  welcomeImport:
    "Porta con te i tuoi scrobble. Importa la tua cronologia di ascolto da Last.fm o da un file: profilo, classifiche e consigli si riempiono con tutto quello che hai ascoltato.",
  welcomeImportButton: "Importa i tuoi scrobble",
  welcomeConnect:
    "Poi collega un player, così ogni brano che ascolti da ora in poi viene scrobblato sul tuo profilo. Funzionano Spotify, i player desktop e le app per smartphone.",
  welcomeConnectButton: "Collega un player",
  welcomeFollow: "Segui gli amici e trova le tue anime gemelle musicali: le persone con i gusti più vicini ai tuoi.",
  welcomeProfile: "Il tuo profilo: {url}",

  resetSubject: "Reimposta la tua password di Sonosphere",
  resetHeading: "Reimposta la password",
  resetBody: "Qualcuno (speriamo tu) ha chiesto di reimpostare la password di {username} su Sonosphere.",
  resetButton: "Scegli una nuova password",
  resetNote:
    "Il link è valido per un’ora e funziona una sola volta. Se non l’hai chiesto tu, ignora questo messaggio: la tua password resta com’è.",

  changeSubject: "Conferma la tua nuova email per Sonosphere",
  changeHeading: "Conferma la tua nuova email",
  changeBody:
    "{username} su Sonosphere ha chiesto di usare questo indirizzo d’ora in poi. Confermalo per completare la modifica.",
  changeButton: "Conferma nuova email",
  changeNote:
    "Il link è valido per 3 giorni. Finché non viene usato, l’account mantiene il vecchio indirizzo. Se non sei stato tu, ignora questo messaggio.",

  approveSubject: "Approva il cambio di email su Sonosphere",
  approveHeading: "Approva il cambio di email",
  approveBody:
    "{username} ha chiesto di cambiare l’email in {email}. Prima approvalo qui; poi invieremo un link di verifica al nuovo indirizzo.",
  approveButton: "Approva il cambio di email",
  approveNote:
    "Il link è valido per un’ora. Se non hai chiesto tu questa modifica, non approvarla e cambia la tua password.",

  emailChangedSubject: "La tua email di Sonosphere è stata cambiata",
  emailChangedHeading: "La tua email è stata cambiata",
  emailChangedBody:
    "L’email di {username} su Sonosphere ora è {email}. Da adesso le comunicazioni sull’account arriveranno lì.",
  emailChangedWarning:
    "Se non hai fatto tu questa modifica, qualcun altro potrebbe avere la tua password. Reimpostala dalla pagina di accesso e avvisa lo staff del sito.",

  passwordChangedSubject: "La tua password di Sonosphere è stata cambiata",
  passwordChangedHeading: "La tua password è stata cambiata",
  passwordChangedBody:
    "La password di {username} su Sonosphere è appena stata cambiata e tutti gli altri dispositivi sono stati disconnessi.",
  passwordSetSubject: "Hai impostato una password su Sonosphere",
  passwordSetHeading: "Hai impostato una password",
  passwordSetBody:
    "{username} su Sonosphere ora ha una password. Puoi usarla per accedere e nelle app di scrobbling che la chiedono. Puoi continuare ad accedere anche con gli altri siti.",
  notYouReset: "Se non sei stato tu, reimposta subito la password dalla pagina di accesso.",
  resetPasswordButton: "Reimposta password",

  digestSubjectDaily: "La tua giornata su Sonosphere: {count} novità",
  digestSubjectWeekly: "La tua settimana su Sonosphere: {count} novità",
  digestHeading: "Ciao {username}, ecco cosa ti sei perso",
  digestMore: "E altri {count} nella tua casella.",
  digestMessages: { one: "{count} nuovo messaggio da {people}", other: "{count} nuovi messaggi da {people}" },
  digestPeople: { one: "{count} persona", other: "{count} persone" },
  openInbox: "Apri la tua casella",

  followed: "{who} ha iniziato a seguirti",
  followedBySomeone: "Qualcuno ha iniziato a seguirti",
  seeProfile: "Vedi il suo profilo",
  wallReply: "{who} ha risposto al tuo post in bacheca",
  wallReplyBySomeone: "Qualcuno ha risposto al tuo post in bacheca",
  wallPost: "{who} ha scritto sulla tua bacheca",
  wallPostBySomeone: "Qualcuno ha scritto sulla tua bacheca",
  seeWall: "Vedi la bacheca",
  commented: "{who} ha commentato “{title}”",
  commentedBySomeone: "Qualcuno ha commentato “{title}”",
  commentedOnJournal: "{who} ha commentato “il tuo post nel diario”",
  commentedOnJournalBySomeone: "Qualcuno ha commentato “il tuo post nel diario”",
  seeComment: "Vedi il commento",
  messageRequest: "{from} ti ha inviato una richiesta di messaggio",
  seeRequest: "Vedi la richiesta",
  messageSent: "{from} ti ha inviato un messaggio",
  readIt: "Leggilo",
} satisfies Translation<typeof en>;
