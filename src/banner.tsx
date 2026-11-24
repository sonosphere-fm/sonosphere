import { useEffect, useState } from "react";
import { Ico } from "./icons";
import { Button } from "./kit";
import { useLocation, useNavigate } from "react-router-dom";
import { api, useAuth } from "./lib";
import { t, tx } from "./i18n";
import type { SiteInfo } from "../shared/admin";
import { UNVERIFIED_DAYS, type MeResponse, type Ok } from "../shared/auth";

const DISMISSED = "spin.announcement.dismissed";

function readDismissed() {
  try {
    return Number(localStorage.getItem(DISMISSED)) || 0;
  } catch {
    return 0;
  }
}

export function SiteBanner() {
  const [site, setSite] = useState<SiteInfo | null>(null);
  const [hidden, setHidden] = useState<number>(readDismissed);
  useEffect(() => {
    const load = () => {
      api<SiteInfo>("/site")
        .then(setSite)
        .catch(() => {});
    };
    load();
    window.addEventListener("spin:site", load);
    return () => window.removeEventListener("spin:site", load);
  }, []);
  const a = site?.announcement;
  if (!a || hidden === a.id) return null;
  const dismiss = () => {
    setHidden(a.id);
    try {
      localStorage.setItem(DISMISSED, String(a.id));
    } catch {
      // private mode: dismissed for this visit only
    }
  };
  return (
    <div className={`site-banner ${a.tone}`} role="status">
      <div className="wrap site-banner-in">
        <span>{a.text}</span>
        <Button kind="site-banner-x" type="button" aria-label={t("common.dismissAnnouncement")} onClick={dismiss}>
          <Ico.X />
        </Button>
      </div>
    </div>
  );
}

const NAGGED = "spin.verify.dismissed";

export function ImpersonationBanner() {
  const { me, setMe } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!me?.impersonating) return null;
  const stop = async () => {
    const target = me.username;
    setBusy(true);
    setError("");
    try {
      const r = await api<MeResponse>("/me/stop-impersonating", { body: {} });
      setMe(r.user);
      navigate(`/admin/users/${encodeURIComponent(target)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="site-banner impersonation" role="status">
      <div className="wrap site-banner-in">
        <span>
          {tx("common.actingAs", {
            user: (
              <strong>
                <Username user={me} />
              </strong>
            ),
            by: <Username name={me.impersonating.by} />,
          })}{" "}
          {error && <span role="alert">{error}</span>}
        </span>
        <button type="button" className="banner-link" disabled={busy} onClick={stop}>
          {busy ? t("common.returning") : t("common.returnToAccount")}
        </button>
      </div>
    </div>
  );
}

function readNagged() {
  try {
    return sessionStorage.getItem(NAGGED) === "1";
  } catch {
    return false;
  }
}

export function VerifyBanner() {
  const { me } = useAuth();
  const { pathname } = useLocation();
  const [hidden, setHidden] = useState(readNagged);
  const [note, setNote] = useState("");
  if (!me || me.impersonating || me.emailVerified || hidden || pathname === "/verify") return null;

  const dismiss = () => {
    setHidden(true);
    try {
      sessionStorage.setItem(NAGGED, "1");
    } catch {}
  };
  const left = Math.max(1, Math.ceil((me.registeredAt + UNVERIFIED_DAYS * 86400 - Date.now() / 1000) / 86400));
  const resend = () => {
    setNote(t("common.sending"));
    api<Ok>("/me/verify", { body: {} }).then(
      () => setNote(t("common.sentCheck", { email: me.email })),
      (e) => setNote(e instanceof Error ? e.message : String(e))
    );
  };
  const restrictions = (
    <> {tx("common.verifyRestrictions", { days: <strong>{t("common.days", { count: left })}</strong> })}</>
  );
  return (
    <div className="site-banner warning" role="status">
      <div className="wrap site-banner-in">
        <span>
          {tx("common.verifyPrompt", { email: <strong>{me.email}</strong> })}
          {!me.admin && restrictions}{" "}
          {note || (
            <button type="button" className="banner-link" onClick={resend}>
              {t("common.resendVerification")}
            </button>
          )}
        </span>
        <Button kind="site-banner-x" type="button" aria-label={t("common.hideForNow")} onClick={dismiss}>
          <Ico.X />
        </Button>
      </div>
    </div>
  );
}
import { Username } from "./ui/username";
