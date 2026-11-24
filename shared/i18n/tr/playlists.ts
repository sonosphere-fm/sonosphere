import type en from "../en/playlists";
import type { Translation } from "../core";

export default {
  repeatTitle: "Tekrar tekrar",
  repeatBlurb: "Son 7 günde en çok dinlediğin parçalar",
  monthTitle: "Ayın favorileri",
  monthBlurb: "Son 30 günde en çok dinlediğin parçalar",
  favouritesTitle: "Tüm zamanların favorileri",
  favouritesBlurb: "Bugüne kadar en çok dinlediğin 50 parça",
  forgottenTitle: "Unutulan favoriler",
  forgottenBlurb: "Çok dinlediğin ama son 3 aydır açmadığın parçalar",
  freshTitle: "Yeni keşifler",
  freshBlurb: "İlk kez son 30 günde dinlediğin parçalar",
  yearAgoTitle: "Bir yıl önce",
  yearAgoBlurb: "Geçen yıl bu zamanlarda en çok dinlediklerin",
  lovedTitle: "Sevilen parçalar",
  lovedBlurb: "En son sevdiğin 50 parça",
} satisfies Translation<typeof en>;
