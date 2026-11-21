import { Arrow, Ico } from "../icons";
import { useState } from "react";
import { Button } from "../kit";
import { Link, useSearchParams } from "react-router-dom";
import { api, qs, useApi, useAuth, userUrl, useTitle } from "../lib";
import { Async, Empty, useAction } from "../ui/base";
import type { AppInfo, AppOk } from "../../shared/apps";

// ---------- API consent (what /api/auth redirects to) ----------
export function Connect() {
  const [sp] = useSearchParams(), apiKey = sp.get("api_key") || "", token = sp.get("token") || "", cb = sp.get("cb") || "";
  const { me } = useAuth(), q = useApi<AppInfo>(apiKey ? `/apps/lookup${qs({ api_key: apiKey })}` : null), act = useAction(), [done, setDone] = useState(false);
  useTitle("Connect an application");
  const allow = () => act.run(async () => {
    await api<AppOk>("/apps/authorize", { body: { api_key: apiKey, token } });
    if (/^https?:\/\//i.test(cb)) { window.location.href = cb + (cb.includes("?") ? "&" : "?") + "token=" + encodeURIComponent(token); return; }
    setDone(true);
  });
  return (
    <div className="wrap page narrow">
      <h1 className="page-title">Connect an application</h1>
      {!apiKey || !token ? <Empty>This link is missing its <code>api_key</code> or <code>token</code>.</Empty> : (
        <Async q={q}>{app => done ? <div className="card"><p className="form-ok"><Ico.Check /> {app.name} is connected.</p><p>You can close this page and return to the application.</p></div> : (
          <div className="card form">
            <p><b>{app.name}</b> <span className="muted">by <Link to={userUrl(app.owner)}>{app.owner}</Link></span> wants to connect to your Sonosphere account{me && <> (<b>{me.username}</b>)</>}.</p>
            {app.description && <p className="muted">{app.description}</p>}
            <p>It will be able to scrobble, update “now playing”, love tracks and add tags on your behalf. You can disconnect it at any time in Settings<Arrow say=", " />Applications.</p>
            {act.note}
            {cb && /^https?:\/\//i.test(cb) && <p className="muted small">After approving you'll be sent to {new URL(cb).host}.</p>}
            <div className="row"><Button kind="btn" loading={act.busy} onClick={allow}>Yes, allow access</Button><Button kind="btn ghost" href="/">No, cancel</Button></div>
          </div>
        )}</Async>
      )}
    </div>
  );
}
