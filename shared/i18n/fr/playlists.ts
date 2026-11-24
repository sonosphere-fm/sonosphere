import type en from "../en/playlists";
import type { Translation } from "../core";

export default {
  repeatTitle: "En boucle",
  repeatBlurb: "Tes titres les plus écoutés des 7 derniers jours",
  monthTitle: "Top du mois",
  monthBlurb: "Tes titres les plus écoutés des 30 derniers jours",
  favouritesTitle: "Favoris de toujours",
  favouritesBlurb: "Tes 50 titres les plus écoutés depuis toujours",
  forgottenTitle: "Favoris oubliés",
  forgottenBlurb: "Des titres que tu as beaucoup écoutés, mais pas ces 3 derniers mois",
  freshTitle: "Nouvelles trouvailles",
  freshBlurb: "Les titres que tu as découverts ces 30 derniers jours",
  yearAgoTitle: "Il y a un an",
  yearAgoBlurb: "Ce que tu écoutais le plus à la même époque l'an dernier",
  lovedTitle: "Titres aimés",
  lovedBlurb: "Tes 50 derniers titres aimés",
} satisfies Translation<typeof en>;
