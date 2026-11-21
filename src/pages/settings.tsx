import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Button, Input, Select, useConfirm } from "../kit";
import { MdEditor } from "../md";
import { Link, NavLink, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ago, api, copyText, date, num, plural, useApi, useAuth, useTitle, type Ok } from "../lib";
import type { ProfileEdit, ProfileSaved, ScrobblesCleared } from "../../shared/account";
import type { ApiApp, AppOk, Apps } from "../../shared/apps";
import { useTurnstile } from "./auth";
import { OAUTH_ERRORS, OAuthMark, oauthStart } from "../ui/oauth";
import type { Logins } from "../../shared/auth";
import type { BlockResult, Blocks } from "../../shared/blocks";
import type { ImageSaved } from "../../shared/images";
import { EMAIL_KINDS, EMAIL_MODES } from "../../shared/notifications";
import type { SpotifyConnect, SpotifyConnectBody, SpotifyLink, SpotifyStatus, SpotifySynced } from "../../shared/spotify";
import { Ico } from "../icons";
import { Art, Async, Section, useAction } from "../ui/base";
import { UserList } from "../ui/lists";
import type { ThemePref } from "../theme";

// ---------- settings ----------
export function Settings() {
  const tab = useParams().tab || "profile";
  useTitle("Settings");
  return (
    <div className="wrap page">
      <h1 className="page-title">Settings</h1>
      <nav className="tabs">{[["", "Profile"], ["/privacy", "Privacy"], ["/notifications", "Notifications"], ["/account", "Account"], ["/applications", "Applications"], ["/data", "Your data"]].map(([p, l]) => <NavLink key={p} to={`/settings${p}`} end>{l}</NavLink>)}</nav>
      <div className="narrow-col">
        {tab === "profile" && <ProfileSettings />}
        {tab === "privacy" && <PrivacySettings />}
        {tab === "notifications" && <NotificationSettings />}
        {tab === "account" && <AccountSettings />}
        {tab === "applications" && <AppSettings />}
        {tab === "data" && <DataSettings />}
      </div>
    </div>
  );
}
function ProfileSettings() {
  const { me, setMe, refresh } = useAuth(), act = useAction(), img = useAction(), file = useRef<HTMLInputElement>(null);
  const [f, setF] = useState({ realname: me!.realname, pronouns: me!.pronouns, country: me!.country, website: me!.website, about: me!.about });
  const set = (k: keyof typeof f) => (e: ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <>
      <Section title="Avatar">
        <div className="avatar-edit">
          <button type="button" className="avatar avatar-pick" aria-label="Change avatar" onClick={() => file.current?.click()} disabled={img.busy}><Art image={me!.image} kind="user" /></button>
          <Input ref={file} type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif" onChange={e => { const x = e.target.files?.[0]; if (x) img.run(async () => { await api<ImageSaved>("/image?type=user", { raw: x, headers: { "Content-Type": x.type } }); refresh(); return "Avatar updated."; }); e.target.value = ""; }} />
          <div className="avatar-side">
            <div className="avatar-actions">
              <Button kind="btn small" loading={img.busy} onClick={() => file.current?.click()}>{me!.image ? "Change picture" : "Upload picture"}</Button>
              {me!.image && <button type="button" className="linklike muted" onClick={() => img.run(async () => { await api<Ok>("/image", { method: "DELETE" }); refresh(); })}>Remove</button>}
            </div>
            <p className="muted small">PNG, JPEG, WebP or GIF (max 8 MB).</p>
            {img.note}
          </div>
        </div>
      </Section>
      <Section title="Profile">
        <form className="form" onSubmit={e => { e.preventDefault(); act.run(async () => { setMe((await api<ProfileSaved>("/me", { method: "PATCH", body: f })).user); return "Profile saved."; }); }}>
          <label>Display name<Input value={f.realname} onChange={set("realname")} maxLength={60} /></label>
          <label>Pronouns<Input value={f.pronouns} onChange={set("pronouns")} placeholder="they/them" maxLength={30} /></label>
          <label>Country<Input value={f.country} onChange={set("country")} maxLength={60} /></label>
          <label>Website<Input type="url" value={f.website} onChange={set("website")} placeholder="https://" maxLength={200} /></label>
          <div className="field-block"><span className="field-label">About me</span><MdEditor label="About me" rows={5} value={f.about} onChange={about => setF(f => ({ ...f, about }))} maxLength={2000} /></div>
          {act.note}<Button kind="btn" loading={act.busy}>Save profile</Button>
        </form>
      </Section>
      <Appearance />
    </>
  );
}
const THEMES: [ThemePref, string][] = [["light", "Light"], ["system", "Automatic"], ["dark", "Dark"]];
function Appearance() {
  const { me, setMe } = useAuth(), act = useAction();
  // switches straight away; goes back if saving fails
  const pick = (theme: ThemePref) => {
    const was = me!; if (theme === (was.theme ?? "light")) return;
    setMe({ ...was, theme });
    act.run(async () => { try { setMe((await api<ProfileSaved>("/me", { method: "PATCH", body: { theme } })).user); } catch (e) { setMe(was); throw e; } });
  };
  return (
    <Section title="Appearance">
      <div className="theme-pick" role="group" aria-label="Theme">
        {THEMES.map(([v, name]) => <button key={v} type="button" aria-pressed={(me!.theme ?? "light") === v} onClick={() => pick(v)}>{name}</button>)}
      </div>
      {act.note}
    </Section>
  );
}
function PrivacySettings() {
  const { me, setMe } = useAuth(), act = useAction();
  const save = (body: ProfileEdit) => act.run(async () => { setMe((await api<ProfileSaved>("/me", { method: "PATCH", body })).user); return "Saved."; });
  return (
    <>
    <Section title="Privacy">
      <div className="form">
        <label className="check"><Input type="checkbox" checked={me!.hideRecent || me!.privateListening} disabled={me!.privateListening} onChange={e => save({ hideRecent: e.target.checked })} /> <span><b>Hide recent listening</b><br /><span className="muted small">Your scrobble history and recent tracks will not be visible to other users. Your charts will still be shown on your profile.</span></span></label>
        <label className="check"><Input type="checkbox" checked={me!.privateListening} onChange={e => save({ privateListening: e.target.checked })} /> <span><b>Keep all my listening private</b><br /><span className="muted small">Your charts, library, loved tracks, play counts and listening reports will be hidden from other users. You will also be excluded from other users' soundalikes and top listener lists. Your plays will still count anonymously toward site-wide charts.</span></span></label>
        <label className="check"><Input type="checkbox" checked={me!.shoutsEnabled} onChange={e => save({ shoutsEnabled: e.target.checked })} /> <span><b>Let people write on my wall</b><br /><span className="muted small">Turn off to close your shoutbox to new shouts.</span></span></label>
        <label>Who can send you direct messages?
          <Select label="Who can message you" value={me!.dmPolicy} onChange={v => save({ dmPolicy: v })} options={[["everyone", "Anyone"], ["requests", "Anyone, but people I don't follow go to Requests"], ["following", "Only people I follow"], ["nobody", "Nobody"]]} />
        </label>
        {act.note}
      </div>
    </Section>
    <BlockedUsers />
    </>
  );
}
function NotificationSettings() {
  const { me, setMe } = useAuth(), act = useAction();
  const save = (body: ProfileEdit) => act.run(async () => { setMe((await api<ProfileSaved>("/me", { method: "PATCH", body })).user); return "Saved."; });
  const off = me!.emailNotify === "off", muted = new Set(me!.emailMuted);
  const toggle = (k: string, on: boolean) => save({ emailMuted: on ? me!.emailMuted.filter(x => x !== k) : [...me!.emailMuted, k] });
  return (
    <Section title="Email notifications">
      <div className="form">
        {!me!.emailVerified && <p className="muted small">Emails only go to a confirmed address. Confirm {me!.email} under <Link to="/settings/account">Account</Link> to start getting them.</p>}
        <label>Send me emails
          <Select label="How often to email you" value={me!.emailNotify} onChange={v => save({ emailNotify: v })} options={EMAIL_MODES.map(([v, l]) => [v, l])} />
        </label>
        {me!.emailNotify !== "instant" && !off && <p className="muted small">One email {me!.emailNotify === "daily" ? "a day" : "a week"} with whatever is still unread, and nothing when there's nothing new.</p>}
        <p className="field-label">Email me when</p>
        {EMAIL_KINDS.map(([k, l]) => <label key={k} className="check"><Input type="checkbox" checked={!off && !muted.has(k)} disabled={off} onChange={e => toggle(k, e.target.checked)} /> {l}</label>)}
        {act.note}
      </div>
    </Section>
  );
}
function BlockedUsers() {
  const q = useApi<Blocks>("/blocks");
  return (
    <Section title="Blocked users">
      <p className="muted small">People you block can't follow you, write on your wall or comment on your journal, and their shouts are hidden from you everywhere. Block someone from the “…” menu on their profile.</p>
      <Async q={q}>{d => d.items.length ? <UserList items={d.items} extra={u => <span><Button kind="link small" type="button" onClick={() => api<BlockResult>("/block", { body: { username: u.username, block: false } }).then(q.reload)}>Unblock</Button></span>} /> : <p className="muted">You haven't blocked anyone.</p>}</Async>
    </Section>
  );
}
/** Other sites that can sign in to this account. The round trip reports back in ?oauth= (a problem) or ?linked=. */
function SignInMethods() {
  const { me } = useAuth(), q = useApi<Logins>("/me/logins"), act = useAction(), [sp, setSp] = useSearchParams();
  const error = OAUTH_ERRORS[sp.get("oauth") ?? ""], linked = sp.get("linked");
  if (!q.data?.providers.length) return null;
  const connectedCount = q.data.providers.filter(p => p.connected).length, lastWayIn = !me!.hasPassword && connectedCount === 1;
  const disconnect = (id: string) => act.run(async () => { await api<Ok>("/me/logins/unlink", { body: { provider: id } }); setSp({}, { replace: true }); q.reload(); });
  return (
    <Section title="Sign-in methods">
      {error && <p className="form-error" role="alert">{error}</p>}
      {linked && !error && <p className="form-ok">Connected. You can now log in with it.</p>}
      <ul className="plain">{q.data.providers.map(p => (
        <li key={p.id} className="row between">
          <span className="oauth-row"><span className={`oauth-chip oauth-${p.id}`}><OAuthMark id={p.id} /></span><b>{p.label}</b> <span className="muted small">{p.connected ? <>{p.connected.name || "connected"}, since {date(p.connected.since)}</> : "not connected"}</span></span>
          {p.connected
            ? <Button kind="btn ghost small" disabled={lastWayIn} title={lastWayIn ? "Set a password first" : undefined} onClick={() => disconnect(p.id)}>Disconnect</Button>
            : <Button kind="btn ghost small" href={oauthStart(p.id, "link")}>Connect</Button>}
        </li>
      ))}</ul>
      {act.note}
    </Section>
  );
}
function AccountSettings() {
  const { me, setMe, refresh } = useAuth(), nav = useNavigate();
  const [email, setEmail] = useState(me!.email), [pw, setPw] = useState({ current: "", next: "" }), [del, setDel] = useState("");
  const a0 = useAction(), a1 = useAction(), a2 = useAction(), a3 = useAction(), c = useConfirm();
  return (
    <>
      {c.dialog}
      <Section title="Email">
        <form className="form" onSubmit={e => { e.preventDefault(); a1.run(async () => {
          if (email.trim().toLowerCase() === me!.email) return "That is already your email.";
          const u = (await api<ProfileSaved>("/me", { method: "PATCH", body: { email } })).user; setMe(u); setEmail(u.email);
          return `We sent a link to ${u.pendingEmail ?? email}. Your email changes once you follow it.`;
        }); }}>
          <p className="muted small">
            {me!.emailVerified ? <>{me!.email} is confirmed.</> : <>{me!.email} is not confirmed yet. <Button kind="link small" type="button" onClick={() => a0.run(async () => { await api<Ok>("/me/verify", { body: {} }); return `Sent a new link to ${me!.email}.`; })}>Send the link again</Button></>}
            {me!.pendingEmail && <> Waiting for you to confirm {me!.pendingEmail}.</>}
          </p>
          {a0.note}
          <label>Email address<Input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>{a1.note}<Button kind="btn" loading={a1.busy}>Update email</Button>
        </form>
      </Section>
      <Section title="Password">
        <form className="form" onSubmit={e => { e.preventDefault(); a2.run(async () => {
          const had = me!.hasPassword;
          await api<Ok>("/me/password", { body: pw }); setPw({ current: "", next: "" });
          if (!had) { await refresh(); return "Password set. You can now log in with it, and in scrobbler apps that ask for one."; }
          return "Password changed. Other devices were signed out.";
        }); }}>
          {!me!.hasPassword && <p className="muted small">You signed up through another site, so your account has no password yet. Set one to log in without it, or to use scrobbler apps that ask for a username and password.</p>}
          {me!.hasPassword && <label>Current password<Input type="password" value={pw.current} onChange={e => setPw({ ...pw, current: e.target.value })} required autoComplete="current-password" /></label>}
          <label>New password<Input type="password" value={pw.next} onChange={e => setPw({ ...pw, next: e.target.value })} required minLength={8} autoComplete="new-password" /></label>
          {a2.note}<Button kind="btn" loading={a2.busy}>{me!.hasPassword ? "Change password" : "Set password"}</Button>
        </form>
      </Section>
      <SignInMethods />
      <Section title="Delete account">
        <form className="form" onSubmit={e => { e.preventDefault(); c.ask({ title: "Delete your account?", body: "Your profile, scrobbles, loved tracks, playlists and shouts will be gone for good. This can't be undone.", action: "Delete my account", danger: true, run: () => a3.run(async () => { await api<Ok>("/me/delete", { body: { password: del } }); setMe(null); nav("/"); }) }); }}>
          <p>This permanently removes your profile, scrobbles, loved tracks, playlists and shouts.</p>
          <ConfirmField value={del} onChange={setDel} />
          {a3.note}<Button kind="btn danger" loading={a3.busy}>Delete my account</Button>
        </form>
      </Section>
    </>
  );
}
// What /api/spotify/callback reports back in ?spotify= after the round trip to Spotify.
const SPOTIFY_OUTCOME: Record<string, { ok: boolean; text: string }> = {
  connected: { ok: true, text: "Spotify is connected. Your recent plays are being imported." },
  denied: { ok: false, text: "Spotify was not connected: access was declined." },
  expired: { ok: false, text: "That sign-in link expired. Try connecting again." },
  forbidden: { ok: false, text: "Spotify refused this account. If you signed in with a different Spotify account from the one that created the app, add it under User Management in the app's settings, then connect again." },
  failed: { ok: false, text: "Spotify could not be connected. Check the client ID and try again." },
};
const SPOTIFY_DASHBOARD = "https://developer.spotify.com/dashboard";

/** How to make the listener's own Spotify app, then the client ID field. */
function SpotifySetup({ redirectUri, initial, playback, onConnect, busy, note }: { redirectUri: string; initial: string; playback: boolean; onConnect: (clientId: string, playback: boolean) => void; busy: boolean; note: ReactNode }) {
  const [id, setId] = useState(initial), [copied, setCopied] = useState(false), [play, setPlay] = useState(playback);
  const copy = () => copyText(redirectUri).then(ok => { if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1500); } });
  return (
    <>
      <p>Spotify only lets each app be used by a few people, so you connect through your own free Spotify app. It takes about two minutes:</p>
      <ol className="steps">
        <li>Open the <a href={SPOTIFY_DASHBOARD} target="_blank" rel="noreferrer">Spotify developer dashboard</a> and log in with your Spotify account. Accept the developer terms if asked.</li>
        <li>Click <b>Create app</b>. Any name and description will do, such as "My Sonosphere scrobbler".</li>
        <li>Under <b>Redirect URIs</b>, paste this address exactly and click <b>Add</b>:
          <span className="copy-row"><code onClick={e => { const r = document.createRange(); r.selectNodeContents(e.currentTarget); getSelection()?.removeAllRanges(); getSelection()?.addRange(r); }}>{redirectUri}</code><Button kind="btn ghost small" type="button" onClick={copy}>{copied ? "Copied" : "Copy"}</Button></span>
        </li>
        <li>Under <b>Which API/SDKs are you planning to use?</b>, tick <b>Web API</b> (and <b>Web Playback SDK</b> to play music here), agree to the terms and click <b>Save</b>.</li>
        <li>Open the app's <b>Settings</b>, copy its <b>Client ID</b> and paste it below. You don't need the client secret.</li>
      </ol>
      <form className="form" onSubmit={e => { e.preventDefault(); onConnect(id.trim(), play); }}>
        <label>Client ID<Input value={id} onChange={e => setId(e.target.value)} required maxLength={64} placeholder="32 letters and numbers" autoComplete="off" spellCheck={false} /></label>
        <label className="check"><Input type="checkbox" checked={play} onChange={e => setPlay(e.target.checked)} /> Also play music here through Spotify instead of videos (needs Spotify Premium)</label>
        {note}
        <div className="row"><Button kind="btn" loading={busy}>Connect Spotify</Button></div>
      </form>
      <p className="muted small">Only the Spotify account that created the app can use it straight away. To connect a different one, add it under <b>User Management</b> in the app's settings first.</p>
    </>
  );
}

function SpotifySettings() {
  const q = useApi<SpotifyStatus>("/spotify"), act = useAction(), [sp, setSp] = useSearchParams(), [redo, setRedo] = useState(false);
  const outcome = SPOTIFY_OUTCOME[sp.get("spotify") ?? ""];
  const connect = (clientId: string, playback: boolean) => act.run(async () => { window.location.href = (await api<SpotifyConnect>("/spotify/connect", { body: { clientId, playback } satisfies SpotifyConnectBody })).url; });
  const sync = (s: Extract<SpotifyStatus, { enabled: true }>) => act.run(async () => { const r = await api<SpotifySynced>("/spotify/sync", { method: "POST" }); q.setData({ ...s, link: r.link }); return r.imported ? `Imported ${plural(r.imported, "play")}.` : "Nothing new to import."; });
  const disconnect = () => act.run(async () => { await api<Ok>("/spotify", { method: "DELETE" }); setSp({}, { replace: true }); setRedo(false); q.reload(); });
  const linked = (s: Extract<SpotifyStatus, { enabled: true }>, l: SpotifyLink) => (
    <>
      <p>Connected as <b>{l.account.name}</b> <span className="muted small">since {date(l.connectedAt)}</span></p>
      {l.broken ? <p className="form-error">{l.broken}</p> : (
        <p className="muted small">{l.lastImport ? <>Last import {ago(l.lastImport)} · {num(l.imported)} plays imported</> : "Importing your recent plays..."}. New plays are picked up every few minutes.</p>
      )}
      {!l.broken && <p className="muted small">{l.playback ? "The player plays through Spotify when it has the track." : "The player uses videos. To play through Spotify (Premium) instead, choose Change app and tick the playback option."}</p>}
      {l.broken || redo ? <SpotifySetup redirectUri={s.redirectUri} initial={l.clientId} playback={l.playback} onConnect={connect} busy={act.busy} note={act.note} /> : act.note}
      <div className="row">
        {!l.broken && !redo && <Button kind="btn" loading={act.busy} onClick={() => sync(s)}>Import now</Button>}
        {!l.broken && !redo && <Button kind="btn ghost" onClick={() => setRedo(true)}>Change app</Button>}
        <Button kind="btn ghost" onClick={disconnect}>Disconnect</Button>
      </div>
    </>
  );
  const badge = !q.data ? null : !q.data.enabled ? <span className="badge off">Disabled</span>
    : q.data.link?.broken ? <span className="badge warn">Needs attention</span>
    : q.data.link ? <span className="badge">Connected</span> : <span className="badge off">Not connected</span>;
  return (
    <Service name="Spotify" blurb="Import what you play on Spotify" badge={badge} open={!!outcome}>
      <Async q={q}>{d => !d.enabled ? <p className="muted">Scrobbling from Spotify is disabled.</p> : (
        <div className="spotify">
          {outcome && !(outcome.ok && d.link?.broken) && <p className={outcome.ok ? "form-ok" : "form-error"}>{outcome.text}</p>}
          {d.link ? linked(d, d.link) : <SpotifySetup redirectUri={d.redirectUri} initial="" playback={false} onConnect={connect} busy={act.busy} note={act.note} />}
        </div>
      )}</Async>
    </Service>
  );
}

/** One streaming service in settings: a row that expands to its setup. Collapsed unless `open`. */
function Service({ name, blurb, badge, open, children }: { name: string; blurb: string; badge: ReactNode; open: boolean; children: ReactNode }) {
  const [shown, setShown] = useState(open);
  return (
    <div className={`card service${shown ? " open" : ""}`}>
      <button type="button" className="service-head" aria-expanded={shown} onClick={() => setShown(v => !v)}>
        <span className="service-name"><b>{name}</b><span className="muted small">{blurb}</span></span>
        {badge}
        <Ico.ChevDown />
      </button>
      {shown && <div className="service-body">{children}</div>}
    </div>
  );
}

/** Services that scrobble for you in the background. */
function Services() {
  return (
    <Section title="Streaming services">
      <div className="services"><SpotifySettings /></div>
    </Section>
  );
}

function AppSettings() {
  const q = useApi<Apps>("/apps"), [f, setF] = useState({ name: "", description: "", callbackUrl: "" }), act = useAction(), c = useConfirm(), robot = useTurnstile("apiapp");
  return (
    <>
      {c.dialog}
      <Services />
      <Section title="Connected applications">
        <Async q={q}>{d => d.sessions.length ? <ul className="plain">{d.sessions.map(s => (
          <li key={s.key} className="row between"><span><b>{s.app}</b> <span className="muted small">connected {date(s.createdAt)}, last used {date(s.lastUsedAt)}</span></span><Button kind="btn ghost small" onClick={() => api<AppOk>("/apps/revoke", { body: { key: s.key } }).then(q.reload)}>Disconnect</Button></li>
        ))}</ul> : <p className="muted">No applications can scrobble to your account yet.</p>}</Async>
      </Section>
      <Section title="Your API accounts" more="/developers" moreLabel="API docs">
        <Async q={q}>{d => d.items.length ? <ul className="plain api-apps">{d.items.map(a => (
          <li key={a.id}>
            <details className="api-app">
              <summary><Ico.Chevron /><b>{a.name}</b><span className="muted small">{a.apiKey.slice(0, 8)}…</span></summary>
              {a.description && <p className="muted small">{a.description}</p>}
              <dl className="keys">
                <dt>API key</dt><dd><code>{a.apiKey}</code></dd>
                <dt>Shared secret</dt><dd><code>{a.secret}</code></dd>
                <dt>Callback URL</dt><dd><CallbackField app={a} onSaved={q.reload} /></dd>
              </dl>
              <Button kind="link small" onClick={() => c.ask({ title: `Delete “${a.name}”?`, body: "Apps using this key will stop working.", action: "Delete", danger: true, run: () => api<AppOk>(`/apps/${a.id}`, { method: "DELETE" }).then(q.reload) })}>Delete API account</Button>
            </details>
          </li>
        ))}</ul> : <p className="muted">Create an API account to get a key and shared secret.</p>}</Async>
        <form className="form" onSubmit={e => { e.preventDefault(); act.run(async () => {
          if (robot.on && !robot.token) throw new Error("Complete the check that you are not a robot");
          try { await api<AppOk>("/apps", { body: { ...f, turnstile: robot.token } }); } finally { robot.reset(); }
          setF({ name: "", description: "", callbackUrl: "" }); q.reload(); return "API account created.";
        }); }}>
          <label>Application name<Input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} required maxLength={60} /></label>
          <label>Description (optional)<Input value={f.description} onChange={e => setF({ ...f, description: e.target.value })} maxLength={300} /></label>
          <label>Callback URL (optional)<Input value={f.callbackUrl} onChange={e => setF({ ...f, callbackUrl: e.target.value })} maxLength={500} placeholder="https://example.com/callback" /></label>
          <p className="muted small">For web sign-in: where people go back to, with <code>?token=</code>, after they approve your app.</p>
          {robot.view}{act.note}<Button kind="btn" loading={act.busy}>Create API account</Button>
        </form>
      </Section>
    </>
  );
}
function CallbackField({ app, onSaved }: { app: ApiApp; onSaved: () => void }) {
  const saved = app.callbackUrl ?? "", [v, setV] = useState(saved), act = useAction();
  return (
    <form className="callback-field" onSubmit={e => { e.preventDefault(); act.run(async () => { await api<AppOk>(`/apps/${app.id}`, { method: "PATCH", body: { callbackUrl: v.trim() } }); onSaved(); return "Saved."; }); }}>
      <Input value={v} onChange={e => setV(e.target.value)} maxLength={500} placeholder="None" aria-label="Callback URL" />
      {v.trim() !== saved &&<Button kind="btn small" loading={act.busy}>Save</Button>}{act.note}
    </form>
  );
}
/** The confirm field for dangerous actions: the password, or the username for an account that has none. */
function ConfirmField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { me } = useAuth();
  return me!.hasPassword
    ? <label>Confirm with your password<Input type="password" value={value} onChange={e => onChange(e.target.value)} required autoComplete="current-password" /></label>
    : <label>Type your username ({me!.username}) to confirm<Input value={value} onChange={e => onChange(e.target.value)} required autoComplete="off" /></label>;
}
function DataSettings() {
  const [pw, setPw] = useState(""), act = useAction(), c = useConfirm();
  return (
    <>
      {c.dialog}
      <Section title="Export your scrobbles">
        <p>Download every scrobble with artist, album, track and timestamp.</p>
        <div className="row"><Button kind="btn" href="/api/me/export?format=csv" download>Download CSV</Button><Button kind="btn ghost" href="/api/me/export?format=json" download>Download JSON</Button></div>
      </Section>
      <Section title="Export your loved tracks">
        <p>Download the tracks you’ve loved, with the date you loved each one.</p>
        <div className="row"><Button kind="btn" href="/api/me/export?format=csv&what=loved" download>Download CSV</Button><Button kind="btn ghost" href="/api/me/export?format=json&what=loved" download>Download JSON</Button></div>
      </Section>
      <Section title="Import"><p>Bring scrobbles or loved tracks in from a CSV or JSON file on the <Link to="/scrobble">Scrobble page</Link>.</p></Section>
      <Section title="Clear listening history">
        <form className="form" onSubmit={e => { e.preventDefault(); c.ask({ title: "Delete all of your scrobbles?", body: "Your whole listening history will be removed. This can't be undone.", action: "Delete all scrobbles", danger: true, run: () => act.run(async () => { const r = await api<ScrobblesCleared>("/me/clear-scrobbles", { body: { password: pw } }); setPw(""); return `Deleted ${plural(r.deleted, "scrobble")}.`; }) }); }}>
          <p>Removes every scrobble from your library. Loved tracks, tags and playlists are kept.</p>
          <ConfirmField value={pw} onChange={setPw} />
          {act.note}<Button kind="btn danger" loading={act.busy}>Delete all scrobbles</Button>
        </form>
      </Section>
    </>
  );
}
