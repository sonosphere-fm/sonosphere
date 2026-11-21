// The site theme is saved on the account: "light" (the default, and for everyone signed out), "system" (follow the
// device) or "dark". The server writes it onto <html data-scheme> for the first paint; this keeps it in step after.
export type ThemePref = "light" | "system" | "dark";

export function applyTheme(p: ThemePref) {
  if (p === "light") document.documentElement.removeAttribute("data-scheme");
  else document.documentElement.setAttribute("data-scheme", p);
}
