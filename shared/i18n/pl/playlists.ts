import type en from "../en/playlists";
import type { Translation } from "../core";

export default {
  repeatTitle: "Na okrągło",
  repeatBlurb: "Twoje najczęściej słuchane utwory z ostatnich 7 dni",
  monthTitle: "Hity miesiąca",
  monthBlurb: "Twoje najczęściej słuchane utwory z ostatnich 30 dni",
  favouritesTitle: "Hity wszech czasów",
  favouritesBlurb: "50 utworów, których słuchasz najczęściej",
  forgottenTitle: "Zapomniane perełki",
  forgottenBlurb: "Utwory często grane, ale nie w ostatnich 3 miesiącach",
  freshTitle: "Świeże odkrycia",
  freshBlurb: "Utwory po raz pierwszy zagrane w ostatnich 30 dniach",
  yearAgoTitle: "Rok temu",
  yearAgoBlurb: "Twoje najczęściej słuchane utwory mniej więcej rok temu",
  lovedTitle: "Ulubione utwory",
  lovedBlurb: "50 ostatnio dodanych ulubionych utworów",
} satisfies Translation<typeof en>;
