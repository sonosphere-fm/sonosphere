import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Button, Input, Select } from "../kit";
import { MdEditor } from "../md";
import { Link, NavLink, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ago, api, copyText, date, num, plural, useApi, useAuth, useTitle, type Ok } from "../lib";
import type { ProfileEdit, ProfileSaved, ScrobblesCleared } from "../../shared/account";
import type { AppOk, Apps } from "../../shared/apps";
import type { BlockResult, Blocks } from "../../shared/blocks";
import type { ImageSaved } from "../../shared/images";
import type { SpotifyConnect, SpotifyConnectBody, SpotifyLink, SpotifyStatus, SpotifySynced } from "../../shared/spotify";
import { Ico } from "../icons";
import { Art, Async, Section, useAction } from "../ui/base";
import { UserList } from "../ui/lists";

// ---------- settings ----------
export function Settings() {
  const tab = useParams().tab || "profile";
  useTitle("Settings");
  return (
    <div className="wrap page">
      <h1 className="page-title">Settings</h1>
      <nav className="tabs">{[["", "Profile"], ["/privacy", "Privacy"], ["/account", "Account"], ["/applications", "Applications"], ["/data", "Your data"]].map(([p, l]) => <NavLink key={p} to={`/settings${p}`} end>{l}</NavLink>)}</nav>
      <div className="narrow-col">
        {tab === "profile" && <ProfileSettings />}
        {tab === "privacy" && <PrivacySettings />}
        {tab === "account" && <AccountSettings />}
        {tab === "applications" && <AppSettings />}
        {tab === "data" && <DataSettings />}
      </div>
    </div>
  );
}
function ProfileSettings() {
  const { me, setMe, refresh } = useAuth(), act = useAction(), img = useAction(), file = useRef<HTMLInputElement>(null);
  const [f, setF] = useState({ realname: me!.realname, country: me!.country, website: me!.website, about: me!.about });
  const set = (k: keyof typeof f) => (e: ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <>
      <Section title="Avatar">
        <div className="row"><span className="avatar" style={{ width: 96, height: 96 }}><Art image={me!.image} kind="user" /></span>
          <Input ref={file} type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif" onChange={e => { const x = e.target.files?.[0]; if (x) img.run(async () => { await api<ImageSaved>("/image?type=user", { raw: x, headers: { "Content-Type": x.type } }); refresh(); return "Avatar updated."; }); e.target.value = ""; }} />
          <Button kind="btn" loading={img.busy} onClick={() => file.current?.click()}>Upload image</Button>
          {me!.image && <Button kind="btn ghost" onClick={() => img.run(async () => { await api<Ok>("/image", { method: "DELETE" }); refresh(); })}>Remove</Button>}
        </div>{img.note}<p className="muted small">PNG, JPEG, WebP or GIF, up to 2 MB.</p>
      </Section>
      <Section title="Profile">
        <form className="form" onSubmit={e => { e.preventDefault(); act.run(async () => { setMe((await api<ProfileSaved>("/me", { method: "PATCH", body: f })).user); return "Profile saved."; }); }}>
          <label>Display name<Input value={f.realname} onChange={set("realname")} maxLength={60} /></label>
          <label>Country<Input value={f.country} onChange={set("country")} maxLength={60} /></label>
          <label>Website<Input type="url" value={f.website} onChange={set("website")} placeholder="https://" maxLength={200} /></label>
          <div className="field-block"><span className="field-label">About me</span><MdEditor label="About me" rows={5} value={f.about} onChange={about => setF(f => ({ ...f, about }))} maxLength={2000} /></div>
          {act.note}<Button kind="btn" loading={act.busy}>Save profile</Button>
        </form>
      </Section>
    </>
  );
}
function PrivacySettings() {
  const { me, setMe } = useAuth(), act = useAction();
  const save = (body: ProfileEdit) => act.run(async () => { setMe((await api<ProfileSaved>("/me", { method: "PATCH", body })).user); return "Saved."; });
  return (
    <>
    <Section title="Privacy">
      <div className="form">
        <label className="check"><Input type="checkbox" checked={me!.hideRecent} onChange={e => save({ hideRecent: e.target.checked })} /> <span><b>Hide recent listening</b><br /><span className="muted small">Other people can't see your recent tracks or scrobble history. Your charts stay visible.</span></span></label>
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
function BlockedUsers() {
  const q = useApi<Blocks>("/blocks");
  return (
    <Section title="Blocked users">
      <p className="muted small">People you block can't follow you, write on your wall or comment on your journal, and their shouts are hidden from you everywhere. Block someone from the “…” menu on their profile.</p>
      <Async q={q}>{d => d.items.length ? <UserList items={d.items} extra={u => <span><Button kind="link small" type="button" onClick={() => api<BlockResult>("/block", { body: { username: u.username, block: false } }).then(q.reload)}>Unblock</Button></span>} /> : <p className="muted">You haven't blocked anyone.</p>}</Async>
    </Section>
  );
}
function AccountSettings() {
  const { me, setMe } = useAuth(), nav = useNavigate();
  const [email, setEmail] = useState(me!.email), [pw, setPw] = useState({ current: "", next: "" }), [del, setDel] = useState("");
  const a1 = useAction(), a2 = useAction(), a3 = useAction();
  return (
    <>
      <Section title="Email">
        <form className="form" onSubmit={e => { e.preventDefault(); a1.run(async () => { setMe((await api<ProfileSaved>("/me", { method: "PATCH", body: { email } })).user); return "Email updated."; }); }}>
          <label>Email address<Input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>{a1.note}<Button kind="btn" loading={a1.busy}>Update email</Button>
        </form>
      </Section>
      <Section title="Password">
        <form className="form" onSubmit={e => { e.preventDefault(); a2.run(async () => { await api<Ok>("/me/password", { body: pw }); setPw({ current: "", next: "" }); return "Password changed."; }); }}>
          <label>Current password<Input type="password" value={pw.current} onChange={e => setPw({ ...pw, current: e.target.value })} required autoComplete="current-password" /></label>
          <label>New password<Input type="password" value={pw.next} onChange={e => setPw({ ...pw, next: e.target.value })} required minLength={8} autoComplete="new-password" /></label>
          {a2.note}<Button kind="btn" loading={a2.busy}>Change password</Button>
        </form>
      </Section>
      <Section title="Delete account">
        <form className="form" onSubmit={e => { e.preventDefault(); if (!window.confirm("Delete your account and all of your scrobbles? This cannot be undone.")) return; a3.run(async () => { await api<Ok>("/me/delete", { body: { password: del } }); setMe(null); nav("/"); }); }}>
          <p>This permanently removes your profile, scrobbles, loved tracks, playlists and shouts.</p>
          <label>Confirm with your password<Input type="password" value={del} onChange={e => setDel(e.target.value)} required autoComplete="current-password" /></label>
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
function SpotifySetup({ redirectUri, initial, onConnect, busy, note }: { redirectUri: string; initial: string; onConnect: (clientId: string) => void; busy: boolean; note: ReactNode }) {
  const [id, setId] = useState(initial), [copied, setCopied] = useState(false);
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
        <li>Under <b>Which API/SDKs are you planning to use?</b>, tick <b>Web API</b>, agree to the terms and click <b>Save</b>.</li>
        <li>Open the app's <b>Settings</b>, copy its <b>Client ID</b> and paste it below. You don't need the client secret.</li>
      </ol>
      <form className="form" onSubmit={e => { e.preventDefault(); onConnect(id.trim()); }}>
        <label>Client ID<Input value={id} onChange={e => setId(e.target.value)} required maxLength={64} placeholder="32 letters and numbers" autoComplete="off" spellCheck={false} /></label>
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
  const connect = (clientId: string) => act.run(async () => { window.location.href = (await api<SpotifyConnect>("/spotify/connect", { body: { clientId } satisfies SpotifyConnectBody })).url; });
  const sync = (s: Extract<SpotifyStatus, { enabled: true }>) => act.run(async () => { const r = await api<SpotifySynced>("/spotify/sync", { method: "POST" }); q.setData({ ...s, link: r.link }); return r.imported ? `Imported ${plural(r.imported, "play")}.` : "Nothing new to import."; });
  const disconnect = () => act.run(async () => { await api<Ok>("/spotify", { method: "DELETE" }); setSp({}, { replace: true }); setRedo(false); q.reload(); });
  const linked = (s: Extract<SpotifyStatus, { enabled: true }>, l: SpotifyLink) => (
    <>
      <p>Connected as <b>{l.account.name}</b> <span className="muted small">since {date(l.connectedAt)}</span></p>
      {l.broken ? <p className="form-error">{l.broken}</p> : (
        <p className="muted small">{l.lastImport ? <>Last import {ago(l.lastImport)} · {num(l.imported)} plays imported</> : "Importing your recent plays..."}. New plays are picked up every few minutes.</p>
      )}
      {l.broken || redo ? <SpotifySetup redirectUri={s.redirectUri} initial={l.clientId} onConnect={connect} busy={act.busy} note={act.note} /> : act.note}
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
          {d.link ? linked(d, d.link) : <SpotifySetup redirectUri={d.redirectUri} initial="" onConnect={connect} busy={act.busy} note={act.note} />}
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
  const q = useApi<Apps>("/apps"), [f, setF] = useState({ name: "", description: "" }), act = useAction();
  return (
    <>
      <Services />
      <Section title="Connected applications">
        <Async q={q}>{d => d.sessions.length ? <ul className="plain">{d.sessions.map(s => (
          <li key={s.key} className="row between"><span><b>{s.app}</b> <span className="muted small">connected {date(s.createdAt)}</span></span><Button kind="btn ghost small" onClick={() => api<AppOk>("/apps/revoke", { body: { key: s.key } }).then(q.reload)}>Disconnect</Button></li>
        ))}</ul> : <p className="muted">No applications can scrobble to your account yet.</p>}</Async>
      </Section>
      <Section title="Your API accounts" more="/developers" moreLabel="API docs">
        <Async q={q}>{d => d.items.length ? <ul className="plain">{d.items.map(a => (
          <li key={a.id} className="card">
            <div className="row between"><b>{a.name}</b><Button kind="link small" onClick={() => { if (window.confirm(`Delete “${a.name}”? Apps using this key will stop working.`)) api<AppOk>(`/apps/${a.id}`, { method: "DELETE" }).then(q.reload); }}>Delete</Button></div>
            {a.description && <p className="muted small">{a.description}</p>}
            <dl className="keys"><dt>API key</dt><dd><code>{a.apiKey}</code></dd><dt>Shared secret</dt><dd><code>{a.secret}</code></dd></dl>
          </li>
        ))}</ul> : <p className="muted">Create an API account to get a key and shared secret.</p>}</Async>
        <form className="form" onSubmit={e => { e.preventDefault(); act.run(async () => { await api<AppOk>("/apps", { body: f }); setF({ name: "", description: "" }); q.reload(); return "API account created."; }); }}>
          <label>Application name<Input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} required maxLength={60} /></label>
          <label>Description (optional)<Input value={f.description} onChange={e => setF({ ...f, description: e.target.value })} maxLength={300} /></label>
          {act.note}<Button kind="btn" loading={act.busy}>Create API account</Button>
        </form>
      </Section>
    </>
  );
}
function DataSettings() {
  const [pw, setPw] = useState(""), act = useAction();
  return (
    <>
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
        <form className="form" onSubmit={e => { e.preventDefault(); if (!window.confirm("Delete all of your scrobbles? This cannot be undone.")) return; act.run(async () => { const r = await api<ScrobblesCleared>("/me/clear-scrobbles", { body: { password: pw } }); setPw(""); return `Deleted ${plural(r.deleted, "scrobble")}.`; }); }}>
          <p>Removes every scrobble from your library. Loved tracks, tags and playlists are kept.</p>
          <label>Confirm with your password<Input type="password" value={pw} onChange={e => setPw(e.target.value)} required autoComplete="current-password" /></label>
          {act.note}<Button kind="btn danger" loading={act.busy}>Delete all scrobbles</Button>
        </form>
      </Section>
    </>
  );
}
