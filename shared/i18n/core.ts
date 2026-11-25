export const LOCALES = [
  "en",
  "es",
  "de",
  "ro",
  "lv",
  "fr",
  "ja",
  "ko",
  "pt",
  "pl",
  "ru",
  "it",
  "id",
  "hi",
  "bn",
  "mr",
  "te",
  "ta",
  "ur",
  "tr",
  "sv",
  "uk",
  "he",
  "ar",
  "zh-Hans",
  "zh-Hant",
] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  es: "Español",
  de: "Deutsch",
  ro: "Română",
  lv: "Latviešu",
  fr: "Français",
  ja: "日本語",
  ko: "한국어",
  pt: "Português (Brasil)",
  pl: "Polski",
  ru: "Русский",
  it: "Italiano",
  id: "Bahasa Indonesia",
  hi: "हिन्दी",
  bn: "বাংলা",
  mr: "मराठी",
  te: "తెలుగు",
  ta: "தமிழ்",
  ur: "اردو",
  tr: "Türkçe",
  sv: "Svenska",
  uk: "Українська",
  he: "עברית",
  ar: "العربية",
  "zh-Hans": "简体中文",
  "zh-Hant": "繁體中文",
};
export const RTL: ReadonlySet<Locale> = new Set(["he", "ar", "ur"]);
export const isLocale = (v: unknown): v is Locale => LOCALES.includes(v as Locale);

export type Plural = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };
export type Entry = string | Plural;
export type Namespace = Record<string, Entry>;
export type Params = Record<string, string | number>;

/** What a translation of `T` must provide: every key, with any plural forms its language needs. */
export type Translation<T> = { [K in keyof T]: T[K] extends string ? string : Plural };
export type Catalog<D> = { [N in keyof D]: Translation<D[N]> };
export type Key<D> = { [N in keyof D & string]: `${N}.${keyof D[N] & string}` }[keyof D & string];

/** Chinese is told apart by script, which older browsers only imply through the region. */
function baseLocale(tag: string) {
  const t = tag.trim().toLowerCase();
  if (/^zh(?![a-z])/.test(t)) return /^zh[-_](hant|tw|hk|mo)(?![a-z])/.test(t) ? "zh-Hant" : "zh-Hans";
  return t.split(/[-_;]/)[0];
}

export function matchLocale(wanted: readonly string[]): Locale {
  for (const tag of wanted) {
    const base = baseLocale(tag);
    if (isLocale(base)) return base;
  }
  return "en";
}

export function acceptLanguage(header: string | null): Locale {
  const tags = (header ?? "")
    .split(",")
    .map((part) => {
      const [tag, q] = part.split(";q=");
      return { tag: tag.trim(), q: q === undefined ? 1 : Number(q) };
    })
    .filter((x) => x.tag && x.q > 0)
    .sort((a, b) => b.q - a.q);
  return matchLocale(tags.map((x) => x.tag));
}

const rules = new Map<Locale, Intl.PluralRules>();
function pluralForm(locale: Locale, n: number) {
  let r = rules.get(locale);
  if (!r) rules.set(locale, (r = new Intl.PluralRules(locale)));
  return r.select(n);
}

export function pick(locale: Locale, entry: Entry, count: unknown): string {
  if (typeof entry === "string") return entry;
  return entry[pluralForm(locale, Number(count ?? 0))] ?? entry.other;
}

/** `{name}` takes params.name; `count` is shown as a localised number and picks the plural form. */
export function format(locale: Locale, entry: Entry, params?: Params): string {
  const text = pick(locale, entry, params?.count);
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = params[name];
    if (value === undefined) return whole;
    if (name === "count" && typeof value === "number") return value.toLocaleString(locale);
    return String(value);
  });
}

export function lookup(dict: Record<string, Namespace>, key: string): Entry | undefined {
  const dot = key.indexOf(".");
  return dict[key.slice(0, dot)]?.[key.slice(dot + 1)];
}
