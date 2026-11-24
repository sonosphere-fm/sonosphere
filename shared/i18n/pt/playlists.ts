import type en from "../en/playlists";
import type { Translation } from "../core";

export default {
  repeatTitle: "No repeat",
  repeatBlurb: "Suas faixas mais tocadas dos últimos 7 dias",
  monthTitle: "Top do mês",
  monthBlurb: "Suas faixas mais tocadas dos últimos 30 dias",
  favouritesTitle: "Favoritas de todos os tempos",
  favouritesBlurb: "Suas 50 faixas mais tocadas de todos os tempos",
  forgottenTitle: "Favoritas esquecidas",
  forgottenBlurb: "Faixas que você ouviu muito, mas não nos últimos 3 meses",
  freshTitle: "Novas descobertas",
  freshBlurb: "Faixas que você ouviu pela primeira vez nos últimos 30 dias",
  yearAgoTitle: "Há um ano",
  yearAgoBlurb: "O que você mais ouviu nesta época no ano passado",
  lovedTitle: "Faixas amadas",
  lovedBlurb: "Suas 50 faixas amadas mais recentes",
} satisfies Translation<typeof en>;
