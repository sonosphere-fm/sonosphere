import type en from "../en/playlists";
import type { Translation } from "../core";

export default {
  repeatTitle: "Diputar berulang",
  repeatBlurb: "Lagu yang paling kamu putar dalam 7 hari terakhir",
  monthTitle: "Teratas bulan ini",
  monthBlurb: "Lagu yang paling kamu putar dalam 30 hari terakhir",
  favouritesTitle: "Favorit sepanjang waktu",
  favouritesBlurb: "50 lagu yang paling kamu putar sepanjang waktu",
  forgottenTitle: "Favorit yang terlupakan",
  forgottenBlurb: "Lagu yang sering kamu putar tapi tidak dalam 3 bulan terakhir",
  freshTitle: "Temuan baru",
  freshBlurb: "Lagu yang pertama kali kamu putar dalam 30 hari terakhir",
  yearAgoTitle: "Setahun lalu",
  yearAgoBlurb: "Apa yang paling kamu putar sekitar waktu ini tahun lalu",
  lovedTitle: "Lagu disukai",
  lovedBlurb: "50 lagu yang paling baru kamu sukai",
} satisfies Translation<typeof en>;
