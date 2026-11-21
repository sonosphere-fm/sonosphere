import { Arrow, Ico } from "../icons";
import { useState } from "react";
import { Button } from "../kit";
import { Link, useSearchParams } from "react-router-dom";
import { api, qs, useApi, useAuth, userUrl, useTitle } from "../lib";
import { Async, Empty, useAction } from "../ui/base";
import type { AppAuthorized, AppInfo } from "../../shared/apps";

// ---------- API consent (what /api/auth redirects to) ----------
// Desktop sign-in arrives with the token the app asked for; web sign-in arrives with just api_key (and maybe cb), and
// the server makes the token when the person approves. Either way they go back to cb or the app's callback URL.
/** Where a callback URL leads, as people recognise it: the site's host, or the app's scheme for native apps. */
const backTo = (url: string) => { try { const u = new URL(url); return u.host || u.protocol.replace(/:$/, " app"); } catch { return ""; } };
export function Connect() {
  const [sp] = useSearchParams(), apiKey = sp.get("api_key") || "", token = sp.get("token") || "", cb = sp.get("cb") || "";
  const { me } = useAuth(), q = useApi<AppInfo>(apiKey ? `/apps/lookup${qs({ api_key: apiKey })}` : null), act = useAction(), [done, setDone] = useState(false);
  useTitle("Connect an application");
  const allow = () => act.run(async () => {
    const r = await api<AppAuthorized>("/apps/authorize", { body: { api_key: apiKey, token: token || undefined, cb: cb || undefined } });
    if (r.redirect) { window.location.href = r.redirect; return; }
    setDone(true);
  });
  return (
    <div className="wrap page narrow">
      <h1 className="page-title">Connect an application</h1>
      {!apiKey ? <Empty>This link is missing its <code>api_key</code>.</Empty> : (
        <Async q={q}>{app => done ? <div className="card"><p className="form-ok"><Ico.Check /> {app.name} is connected.</p><p>You can close this page and return to the application.</p></div> : (
          <div className="card form">
            <p><b>{app.name}</b> <span className="muted">by <Link to={userUrl(app.owner)}>{app.owner}</Link></span> wants to connect to your Sonosphere account{me && <> (<b>{me.username}</b>)</>}.</p>
            {app.description && <p className="muted">{app.description}</p>}
            <p>It will be able to scrobble, update “now playing”, love tracks and add tags on your behalf. You can disconnect it at any time in Settings<Arrow say=", " />Applications.</p>
            {act.note}
            {backTo(cb || app.callbackUrl) && <p className="muted small">After approving you'll be sent back to {backTo(cb || app.callbackUrl)}.</p>}
            <div className="row"><Button kind="btn" loading={act.busy} onClick={allow}>Yes, allow access</Button><Button kind="btn ghost" href="/">No, cancel</Button></div>
          </div>
        )}</Async>
      )}
    </div>
  );
}
