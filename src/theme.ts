import { useSyncExternalStore } from "react";
import { flushSync } from "react-dom";

export type ThemePref = "light" | "system" | "dark";
const KEY = "spin.theme";

export function applyTheme(p: ThemePref) {
  const root = document.documentElement;
  if (p === "light") root.removeAttribute("data-scheme");
  else root.setAttribute("data-scheme", p);
  try {
    if (p === "light") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, p);
  } catch {}
}

export async function changeTheme(theme: ThemePref, update?: () => void) {
  const change = () => {
    applyTheme(theme);
    update?.();
  };
  const systemDark = matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = (pref: ThemePref) => pref === "dark" || (pref === "system" && systemDark);
  if (
    !document.startViewTransition ||
    matchMedia("(prefers-reduced-motion: reduce)").matches ||
    dark(startingTheme()) === dark(theme)
  ) {
    change();
    return;
  }
  await document.startViewTransition(() => flushSync(change)).updateCallbackDone;
}

function startingTheme(): ThemePref {
  const s = document.documentElement.getAttribute("data-scheme");
  return s === "dark" || s === "system" ? s : "light";
}

function watchScheme(changed: () => void) {
  const observer = new MutationObserver(changed);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-scheme"] });
  return () => observer.disconnect();
}

/** The theme on the page right now, so a signed-out switch re-renders whatever depends on it. */
export const usePageTheme = () => useSyncExternalStore(watchScheme, startingTheme);
