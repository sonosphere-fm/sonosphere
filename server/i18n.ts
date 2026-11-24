import en from "../shared/i18n/en/server";
import es from "../shared/i18n/es/server";
import de from "../shared/i18n/de/server";
import ro from "../shared/i18n/ro/server";
import lv from "../shared/i18n/lv/server";
import fr from "../shared/i18n/fr/server";
import ja from "../shared/i18n/ja/server";
import ko from "../shared/i18n/ko/server";
import pt from "../shared/i18n/pt/server";
import pl from "../shared/i18n/pl/server";
import ru from "../shared/i18n/ru/server";
import it from "../shared/i18n/it/server";
import turkish from "../shared/i18n/tr/server";
import sv from "../shared/i18n/sv/server";
import zhHans from "../shared/i18n/zh-Hans/server";
import zhHant from "../shared/i18n/zh-Hant/server";
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

const CATALOGS: Record<Locale, Catalog<typeof en>> = {
  en,
  es,
  de,
  ro,
  lv,
  fr,
  ja,
  ko,
  pt,
  pl,
  ru,
  it,
  tr: turkish,
  sv,
  "zh-Hans": zhHans,
  "zh-Hant": zhHant,
};

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
