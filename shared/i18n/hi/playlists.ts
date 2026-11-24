import type en from "../en/playlists";
import type { Translation } from "../core";

export default {
  repeatTitle: "बार-बार",
  repeatBlurb: "पिछले 7 दिनों में आपके सबसे ज़्यादा चलाए गए ट्रैक",
  monthTitle: "महीने के टॉप",
  monthBlurb: "पिछले 30 दिनों में आपके सबसे ज़्यादा चलाए गए ट्रैक",
  favouritesTitle: "हमेशा के पसंदीदा",
  favouritesBlurb: "अब तक आपके 50 सबसे ज़्यादा चलाए गए ट्रैक",
  forgottenTitle: "भूले-बिसरे पसंदीदा",
  forgottenBlurb: "वे ट्रैक जो आपने बहुत चलाए, पर पिछले 3 महीनों में नहीं",
  freshTitle: "नई खोजें",
  freshBlurb: "वे ट्रैक जो आपने पहली बार पिछले 30 दिनों में चलाए",
  yearAgoTitle: "एक साल पहले",
  yearAgoBlurb: "पिछले साल इसी समय के आस-पास आपने सबसे ज़्यादा क्या चलाया",
  lovedTitle: "पसंदीदा ट्रैक",
  lovedBlurb: "आपके हाल में पसंद किए गए 50 ट्रैक",
} satisfies Translation<typeof en>;
