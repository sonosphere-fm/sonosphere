import { Fragment, type ReactNode } from "react";
import en from "../shared/i18n/en";
import {
  format,
  isLocale,
  lookup,
  matchLocale,
  pick,
  RTL,
  type Catalog,
  type Key,
  type Locale,
  type Namespace,
  type Params,
} from "../shared/i18n/core";

const KEY = "spin.locale";
let current: Locale = "en";

export const locale = () => current;

export function chosenLocale(): Locale | "" {
  try {
    const v = localStorage.getItem(KEY);
    return isLocale(v) ? v : "";
  } catch {
    return "";
  }
}

/** "" follows the browser. Reloads so every string, date and number is drawn in the new language. */
export function switchLocale(next: Locale | "") {
  try {
    if (next) localStorage.setItem(KEY, next);
    else localStorage.removeItem(KEY);
  } catch {}
  location.reload();
}

type Loaders<D> = Record<Exclude<Locale, "en">, () => Promise<{ default: Catalog<D> }>>;

export function translator<D extends Record<string, Namespace>>(base: D, loaders: Loaders<D>) {
  let dict: Record<string, Namespace> = base;
  const entry = (key: string) => lookup(dict, key) ?? lookup(base, key) ?? key;
  return {
    t: (key: Key<D>, params?: Params) => format(current, entry(key), params),
    /** Like t, with elements allowed as params. */
    tx: (key: Key<D>, params: Record<string, ReactNode>) => {
      const text = pick(current, entry(key), params.count);
      return text.split(/\{(\w+)\}/g).map((part, i) => {
        if (i % 2 === 0) return part;
        const value = params[part];
        return (
          <Fragment key={i}>
            {typeof value === "number" && part === "count" ? value.toLocaleString(current) : (value ?? `{${part}}`)}
          </Fragment>
        );
      });
    },
    load: async () => {
      if (current !== "en") dict = (await loaders[current]()).default;
    },
  };
}

const main = translator(en, {
  es: () => import("../shared/i18n/es/index"),
  de: () => import("../shared/i18n/de/index"),
  ro: () => import("../shared/i18n/ro/index"),
  lv: () => import("../shared/i18n/lv/index"),
  fr: () => import("../shared/i18n/fr/index"),
  ja: () => import("../shared/i18n/ja/index"),
  ko: () => import("../shared/i18n/ko/index"),
  pt: () => import("../shared/i18n/pt/index"),
  pl: () => import("../shared/i18n/pl/index"),
  ru: () => import("../shared/i18n/ru/index"),
  it: () => import("../shared/i18n/it/index"),
  id: () => import("../shared/i18n/id/index"),
  tr: () => import("../shared/i18n/tr/index"),
  sv: () => import("../shared/i18n/sv/index"),
  uk: () => import("../shared/i18n/uk/index"),
  he: () => import("../shared/i18n/he/index"),
  ar: () => import("../shared/i18n/ar/index"),
  "zh-Hans": () => import("../shared/i18n/zh-Hans/index"),
  "zh-Hant": () => import("../shared/i18n/zh-Hant/index"),
});
export const { t, tx } = main;
export type MessageKey = Key<typeof en>;

/** A signed-in account's choice wins, then this browser's, then the browser's own languages. */
export async function loadLocale(account?: Locale | "") {
  current = account || chosenLocale() || matchLocale(navigator.languages);
  document.documentElement.lang = current;
  document.documentElement.dir = RTL.has(current) ? "rtl" : "ltr";
  await main.load();
}
