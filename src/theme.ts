// The site theme is saved on the account: "light" (the default, and for everyone signed out), "system" (follow the
// device) or "dark". The server writes it onto <html data-scheme> for the first paint; this keeps it in step after.
// It is also remembered in the browser, so a page the server did not mark (development, a cached shell) still starts
// in the right scheme: the inline script in index.html reads it before anything paints.
export type ThemePref = "light" | "system" | "dark";
const KEY = "spin.theme";

export function applyTheme(p: ThemePref) {
  if (p === "light") document.documentElement.removeAttribute("data-scheme");
  else document.documentElement.setAttribute("data-scheme", p);
  try { if (p === "light") localStorage.removeItem(KEY); else localStorage.setItem(KEY, p); } catch { /* private mode */ }
}

/** What the early script applied, for anything that needs the theme before the session check answers. */
export function startingTheme(): ThemePref {
  const s = document.documentElement.getAttribute("data-scheme");
  return s === "dark" || s === "system" ? s : "light";
}
