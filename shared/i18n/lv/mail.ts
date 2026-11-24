import type en from "../en/mail";
import type { Translation } from "../core";

export default {
  pasteLink: "Vai iekopē šo pārlūkā:",
  manageEmails: "Izvēlies, kādus e-pastus saņemt",
  manageEmailsLine: "Izvēlies, kādus e-pastus saņemt: {url}",
  footer: "Tu saņem šo e-pastu, jo tev ir konts vietnē {site}.",
  quoted: "„{text}”",

  verifySubject: "Apstiprini savu e-pastu Sonosphere",
  verifyHeading: "Sveiks, {username}! Apstiprini savu e-pastu",
  verifyBody:
    "Paldies, ka pievienojies Sonosphere. Apstiprini, ka šī ir tava e-pasta adrese, lai varētu atgūt piekļuvi kontam, ja kādreiz aizmirsīsi paroli.",
  verifyButton: "Apstiprināt e-pastu",
  verifyNote:
    "Saite ir derīga 3 dienas; jaunu vari pieprasīt iestatījumos. Konti, kas netiek apstiprināti {days} dienu laikā, tiek dzēsti. Ja tu nereģistrējies, ignorē šo ziņu, un konts tiks noņemts.",

  welcomeSubject: "Laipni lūdzam Sonosphere",
  welcomeHeading: "Laipni lūdzam, {username}!",
  welcomeIntro: "Tavs e-pasts ir apstiprināts, un konts ir gatavs. Dažas lietas, ar ko sākt:",
  welcomeImport:
    "Paņem līdzi savus skrobļus. Importē klausīšanās vēsturi no Last.fm vai faila, un tavs profils, topi un ieteikumi aizpildīsies no visa, ko esi klausījies.",
  welcomeImportButton: "Importēt skrobļus",
  welcomeConnect:
    "Pēc tam pievieno atskaņotāju, lai katra dziesma, ko turpmāk klausīsies, tiktu noskroblēta tavā profilā. Der Spotify, datora atskaņotāji un telefona lietotnes.",
  welcomeConnectButton: "Pievienot atskaņotāju",
  welcomeFollow: "Seko draugiem un atrodi savus mūzikas dvīņus: cilvēkus, kuru gaume ir vistuvākā tavējai.",
  welcomeProfile: "Tavs profils: {url}",

  resetSubject: "Atiestati savu Sonosphere paroli",
  resetHeading: "Atiestati paroli",
  resetBody: "Kāds (cerams, tu) pieprasīja atiestatīt paroli lietotājam {username} vietnē Sonosphere.",
  resetButton: "Izvēlēties jaunu paroli",
  resetNote:
    "Saite ir derīga vienu stundu un tikai vienu reizi. Ja tu to nepieprasīji, ignorē šo ziņu: tava parole paliks nemainīta.",

  changeSubject: "Apstiprini savu jauno e-pastu Sonosphere",
  changeHeading: "Apstiprini jauno e-pastu",
  changeBody: "{username} vietnē Sonosphere vēlas turpmāk izmantot šo adresi. Apstiprini to, lai veiktu maiņu.",
  changeButton: "Apstiprināt jauno e-pastu",
  changeNote:
    "Saite ir derīga 3 dienas. Kamēr tā nav izmantota, kontam paliek vecā adrese. Ja tas nebiji tu, ignorē šo ziņu.",

  approveSubject: "Apstiprini Sonosphere e-pasta maiņu",
  approveHeading: "Apstiprini e-pasta maiņu",
  approveBody:
    "{username} pieprasīja mainīt e-pastu uz {email}. Vispirms apstiprini to šeit; pēc tam nosūtīsim apstiprinājuma saiti uz jauno adresi.",
  approveButton: "Apstiprināt e-pasta maiņu",
  approveNote: "Šī saite ir derīga vienu stundu. Ja tu nepieprasīji šo maiņu, neapstiprini to un nomaini paroli.",

  emailChangedSubject: "Tavs Sonosphere e-pasts tika mainīts",
  emailChangedHeading: "Tavs e-pasts tika mainīts",
  emailChangedBody:
    "Lietotāja {username} e-pasts vietnē Sonosphere tagad ir {email}. Turpmāk vēstules par kontu tiks sūtītas uz turieni.",
  emailChangedWarning:
    "Ja šo maiņu neveici tu, kādam citam var būt tava parole. Atiestati to pieteikšanās lapā un paziņo vietnes komandai.",

  passwordChangedSubject: "Tava Sonosphere parole tika mainīta",
  passwordChangedHeading: "Tava parole tika mainīta",
  passwordChangedBody:
    "Lietotāja {username} parole vietnē Sonosphere tikko tika mainīta, un visas pārējās ierīces tika izrakstītas.",
  passwordSetSubject: "Tu iestatīji paroli Sonosphere",
  passwordSetHeading: "Tu iestatīji paroli",
  passwordSetBody:
    "Lietotājam {username} vietnē Sonosphere tagad ir parole. Ar to vari pieteikties un izmantot to skroblēšanas lietotnēs, kas to prasa. Pieteikšanās ar citām vietnēm arī joprojām darbojas.",
  notYouReset: "Ja tas nebiji tu, nekavējoties atiestati paroli pieteikšanās lapā.",
  resetPasswordButton: "Atiestatīt paroli",

  digestSubjectDaily: "Tava diena Sonosphere: jaunumi ({count})",
  digestSubjectWeekly: "Tava nedēļa Sonosphere: jaunumi ({count})",
  digestHeading: "Sveiks, {username}! Lūk, ko palaidi garām",
  digestMore: "Un vēl {count} tavā iesūtnē.",
  digestMessages: {
    zero: "{count} jaunas ziņas no {people}",
    one: "{count} jauna ziņa no {people}",
    other: "{count} jaunas ziņas no {people}",
  },
  digestPeople: { zero: "{count} cilvēkiem", one: "{count} cilvēka", other: "{count} cilvēkiem" },
  openInbox: "Atvērt iesūtni",

  followed: "{who} sāka tev sekot",
  followedBySomeone: "Kāds sāka tev sekot",
  seeProfile: "Skatīt profilu",
  wallReply: "{who} atbildēja uz tavu sienas ierakstu",
  wallReplyBySomeone: "Kāds atbildēja uz tavu sienas ierakstu",
  wallPost: "{who} uzrakstīja uz tavas sienas",
  wallPostBySomeone: "Kāds uzrakstīja uz tavas sienas",
  seeWall: "Skatīt sienu",
  commented: "{who} komentēja „{title}”",
  commentedBySomeone: "Kāds komentēja „{title}”",
  commentedOnJournal: "{who} komentēja „tavu žurnāla ierakstu”",
  commentedOnJournalBySomeone: "Kāds komentēja „tavu žurnāla ierakstu”",
  seeComment: "Skatīt komentāru",
  messageRequest: "{from} nosūtīja tev ziņas pieprasījumu",
  seeRequest: "Skatīt pieprasījumu",
  messageSent: "{from} nosūtīja tev ziņu",
  readIt: "Lasīt",
} satisfies Translation<typeof en>;
