export const USERNAME_FONTS = [
  { id: "default", label: "Site default", family: null },
  { id: "inter", label: "Inter", family: "Inter" },
  { id: "roboto", label: "Roboto", family: "Roboto" },
  { id: "open-sans", label: "Open Sans", family: "Open Sans" },
  { id: "lato", label: "Lato", family: "Lato" },
  { id: "nunito-sans", label: "Nunito Sans", family: "Nunito Sans" },
  { id: "montserrat", label: "Montserrat", family: "Montserrat" },
  { id: "merriweather", label: "Merriweather", family: "Merriweather" },
  { id: "libre-baskerville", label: "Libre Baskerville", family: "Libre Baskerville" },
  { id: "dm-sans", label: "DM Sans", family: "DM Sans" },
  { id: "space-grotesk", label: "Space Grotesk", family: "Space Grotesk" },
  { id: "outfit", label: "Outfit", family: "Outfit" },
  { id: "oswald", label: "Oswald", family: "Oswald" },
  { id: "anton", label: "Anton", family: "Anton" },
  { id: "bebas-neue", label: "Bebas Neue", family: "Bebas Neue" },
  { id: "archivo-black", label: "Archivo Black", family: "Archivo Black" },
  { id: "syncopate", label: "Syncopate", family: "Syncopate" },
  { id: "syne", label: "Syne", family: "Syne" },
  { id: "playfair-display", label: "Playfair Display", family: "Playfair Display" },
  { id: "lobster", label: "Lobster", family: "Lobster" },
  { id: "righteous", label: "Righteous", family: "Righteous" },
  { id: "bungee", label: "Bungee", family: "Bungee" },
  { id: "monoton", label: "Monoton", family: "Monoton" },
  { id: "rubik-puddles", label: "Rubik Puddles", family: "Rubik Puddles" },
  {
    id: "244va",
    label: "244VA",
    family: "Font_244VA___",
    url: "https://fonts.sad.ovh/fonts/english/244VA___.TTF",
    format: "truetype",
  },
  {
    id: "box2-al",
    label: "Box2-AL",
    family: "Font_Box2-AL",
    url: "https://fonts.sad.ovh/fonts/english/Box2-AL.otf",
    format: "opentype",
  },
  {
    id: "holia",
    label: "Holia",
    family: "Font_HOLIA___",
    url: "https://fonts.sad.ovh/fonts/english/HOLIA___.TTF",
    format: "truetype",
  },
  {
    id: "honeb",
    label: "Honeb",
    family: "Font_HONEB___",
    url: "https://fonts.sad.ovh/fonts/english/HONEB___.TTF",
    format: "truetype",
  },
  { id: "pixelify-sans", label: "Pixelify Sans", family: "Pixelify Sans" },
  { id: "silkscreen", label: "Silkscreen", family: "Silkscreen" },
  { id: "permanent-marker", label: "Permanent Marker", family: "Permanent Marker" },
  { id: "unifrakturmaguntia", label: "UnifrakturMaguntia", family: "UnifrakturMaguntia" },
] as const;

export type UsernameFont = (typeof USERNAME_FONTS)[number]["id"];

export const isUsernameFont = (value: unknown): value is UsernameFont =>
  typeof value === "string" && USERNAME_FONTS.some((font) => font.id === value);

// Optional for cached viewers and older API consumers. Null accents use the site palette.
export type UserAppearance = {
  usernameFont?: UsernameFont;
  profileAccent?: string | null;
  profileAccentEnd?: string | null;
};
