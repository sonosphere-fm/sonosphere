import type en from "../en/mail";
import type { Translation } from "../core";

export default {
  pasteLink: "किंवा हे तुमच्या ब्राउझरमध्ये पेस्ट करा:",
  manageEmails: "तुम्हाला कोणते ईमेल मिळावेत ते निवडा",
  manageEmailsLine: "तुम्हाला कोणते ईमेल मिळावेत ते निवडा: {url}",
  footer: "{site} वरील खात्यामुळे तुम्हाला हा ईमेल मिळत आहे.",
  quoted: "“{text}”",

  verifySubject: "Sonosphere साठी तुमचा ईमेल निश्चित करा",
  verifyHeading: "नमस्कार {username}, तुमचा ईमेल निश्चित करा",
  verifyBody:
    "Sonosphere मध्ये सामील झाल्याबद्दल धन्यवाद. हा तुमचाच ईमेल पत्ता असल्याची खात्री करा, म्हणजे पासवर्ड विसरलात तरी तुम्ही तुमच्या खात्यात परत येऊ शकाल.",
  verifyButton: "ईमेल निश्चित करा",
  verifyNote:
    "ही लिंक 3 दिवस चालते; नवीन लिंक तुम्ही सेटिंग्जमधून मागवू शकता. {days} दिवसांत निश्चित न केलेली खाती हटवली जातात. तुम्ही साइन अप केले नसल्यास, या संदेशाकडे दुर्लक्ष करा आणि खाते काढून टाकले जाईल.",

  purgeSubject: {
    one: "तुमचे Sonosphere खाते {count} दिवसात हटवले जाईल",
    other: "तुमचे Sonosphere खाते {count} दिवसांत हटवले जाईल",
  },
  purgeHeading: "नमस्कार {username}, तुमचे खाते लवकरच हटवले जाणार आहे",
  purgeBody: {
    one: "तुम्ही अजून तुमचा ईमेल पुष्टी केलेला नाही. {count} दिवसात पुष्टी न केल्यास तुमचे खाते आणि त्यातील सर्व काही कायमचे हटवले जाईल.",
    other: "तुम्ही अजून तुमचा ईमेल पुष्टी केलेला नाही. {count} दिवसांत पुष्टी न केल्यास तुमचे खाते आणि त्यातील सर्व काही कायमचे हटवले जाईल.",
  },
  purgeNote: "तुम्ही नोंदणी केली नसल्यास, हा संदेश दुर्लक्षित करा आणि खाते काढून टाकले जाईल.",

  welcomeSubject: "Sonosphere मध्ये स्वागत आहे",
  welcomeHeading: "स्वागत आहे, {username}",
  welcomeIntro: "तुमचा ईमेल निश्चित झाला आहे आणि तुमचे खाते तयार आहे. सुरुवातीला हे करून पाहा:",
  welcomeImport:
    "तुमचे स्क्रॉबल सोबत आणा. Last.fm किंवा फाइलमधून तुमचा ऐकण्याचा इतिहास इम्पोर्ट करा, आणि तुम्ही ऐकलेल्या सगळ्यावरून तुमचे प्रोफाइल, चार्ट आणि शिफारसी भरल्या जातील.",
  welcomeImportButton: "तुमचे स्क्रॉबल इम्पोर्ट करा",
  welcomeConnect:
    "मग एखादा प्लेअर कनेक्ट करा, म्हणजे आतापासून तुम्ही वाजवलेले प्रत्येक गाणे तुमच्या प्रोफाइलवर स्क्रॉबल होईल. Spotify, डेस्कटॉप प्लेअर आणि फोन अॅप्स सगळे चालतात.",
  welcomeConnectButton: "प्लेअर कनेक्ट करा",
  welcomeFollow: "मित्रांना फॉलो करा आणि तुमच्यासारखी आवड असणारे लोक शोधा: ज्यांची आवड तुमच्या सर्वात जवळची आहे असे लोक.",
  welcomeProfile: "तुमचे प्रोफाइल: {url}",

  resetSubject: "तुमचा Sonosphere पासवर्ड रीसेट करा",
  resetHeading: "तुमचा पासवर्ड रीसेट करा",
  resetBody: "कोणीतरी (बहुधा तुम्हीच) Sonosphere वरील {username} चा पासवर्ड रीसेट करण्याची विनंती केली.",
  resetButton: "नवीन पासवर्ड निवडा",
  resetNote:
    "ही लिंक एक तास आणि फक्त एकदाच चालते. तुम्ही ही विनंती केली नसल्यास, या संदेशाकडे दुर्लक्ष करा: तुमचा पासवर्ड आहे तसाच राहील.",

  changeSubject: "Sonosphere साठी तुमचा नवीन ईमेल निश्चित करा",
  changeHeading: "तुमचा नवीन ईमेल निश्चित करा",
  changeBody: "Sonosphere वरील {username} ने आतापासून हा पत्ता वापरण्याची विनंती केली आहे. बदल करण्यासाठी तो निश्चित करा.",
  changeButton: "नवीन ईमेल निश्चित करा",
  changeNote: "ही लिंक 3 दिवस चालते. ती वापरली जाईपर्यंत खात्यावर जुनाच पत्ता राहील. हे तुम्ही केले नसल्यास, या संदेशाकडे दुर्लक्ष करा.",

  approveSubject: "तुमच्या Sonosphere ईमेल बदलाला मंजुरी द्या",
  approveHeading: "ईमेल बदलाला मंजुरी द्या",
  approveBody:
    "{username} ने ईमेल {email} मध्ये बदलण्याची विनंती केली आहे. आधी येथे मंजुरी द्या; त्यानंतर आम्ही नवीन पत्त्यावर पडताळणी लिंक पाठवू.",
  approveButton: "ईमेल बदलाला मंजुरी द्या",
  approveNote: "ही लिंक एक तास चालते. तुम्ही हा बदल मागितला नसल्यास, मंजुरी देऊ नका आणि तुमचा पासवर्ड बदला.",

  emailChangedSubject: "तुमचा Sonosphere ईमेल बदलला गेला",
  emailChangedHeading: "तुमचा ईमेल बदलला गेला",
  emailChangedBody: "Sonosphere वरील {username} चा ईमेल आता {email} आहे. आतापासून खात्याशी संबंधित मेल तिथे जाईल.",
  emailChangedWarning:
    "हा बदल तुम्ही केला नसल्यास, कदाचित दुसऱ्या कोणाकडे तुमचा पासवर्ड असू शकतो. लॉग इन पेजवरून तो रीसेट करा आणि साइटच्या टीमला कळवा.",

  passwordChangedSubject: "तुमचा Sonosphere पासवर्ड बदलला गेला",
  passwordChangedHeading: "तुमचा पासवर्ड बदलला गेला",
  passwordChangedBody: "Sonosphere वरील {username} चा पासवर्ड नुकताच बदलला गेला, आणि इतर सर्व डिव्हाइसेसवरून साइन आउट केले गेले.",
  passwordSetSubject: "तुम्ही Sonosphere वर पासवर्ड सेट केला",
  passwordSetHeading: "तुम्ही पासवर्ड सेट केला",
  passwordSetBody:
    "Sonosphere वरील {username} ला आता पासवर्ड आहे. तुम्ही त्याने लॉग इन करू शकता, आणि पासवर्ड मागणाऱ्या स्क्रॉबलर अॅप्समध्ये तो वापरू शकता. तुमच्या इतर साइट्सद्वारे साइन इन करणेही चालू राहील.",
  notYouReset: "हे तुम्ही केले नसल्यास, लॉग इन पेजवरून लगेच तुमचा पासवर्ड रीसेट करा.",
  resetPasswordButton: "पासवर्ड रीसेट करा",

  digestSubjectDaily: "Sonosphere वरील तुमचा दिवस: {count} नवीन",
  digestSubjectWeekly: "Sonosphere वरील तुमचा आठवडा: {count} नवीन",
  digestHeading: "नमस्कार {username}, तुमचे हे राहून गेले",
  digestMore: "आणि तुमच्या इनबॉक्समध्ये आणखी {count}.",
  digestMessages: { one: "{people} कडून {count} नवीन संदेश", other: "{people} कडून {count} नवीन संदेश" },
  digestPeople: { one: "{count} व्यक्ती", other: "{count} लोक" },
  openInbox: "तुमचा इनबॉक्स उघडा",

  followed: "{who} ने तुम्हाला फॉलो करायला सुरुवात केली",
  followedBySomeone: "कोणीतरी तुम्हाला फॉलो करायला सुरुवात केली",
  seeProfile: "त्यांचे प्रोफाइल पाहा",
  wallReply: "{who} ने तुमच्या वॉल पोस्टला उत्तर दिले",
  wallReplyBySomeone: "कोणीतरी तुमच्या वॉल पोस्टला उत्तर दिले",
  wallPost: "{who} ने तुमच्या वॉलवर लिहिले",
  wallPostBySomeone: "कोणीतरी तुमच्या वॉलवर लिहिले",
  seeWall: "वॉल पाहा",
  commented: "{who} ने “{title}” वर टिप्पणी केली",
  commentedBySomeone: "कोणीतरी “{title}” वर टिप्पणी केली",
  commentedOnJournal: "{who} ने “तुमच्या जर्नल पोस्ट” वर टिप्पणी केली",
  commentedOnJournalBySomeone: "कोणीतरी “तुमच्या जर्नल पोस्ट” वर टिप्पणी केली",
  seeComment: "टिप्पणी पाहा",
  messageRequest: "{from} ने तुम्हाला संदेश विनंती पाठवली",
  seeRequest: "विनंती पाहा",
  messageSent: "{from} ने तुम्हाला संदेश पाठवला",
  readIt: "वाचा",
} satisfies Translation<typeof en>;
