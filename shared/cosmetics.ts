export const COSMETIC_SLOTS = ["accessory", "frame", "name_fx", "page_fx", "scrobble_fx"] as const;
export type CosmeticSlot = (typeof COSMETIC_SLOTS)[number];
export type EquippedCosmetic = {
  slot: CosmeticSlot;
  id: string;
  options: { color?: string };
};
export type Cosmetic = {
  id: string;
  name: string;
  slot: CosmeticSlot;
  description: string;
  colors: string[];
};
const item = (id: string, name: string, slot: CosmeticSlot, colors = "", description = name): Cosmetic => ({
  id,
  name,
  slot,
  description,
  colors: colors.split(",").filter(Boolean),
});
export const COSMETICS: Cosmetic[] = [
  item("ears.cat", "Cat Ears", "accessory", "black,white,orange,grey,calico,pink"),
  item("ears.dog", "Dog Ears", "accessory", "brown,golden,black,white,spotted"),
  item("ears.bunny", "Bunny Ears", "accessory", "white,pink,brown"),
  item("ears.fox", "Fox Ears", "accessory", "red,arctic,silver"),
  item("ears.wolf", "Wolf Ears", "accessory", "grey,black,white"),
  item("ears.bear", "Bear Ears", "accessory", "brown,black,panda,polar"),
  item("acc.halo", "Halo", "accessory", "gold,silver,pink"),
  item("acc.horns", "Little Horns", "accessory", "red,purple,black"),
  item("acc.headphones", "Headphones", "accessory", "black,white,neon"),
  item("acc.crown", "Tiny Crown", "accessory", "gold"),
  ...[
    ["vinyl", "Vinyl Ring"],
    ["pixel", "Pixel Border"],
    ["neon", "Neon Pulse"],
    ["laurel", "Gold Laurel"],
    ["holo", "Holo Foil"],
  ].map(([id, name]) => item(`frame.${id}`, name, "frame")),
  item("name.rainbow", "Rainbow Cycle", "name_fx", "non-pastel,pastel"),
  ...[
    ["glitch", "Glitch"],
    ["neon", "Neon Flicker"],
    ["wave", "Gradient Wave"],
    ["fire", "Ember"],
    ["frost", "Frost"],
    ["sparkle", "Sparkle Trail"],
    ["bounce", "Bounce"],
    ["chrome", "Chrome"],
    ["eq", "Equalizer Underline"],
    ["typewriter", "Typewriter"],
  ].map(([id, name]) => item(`name.${id}`, name, "name_fx")),
  item("fx.sparkles", "Page Sparkles", "page_fx"),
  item("fx.cursor", "Cursor Stardust", "page_fx"),
  item("fx.confetti", "Confetti Pop", "page_fx"),
  item("scrob.heart", "Heart Burst", "scrobble_fx"),
];
export type CosmeticsState = {
  owned: Cosmetic[];
  equipped: EquippedCosmetic[];
  showCosmetics: boolean;
};
