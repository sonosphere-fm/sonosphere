import type en from "../en/playlists";
import type { Translation } from "../core";

export default {
  repeatTitle: "На повторі",
  repeatBlurb: "Твої найпопулярніші треки за останні 7 днів",
  monthTitle: "Топ місяця",
  monthBlurb: "Твої найпопулярніші треки за останні 30 днів",
  favouritesTitle: "Улюблене всіх часів",
  favouritesBlurb: "Твої 50 найпопулярніших треків за весь час",
  forgottenTitle: "Забуті улюблені",
  forgottenBlurb: "Треки, які ти слухав часто, але не за останні 3 місяці",
  freshTitle: "Свіжі знахідки",
  freshBlurb: "Треки, які ти вперше послухав за останні 30 днів",
  yearAgoTitle: "Рік тому",
  yearAgoBlurb: "Що ти найбільше слухав приблизно в цей час торік",
  lovedTitle: "Вподобані треки",
  lovedBlurb: "50 треків, які ти вподобав нещодавно",
} satisfies Translation<typeof en>;
