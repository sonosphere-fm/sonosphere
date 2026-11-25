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
  item("acc.beret", "Beret", "accessory", "black,cream,red,cobalt,mustard", "A soft beret tilted over one side."),
  item("acc.beanie", "Beanie", "accessory", "charcoal,cream,rust,teal", "A knit cuff with a folded brim and pom."),
  item("acc.cap", "Curved Cap", "accessory", "black,cobalt,cream,olive", "A low cap with a short curved brim."),
  item(
    "acc.flowercrown",
    "Flower Crown",
    "accessory",
    "wildflower,rose,daisy,lavender",
    "A thin vine with small flowers across the top."
  ),
  item("acc.antlers", "Antlers", "accessory", "oak,birch,velvet", "Two branching antlers above the rim."),
  item("acc.antenna", "Antennae", "accessory", "lime,pink,cobalt", "Two round-tipped stalks with a spring."),
  item("acc.scarf", "Scarf", "accessory", "cobalt,mustard,plaid,rust", "A folded scarf with a short hanging tail."),
  item("acc.bowtie", "Bow Tie", "accessory", "black,crimson,cobalt,gold", "A small bow at the bottom of the avatar."),
  item("acc.earring", "Hoop Earring", "accessory", "gold,silver,black", "A single hoop at the lower rim."),
  item("acc.pin", "Enamel Pin", "accessory", "gold,silver,cobalt,red", "A music-note pin on the lower rim."),
  ...[
    ["vinyl", "Vinyl Ring"],
    ["pixel", "Pixel Border"],
    ["neon", "Neon Pulse"],
    ["laurel", "Gold Laurel"],
    ["holo", "Holo Foil"],
    ["tape", "Cassette Ring"],
    ["orbit", "Orbit Ring"],
    ["stitch", "Stitched Ring"],
    ["ripple", "Ripple Ring"],
    ["eclipse", "Eclipse Ring"],
    ["garden", "Garden Ring"],
    ["arcade", "Arcade Ring"],
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
    ["shimmer", "Shimmer"],
    ["cascade", "Cascade"],
    ["decrypt", "Decrypt"],
    ["vapor", "Vapor"],
    ["marquee", "Marquee"],
    ["spotlight", "Spotlight"],
    ["halo", "Halo"],
    ["echo", "Echo"],
  ].map(([id, name]) => item(`name.${id}`, name, "name_fx")),
  item("fx.sparkles", "Page Sparkles", "page_fx"),
  item("fx.cursor", "Cursor Stardust", "page_fx"),
  item("fx.confetti", "Confetti Pop", "page_fx"),
  item("fx.leaves", "Drifting Leaves", "page_fx", "", "Slow leaves drift down the profile."),
  item("fx.snow", "Soft Snow", "page_fx", "", "Pale flakes fall without settling."),
  item("fx.fireflies", "Fireflies", "page_fx", "", "Warm glows fade in and out near the edges."),
  item("fx.ripple", "Press Ripple", "page_fx", "", "A thin ring spreads from a press on open space."),
  item("fx.bokeh", "Bokeh", "page_fx", "", "Soft translucent discs drift upward."),
  item("scrob.heart", "Heart Burst", "scrobble_fx"),
  item("scrob.notes", "Floating Notes", "scrobble_fx", "", "Notes rise from the now-playing label."),
  item("scrob.spark", "Needle Spark", "scrobble_fx", "", "A spark when the track changes."),
  item("scrob.stars", "Star Shower", "scrobble_fx", "", "Small stars drift up while a track plays."),
  item("scrob.bubbles", "Bubbles", "scrobble_fx", "", "Outline bubbles rise and fade."),
  item("scrob.aurora", "Aurora", "scrobble_fx", "", "A brief ribbon of light on track changes."),
];
export type CosmeticsState = {
  owned: Cosmetic[];
  equipped: EquippedCosmetic[];
  showCosmetics: boolean;
};
