import type en from "../en/mail";
import type { Translation } from "../core";

export default {
  pasteLink: "או להדביק את זה בדפדפן:",
  manageEmails: "בחירת האימיילים שמקבלים",
  manageEmailsLine: "בחירת האימיילים שמקבלים: {url}",
  footer: "האימייל הזה נשלח בגלל חשבון ב־{site}.",
  quoted: "״{text}״",

  verifySubject: "אימות האימייל שלך ב־Sonosphere",
  verifyHeading: "היי {username}, נא לאמת את האימייל",
  verifyBody:
    "תודה שהצטרפת ל־Sonosphere. נא לאשר שזו כתובת האימייל שלך, כדי שתמיד תהיה דרך לחזור לחשבון אם הסיסמה תישכח.",
  verifyButton: "אימות האימייל",
  verifyNote:
    "הקישור תקף ל־3 ימים; אפשר לבקש קישור חדש מההגדרות. חשבונות שלא אומתו תוך {days} ימים נמחקים. אם לא נרשמת, אפשר להתעלם מההודעה הזו והחשבון יוסר.",

  welcomeSubject: "ברוכים הבאים ל־Sonosphere",
  welcomeHeading: "ברוכים הבאים, {username}",
  welcomeIntro: "האימייל שלך אומת והחשבון מוכן. כמה דברים לנסות קודם:",
  welcomeImport:
    "להביא איתך את הסקרובלים. אפשר לייבא את היסטוריית ההאזנה מ־Last.fm או מקובץ, והפרופיל, המצעדים וההמלצות יתמלאו מכל מה שהשמעת.",
  welcomeImportButton: "ייבוא הסקרובלים",
  welcomeConnect:
    "אחר כך לחבר נגן, כך שכל שיר שמושמע מעכשיו יסוקרבל לפרופיל שלך. Spotify, נגנים למחשב ואפליקציות לטלפון, כולם עובדים.",
  welcomeConnectButton: "חיבור נגן",
  welcomeFollow: "לעקוב אחרי חברים ולמצוא את התאומים המוזיקליים שלך: אנשים שהטעם שלהם הכי קרוב לשלך.",
  welcomeProfile: "הפרופיל שלך: {url}",

  resetSubject: "איפוס הסיסמה שלך ב־Sonosphere",
  resetHeading: "איפוס הסיסמה",
  resetBody: "מישהו (בתקווה שזה היה ממך) ביקש לאפס את הסיסמה של {username} ב־Sonosphere.",
  resetButton: "בחירת סיסמה חדשה",
  resetNote: "הקישור תקף לשעה אחת ולשימוש אחד בלבד. אם לא ביקשת את זה, אפשר להתעלם מההודעה: הסיסמה שלך נשארת כמו שהיא.",

  changeSubject: "אימות האימייל החדש שלך ב־Sonosphere",
  changeHeading: "אימות האימייל החדש",
  changeBody: "{username} ב־Sonosphere ביקש להשתמש בכתובת הזו מעכשיו. יש לאשר אותה כדי להשלים את השינוי.",
  changeButton: "אימות האימייל החדש",
  changeNote:
    "הקישור תקף ל־3 ימים. עד שישתמשו בו, החשבון שומר על הכתובת הישנה. אם הבקשה לא הגיעה ממך, אפשר להתעלם מההודעה.",

  approveSubject: "אישור שינוי האימייל שלך ב־Sonosphere",
  approveHeading: "אישור שינוי אימייל",
  approveBody:
    "{username} ביקש לשנות את האימייל ל־{email}. קודם צריך לאשר את זה כאן; אחר כך נשלח קישור אימות לכתובת החדשה.",
  approveButton: "אישור שינוי האימייל",
  approveNote: "הקישור תקף לשעה אחת. אם לא ביקשת את השינוי, אין לאשר אותו, וכדאי לשנות את הסיסמה.",

  emailChangedSubject: "האימייל שלך ב־Sonosphere שונה",
  emailChangedHeading: "האימייל שלך שונה",
  emailChangedBody: "האימייל של {username} ב־Sonosphere הוא עכשיו {email}. מעכשיו דואר על החשבון יישלח לשם.",
  emailChangedWarning:
    "אם לא ביצעת את השינוי הזה, ייתכן שמישהו אחר יודע את הסיסמה שלך. כדאי לאפס אותה מדף ההתחברות ולעדכן את צוות האתר.",

  passwordChangedSubject: "הסיסמה שלך ב־Sonosphere שונתה",
  passwordChangedHeading: "הסיסמה שלך שונתה",
  passwordChangedBody: "הסיסמה של {username} ב־Sonosphere שונתה עכשיו, וכל שאר המכשירים נותקו.",
  passwordSetSubject: "הגדרת סיסמה ב־Sonosphere",
  passwordSetHeading: "הגדרת סיסמה",
  passwordSetBody:
    "ל־{username} ב־Sonosphere יש עכשיו סיסמה. אפשר להתחבר איתה ולהשתמש בה באפליקציות סקרובלינג שמבקשות סיסמה. גם ההתחברות דרך האתרים האחרים שלך ממשיכה לעבוד.",
  notYouReset: "אם זה לא היה ממך, כדאי לאפס את הסיסמה מיד מדף ההתחברות.",
  resetPasswordButton: "איפוס סיסמה",

  digestSubjectDaily: "היום שלך ב־Sonosphere: {count} חדשים",
  digestSubjectWeekly: "השבוע שלך ב־Sonosphere: {count} חדשים",
  digestHeading: "היי {username}, הנה מה שפספסת",
  digestMore: "ועוד {count} בתיבת הדואר שלך.",
  digestMessages: {
    one: "הודעה חדשה אחת מ־{people}",
    two: "{count} הודעות חדשות מ־{people}",
    other: "{count} הודעות חדשות מ־{people}",
  },
  digestPeople: { one: "אדם אחד", two: "{count} אנשים", other: "{count} אנשים" },
  openInbox: "לתיבת הדואר",

  followed: "{who} התחיל לעקוב אחריך",
  followedBySomeone: "מישהו התחיל לעקוב אחריך",
  seeProfile: "לפרופיל",
  wallReply: "{who} הגיב לפוסט שלך בקיר",
  wallReplyBySomeone: "מישהו הגיב לפוסט שלך בקיר",
  wallPost: "{who} כתב על הקיר שלך",
  wallPostBySomeone: "מישהו כתב על הקיר שלך",
  seeWall: "לקיר",
  commented: "{who} הגיב על ״{title}״",
  commentedBySomeone: "מישהו הגיב על ״{title}״",
  commentedOnJournal: "{who} הגיב על ״פוסט היומן שלך״",
  commentedOnJournalBySomeone: "מישהו הגיב על ״פוסט היומן שלך״",
  seeComment: "לתגובה",
  messageRequest: "{from} שלח לך בקשת הודעה",
  seeRequest: "לבקשה",
  messageSent: "{from} שלח לך הודעה",
  readIt: "לקריאה",
} satisfies Translation<typeof en>;
