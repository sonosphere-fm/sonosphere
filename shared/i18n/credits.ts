import type { Locale } from "./core";

const words: Record<Locale, string> = {
  en: "Credits",
  es: "Créditos",
  de: "Mitwirkende",
  ro: "Credite",
  lv: "Dalībnieki",
  fr: "Crédits",
  ja: "クレジット",
  ko: "크레딧",
  pt: "Créditos",
  pl: "Twórcy",
  ru: "Участники",
  it: "Crediti",
  id: "Kredit",
  tr: "Katkıda bulunanlar",
  sv: "Medverkande",
  uk: "Учасники",
  he: "קרדיטים",
  ar: "المساهمون",
  "zh-Hans": "制作人员",
};

export function creditsCatalog(locale: Locale) {
  return { credits: words[locale] };
}
