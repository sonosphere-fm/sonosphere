import type en from "../en/playlists";
import type { Translation } from "../core";

export default {
  repeatTitle: "요즘 무한 반복",
  repeatBlurb: "최근 7일 동안 가장 많이 들은 트랙",
  monthTitle: "이달의 톱",
  monthBlurb: "최근 30일 동안 가장 많이 들은 트랙",
  favouritesTitle: "역대 최애곡",
  favouritesBlurb: "지금까지 가장 많이 들은 트랙 50곡",
  forgottenTitle: "잊고 있던 최애곡",
  forgottenBlurb: "많이 들었지만 최근 3개월 동안은 듣지 않은 트랙",
  freshTitle: "새로운 발견",
  freshBlurb: "최근 30일 안에 처음 들은 트랙",
  yearAgoTitle: "1년 전 오늘",
  yearAgoBlurb: "작년 이맘때 가장 많이 들은 곡",
  lovedTitle: "좋아하는 트랙",
  lovedBlurb: "최근에 좋아요한 트랙 50곡",
} satisfies Translation<typeof en>;
