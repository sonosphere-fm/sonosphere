import type en from "../en/playlists";
import type { Translation } from "../core";

export default {
  repeatTitle: "单曲循环",
  repeatBlurb: "你最近 7 天播放最多的曲目",
  monthTitle: "本月最爱",
  monthBlurb: "你最近 30 天播放最多的曲目",
  favouritesTitle: "历来最爱",
  favouritesBlurb: "你有史以来播放最多的 50 首曲目",
  forgottenTitle: "被遗忘的最爱",
  forgottenBlurb: "你曾经常听、但最近 3 个月没听过的曲目",
  freshTitle: "新鲜发现",
  freshBlurb: "你在最近 30 天第一次播放的曲目",
  yearAgoTitle: "一年前",
  yearAgoBlurb: "去年这个时候你最常听的歌",
  lovedTitle: "喜爱的曲目",
  lovedBlurb: "你最近喜爱的 50 首曲目",
} satisfies Translation<typeof en>;
