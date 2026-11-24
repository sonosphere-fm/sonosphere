import { Arrow, Ico } from "../icons";
import { useState } from "react";
import { Button } from "../kit";
import { t, tx } from "../i18n";
import { Link, useSearchParams } from "react-router-dom";
import { api, qs, TITLES, useApi, useAuth, userUrl, useTitle } from "../lib";
import { Async, Empty, useAction } from "../ui/base";
import type { AppAuthorized, AppInfo } from "../../shared/apps";

// Desktop sign-in arrives with the token the app asked for; web sign-in arrives with just api_key (and maybe cb),
// and the server makes the token on approval.

// The site's host, or "<scheme> app" for native apps.
function backTo(url: string) {
  try {
    const u = new URL(url);
    return u.host || u.protocol.replace(/:$/, " app");
  } catch {
    return "";
  }
}

export function Connect() {
  const [sp] = useSearchParams();
  const apiKey = sp.get("api_key") || "";
  const token = sp.get("token") || "";
  const cb = sp.get("cb") || "";
  const { me } = useAuth();
  const q = useApi<AppInfo>(apiKey ? `/apps/lookup${qs({ api_key: apiKey })}` : null);
  const act = useAction();
  const [done, setDone] = useState(false);
  useTitle(TITLES.connect);

  const allow = () =>
    act.run(async () => {
      const r = await api<AppAuthorized>("/apps/authorize", {
        body: { api_key: apiKey, token: token || undefined, cb: cb || undefined },
      });
      if (r.redirect) {
        window.location.href = r.redirect;
        return;
      }
      setDone(true);
    });

  const consent = (app: AppInfo) => {
    if (done) {
      return (
        <div className="card">
          <p className="form-ok">
            <Ico.Check /> {t("auth.connectDone", { app: app.name })}
          </p>
          <p>{t("auth.connectClose")}</p>
        </div>
      );
    }
    const destination = backTo(cb || app.callbackUrl);
    return (
      <div className="card form">
        <p>
          {tx(me ? "auth.connectWantsAs" : "auth.connectWants", {
            app: <b>{app.name}</b>,
            owner: (
              <span className="muted">
                {tx("auth.connectBy", {
                  owner: (
                    <Link to={userUrl(app.owner)}>
                      <Username name={app.owner} />
                    </Link>
                  ),
                })}
              </span>
            ),
            me: me && (
              <b>
                <Username user={me} />
              </b>
            ),
          })}
        </p>
        {app.description && <p className="muted">{app.description}</p>}
        <p>{tx("auth.connectScope", { arrow: <Arrow say=", " /> })}</p>
        {act.note}
        {destination && <p className="muted small">{t("auth.connectSentBack", { destination })}</p>}
        <div className="row">
          <Button kind="btn" loading={act.busy} onClick={allow}>
            {t("auth.connectAllow")}
          </Button>
          <Button kind="btn ghost" href="/">
            {t("auth.connectCancel")}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="wrap page narrow">
      <h1 className="page-title">{t("auth.connectTitle")}</h1>
      {apiKey ? (
        <Async q={q}>{consent}</Async>
      ) : (
        <Empty>{tx("auth.connectMissingKey", { param: <code>api_key</code> })}</Empty>
      )}
    </div>
  );
}
import { Username } from "../ui/username";
