import type en from "../en/playlists";
import type { Translation } from "../core";

export default {
  repeatTitle: "På repeat",
  repeatBlurb: "Dina mest spelade låtar de senaste 7 dagarna",
  monthTitle: "Månadens topp",
  monthBlurb: "Dina mest spelade låtar de senaste 30 dagarna",
  favouritesTitle: "Favoriter genom tiderna",
  favouritesBlurb: "Dina 50 mest spelade låtar någonsin",
  forgottenTitle: "Bortglömda favoriter",
  forgottenBlurb: "Låtar du spelat mycket men inte de senaste 3 månaderna",
  freshTitle: "Nya fynd",
  freshBlurb: "Låtar du spelade för första gången de senaste 30 dagarna",
  yearAgoTitle: "För ett år sedan",
  yearAgoBlurb: "Det du spelade mest runt den här tiden förra året",
  lovedTitle: "Älskade låtar",
  lovedBlurb: "Dina 50 senast älskade låtar",
} satisfies Translation<typeof en>;
