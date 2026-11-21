// The site-wide announcement staff can set, shown at the top of every page until dismissed.
import { useEffect, useState } from "react";
import { Ico } from "./icons";
import { Button } from "./kit";
import { useLocation } from "react-router-dom";
import { api, useAuth } from "./lib";
import type { SiteInfo } from "../shared/admin";
import { UNVERIFIED_DAYS, type Ok } from "../shared/auth";

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

// A reminder for accounts whose email is not confirmed yet, with a way to get the link again. Hidden for the visit once dismissed.
const NAGGED = "spin.verify.dismissed";
export function VerifyBanner() {
  const { me } = useAuth(), { pathname } = useLocation();
  const [hidden, setHidden] = useState(() => { try { return sessionStorage.getItem(NAGGED) === "1"; } catch { return false; } });
  const [note, setNote] = useState("");
  if (!me || me.emailVerified || hidden || pathname === "/verify") return null;
  const dismiss = () => { setHidden(true); try { sessionStorage.setItem(NAGGED, "1"); } catch { /* private mode */ } };
  const left = Math.max(1, Math.ceil((me.registeredAt + UNVERIFIED_DAYS * 86400 - Date.now() / 1000) / 86400));
  const resend = () => { setNote("Sending..."); api<Ok>("/me/verify", { body: {} }).then(() => setNote(`Sent. Check ${me.email}.`), e => setNote(e instanceof Error ? e.message : String(e))); };
  return (
    <div className="site-banner warning" role="status">
      <div className="wrap site-banner-in">
        <span>Please confirm your email address using the link we sent to <strong>{me.email}</strong>.{!me.admin && <> Certain actions such as posting, sending messages, and following users are restricted until you confirm your email address. Your account will be automatically purged if you do not verify your email address within <strong>{left} {left === 1 ? "day" : "days"}</strong>.</>} {note || <button type="button" className="banner-link" onClick={resend}>Resend verification email</button>}</span>
        <Button kind="site-banner-x" type="button" aria-label="Hide for now" onClick={dismiss}><Ico.X /></Button>
      </div>
    </div>
  );
}
