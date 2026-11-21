// Light by default; Automatic (follow the device) and Dark are opt-in from settings. Kept on this device only.
// index.html applies it before anything paints via <html data-scheme>; styles.css maps that to color-scheme.
import { useSyncExternalStore } from "react";

export type ThemePref = "light" | "system" | "dark";
const KEY = "theme";
const subs = new Set<() => void>();

function read(): ThemePref {
  try { const v = localStorage.getItem(KEY); return v === "system" || v === "dark" ? v : "light"; } catch { return "light"; }
}
function apply(p: ThemePref) {
  if (typeof document === "undefined") return;
  if (p === "light") document.documentElement.removeAttribute("data-scheme");
  else document.documentElement.setAttribute("data-scheme", p);
}
let pref = read();

export function setThemePref(p: ThemePref) {
  pref = p;
  apply(p);
  try { if (p === "light") localStorage.removeItem(KEY); else localStorage.setItem(KEY, p); } catch { /* private mode: this visit only */ }
  subs.forEach(f => f());
}

// another tab changed it
if (typeof window !== "undefined") window.addEventListener("storage", e => { if (e.key === KEY || e.key === null) { pref = read(); apply(pref); subs.forEach(f => f()); } });

export function useThemePref(): ThemePref {
  return useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f); }; }, () => pref);
}
