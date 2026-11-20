import { defineTheme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral";

const BARLOW = { family: "Source Sans 3 Variable", fallbacks: '"Helvetica Neue", Arial, sans-serif' };
const NONE = "0 0 0 transparent";
const OFF = "0ms"; // nothing fades, slides or pulses: a click changes the screen in one paint

/** Needle on Astryx: red, Barlow, flat, square, instant. Light only - the site has one look. */
export const needleTheme = defineTheme({
  name: "needle",
  extends: neutralTheme,
  typography: { scale: { base: 16, ratio: 1.2 }, body: BARLOW, heading: BARLOW },
  radius: { base: 0, multiplier: 0 },
  tokens: {
    "--color-accent": "#2438d6",
    "--color-on-accent": "#ffffff",
    "--color-accent-muted": "#fbe3e1",
    "--color-text-accent": "#2438d6",
    "--color-icon-accent": "#2438d6",
    "--color-background-body": "#ffffff",
    "--color-background-surface": "#ffffff",
    "--color-background-card": "#ffffff",
    "--color-background-popover": "#ffffff",
    "--color-background-muted": "#f5f3ef",
    "--color-text-primary": "#171717",
    "--color-text-secondary": "#4a4a4a",
    "--color-text-disabled": "#9a9a9a",
    "--color-icon-primary": "#171717",
    "--color-icon-secondary": "#767676",
    "--color-border": "#e3e0db",
    "--color-border-emphasized": "#bdb9b2",
    "--color-error": "#1a299f",
    "--color-text-error": "#1a299f",
    "--color-border-error": "#1a299f",
    "--color-success": "#1b7a3d",
    "--color-text-success": "#1b7a3d",
    "--radius-inner": "0px", "--radius-element": "0px", "--radius-container": "0px", "--radius-page": "0px", "--radius-full": "0px",
    "--shadow-low": NONE, "--shadow-med": NONE, "--shadow-high": NONE,
    "--duration-exit": OFF, "--duration-fast": OFF, "--duration-fast-min": OFF, "--duration-fast-max": OFF,
    "--duration-medium": OFF, "--duration-medium-min": OFF, "--duration-medium-max": OFF,
    "--duration-slow": OFF, "--duration-slow-min": OFF, "--duration-slow-max": OFF,
  },
  components: {
    button: {
      base: { fontWeight: "600", borderRadius: "0px" },
      "variant:primary": { backgroundColor: "#2438d6", color: "#ffffff" },
      "variant:secondary": { backgroundColor: "transparent", color: "#171717", borderWidth: "2px", borderStyle: "solid", borderColor: "#171717" },
      "variant:destructive": { backgroundColor: "#171717", color: "#ffffff" },
    },
  },
});
