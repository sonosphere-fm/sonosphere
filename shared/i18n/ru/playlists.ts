import type en from "../en/playlists";
import type { Translation } from "../core";

export default {
  repeatTitle: "На повторе",
  repeatBlurb: "Твои самые прослушиваемые треки за последние 7 дней",
  monthTitle: "Лучшее за месяц",
  monthBlurb: "Твои самые прослушиваемые треки за последние 30 дней",
  favouritesTitle: "Любимое за всё время",
  favouritesBlurb: "50 твоих самых прослушиваемых треков за всё время",
  forgottenTitle: "Забытые любимцы",
  forgottenBlurb: "Треки, которые часто играли у тебя, но не в последние 3 месяца",
  freshTitle: "Свежие находки",
  freshBlurb: "Треки, впервые прослушанные за последние 30 дней",
  yearAgoTitle: "Год назад",
  yearAgoBlurb: "Что у тебя играло чаще всего примерно в это время год назад",
  lovedTitle: "Любимые треки",
  lovedBlurb: "50 треков, недавно отмеченных как любимые",
} satisfies Translation<typeof en>;
