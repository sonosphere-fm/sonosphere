import type en from "../en/playlists";
import type { Translation } from "../core";

export default {
  repeatTitle: "على التكرار",
  repeatBlurb: "أكثر مقاطعك تشغيلًا في آخر 7 أيام",
  monthTitle: "الأفضل هذا الشهر",
  monthBlurb: "أكثر مقاطعك تشغيلًا في آخر 30 يومًا",
  favouritesTitle: "المفضلة على الإطلاق",
  favouritesBlurb: "أكثر 50 مقطعًا شغّلتها على الإطلاق",
  forgottenTitle: "مفضلات منسية",
  forgottenBlurb: "مقاطع شغّلتها كثيرًا لكن ليس في آخر 3 أشهر",
  freshTitle: "اكتشافات جديدة",
  freshBlurb: "مقاطع شغّلتها لأول مرة في آخر 30 يومًا",
  yearAgoTitle: "قبل عام",
  yearAgoBlurb: "ما شغّلته أكثر في مثل هذا الوقت من العام الماضي",
  lovedTitle: "المقاطع المحبوبة",
  lovedBlurb: "آخر 50 مقطعًا أحببتها",
} satisfies Translation<typeof en>;
