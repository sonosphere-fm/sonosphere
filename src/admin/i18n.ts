import base from "../../shared/i18n/en/catalog-admin";
import { translator } from "../i18n";

const admin = translator(base, {
  es: () => import("../../shared/i18n/es/catalog-admin"),
  de: () => import("../../shared/i18n/de/catalog-admin"),
  ro: () => import("../../shared/i18n/ro/catalog-admin"),
  lv: () => import("../../shared/i18n/lv/catalog-admin"),
});
export const { t, tx } = admin;
export const ready = admin.load();
