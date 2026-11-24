import type en from "../en/playlists";
import type { Translation } from "../core";

export default {
  repeatTitle: "Pe repeat",
  repeatBlurb: "Cele mai ascultate piese ale tale din ultimele 7 zile",
  monthTitle: "Topul lunii",
  monthBlurb: "Cele mai ascultate piese ale tale din ultimele 30 de zile",
  favouritesTitle: "Preferate dintotdeauna",
  favouritesBlurb: "Cele mai ascultate 50 de piese ale tale, dintotdeauna",
  forgottenTitle: "Preferate uitate",
  forgottenBlurb: "Piese pe care le-ai ascultat mult, dar nu în ultimele 3 luni",
  freshTitle: "Descoperiri noi",
  freshBlurb: "Piese pe care le-ai ascultat prima dată în ultimele 30 de zile",
  yearAgoTitle: "Acum un an",
  yearAgoBlurb: "Ce ai ascultat cel mai mult în perioada asta anul trecut",
  lovedTitle: "Piese preferate",
  lovedBlurb: "Ultimele 50 de piese pe care le-ai marcat ca preferate",
} satisfies Translation<typeof en>;
