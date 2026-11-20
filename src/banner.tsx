// The site-wide announcement staff can set, shown at the top of every page until dismissed.
import { useEffect, useState } from "react";
import { Ico } from "./icons";
import { Button } from "./kit";
import { api } from "./lib";
import type { SiteInfo } from "../shared/admin";

const DISMISSED = "spin.announcement.dismissed";
export function SiteBanner() {
  const [site, setSite] = useState<SiteInfo | null>(null);
  const [hidden, setHidden] = useState<number>(() => { try { return Number(localStorage.getItem(DISMISSED)) || 0; } catch { return 0; } });
  useEffect(() => {
    const load = () => { api<SiteInfo>("/site").then(setSite).catch(() => {}); };
    load();
    window.addEventListener("spin:site", load);
    return () => window.removeEventListener("spin:site", load);
  }, []);
  const a = site?.announcement;
  if (!a || hidden === a.id) return null;
  const dismiss = () => { setHidden(a.id); try { localStorage.setItem(DISMISSED, String(a.id)); } catch { /* private mode: dismissed for this visit only */ } };
  return (
    <div className={`site-banner ${a.tone}`} role="status">
      <div className="wrap site-banner-in">
        <span>{a.text}</span>
        <Button kind="site-banner-x" type="button" aria-label="Dismiss announcement" onClick={dismiss}><Ico.X /></Button>
      </div>
    </div>
  );
}
