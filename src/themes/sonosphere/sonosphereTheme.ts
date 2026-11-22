import { defineTheme } from "@astryxdesign/core/theme";
import { neutralTheme } from "@astryxdesign/theme-neutral";

const FONT = { family: "Source Sans 3 Variable", fallbacks: '"Helvetica Neue", Arial, sans-serif' };
const DISPLAY = { family: "Radio Canada Variable", fallbacks: '"Helvetica Neue", Arial, sans-serif' };
const NONE ="0 0 0 transparent";
const OFF = "0ms";

export const sonosphereTheme = defineTheme({
  name: "sonosphere",
  extends: neutralTheme,
  typography: { scale: { base: 16, ratio: 1.2 }, body: FONT, heading: DISPLAY },
  radius: { base: 0, multiplier: 0 },
  tokens: {
    "--color-accent": ["#2438d6", "#5468ff"],
    "--color-on-accent": ["#ffffff", "#ffffff"],
    "--color-accent-muted": ["#fbe3e1", "#2a3796"],
    "--color-text-accent": ["#2438d6", "#ffd257"],
    "--color-icon-accent": ["#2438d6", "#ffd257"],
    "--color-background-body": ["#ffffff", "#0c0f27"],
    "--color-background-surface": ["#ffffff", "#181d45"],
    "--color-background-card": ["#ffffff", "#181d45"],
    "--color-background-popover": ["#ffffff", "#1d2352"],
    "--color-background-muted": ["#f5f3ef", "#121636"],
    "--color-text-primary": ["#171717", "#f3efe4"],
    "--color-text-secondary": ["#4a4a4a", "#d3d0d8"],
    "--color-text-disabled": ["#9a9a9a", "#5e648f"],
    "--color-icon-primary": ["#171717", "#f3efe4"],
    "--color-icon-secondary": ["#767676", "#9da2c6"],
    "--color-border": ["#e3e0db", "#262c5e"],
    "--color-border-emphasized": ["#bdb9b2", "#3a4385"],
    "--color-error": ["#1a299f", "#ff8f7d"],
    "--color-text-error": ["#1a299f", "#ff8f7d"],
    "--color-border-error": ["#1a299f", "#ff8f7d"],
    "--color-success": ["#1b7a3d", "#6fd492"],
    "--color-skeleton": ["#f1f1f1", "#232a5e"],
    "--color-text-success": ["#1b7a3d", "#6fd492"],
    "--radius-inner": "0px",
    "--radius-element": "0px",
    "--radius-container": "0px",
    "--radius-page": "0px",
    "--radius-full": "0px",
    "--shadow-low": NONE,
    "--shadow-med": NONE,
    "--shadow-high": NONE,
    "--duration-exit": OFF,
    "--duration-fast": OFF,
    "--duration-fast-min": OFF,
    "--duration-fast-max": OFF,
    "--duration-medium": OFF,
    "--duration-medium-min": OFF,
    "--duration-medium-max": OFF,
    "--duration-slow": OFF,
    "--duration-slow-min": OFF,
    "--duration-slow-max": OFF,
  },
  /*
   * Component looks that hold everywhere. Anything that depends on where a component sits or on hover/focus
   * (.hero, .banner, :not(.bare), :has(...)) can't be said here and stays in styles.css as data-attribute CSS.
   * The --panel, --card... variables are the app palette from styles.css.
   */
  components: {
    button: {
      base: { fontWeight: "600", borderRadius: "0px", whiteSpace: "nowrap", cursor: "pointer" },
      "variant:primary": { backgroundColor: "var(--color-accent)", color: "var(--color-on-accent)" },
      "variant:secondary": {
        backgroundColor: "var(--panel)",
        color: "var(--ink)",
        borderWidth: "2px",
        borderStyle: "solid",
        borderColor: "var(--panel)",
      },
      "variant:destructive": { backgroundColor: "var(--color-text-primary)", color: "var(--color-background-body)" },
    },
    "text-input": {
      base: { borderRadius: "0px", border: "1px solid var(--edge)", backgroundColor: "var(--card)", boxShadow: "inset 0 1px 3px var(--inset)", minHeight: "40px" },
    },
    "text-area": {
      base: { borderRadius: "0px", border: "1px solid var(--edge)", backgroundColor: "var(--card)", boxShadow: "inset 0 1px 3px var(--inset)" },
    },
    selector: {
      base: { borderRadius: "0px", border: "1px solid var(--edge)", backgroundColor: "var(--card)", boxShadow: "inset 0 1px 3px var(--inset)", fontWeight: "500" },
    },
    "field-label": {
      base: { fontFamily: "inherit" },
    },
    "dropdown-menu": {
      base: { backgroundColor: "var(--card)", border: "1px solid var(--line)", borderRadius: "0px", boxShadow: "0 6px 18px light-dark(rgba(0, 0, 0, .14), rgba(0, 0, 0, .5))" },
    },
    "dropdown-menu-item": {
      base: { borderRadius: "0px", fontWeight: "500" },
    },
  },
});
