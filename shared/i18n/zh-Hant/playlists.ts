import type en from "../en/playlists";
import type { Translation } from "../core";

export default {
  repeatTitle: "單曲循環",
  repeatBlurb: "你最近 7 天播放最多的曲目",
  monthTitle: "本月最愛",
  monthBlurb: "你最近 30 天播放最多的曲目",
  favouritesTitle: "歷來最愛",
  favouritesBlurb: "你有史以來播放最多的 50 首曲目",
  forgottenTitle: "被遺忘的最愛",
  forgottenBlurb: "你曾經常聽、但最近 3 個月沒聽過的曲目",
  freshTitle: "新鮮發現",
  freshBlurb: "你在最近 30 天第一次播放的曲目",
  yearAgoTitle: "一年前",
  yearAgoBlurb: "去年這個時候你最常聽的歌",
  lovedTitle: "喜愛的曲目",
  lovedBlurb: "你最近喜愛的 50 首曲目",
} satisfies Translation<typeof en>;
