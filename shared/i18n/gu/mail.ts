import type en from "../en/mail";
import type { Translation } from "../core";

export default {
  pasteLink: "અથવા આ તમારા બ્રાઉઝરમાં પેસ્ટ કરો:",
  manageEmails: "તમને કયા ઇમેઇલ મળે તે પસંદ કરો",
  manageEmailsLine: "તમને કયા ઇમેઇલ મળે તે પસંદ કરો: {url}",
  footer: "{site} પર તમારું એકાઉન્ટ હોવાથી તમને આ મળી રહ્યું છે.",
  quoted: "“{text}”",

  verifySubject: "Sonosphere માટે તમારો ઇમેઇલ કન્ફર્મ કરો",
  verifyHeading: "નમસ્તે {username}, તમારો ઇમેઇલ કન્ફર્મ કરો",
  verifyBody:
    "Sonosphere સાથે જોડાવા બદલ આભાર. આ તમારું ઇમેઇલ સરનામું છે તે કન્ફર્મ કરો, જેથી પાસવર્ડ ભૂલી જાઓ તો પણ તમે તમારા એકાઉન્ટમાં પાછા આવી શકો.",
  verifyButton: "ઇમેઇલ કન્ફર્મ કરો",
  verifyNote:
    "આ લિંક 3 દિવસ ચાલે છે; સેટિંગ્સમાંથી તમે નવી લિંક માંગી શકો છો. {days} દિવસમાં કન્ફર્મ ન થયેલા એકાઉન્ટ કાઢી નાખવામાં આવે છે. જો તમે સાઇન અપ ન કર્યું હોય, તો આ સંદેશની અવગણના કરો અને એકાઉન્ટ દૂર થઈ જશે.",

  purgeSubject: { other: "તમારું Sonosphere એકાઉન્ટ {count} દિવસમાં કાઢી નાખવામાં આવશે" },
  purgeHeading: "નમસ્તે {username}, તમારું એકાઉન્ટ કાઢી નાખવામાં આવવાનું છે",
  purgeBody: {
    other:
      "તમે હજી તમારો ઇમેઇલ કન્ફર્મ કર્યો નથી. જો તમે {count} દિવસમાં કન્ફર્મ નહીં કરો, તો તમારું એકાઉન્ટ અને તેમાંનું બધું કાયમ માટે કાઢી નાખવામાં આવશે.",
  },
  purgeNote: "જો તમે સાઇન અપ ન કર્યું હોય, તો આ સંદેશને અવગણો અને એકાઉન્ટ દૂર કરવામાં આવશે.",

  welcomeSubject: "Sonosphere માં તમારું સ્વાગત છે",
  welcomeHeading: "સ્વાગત છે, {username}",
  welcomeIntro: "તમારો ઇમેઇલ કન્ફર્મ થઈ ગયો છે અને તમારું એકાઉન્ટ તૈયાર છે. પહેલાં આ થોડી વસ્તુઓ અજમાવો:",
  welcomeImport:
    "તમારા સ્ક્રોબલ સાથે લાવો. Last.fm અથવા ફાઇલમાંથી તમારો સાંભળવાનો ઇતિહાસ ઇમ્પોર્ટ કરો, અને તમે વગાડેલી દરેક વસ્તુ પરથી તમારી પ્રોફાઇલ, ચાર્ટ અને ભલામણો ભરાઈ જશે.",
  welcomeImportButton: "તમારા સ્ક્રોબલ ઇમ્પોર્ટ કરો",
  welcomeConnect:
    "પછી એક પ્લેયર કનેક્ટ કરો, જેથી હવેથી તમે વગાડો તે દરેક ગીત તમારી પ્રોફાઇલ પર સ્ક્રોબલ થાય. Spotify, ડેસ્કટૉપ પ્લેયર અને ફોન ઍપ બધું ચાલે છે.",
  welcomeConnectButton: "પ્લેયર કનેક્ટ કરો",
  welcomeFollow: "મિત્રોને ફૉલો કરો અને તમારા જેવી રુચિવાળા લોકો શોધો: જેમની પસંદ તમારી સૌથી નજીક છે.",
  welcomeProfile: "તમારી પ્રોફાઇલ: {url}",

  resetSubject: "તમારો Sonosphere પાસવર્ડ રીસેટ કરો",
  resetHeading: "તમારો પાસવર્ડ રીસેટ કરો",
  resetBody: "કોઈએ (આશા છે કે તમે) Sonosphere પર {username} નો પાસવર્ડ રીસેટ કરવાનું કહ્યું છે.",
  resetButton: "નવો પાસવર્ડ પસંદ કરો",
  resetNote:
    "આ લિંક એક કલાક અને ફક્ત એક જ વાર ચાલે છે. જો તમે આ ન માંગ્યું હોય, તો આ સંદેશની અવગણના કરો: તમારો પાસવર્ડ જેમ છે તેમ જ રહેશે.",

  changeSubject: "Sonosphere માટે તમારો નવો ઇમેઇલ કન્ફર્મ કરો",
  changeHeading: "તમારો નવો ઇમેઇલ કન્ફર્મ કરો",
  changeBody: "Sonosphere પર {username} એ હવેથી આ સરનામું વાપરવાનું કહ્યું છે. ફેરફાર કરવા માટે તેને કન્ફર્મ કરો.",
  changeButton: "નવો ઇમેઇલ કન્ફર્મ કરો",
  changeNote: "આ લિંક 3 દિવસ ચાલે છે. તે વપરાય ત્યાં સુધી એકાઉન્ટમાં જૂનું સરનામું જ રહેશે. જો આ તમે ન હો, તો આ સંદેશની અવગણના કરો.",

  approveSubject: "તમારા Sonosphere ઇમેઇલ ફેરફારને મંજૂરી આપો",
  approveHeading: "ઇમેઇલ ફેરફારને મંજૂરી આપો",
  approveBody:
    "{username} એ ઇમેઇલ બદલીને {email} કરવાની વિનંતી કરી છે. પહેલાં અહીં મંજૂરી આપો; પછી અમે નવા સરનામે વેરિફિકેશન લિંક મોકલીશું.",
  approveButton: "ઇમેઇલ ફેરફારને મંજૂરી આપો",
  approveNote: "આ લિંક એક કલાક ચાલે છે. જો તમે આ ફેરફારની વિનંતી ન કરી હોય, તો મંજૂરી ન આપો અને તમારો પાસવર્ડ બદલો.",

  emailChangedSubject: "તમારો Sonosphere ઇમેઇલ બદલાયો છે",
  emailChangedHeading: "તમારો ઇમેઇલ બદલાયો છે",
  emailChangedBody: "Sonosphere પર {username} નો ઇમેઇલ હવે {email} છે. એકાઉન્ટ વિશેના મેઇલ હવેથી ત્યાં જશે.",
  emailChangedWarning:
    "જો આ ફેરફાર તમે ન કર્યો હોય, તો કદાચ કોઈ બીજા પાસે તમારો પાસવર્ડ છે. લૉગ-ઇન પેજ પરથી તેને રીસેટ કરો અને સાઇટ સ્ટાફને જાણ કરો.",

  passwordChangedSubject: "તમારો Sonosphere પાસવર્ડ બદલાયો છે",
  passwordChangedHeading: "તમારો પાસવર્ડ બદલાયો છે",
  passwordChangedBody: "Sonosphere પર {username} નો પાસવર્ડ હમણાં જ બદલાયો છે, અને બાકીના બધા ડિવાઇસ સાઇન આઉટ થઈ ગયા છે.",
  passwordSetSubject: "તમે Sonosphere પર પાસવર્ડ સેટ કર્યો",
  passwordSetHeading: "તમે પાસવર્ડ સેટ કર્યો",
  passwordSetBody:
    "Sonosphere પર {username} નો હવે પાસવર્ડ છે. તમે તેનાથી લૉગ ઇન કરી શકો છો, અને પાસવર્ડ માંગતી સ્ક્રોબલર ઍપમાં પણ વાપરી શકો છો. તમારી બીજી સાઇટ્સથી સાઇન ઇન કરવાનું પણ ચાલુ રહેશે.",
  notYouReset: "જો આ તમે ન હો, તો લૉગ-ઇન પેજ પરથી તરત જ તમારો પાસવર્ડ રીસેટ કરો.",
  resetPasswordButton: "પાસવર્ડ રીસેટ કરો",

  digestSubjectDaily: "Sonosphere પર તમારો દિવસ: {count} નવા",
  digestSubjectWeekly: "Sonosphere પર તમારું અઠવાડિયું: {count} નવા",
  digestHeading: "નમસ્તે {username}, તમે આ ચૂકી ગયા",
  digestMore: "અને તમારા ઇનબૉક્સમાં વધુ {count}.",
  digestMessages: { one: "{people} તરફથી {count} નવો સંદેશ", other: "{people} તરફથી {count} નવા સંદેશ" },
  digestPeople: { one: "{count} વ્યક્તિ", other: "{count} લોકો" },
  openInbox: "તમારું ઇનબૉક્સ ખોલો",

  followed: "{who} એ તમને ફૉલો કરવાનું શરૂ કર્યું",
  followedBySomeone: "કોઈએ તમને ફૉલો કરવાનું શરૂ કર્યું",
  seeProfile: "તેમની પ્રોફાઇલ જુઓ",
  wallReply: "{who} એ તમારી વૉલ પોસ્ટનો જવાબ આપ્યો",
  wallReplyBySomeone: "કોઈએ તમારી વૉલ પોસ્ટનો જવાબ આપ્યો",
  wallPost: "{who} એ તમારી વૉલ પર લખ્યું",
  wallPostBySomeone: "કોઈએ તમારી વૉલ પર લખ્યું",
  seeWall: "વૉલ જુઓ",
  commented: "{who} એ “{title}” પર કૉમેન્ટ કરી",
  commentedBySomeone: "કોઈએ “{title}” પર કૉમેન્ટ કરી",
  commentedOnJournal: "{who} એ “તમારી જર્નલ પોસ્ટ” પર કૉમેન્ટ કરી",
  commentedOnJournalBySomeone: "કોઈએ “તમારી જર્નલ પોસ્ટ” પર કૉમેન્ટ કરી",
  seeComment: "કૉમેન્ટ જુઓ",
  messageRequest: "{from} એ તમને સંદેશ વિનંતી મોકલી",
  seeRequest: "વિનંતી જુઓ",
  messageSent: "{from} એ તમને સંદેશ મોકલ્યો",
  readIt: "વાંચો",
} satisfies Translation<typeof en>;
