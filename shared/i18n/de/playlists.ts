import type en from "../en/playlists";
import type { Translation } from "../core";

export default {
  repeatTitle: "In Dauerschleife",
  repeatBlurb: "Deine meistgehörten Titel der letzten 7 Tage",
  monthTitle: "Top des Monats",
  monthBlurb: "Deine meistgehörten Titel der letzten 30 Tage",
  favouritesTitle: "Ewige Favoriten",
  favouritesBlurb: "Deine 50 meistgehörten Titel aller Zeiten",
  forgottenTitle: "Vergessene Favoriten",
  forgottenBlurb: "Titel, die du oft gehört hast, aber nicht in den letzten 3 Monaten",
  freshTitle: "Neuentdeckungen",
  freshBlurb: "Titel, die du in den letzten 30 Tagen zum ersten Mal gehört hast",
  yearAgoTitle: "Vor einem Jahr",
  yearAgoBlurb: "Was du letztes Jahr um diese Zeit am meisten gehört hast",
  lovedTitle: "Lieblingstitel",
  lovedBlurb: "Deine 50 zuletzt geliebten Titel",
} satisfies Translation<typeof en>;
