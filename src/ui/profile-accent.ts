import { useLayoutEffect, type CSSProperties } from "react";
import { useLocation } from "react-router-dom";
import { isProfileAccent } from "../../shared/profile-accent";
import type { UserAppearance } from "../../shared/username-fonts";
import { useAuth } from "../lib";

function luminance(hex: string) {
  const channels = [1, 3, 5].map((offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(a: string, b: string) {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

function mix(hex: string, base: string, amount: number) {
  return (
    "#" +
    [1, 3, 5]
      .map((offset) => {
        const channel = parseInt(hex.slice(offset, offset + 2), 16);
        const other = parseInt(base.slice(offset, offset + 2), 16);
        return Math.round(channel * amount + other * (1 - amount))
          .toString(16)
          .padStart(2, "0");
      })
      .join("")
  );
}

// Move toward black/white until text is readable on every supplied surface.
function textTone(hex: string, dark: boolean, backgrounds: string[]) {
  for (let step = 0; step <= 100; step++) {
    const color = mix(dark ? "#ffffff" : "#000000", hex, step / 100);
    if (backgrounds.every((background) => contrast(color, background) >= 7)) return color;
  }
  return dark ? "#ffffff" : "#000000";
}

export function profileAccentStyle(user: UserAppearance): CSSProperties | undefined {
  if (!isProfileAccent(user.profileAccent)) return undefined;
  const start = user.profileAccent;
  const end = isProfileAccent(user.profileAccentEnd) ? user.profileAccentEnd : start;
  const pair = (amount: number, light = "#fffdf7", dark = "#101012") =>
    `light-dark(${mix(start, light, amount)}, ${mix(start, dark, amount * 0.32)})`;
  const surface = (amount: number, darkAmount = amount) =>
    `linear-gradient(110deg, light-dark(${mix(start, "#fffdf7", amount)}, ${mix(start, "#101012", darkAmount)}), light-dark(${mix(end, "#fffdf7", amount)}, ${mix(end, "#101012", darkAmount)}))`;
  const lightSurfaces = [start, end].map((color) => mix(color, "#fffdf7", 0.32));
  const darkSurfaces = [start, end].map((color) => mix(color, "#101012", 0.13));
  // White is readable across the entire sRGB gradient, including its middle.
  const barStart = textTone(start, false, ["#ffffff"]);
  const barEnd = textTone(end, false, ["#ffffff"]);
  // Tailwind's CSS optimizer drops all but one color-mix() custom property per rule, so mixes live here.
  const lightBg = mix(start, "#fffdf7", 0.12);
  const darkBg = mix(start, "#101012", 0.048);
  const onBg = (color: string, amount: number) =>
    `light-dark(${mix(color, lightBg, amount)}, ${mix(color, darkBg, amount * 0.4)})`;
  return {
    "--profile-line": onBg(start, 0.25),
    "--profile-tint": onBg(start, 0.18),
    "--profile-faint": onBg(start, 0.08),
    "--profile-now-hover": onBg(start, 0.23),
    "--profile-black": mix(start, "#080808", 0.08),
    "--profile-zebra": `${start}0d`,
    "--profile-wash": `${start}1f`,
    "--profile-chart": `linear-gradient(90deg, ${onBg(start, 0.24)}, ${onBg(end, 0.24)})`,
    "--profile-accent": start,
    "--profile-accent-end": end,
    "--profile-text": `light-dark(${textTone(start, false, lightSurfaces)}, ${textTone(start, true, darkSurfaces)})`,
    "--profile-on-accent": contrast(start, "#000000") > contrast(start, "#ffffff") ? "#000000" : "#ffffff",
    "--profile-bg": pair(0.12),
    "--profile-panel": pair(0.2),
    "--profile-card": pair(0.07),
    "--profile-fill": pair(0.24),
    "--profile-fill-hover": pair(0.3),
    "--profile-edge": pair(0.55),
    "--profile-page": surface(0.12, 0.045),
    "--profile-surface": surface(0.2, 0.08),
    "--profile-shell-bar": `linear-gradient(110deg, light-dark(${barStart}, ${mix(start, "#101114", 0.16)}), light-dark(${barEnd}, ${mix(end, "#101114", 0.16)}))`,
    "--profile-banner-shade": `linear-gradient(0deg, light-dark(${mix(start, "#fffdf7", 0.12)}, ${mix(start, "#101012", 0.12)}), transparent 45%), linear-gradient(90deg, light-dark(${mix(start, "#fffdf7", 0.12)}b8, ${mix(start, "#101012", 0.12)}b8), light-dark(${mix(end, "#fffdf7", 0.12)}2e, ${mix(end, "#101012", 0.12)}2e))`,
    "--profile-bar": barStart,
  } as CSSProperties;
}

const shellPalettes = new Map<string, CSSProperties>();
let appliedKeys: string[] = [];

function applyShellPalette() {
  const root = document.documentElement;
  for (const key of appliedKeys) root.style.removeProperty(key);
  const style = shellPalettes.get("profile") ?? shellPalettes.get("personal");
  appliedKeys = style ? Object.keys(style) : [];
  if (!style) {
    root.removeAttribute("data-profile-shell");
    return;
  }
  for (const [key, value] of Object.entries(style)) root.style.setProperty(key, String(value));
  root.setAttribute("data-profile-shell", "custom");
}

function mountPalette(key: string, style: CSSProperties | undefined) {
  if (style) shellPalettes.set(key, style);
  else shellPalettes.delete(key);
  applyShellPalette();
  return () => {
    shellPalettes.delete(key);
    applyShellPalette();
  };
}

export function PersonalShellTheme() {
  const { me } = useAuth();
  const id = me?.id;
  const enabled = me?.useProfileTheme;
  const profileAccent = me?.profileAccent;
  const profileAccentEnd = me?.profileAccentEnd;
  useLayoutEffect(
    () => mountPalette("personal", enabled ? profileAccentStyle({ profileAccent, profileAccentEnd }) : undefined),
    [id, enabled, profileAccent, profileAccentEnd]
  );
  return null;
}

/** Layout cleanup also runs when Suspense hides a profile during navigation. */
export function ProfileShellTheme({ user, name }: { user: UserAppearance & { username: string }; name: string }) {
  const { pathname } = useLocation();
  const { profileAccent, profileAccentEnd } = user;
  useLayoutEffect(() => {
    // useApi defers paths: never apply the previous listener's palette to a new route.
    if (user.username.toLowerCase() !== name.toLowerCase()) return;
    const style = profileAccentStyle({ profileAccent, profileAccentEnd });
    return mountPalette("profile", style);
  }, [pathname, name, user.username, profileAccent, profileAccentEnd]);
  return null;
}
