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

export function startingTheme(): ThemePref {
  const s = document.documentElement.getAttribute("data-scheme");
  return s === "dark" || s === "system" ? s : "light";
}
