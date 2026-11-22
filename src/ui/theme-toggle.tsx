import { useEffect, useState } from "react";
import { Moon, Sun } from "@phosphor-icons/react";
import { api, useAuth } from "../lib";
import { applyTheme } from "../theme";
import { useAction } from "./base";
import type { ProfileSaved } from "../../shared/account";

const isDark = () => getComputedStyle(document.documentElement).colorScheme === "dark"
  || (document.documentElement.dataset.scheme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);

const button = "inline-grid place-items-center size-8 p-0 bg-transparent text-[#f6f2e9] border-none rounded-none "
  + "hover:text-site-sun disabled:cursor-progress disabled:opacity-60";

export function ThemeToggle() {
  const { me, setMe } = useAuth();
  const [dark, setDark] = useState(isDark);
  const act = useAction();
  useEffect(() => {
    const update = () => setDark(isDark());
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-scheme"] });
    const media = matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", update);
    update();
    return () => { observer.disconnect(); media.removeEventListener("change", update); };
  }, []);

  const toggle = () => act.run(async () => {
    const theme = isDark() ? "light" : "dark";
    if (!me) { applyTheme(theme); return; }
    const previous = me;
    setMe({ ...me, theme });
    try {
      const saved = await api<ProfileSaved>("/me", { method: "PATCH", body: { theme } });
      setMe(saved.user);
    } catch (error) { setMe(previous); throw error; }
  });
  const label = dark ? "Switch to light mode" : "Switch to dark mode";
  return <span className="footer-theme inline-flex items-center gap-2.5">
    <button type="button" className={button} aria-label={label} title={label} onClick={toggle} disabled={act.busy}>
      {dark ? <Sun size={18} weight="bold" aria-hidden /> : <Moon size={18} weight="bold" aria-hidden />}
    </button>
    {act.note}
  </span>;
}
