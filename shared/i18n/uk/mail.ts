import type en from "../en/mail";
import type { Translation } from "../core";

export default {
  pasteLink: "Або встав це в браузер:",
  manageEmails: "Вибери, які листи отримувати",
  manageEmailsLine: "Вибери, які листи отримувати: {url}",
  footer: "Ти отримуєш цей лист, бо маєш обліковий запис на {site}.",
  quoted: "«{text}»",

  verifySubject: "Підтвердь свою адресу для Sonosphere",
  verifyHeading: "Привіт, {username}! Підтвердь свою адресу",
  verifyBody:
    "Дякуємо, що приєднався до Sonosphere. Підтвердь, що це твоя адреса, щоб мати змогу повернутися до облікового запису, якщо забудеш пароль.",
  verifyButton: "Підтвердити адресу",
  verifyNote:
    "Посилання дійсне 3 дні; нове можна запросити в Налаштуваннях. Облікові записи, не підтверджені протягом {days} днів, видаляються. Якщо ти не реєструвався, просто проігноруй цей лист, і обліковий запис буде видалено.",

  welcomeSubject: "Ласкаво просимо до Sonosphere",
  welcomeHeading: "Ласкаво просимо, {username}",
  welcomeIntro: "Твою адресу підтверджено, обліковий запис готовий. З чого варто почати:",
  welcomeImport:
    "Перенеси свої скробли. Імпортуй історію прослуховувань із Last.fm або з файлу, і твій профіль, чарти та рекомендації заповняться всім, що ти слухав.",
  welcomeImportButton: "Імпортувати скробли",
  welcomeConnect:
    "Потім під’єднай плеєр, щоб кожна пісня, яку ти слухаєш, скроблилася у твій профіль. Підходять Spotify, програми для комп’ютера і застосунки для телефона.",
  welcomeConnectButton: "Під’єднати плеєр",
  welcomeFollow: "Підписуйся на друзів і знаходь музичних двійників: людей із найближчим до тебе смаком.",
  welcomeProfile: "Твій профіль: {url}",

  resetSubject: "Скидання пароля Sonosphere",
  resetHeading: "Скинь свій пароль",
  resetBody: "Хтось (сподіваємося, ти) попросив скинути пароль для {username} на Sonosphere.",
  resetButton: "Вибрати новий пароль",
  resetNote:
    "Посилання дійсне одну годину і лише один раз. Якщо ти цього не просив, проігноруй цей лист: пароль залишиться без змін.",

  changeSubject: "Підтвердь нову адресу для Sonosphere",
  changeHeading: "Підтвердь нову адресу",
  changeBody: "{username} на Sonosphere хоче відтепер використовувати цю адресу. Підтвердь її, щоб завершити зміну.",
  changeButton: "Підтвердити нову адресу",
  changeNote:
    "Посилання дійсне 3 дні. Доки його не використано, обліковий запис зберігає стару адресу. Якщо це був не ти, проігноруй цей лист.",

  approveSubject: "Схвали зміну адреси в Sonosphere",
  approveHeading: "Схвали зміну адреси",
  approveBody:
    "{username} попросив змінити адресу на {email}. Спершу схвали це тут; потім ми надішлемо посилання для підтвердження на нову адресу.",
  approveButton: "Схвалити зміну адреси",
  approveNote: "Посилання дійсне одну годину. Якщо ти не просив цієї зміни, не схвалюй її і зміни пароль.",

  emailChangedSubject: "Адресу в Sonosphere змінено",
  emailChangedHeading: "Твою адресу змінено",
  emailChangedBody:
    "Адреса для {username} на Sonosphere тепер {email}. Листи щодо облікового запису надходитимуть туди.",
  emailChangedWarning:
    "Якщо це зробив не ти, можливо, хтось знає твій пароль. Скинь його на сторінці входу і повідом команду сайту.",

  passwordChangedSubject: "Пароль у Sonosphere змінено",
  passwordChangedHeading: "Твій пароль змінено",
  passwordChangedBody: "Пароль для {username} на Sonosphere щойно змінили, а на всіх інших пристроях виконано вихід.",
  passwordSetSubject: "Ти встановив пароль у Sonosphere",
  passwordSetHeading: "Ти встановив пароль",
  passwordSetBody:
    "У {username} на Sonosphere тепер є пароль. Ним можна входити і користуватися в застосунках для скроблінгу, які його просять. Вхід через інші сайти теж працює.",
  notYouReset: "Якщо це був не ти, негайно скинь пароль на сторінці входу.",
  resetPasswordButton: "Скинути пароль",

  digestSubjectDaily: "Твій день у Sonosphere: нове ({count})",
  digestSubjectWeekly: "Твій тиждень у Sonosphere: нове ({count})",
  digestHeading: "Привіт, {username}! Ось що ти пропустив",
  digestMore: "І ще {count} у вхідних.",
  digestMessages: {
    one: "{count} нове повідомлення від {people}",
    few: "{count} нові повідомлення від {people}",
    many: "{count} нових повідомлень від {people}",
    other: "{count} нового повідомлення від {people}",
  },
  digestPeople: {
    one: "{count} людини",
    few: "{count} людей",
    many: "{count} людей",
    other: "{count} людини",
  },
  openInbox: "Відкрити вхідні",

  followed: "{who} підписався на тебе",
  followedBySomeone: "Хтось підписався на тебе",
  seeProfile: "Переглянути профіль",
  wallReply: "{who} відповів на твій допис на стіні",
  wallReplyBySomeone: "Хтось відповів на твій допис на стіні",
  wallPost: "{who} написав на твоїй стіні",
  wallPostBySomeone: "Хтось написав на твоїй стіні",
  seeWall: "Переглянути стіну",
  commented: "{who} прокоментував «{title}»",
  commentedBySomeone: "Хтось прокоментував «{title}»",
  commentedOnJournal: "{who} прокоментував «твій допис у журналі»",
  commentedOnJournalBySomeone: "Хтось прокоментував «твій допис у журналі»",
  seeComment: "Переглянути коментар",
  messageRequest: "{from} надіслав тобі запит на листування",
  seeRequest: "Переглянути запит",
  messageSent: "{from} надіслав тобі повідомлення",
  readIt: "Прочитати",
} satisfies Translation<typeof en>;
