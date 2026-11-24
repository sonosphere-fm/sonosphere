import type en from "../en/mail";
import type { Translation } from "../core";

export default {
  pasteLink: "या इसे अपने ब्राउज़र में पेस्ट करें:",
  manageEmails: "चुनें कि आपको कौन-से ईमेल मिलें",
  manageEmailsLine: "चुनें कि आपको कौन-से ईमेल मिलें: {url}",
  footer: "आपको यह ईमेल {site} पर आपके खाते के कारण मिल रहा है।",
  quoted: "“{text}”",

  verifySubject: "Sonosphere के लिए अपना ईमेल कन्फ़र्म करें",
  verifyHeading: "नमस्ते {username}, अपना ईमेल कन्फ़र्म करें",
  verifyBody:
    "Sonosphere से जुड़ने के लिए धन्यवाद। कन्फ़र्म करें कि यह आपका ईमेल पता है, ताकि पासवर्ड भूल जाने पर भी आप अपने खाते में वापस आ सकें।",
  verifyButton: "ईमेल कन्फ़र्म करें",
  verifyNote:
    "यह लिंक 3 दिन तक काम करता है; आप सेटिंग्स से नया लिंक मांग सकते हैं। जो खाते {days} दिनों के भीतर कन्फ़र्म नहीं होते, उन्हें हटा दिया जाता है। अगर आपने साइन अप नहीं किया था, तो इस संदेश को अनदेखा करें, खाता हटा दिया जाएगा।",

  welcomeSubject: "Sonosphere में आपका स्वागत है",
  welcomeHeading: "स्वागत है, {username}",
  welcomeIntro: "आपका ईमेल कन्फ़र्म हो गया है और आपका खाता तैयार है। शुरुआत के लिए कुछ चीज़ें:",
  welcomeImport:
    "अपने स्क्रॉबल साथ लाएं। Last.fm या किसी फ़ाइल से अपनी सुनने की हिस्ट्री इम्पोर्ट करें, और आपकी प्रोफ़ाइल, चार्ट और सुझाव आपके अब तक सुने हर गाने से भर जाएंगे।",
  welcomeImportButton: "अपने स्क्रॉबल इम्पोर्ट करें",
  welcomeConnect:
    "फिर एक प्लेयर कनेक्ट करें, ताकि अब से आप जो भी गाना चलाएं वह आपकी प्रोफ़ाइल पर स्क्रॉबल हो। Spotify, डेस्कटॉप प्लेयर और फ़ोन ऐप, सभी काम करते हैं।",
  welcomeConnectButton: "प्लेयर कनेक्ट करें",
  welcomeFollow: "दोस्तों को फ़ॉलो करें और अपने जैसी पसंद वाले लोग ढूंढें: वे लोग जिनकी पसंद आपसे सबसे ज़्यादा मिलती है।",
  welcomeProfile: "आपकी प्रोफ़ाइल: {url}",

  resetSubject: "अपना Sonosphere पासवर्ड रीसेट करें",
  resetHeading: "अपना पासवर्ड रीसेट करें",
  resetBody: "किसी ने (उम्मीद है आपने) Sonosphere पर {username} का पासवर्ड रीसेट करने का अनुरोध किया है।",
  resetButton: "नया पासवर्ड चुनें",
  resetNote:
    "यह लिंक एक घंटे तक और केवल एक बार काम करता है। अगर आपने यह अनुरोध नहीं किया, तो इस संदेश को अनदेखा करें: आपका पासवर्ड वैसा ही रहेगा।",

  changeSubject: "Sonosphere के लिए अपना नया ईमेल कन्फ़र्म करें",
  changeHeading: "अपना नया ईमेल कन्फ़र्म करें",
  changeBody: "Sonosphere पर {username} ने अब से यह पता इस्तेमाल करने का अनुरोध किया है। बदलाव के लिए इसे कन्फ़र्म करें।",
  changeButton: "नया ईमेल कन्फ़र्म करें",
  changeNote:
    "यह लिंक 3 दिन तक काम करता है। इसके इस्तेमाल होने तक खाते में पुराना पता ही रहेगा। अगर यह आप नहीं थे, तो इस संदेश को अनदेखा करें।",

  approveSubject: "अपने Sonosphere ईमेल बदलाव को मंज़ूरी दें",
  approveHeading: "ईमेल बदलाव को मंज़ूरी दें",
  approveBody:
    "{username} ने ईमेल को {email} में बदलने का अनुरोध किया है। पहले यहां इसे मंज़ूरी दें; फिर हम नए पते पर एक वेरिफ़िकेशन लिंक भेजेंगे।",
  approveButton: "ईमेल बदलाव को मंज़ूरी दें",
  approveNote: "यह लिंक एक घंटे तक काम करता है। अगर आपने यह बदलाव नहीं मांगा, तो इसे मंज़ूरी न दें और अपना पासवर्ड बदलें।",

  emailChangedSubject: "आपका Sonosphere ईमेल बदल दिया गया",
  emailChangedHeading: "आपका ईमेल बदल दिया गया",
  emailChangedBody: "Sonosphere पर {username} का ईमेल अब {email} है। अब से खाते से जुड़े ईमेल वहीं जाएंगे।",
  emailChangedWarning:
    "अगर यह बदलाव आपने नहीं किया, तो हो सकता है किसी और के पास आपका पासवर्ड हो। लॉग इन पेज से इसे रीसेट करें और साइट स्टाफ़ को बताएं।",

  passwordChangedSubject: "आपका Sonosphere पासवर्ड बदल दिया गया",
  passwordChangedHeading: "आपका पासवर्ड बदल दिया गया",
  passwordChangedBody:
    "Sonosphere पर {username} का पासवर्ड अभी बदला गया है, और बाकी सभी डिवाइस से साइन आउट कर दिया गया है।",
  passwordSetSubject: "आपने Sonosphere पर पासवर्ड सेट किया",
  passwordSetHeading: "आपने पासवर्ड सेट किया",
  passwordSetBody:
    "Sonosphere पर {username} का अब एक पासवर्ड है। आप इससे लॉग इन कर सकते हैं, और उन स्क्रॉबलर ऐप में इस्तेमाल कर सकते हैं जो पासवर्ड मांगते हैं। दूसरी साइटों से साइन इन करना भी काम करता रहेगा।",
  notYouReset: "अगर यह आप नहीं थे, तो लॉग इन पेज से तुरंत अपना पासवर्ड रीसेट करें।",
  resetPasswordButton: "पासवर्ड रीसेट करें",

  digestSubjectDaily: "Sonosphere पर आपका दिन: {count} नए",
  digestSubjectWeekly: "Sonosphere पर आपका हफ़्ता: {count} नए",
  digestHeading: "नमस्ते {username}, यह रहा जो आपसे छूट गया",
  digestMore: "और आपके इनबॉक्स में {count} और।",
  digestMessages: { one: "{people} से {count} नया संदेश", other: "{people} से {count} नए संदेश" },
  digestPeople: { one: "{count} व्यक्ति", other: "{count} लोग" },
  openInbox: "अपना इनबॉक्स खोलें",

  followed: "{who} ने आपको फ़ॉलो करना शुरू किया",
  followedBySomeone: "किसी ने आपको फ़ॉलो करना शुरू किया",
  seeProfile: "उनकी प्रोफ़ाइल देखें",
  wallReply: "{who} ने आपकी वॉल पोस्ट का जवाब दिया",
  wallReplyBySomeone: "किसी ने आपकी वॉल पोस्ट का जवाब दिया",
  wallPost: "{who} ने आपकी वॉल पर लिखा",
  wallPostBySomeone: "किसी ने आपकी वॉल पर लिखा",
  seeWall: "वॉल देखें",
  commented: "{who} ने “{title}” पर कमेंट किया",
  commentedBySomeone: "किसी ने “{title}” पर कमेंट किया",
  commentedOnJournal: "{who} ने “आपकी जर्नल पोस्ट” पर कमेंट किया",
  commentedOnJournalBySomeone: "किसी ने “आपकी जर्नल पोस्ट” पर कमेंट किया",
  seeComment: "कमेंट देखें",
  messageRequest: "{from} ने आपको संदेश अनुरोध भेजा",
  seeRequest: "अनुरोध देखें",
  messageSent: "{from} ने आपको संदेश भेजा",
  readIt: "पढ़ें",
} satisfies Translation<typeof en>;
