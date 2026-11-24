import en from "../shared/i18n/en/server";
import es from "../shared/i18n/es/server";
import de from "../shared/i18n/de/server";
import ro from "../shared/i18n/ro/server";
import lv from "../shared/i18n/lv/server";
import {
  acceptLanguage,
  format,
  isLocale,
  lookup,
  type Catalog,
  type Key,
  type Locale,
  type Params,
} from "../shared/i18n/core";

const CATALOGS: Record<Locale, Catalog<typeof en>> = { en, es, de, ro, lv };

export type ServerKey = Key<typeof en>;
export type ErrorKey = keyof typeof en.errors & string;

export function tr(locale: Locale, key: ServerKey, params?: Params): string {
  return format(locale, lookup(CATALOGS[locale], key) ?? lookup(en, key) ?? key, params);
}

/** The client names its language on every request; anything else falls back to the browser's. */
export function requestLocale(req: Request): Locale {
  const sent = req.headers.get("x-locale");
  return isLocale(sent) ? sent : acceptLanguage(req.headers.get("accept-language"));
}

export const userLocale = (u: { locale: string }): Locale => (isLocale(u.locale) ? u.locale : "en");
