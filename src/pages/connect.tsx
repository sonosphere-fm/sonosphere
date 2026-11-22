import { Arrow, Ico } from "../icons";
import { useState } from "react";
import { Button } from "../kit";
import { Link, useSearchParams } from "react-router-dom";
import { api, qs, useApi, useAuth, userUrl, useTitle } from "../lib";
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
  useTitle("Connect an application");

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
            <Ico.Check /> {app.name} is connected.
          </p>
          <p>You can close this page and return to the application.</p>
        </div>
      );
    }
    const destination = backTo(cb || app.callbackUrl);
    return (
      <div className="card form">
        <p>
          <b>{app.name}</b>{" "}
          <span className="muted">
            by <Link to={userUrl(app.owner)}>{app.owner}</Link>
          </span>{" "}
          wants to connect to your Sonosphere account
          {me && (
            <>
              {" "}
              (<b>{me.username}</b>)
            </>
          )}
          .
        </p>
        {app.description && <p className="muted">{app.description}</p>}
        <p>
          It will be able to scrobble, update “now playing”, love tracks and add tags on your behalf. You can disconnect
          it at any time in Settings
          <Arrow say=", " />
          Applications.
        </p>
        {act.note}
        {destination && <p className="muted small">After approving you'll be sent back to {destination}.</p>}
        <div className="row">
          <Button kind="btn" loading={act.busy} onClick={allow}>
            Yes, allow access
          </Button>
          <Button kind="btn ghost" href="/">
            No, cancel
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="wrap page narrow">
      <h1 className="page-title">Connect an application</h1>
      {apiKey ? (
        <Async q={q}>{consent}</Async>
      ) : (
        <Empty>
          This link is missing its <code>api_key</code>.
        </Empty>
      )}
    </div>
  );
}
