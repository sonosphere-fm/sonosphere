export const USERNAME_FONTS = [
  { id: "default", label: "Site default", family: null },
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
