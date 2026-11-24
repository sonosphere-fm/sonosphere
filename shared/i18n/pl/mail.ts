import type en from "../en/mail";
import type { Translation } from "../core";

export default {
  pasteLink: "Albo wklej to do przeglądarki:",
  manageEmails: "Wybierz, jakie e-maile dostajesz",
  manageEmailsLine: "Wybierz, jakie e-maile dostajesz: {url}",
  footer: "Dostajesz tę wiadomość, bo masz konto w {site}.",
  quoted: "„{text}”",

  verifySubject: "Potwierdź swój e-mail w Sonosphere",
  verifyHeading: "Cześć {username}, potwierdź swój e-mail",
  verifyBody:
    "Dzięki za dołączenie do Sonosphere. Potwierdź, że to twój adres e-mail, żeby móc odzyskać konto, jeśli kiedyś zapomnisz hasła.",
  verifyButton: "Potwierdź e-mail",
  verifyNote:
    "Link działa przez 3 dni; nowy możesz zamówić w Ustawieniach. Konta niepotwierdzone w ciągu {days} dni są usuwane. Jeśli to nie ty się rejestrujesz, zignoruj tę wiadomość, a konto zostanie usunięte.",

  welcomeSubject: "Witaj w Sonosphere",
  welcomeHeading: "Witaj, {username}",
  welcomeIntro: "Twój e-mail jest potwierdzony, a konto gotowe. Kilka rzeczy na początek:",
  welcomeImport:
    "Zabierz ze sobą swoje scrobble. Zaimportuj historię słuchania z Last.fm lub z pliku, a twój profil, listy przebojów i rekomendacje wypełnią się na podstawie wszystkiego, czego słuchasz.",
  welcomeImportButton: "Zaimportuj scrobble",
  welcomeConnect:
    "Potem podłącz odtwarzacz, żeby każdy utwór, który od teraz zagrasz, był scrobblowany na twój profil. Działa Spotify, odtwarzacze na komputer i aplikacje na telefon.",
  welcomeConnectButton: "Podłącz odtwarzacz",
  welcomeFollow: "Obserwuj znajomych i znajdź swoje bratnie dusze: osoby o guście najbliższym twojemu.",
  welcomeProfile: "Twój profil: {url}",

  resetSubject: "Zresetuj hasło do Sonosphere",
  resetHeading: "Zresetuj hasło",
  resetBody: "Ktoś (miejmy nadzieję, że ty) poprosił o reset hasła dla {username} w Sonosphere.",
  resetButton: "Wybierz nowe hasło",
  resetNote:
    "Link działa przez godzinę i tylko raz. Jeśli to nie ty prosisz o reset, zignoruj tę wiadomość: hasło pozostanie bez zmian.",

  changeSubject: "Potwierdź nowy e-mail w Sonosphere",
  changeHeading: "Potwierdź nowy e-mail",
  changeBody: "{username} w Sonosphere chce od teraz używać tego adresu. Potwierdź go, aby wprowadzić zmianę.",
  changeButton: "Potwierdź nowy e-mail",
  changeNote:
    "Link działa przez 3 dni. Dopóki nie zostanie użyty, konto zachowuje stary adres. Jeśli to nie ty, zignoruj tę wiadomość.",

  approveSubject: "Zatwierdź zmianę e-maila w Sonosphere",
  approveHeading: "Zatwierdź zmianę e-maila",
  approveBody:
    "Konto {username} prosi o zmianę e-maila na {email}. Najpierw zatwierdź to tutaj; potem wyślemy link weryfikacyjny na nowy adres.",
  approveButton: "Zatwierdź zmianę e-maila",
  approveNote: "Ten link działa przez godzinę. Jeśli to nie ty prosisz o zmianę, nie zatwierdzaj jej i zmień hasło.",

  emailChangedSubject: "Twój e-mail w Sonosphere został zmieniony",
  emailChangedHeading: "Twój e-mail został zmieniony",
  emailChangedBody:
    "E-mail konta {username} w Sonosphere to teraz {email}. Od teraz wiadomości dotyczące konta będą trafiać tam.",
  emailChangedWarning:
    "Jeśli to nie ty wprowadzasz tę zmianę, ktoś inny może znać twoje hasło. Zresetuj je na stronie logowania i daj znać zespołowi serwisu.",

  passwordChangedSubject: "Twoje hasło do Sonosphere zostało zmienione",
  passwordChangedHeading: "Twoje hasło zostało zmienione",
  passwordChangedBody:
    "Hasło konta {username} w Sonosphere zostało właśnie zmienione, a wszystkie inne urządzenia zostały wylogowane.",
  passwordSetSubject: "Ustawiono hasło w Sonosphere",
  passwordSetHeading: "Ustawiono hasło",
  passwordSetBody:
    "Konto {username} w Sonosphere ma teraz hasło. Możesz się nim logować i używać go w aplikacjach do scrobblowania, które o nie proszą. Logowanie przez inne serwisy nadal działa.",
  notYouReset: "Jeśli to nie ty, od razu zresetuj hasło na stronie logowania.",
  resetPasswordButton: "Zresetuj hasło",

  digestSubjectDaily: "Twój dzień w Sonosphere: nowe: {count}",
  digestSubjectWeekly: "Twój tydzień w Sonosphere: nowe: {count}",
  digestHeading: "Cześć {username}, oto co cię ominęło",
  digestMore: "I jeszcze {count} w skrzynce.",
  digestMessages: {
    one: "{count} nowa wiadomość od {people}",
    few: "{count} nowe wiadomości od {people}",
    many: "{count} nowych wiadomości od {people}",
    other: "{count} nowej wiadomości od {people}",
  },
  digestPeople: {
    one: "{count} osoby",
    few: "{count} osób",
    many: "{count} osób",
    other: "{count} osoby",
  },
  openInbox: "Otwórz skrzynkę",

  followed: "{who} obserwuje cię od teraz",
  followedBySomeone: "Ktoś obserwuje cię od teraz",
  seeProfile: "Zobacz profil",
  wallReply: "{who} odpowiada na twój wpis na tablicy",
  wallReplyBySomeone: "Ktoś odpowiada na twój wpis na tablicy",
  wallPost: "{who} pisze na twojej tablicy",
  wallPostBySomeone: "Ktoś pisze na twojej tablicy",
  seeWall: "Zobacz tablicę",
  commented: "{who} komentuje „{title}”",
  commentedBySomeone: "Ktoś komentuje „{title}”",
  commentedOnJournal: "{who} komentuje „twój wpis w dzienniku”",
  commentedOnJournalBySomeone: "Ktoś komentuje „twój wpis w dzienniku”",
  seeComment: "Zobacz komentarz",
  messageRequest: "{from} wysyła ci prośbę o wiadomość",
  seeRequest: "Zobacz prośbę",
  messageSent: "{from} wysyła ci wiadomość",
  readIt: "Przeczytaj",
} satisfies Translation<typeof en>;
