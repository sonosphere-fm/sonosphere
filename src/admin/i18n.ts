import base from "../../shared/i18n/en/catalog-admin";
import { translator } from "../i18n";

const admin = translator(base, {
  es: () => import("../../shared/i18n/es/catalog-admin"),
  de: () => import("../../shared/i18n/de/catalog-admin"),
  ro: () => import("../../shared/i18n/ro/catalog-admin"),
  lv: () => import("../../shared/i18n/lv/catalog-admin"),
  fr: () => import("../../shared/i18n/fr/catalog-admin"),
  ja: () => import("../../shared/i18n/ja/catalog-admin"),
  ko: () => import("../../shared/i18n/ko/catalog-admin"),
  pt: () => import("../../shared/i18n/pt/catalog-admin"),
  pl: () => import("../../shared/i18n/pl/catalog-admin"),
  ru: () => import("../../shared/i18n/ru/catalog-admin"),
  it: () => import("../../shared/i18n/it/catalog-admin"),
  id: () => import("../../shared/i18n/id/catalog-admin"),
  tr: () => import("../../shared/i18n/tr/catalog-admin"),
  sv: () => import("../../shared/i18n/sv/catalog-admin"),
  uk: () => import("../../shared/i18n/uk/catalog-admin"),
  he: () => import("../../shared/i18n/he/catalog-admin"),
  ar: () => import("../../shared/i18n/ar/catalog-admin"),
  "zh-Hans": () => import("../../shared/i18n/zh-Hans/catalog-admin"),
  "zh-Hant": () => import("../../shared/i18n/zh-Hant/catalog-admin"),
});
export const { t, tx } = admin;
export const ready = admin.load();
