import type { Locale } from "./core";

const words: Record<Locale, [string, string]> = {
  en: ["Credits", "Credits from MusicBrainz"],
  es: ["Créditos", "Créditos de MusicBrainz"],
  de: ["Mitwirkende", "Angaben von MusicBrainz"],
  ro: ["Credite", "Credite de la MusicBrainz"],
  lv: ["Dalībnieki", "Informācija no MusicBrainz"],
  fr: ["Crédits", "Crédits de MusicBrainz"],
  ja: ["クレジット", "MusicBrainz 提供のクレジット"],
  ko: ["크레딧", "MusicBrainz 크레딧"],
  pt: ["Créditos", "Créditos do MusicBrainz"],
  pl: ["Twórcy", "Informacje z MusicBrainz"],
  ru: ["Участники", "Сведения из MusicBrainz"],
  it: ["Crediti", "Crediti da MusicBrainz"],
  id: ["Kredit", "Kredit dari MusicBrainz"],
  hi: ["श्रेय", "MusicBrainz से श्रेय"],
  bn: ["কৃতিত্ব", "MusicBrainz থেকে কৃতিত্ব"],
  mr: ["श्रेय", "MusicBrainz कडून श्रेय"],
  te: ["క్రెడిట్‌లు", "MusicBrainz నుండి క్రెడిట్‌లు"],
  ta: ["பங்களிப்பாளர்கள்", "MusicBrainz வழங்கும் விவரங்கள்"],
  ur: ["کریڈٹس", "MusicBrainz سے کریڈٹس"],
  tr: ["Katkıda bulunanlar", "MusicBrainz katkı bilgileri"],
  sv: ["Medverkande", "Uppgifter från MusicBrainz"],
  uk: ["Учасники", "Відомості з MusicBrainz"],
  he: ["קרדיטים", "קרדיטים מ־MusicBrainz"],
  ar: ["المساهمون", "معلومات المساهمين من MusicBrainz"],
  "zh-Hans": ["制作人员", "制作人员信息来自 MusicBrainz"],
  "zh-Hant": ["製作人員", "製作人員資訊來自 MusicBrainz"],
};

export function creditsCatalog(locale: Locale) {
  const [credits, source] = words[locale];
  return { credits, source };
}
