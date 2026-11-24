import type en from "../en/playlists";
import type { Translation } from "../core";

export default {
  repeatTitle: "En bucle",
  repeatBlurb: "Tus canciones más escuchadas de los últimos 7 días",
  monthTitle: "Lo mejor del mes",
  monthBlurb: "Tus canciones más escuchadas de los últimos 30 días",
  favouritesTitle: "Favoritas de siempre",
  favouritesBlurb: "Tus 50 canciones más escuchadas de todos los tiempos",
  forgottenTitle: "Favoritas olvidadas",
  forgottenBlurb: "Canciones que escuchaste mucho, pero no en los últimos 3 meses",
  freshTitle: "Descubrimientos",
  freshBlurb: "Canciones que escuchaste por primera vez en los últimos 30 días",
  yearAgoTitle: "Hace un año",
  yearAgoBlurb: "Lo que más escuchabas por estas fechas el año pasado",
  lovedTitle: "Canciones favoritas",
  lovedBlurb: "Tus 50 canciones marcadas como favoritas más recientes",
} satisfies Translation<typeof en>;
