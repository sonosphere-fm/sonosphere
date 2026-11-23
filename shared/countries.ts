import { countries } from "country-flag-icons";

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
const NOT_COUNTRIES = ["AC", "EU", "IC", "TA"];

/** Every country with a flag, by ISO code and English name. */
export const COUNTRIES = countries
  .filter((code) => /^[A-Z]{2}$/.test(code) && !NOT_COUNTRIES.includes(code))
  .map((code) => ({ code, name: regionNames.of(code) ?? code }))
  .filter((c) => c.name !== c.code);

export const COUNTRY_ALIASES: Record<string, string> = {
  uk: "GB",
  "great britain": "GB",
  england: "GB",
  scotland: "GB",
  wales: "GB",
  usa: "US",
  us: "US",
  "united states of america": "US",
  america: "US",
  "south korea": "KR",
  "north korea": "KP",
  russia: "RU",
  "czech republic": "CZ",
  holland: "NL",
  // older names browsers with older region data may still show
  turkey: "TR",
  "ivory coast": "CI",
  swaziland: "SZ",
  macedonia: "MK",
  burma: "MM",
};

const byName = new Map<string, string>([
  ...COUNTRIES.map((c) => [c.name.toLowerCase(), c.code] as const),
  ...Object.entries(COUNTRY_ALIASES),
]);

/** The ISO code for a country name or common alias. */
export const countryCode = (name: string) => byName.get(name.trim().toLowerCase());
/** The English name for an ISO code, or "" when it isn't a listed country. */
export const countryNameOf = (code: string) => COUNTRIES.find((c) => c.code === code)?.name ?? "";
/** The canonical name for a country name or alias, or "" when it isn't one. */
export function countryName(s: string) {
  const c = countryCode(s);
  return c ? countryNameOf(c) : "";
}
