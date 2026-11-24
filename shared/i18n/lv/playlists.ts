import type en from "../en/playlists";
import type { Translation } from "../core";

export default {
  repeatTitle: "Uz atkārtošanu",
  repeatBlurb: "Tavas visvairāk klausītās dziesmas pēdējās 7 dienās",
  monthTitle: "Mēneša topā",
  monthBlurb: "Tavas visvairāk klausītās dziesmas pēdējās 30 dienās",
  favouritesTitle: "Visu laiku mīļākās",
  favouritesBlurb: "Tavas 50 visvairāk klausītās dziesmas",
  forgottenTitle: "Aizmirstās mīļākās",
  forgottenBlurb: "Dziesmas, kuras daudz klausījies, bet ne pēdējos 3 mēnešos",
  freshTitle: "Svaigi atradumi",
  freshBlurb: "Dziesmas, kuras pirmoreiz klausījies pēdējās 30 dienās",
  yearAgoTitle: "Pirms gada",
  yearAgoBlurb: "Ko tu visvairāk klausījies šajā laikā pērn",
  lovedTitle: "Mīļākās dziesmas",
  lovedBlurb: "Tavas 50 pēdējās mīļākajām pievienotās dziesmas",
} satisfies Translation<typeof en>;
