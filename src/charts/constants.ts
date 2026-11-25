import { t } from "../i18n";
import { CHART_PERIODS, type ChartPeriod } from "../../shared/charts";

export const periodLabel = (key: ChartPeriod) =>
  ({
    weekly: t("music.chartWeekly"),
    monthly: t("music.chartMonthly"),
    quarterly: t("music.chartQuarterly"),
    half: t("music.chartHalfYearly"),
    yearly: t("music.chartYearly"),
    all: t("music.chartOverall"),
  })[key];

export const titleOptions = (): [string, string][] => [
  ["titles", t("music.chartTitlesNames")],
  ["plays", t("music.chartTitlesPlays")],
  ["none", t("music.chartTitlesNone")],
];

export const periodOptions = (): [string, string][] => [
  ...(Object.keys(CHART_PERIODS) as ChartPeriod[]).map((key): [string, string] => [key, periodLabel(key)]),
  ["custom", t("music.chartCustomDates")],
];
