import type en from "../en/playlists";
import type { Translation } from "../core";

export default {
  repeatTitle: "リピート中",
  repeatBlurb: "過去7日間によく聴いたトラック",
  monthTitle: "今月のトップ",
  monthBlurb: "過去30日間によく聴いたトラック",
  favouritesTitle: "不動のお気に入り",
  favouritesBlurb: "これまでに最も多く聴いた50曲",
  forgottenTitle: "忘れかけたお気に入り",
  forgottenBlurb: "よく聴いていたのに、ここ3か月は聴いていないトラック",
  freshTitle: "新しい出会い",
  freshBlurb: "過去30日間に初めて聴いたトラック",
  yearAgoTitle: "1年前",
  yearAgoBlurb: "去年の今ごろによく聴いていた曲",
  lovedTitle: "お気に入りトラック",
  lovedBlurb: "最近お気に入りにした50曲",
} satisfies Translation<typeof en>;
