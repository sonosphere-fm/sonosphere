import type { Locale } from "./core";

const words: Record<Locale, [string, string, string, string]> = {
  en: ["Credits", "Show credits", "No credits available yet.", "Credits from MusicBrainz"],
  es: ["Créditos", "Mostrar créditos", "Aún no hay créditos disponibles.", "Créditos de MusicBrainz"],
  de: ["Mitwirkende", "Mitwirkende anzeigen", "Noch keine Angaben zu Mitwirkenden.", "Angaben von MusicBrainz"],
  ro: ["Credite", "Arată creditele", "Nu există încă informații despre credite.", "Credite de la MusicBrainz"],
  lv: ["Dalībnieki", "Rādīt dalībniekus", "Dalībnieku informācija vēl nav pieejama.", "Informācija no MusicBrainz"],
  fr: ["Crédits", "Afficher les crédits", "Aucun crédit disponible pour le moment.", "Crédits de MusicBrainz"],
  ja: ["クレジット", "クレジットを表示", "クレジットはまだありません。", "MusicBrainz 提供のクレジット"],
  ko: ["크레딧", "크레딧 보기", "아직 크레딧 정보가 없습니다.", "MusicBrainz 크레딧"],
  pt: ["Créditos", "Mostrar créditos", "Ainda não há créditos disponíveis.", "Créditos do MusicBrainz"],
  pl: ["Twórcy", "Pokaż twórców", "Brak informacji o twórcach.", "Informacje z MusicBrainz"],
  ru: ["Участники", "Показать участников", "Сведения об участниках пока недоступны.", "Сведения из MusicBrainz"],
  it: ["Crediti", "Mostra crediti", "Nessun credito ancora disponibile.", "Crediti da MusicBrainz"],
  id: ["Kredit", "Tampilkan kredit", "Belum ada kredit tersedia.", "Kredit dari MusicBrainz"],
  hi: ["श्रेय", "श्रेय दिखाएँ", "अभी श्रेय उपलब्ध नहीं हैं।", "MusicBrainz से श्रेय"],
  bn: ["কৃতিত্ব", "কৃতিত্ব দেখান", "এখনও কৃতিত্বের তথ্য নেই।", "MusicBrainz থেকে কৃতিত্ব"],
  mr: ["श्रेय", "श्रेय दाखवा", "अद्याप श्रेय उपलब्ध नाही.", "MusicBrainz कडून श्रेय"],
  te: ["క్రెడిట్‌లు", "క్రెడిట్‌లను చూపించు", "ఇంకా క్రెడిట్‌లు అందుబాటులో లేవు.", "MusicBrainz నుండి క్రెడిట్‌లు"],
  ta: ["பங்களிப்பாளர்கள்", "பங்களிப்பாளர்களைக் காட்டு", "இன்னும் பங்களிப்பாளர் விவரங்கள் இல்லை.", "MusicBrainz வழங்கும் விவரங்கள்"],
  ur: ["کریڈٹس", "کریڈٹس دکھائیں", "ابھی کریڈٹس دستیاب نہیں۔", "MusicBrainz سے کریڈٹس"],
  tr: ["Katkıda bulunanlar", "Katkıları göster", "Henüz katkı bilgisi yok.", "MusicBrainz katkı bilgileri"],
  sv: ["Medverkande", "Visa medverkande", "Inga uppgifter om medverkande ännu.", "Uppgifter från MusicBrainz"],
  uk: ["Учасники", "Показати учасників", "Відомості про учасників поки недоступні.", "Відомості з MusicBrainz"],
  he: ["קרדיטים", "הצגת קרדיטים", "אין עדיין קרדיטים זמינים.", "קרדיטים מ־MusicBrainz"],
  ar: ["المساهمون", "عرض المساهمين", "لا تتوفر معلومات عن المساهمين بعد.", "معلومات المساهمين من MusicBrainz"],
  "zh-Hans": ["制作人员", "显示制作人员", "暂无制作人员信息。", "制作人员信息来自 MusicBrainz"],
  "zh-Hant": ["製作人員", "顯示製作人員", "暫無製作人員資訊。", "製作人員資訊來自 MusicBrainz"],
};

export function creditsCatalog(locale: Locale) {
  const [credits, show, empty, source] = words[locale];
  return { credits, show, empty, source };
}
