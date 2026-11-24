import type en from "../en/playlists";
import type { Translation } from "../core";

export default {
  repeatTitle: "In loop",
  repeatBlurb: "I brani che hai ascoltato di più negli ultimi 7 giorni",
  monthTitle: "Il meglio del mese",
  monthBlurb: "I brani che hai ascoltato di più negli ultimi 30 giorni",
  favouritesTitle: "Preferiti di sempre",
  favouritesBlurb: "I 50 brani che hai ascoltato di più in assoluto",
  forgottenTitle: "Preferiti dimenticati",
  forgottenBlurb: "Brani che hai ascoltato tanto, ma non negli ultimi 3 mesi",
  freshTitle: "Nuove scoperte",
  freshBlurb: "Brani che hai ascoltato per la prima volta negli ultimi 30 giorni",
  yearAgoTitle: "Un anno fa",
  yearAgoBlurb: "Cosa ascoltavi di più in questo periodo l'anno scorso",
  lovedTitle: "Brani preferiti",
  lovedBlurb: "Gli ultimi 50 brani che hai aggiunto ai preferiti",
} satisfies Translation<typeof en>;
