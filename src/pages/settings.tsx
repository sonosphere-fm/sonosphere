import {
  lazy,
  Suspense,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { Button, Input, Select, useConfirm } from "../kit";
import { Markdown, MdEditor } from "../md";
import { UsernameSettings } from "../ui/username-settings";
import { ProfileLinkIcon } from "../ui/profile-link-icon";
import { PROFILE_LINK_ICONS, type ProfileLinkIcon as ProfileLinkIconName } from "../../shared/profile-links";
import { ProfileStyleSettings } from "../ui/profile-style-settings";
import CosmeticsSettings from "../ui/cosmetics-settings";
import { Username } from "../ui/username";
import { Link, NavLink, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ago,
  api,
  copyText,
  date,
  imageUrl,
  invalidateAll,
  num,
  plural,
  useApi,
  useAuth,
  useTitle,
  type Ok,
} from "../lib";
import type { ProfileEdit, ProfileSaved, ScrobblesCleared } from "../../shared/account";
import type { ApiApp, AppOk, Apps, ListenToken } from "../../shared/apps";
import { useTurnstile } from "./auth";
import { OAUTH_ERRORS, OAuthMark, oauthStart } from "../ui/oauth";
import type { Logins } from "../../shared/auth";
import type { BlockResult, Blocks } from "../../shared/blocks";
import type { ImageSaved } from "../../shared/images";
import { EMAIL_KINDS, EMAIL_MODES } from "../../shared/notifications";
import type {
  SpotifyConnect,
  SpotifyConnectBody,
  SpotifyLink,
  SpotifyStatus,
  SpotifySynced,
} from "../../shared/spotify";
import { Arrow, Ico } from "../icons";
import { Art, Async, Pane, Section, useAction } from "../ui/base";
import { ImageWithFallback } from "../ui/image";
import { ImageCropper } from "../ui/image-cropper";
import { UserList } from "../ui/lists";
import { changeTheme, type ThemePref } from "../theme";

// The country picker carries every flag, so it loads separately.
const CountryInput = lazy(() => import("../ui/country").then((m) => ({ default: m.CountryInput })));

const clock = (at: number) => new Date(at * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const TABS = [
  ["", "Profile"],
  ["/privacy", "Privacy"],
  ["/notifications", "Notifications"],
  ["/account", "Account"],
  ["/applications", "Applications"],
  ["/data", "Your data"],
];

export function Settings() {
  const tab = useParams().tab || "profile";
  useTitle("Settings");
  return (
    <div className="wrap page">
      <h1 className="page-title">Settings</h1>
      <nav className="tabs">
        {TABS.map(([p, l]) => (
          <NavLink key={p} to={`/settings${p}`} end>
            {l}
          </NavLink>
        ))}
      </nav>
      <div className="narrow-col">
        <Pane>
          {tab === "profile" && <ProfileSettings />}
          {tab === "privacy" && <PrivacySettings />}
          {tab === "notifications" && <NotificationSettings />}
          {tab === "account" && <AccountSettings />}
          {tab === "applications" && <AppSettings />}
          {tab === "data" && <DataSettings />}
        </Pane>
      </div>
    </div>
  );
}

function useSaveProfile() {
  const { setMe } = useAuth();
  const act = useAction();
  const save = (body: ProfileEdit) =>
    act.run(async () => {
      const r = await api<ProfileSaved>("/me", { method: "PATCH", body });
      setMe(r.user);
      return "Saved.";
    });
  return { act, save };
}

function ProfileSettings() {
  const { me, setMe, refresh } = useAuth();
  const act = useAction();
  const img = useAction();
  const [crop, setCrop] = useState<File | null>(null);
  const [previewAbout, setPreviewAbout] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const [f, setF] = useState({
    realname: me!.realname,
    pronouns: me!.pronouns,
    country: me!.country,
    about: me!.about,
    links: me!.links ?? [],
    usernameFont: me!.usernameFont ?? "default",
    profileAccent: me!.profileAccent ?? null,
    profileAccentEnd: me!.profileAccentEnd ?? null,
    useProfileTheme: me!.useProfileTheme ?? false,
  });
  const set = (k: "realname" | "pronouns") => (e: ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const upload = (e: ChangeEvent<HTMLInputElement>) => {
    const x = e.target.files?.[0];
    if (x) setCrop(x);
    e.target.value = "";
  };

  const removeImage = () =>
    img.run(async () => {
      await api<Ok>("/image", { method: "DELETE" });
      refresh();
    });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    act.run(async () => {
      const r = await api<ProfileSaved>("/me", { method: "PATCH", body: f });
      setMe(r.user);
      invalidateAll();
      return "Profile saved.";
    });
  };

  return (
    <>
      {crop && (
        <ImageCropper
          file={crop}
          kind="avatar"
          onClose={() => setCrop(null)}
          onSave={async (image) => {
            await api<ImageSaved>("/image?type=user", { raw: image, headers: { "Content-Type": image.type } });
            refresh();
            invalidateAll();
          }}
        />
      )}
      <Section title="Avatar">
        <div className="avatar-edit">
          <button
            type="button"
            className="avatar avatar-pick"
            aria-label="Change avatar"
            onClick={() => file.current?.click()}
            disabled={img.busy}
          >
            <Art image={me!.image} kind="user" />
          </button>
          <Input ref={file} type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif" onChange={upload} />
          <div className="avatar-side">
            <div className="avatar-actions">
              <Button kind="btn small" loading={img.busy} onClick={() => file.current?.click()}>
                {me!.image ? "Change picture" : "Upload picture"}
              </Button>
              {me!.image && (
                <button type="button" className="linklike muted" onClick={removeImage}>
                  Remove
                </button>
              )}
            </div>
            <p className="muted small">PNG, JPEG, WebP or GIF (max 8 MB).</p>
            {img.note}
          </div>
        </div>
      </Section>
      <BannerSettings />
      <CosmeticsSettings />
      <Section title="Profile">
        <form className="form" onSubmit={submit}>
          <ProfileStyleSettings value={f} onChange={(style) => setF((f) => ({ ...f, ...style }))} disabled={act.busy} />
          <button
            type="button"
            role="checkbox"
            aria-checked={f.useProfileTheme}
            disabled={act.busy}
            className="profile-theme-check"
            onClick={() => setF((f) => ({ ...f, useProfileTheme: !f.useProfileTheme }))}
          >
            <span className="profile-theme-check-box" aria-hidden="true">
              {f.useProfileTheme && <Ico.Check />}
            </span>
            <span>Use my profile colors site-wide</span>
          </button>
          <label>
            Display name
            <Input value={f.realname} onChange={set("realname")} maxLength={60} />
          </label>
          <label>
            Pronouns
            <Input value={f.pronouns} onChange={set("pronouns")} placeholder="they/them" maxLength={30} />
          </label>
          <label>
            Country
            <Suspense fallback={<Input value={f.country} disabled />}>
              <CountryInput
                value={f.country}
                onChange={(v) => setF((p) => ({ ...p, country: v }))}
                eventCounts={false}
              />
            </Suspense>
          </label>
          <div className="field-block">
            <div className="flex items-center justify-between gap-3 mb-2">
              <span className="field-label">About me</span>
              <Button
                type="button"
                kind="btn ghost small"
                aria-pressed={previewAbout}
                onClick={() => setPreviewAbout(!previewAbout)}
              >
                {previewAbout ? "Write" : "Preview"}
              </Button>
            </div>
            {previewAbout ? (
              <div className="border border-site-line p-3 min-h-[140px] [overflow-wrap:anywhere]">
                <Markdown text={f.about} images />
              </div>
            ) : (
              <MdEditor
                label="About me"
                rows={5}
                value={f.about}
                onChange={(about) => setF((f) => ({ ...f, about }))}
                maxLength={2000}
                images
                imageUpload="about"
              />
            )}
            <p className="muted small">
              Upload images with the image button (PNG, JPEG, WebP or GIF, max 8 MB). Headings, lists, and links are
              supported.
            </p>
          </div>
          <fieldset className="border-0 p-0 m-0 min-w-0 grid gap-3">
            <legend className="field-label mb-2">Profile links</legend>
            {f.links.map((link, index) => (
              <div key={index} className="grid gap-2 border-b border-site-line pb-3">
                <div className="flex items-center gap-3">
                  <ProfileLinkIcon icon={link.icon} />
                  <Select
                    label={`Link ${index + 1} icon`}
                    value={link.icon ?? "link"}
                    options={PROFILE_LINK_ICONS.map(([id, label]) => [id, label])}
                    onChange={(icon) =>
                      setF((f) => ({
                        ...f,
                        links: f.links.map((item, i) =>
                          i === index ? { ...item, icon: icon as ProfileLinkIconName } : item
                        ),
                      }))
                    }
                  />
                </div>
                <div className="grid gap-2 min-w-0">
                  <label>
                    Label
                    <Input
                      value={link.label}
                      maxLength={60}
                      onChange={(e) =>
                        setF({
                          ...f,
                          links: f.links.map((item, i) => (i === index ? { ...item, label: e.target.value } : item)),
                        })
                      }
                    />
                  </label>
                  <label>
                    URL
                    <Input
                      type="url"
                      required
                      value={link.url}
                      placeholder="https://"
                      maxLength={500}
                      onChange={(e) =>
                        setF({
                          ...f,
                          links: f.links.map((item, i) => (i === index ? { ...item, url: e.target.value } : item)),
                        })
                      }
                    />
                  </label>
                </div>
                <div className="grid">
                  <Button
                    type="button"
                    kind="btn ghost small"
                    aria-label={`Remove profile link ${index + 1}`}
                    onClick={() => setF({ ...f, links: f.links.filter((_, i) => i !== index) })}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
            <Button
              type="button"
              kind="btn ghost small"
              disabled={f.links.length >= 8}
              onClick={() => setF({ ...f, links: [...f.links, { label: "", url: "" }] })}
            >
              Add link
            </Button>
          </fieldset>
          {act.note}
          <Button kind="btn" loading={act.busy}>
            Save profile
          </Button>
        </form>
      </Section>
      <Appearance />
    </>
  );
}

function BannerSettings() {
  const { me, refresh } = useAuth();
  const act = useAction();
  const file = useRef<HTMLInputElement>(null);
  const [crop, setCrop] = useState<File | null>(null);

  const upload = (e: ChangeEvent<HTMLInputElement>) => {
    const image = e.target.files?.[0];
    e.target.value = "";
    if (image) setCrop(image);
  };

  const remove = () =>
    act.run(async () => {
      await api<Ok>("/image?type=banner", { method: "DELETE" });
      refresh();
      invalidateAll();
      return "Banner removed.";
    });

  return (
    <Section title="Banner">
      {crop && (
        <ImageCropper
          file={crop}
          kind="banner"
          onClose={() => setCrop(null)}
          onSave={async (image) => {
            await api<ImageSaved>("/image?type=banner", { raw: image, headers: { "Content-Type": image.type } });
            refresh();
            invalidateAll();
          }}
        />
      )}
      <div className="banner-edit">
        {me!.banner && (
          <ImageWithFallback
            className="banner-preview"
            src={imageUrl(me!.banner)}
            alt="Your profile banner"
            fallback={<span className="image-placeholder">Loading banner…</span>}
            errorFallback={<span className="image-placeholder">Image unavailable</span>}
          />
        )}
        <Input
          ref={file}
          type="file"
          hidden
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={upload}
          disabled={act.busy}
        />
        <div className="avatar-actions">
          <Button kind="btn small" type="button" loading={act.busy} onClick={() => file.current?.click()}>
            {me!.banner ? "Change banner" : "Upload banner"}
          </Button>
          {me!.banner && (
            <button type="button" className="linklike muted" disabled={act.busy} onClick={remove}>
              Remove banner
            </button>
          )}
        </div>
        <p className="muted small">
          PNG, JPEG, WebP or GIF (max 8 MB). A wide image works best, around 1200 × 300 pixels. Banners are cropped to
          fit.
        </p>
        {act.note}
      </div>
    </Section>
  );
}

const THEMES: [ThemePref, string][] = [
  ["light", "Light"],
  ["system", "Automatic"],
  ["dark", "Dark"],
];

function Appearance() {
  const { me, setMe } = useAuth();
  const act = useAction();

  // Applied optimistically; rolled back if saving fails.
  const pick = (theme: ThemePref) => {
    const was = me!;
    if (theme === was.theme) return;
    act.run(async () => {
      await changeTheme(theme, () => setMe({ ...was, theme }));
      try {
        const r = await api<ProfileSaved>("/me", { method: "PATCH", body: { theme } });
        setMe(r.user);
      } catch (e) {
        setMe(was);
        throw e;
      }
    });
  };

  return (
    <Section title="Appearance">
      <div className="theme-pick" role="group" aria-label="Theme">
        {THEMES.map(([v, name]) => (
          <button key={v} type="button" aria-pressed={me!.theme === v} onClick={() => pick(v)}>
            {name}
          </button>
        ))}
      </div>
      {act.note}
    </Section>
  );
}

const DM_POLICIES: [string, string][] = [
  ["everyone", "Anyone"],
  ["requests", "Anyone, but people I don't follow go to Requests"],
  ["following", "Only people I follow"],
  ["nobody", "Nobody"],
];

function CheckOption({
  checked,
  disabled,
  onChange,
  title,
  children,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <label className="check">
      <Input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />{" "}
      <span>
        <b>{title}</b>
        <br />
        <span className="muted small">{children}</span>
      </span>
    </label>
  );
}

function PrivacySettings() {
  const { me } = useAuth();
  const { act, save } = useSaveProfile();
  return (
    <>
      <Section title="Privacy">
        <div className="form">
          <CheckOption
            title="Hide recent listening"
            checked={me!.hideRecent || me!.privateListening}
            disabled={me!.privateListening}
            onChange={(hideRecent) => save({ hideRecent })}
          >
            Your scrobble history and recent tracks will not be visible to other users. Your charts will still be shown
            on your profile.
          </CheckOption>
          <CheckOption
            title="Keep all my listening private"
            checked={me!.privateListening}
            onChange={(privateListening) => save({ privateListening })}
          >
            Your charts, library, loved tracks, play counts and listening reports will be hidden from other users. You
            will also be excluded from other users' soundalikes and top listener lists. Your plays will still count
            anonymously toward site-wide charts.
          </CheckOption>
          <CheckOption
            title="Let people write on my wall"
            checked={me!.shoutsEnabled}
            onChange={(shoutsEnabled) => save({ shoutsEnabled })}
          >
            Turn off to close your shoutbox to new shouts.
          </CheckOption>
          <label>
            Who can send you direct messages?
            <Select
              label="Who can message you"
              value={me!.dmPolicy}
              onChange={(v) => save({ dmPolicy: v })}
              options={DM_POLICIES}
            />
          </label>
          {act.note}
        </div>
      </Section>
      <BlockedUsers />
    </>
  );
}

function NotificationSettings() {
  const { me } = useAuth();
  const { act, save } = useSaveProfile();
  const off = me!.emailNotify === "off";
  const muted = new Set(me!.emailMuted);
  const toggle = (k: string, on: boolean) => {
    const emailMuted = on ? me!.emailMuted.filter((x) => x !== k) : [...me!.emailMuted, k];
    save({ emailMuted });
  };
  return (
    <Section title="Email notifications">
      <div className="form">
        {!me!.emailVerified && (
          <p className="muted small">
            Emails only go to a confirmed address. Confirm {me!.email} under <Link to="/settings/account">Account</Link>{" "}
            to start getting them.
          </p>
        )}
        <label>
          Send me emails
          <Select
            label="How often to email you"
            value={me!.emailNotify}
            onChange={(v) => save({ emailNotify: v })}
            options={EMAIL_MODES.map(([v, l]) => [v, l])}
          />
        </label>
        {me!.emailNotify !== "instant" && !off && (
          <p className="muted small">
            One email {me!.emailNotify === "daily" ? "a day" : "a week"} with whatever is still unread, and nothing when
            there's nothing new.
          </p>
        )}
        <p className="field-label">Email me when</p>
        {EMAIL_KINDS.map(([k, l]) => (
          <label key={k} className="check">
            <Input
              type="checkbox"
              checked={!off && !muted.has(k)}
              disabled={off}
              onChange={(e) => toggle(k, e.target.checked)}
            />{" "}
            {l}
          </label>
        ))}
        {act.note}
      </div>
    </Section>
  );
}

function BlockedUsers() {
  const q = useApi<Blocks>("/blocks");
  const unblock = (username: string) => api<BlockResult>("/block", { body: { username, block: false } }).then(q.reload);
  return (
    <Section title="Blocked users">
      <p className="muted small">
        People you block can't follow you, write on your wall or comment on your journal, and their shouts are hidden
        from you everywhere. Block someone from the “…” menu on their profile.
      </p>
      <Async q={q}>
        {(d) =>
          d.items.length ? (
            <UserList
              items={d.items}
              extra={(u) => (
                <span>
                  <Button kind="link small" type="button" onClick={() => unblock(u.username)}>
                    Unblock
                  </Button>
                </span>
              )}
            />
          ) : (
            <p className="muted">You haven't blocked anyone.</p>
          )
        }
      </Async>
    </Section>
  );
}

// The OAuth round trip reports back in ?oauth= (a problem) or ?linked=.
function SignInMethods() {
  const { me } = useAuth();
  const q = useApi<Logins>("/me/logins");
  const act = useAction();
  const [sp, setSp] = useSearchParams();
  const error = OAUTH_ERRORS[sp.get("oauth") ?? ""];
  const linked = sp.get("linked");
  if (!q.data?.providers.length) return null;
  const connectedCount = q.data.providers.filter((p) => p.connected).length;
  const lastWayIn = !me!.hasPassword && connectedCount === 1;

  const disconnect = (id: string) =>
    act.run(async () => {
      await api<Ok>("/me/logins/unlink", { body: { provider: id } });
      setSp({}, { replace: true });
      q.reload();
    });

  return (
    <Section title="Sign-in methods">
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {linked && !error && <p className="form-ok">Connected. You can now log in with it.</p>}
      <ul className="plain">
        {q.data.providers.map((p) => (
          <li key={p.id} className="row between">
            <span className="oauth-row">
              <span className={`oauth-chip oauth-${p.id}`}>
                <OAuthMark id={p.id} />
              </span>
              <b>{p.label}</b>{" "}
              <span className="muted small">
                {p.connected ? (
                  <>
                    {p.connected.name || "connected"}, since {date(p.connected.since)}
                  </>
                ) : (
                  "not connected"
                )}
              </span>
            </span>
            {p.connected ? (
              <Button
                kind="btn ghost small"
                disabled={lastWayIn}
                title={lastWayIn ? "Set a password first" : undefined}
                onClick={() => disconnect(p.id)}
              >
                Disconnect
              </Button>
            ) : (
              <Button kind="btn ghost small" href={oauthStart(p.id, "link")}>
                Connect
              </Button>
            )}
          </li>
        ))}
      </ul>
      {act.note}
    </Section>
  );
}

function AccountSettings() {
  const { me, setMe, refresh } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState(me!.email);
  const [pw, setPw] = useState({ current: "", next: "" });
  const [del, setDel] = useState("");
  const resend = useAction();
  const emailAct = useAction();
  const pwAct = useAction();
  const delAct = useAction();
  const c = useConfirm();

  const resendLink = () =>
    resend.run(async () => {
      await api<Ok>("/me/verify", { body: {} });
      return `Sent a new link to ${me!.email}.`;
    });

  const submitEmail = (e: FormEvent) => {
    e.preventDefault();
    emailAct.run(async () => {
      if (email.trim().toLowerCase() === me!.email) return "That is already your email.";
      const u = (await api<ProfileSaved>("/me", { method: "PATCH", body: { email } })).user;
      setMe(u);
      setEmail(u.email);
      return `Approve the change from your current inbox first. We will then send a verification link to ${u.pendingEmail ?? email}.`;
    });
  };

  const submitPassword = (e: FormEvent) => {
    e.preventDefault();
    pwAct.run(async () => {
      const had = me!.hasPassword;
      await api<Ok>("/me/password", { body: pw });
      setPw({ current: "", next: "" });
      if (!had) {
        await refresh();
        return "Password set. You can now log in with it, and in scrobbler apps that ask for one.";
      }
      return "Password changed. Other devices were signed out.";
    });
  };

  const submitDelete = (e: FormEvent) => {
    e.preventDefault();
    c.ask({
      title: "Delete your account?",
      body: "Your profile, scrobbles, loved tracks, playlists and shouts will be gone for good. This can't be undone.",
      action: "Delete my account",
      danger: true,
      run: () =>
        delAct.run(async () => {
          await api<Ok>("/me/delete", { body: { password: del } });
          setMe(null);
          nav("/");
        }),
    });
  };

  return (
    <>
      {c.dialog}
      <UsernameSettings />
      <Section title="Email">
        <form className="form" onSubmit={submitEmail}>
          <p className="muted small">
            {me!.emailVerified ? (
              <>{me!.email} is confirmed.</>
            ) : (
              <>
                {me!.email} is not confirmed yet.{" "}
                <Button kind="link small" type="button" onClick={resendLink}>
                  Send the link again
                </Button>
              </>
            )}
            {me!.pendingEmail && <> Waiting for you to confirm {me!.pendingEmail}.</>}
          </p>
          {resend.note}
          <label>
            Email address
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          {emailAct.note}
          <Button kind="btn" loading={emailAct.busy}>
            Update email
          </Button>
        </form>
      </Section>
      <Section title="Password">
        <form className="form" onSubmit={submitPassword}>
          {!me!.hasPassword && (
            <p className="muted small">
              You signed up through another site, so your account has no password yet. Set one to log in without it, or
              to use scrobbler apps that ask for a username and password.
            </p>
          )}
          {me!.hasPassword && (
            <label>
              Current password
              <Input
                type="password"
                value={pw.current}
                onChange={(e) => setPw({ ...pw, current: e.target.value })}
                required
                autoComplete="current-password"
              />
            </label>
          )}
          <label>
            New password
            <Input
              type="password"
              value={pw.next}
              onChange={(e) => setPw({ ...pw, next: e.target.value })}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          {pwAct.note}
          <Button kind="btn" loading={pwAct.busy}>
            {me!.hasPassword ? "Change password" : "Set password"}
          </Button>
        </form>
      </Section>
      <SignInMethods />
      <Section title="Delete account">
        <form className="form" onSubmit={submitDelete}>
          <p>This permanently removes your profile, scrobbles, loved tracks, playlists and shouts.</p>
          <ConfirmField value={del} onChange={setDel} />
          {delAct.note}
          <Button kind="btn danger" loading={delAct.busy}>
            Delete my account
          </Button>
        </form>
      </Section>
    </>
  );
}

// What /api/spotify/callback reports back in ?spotify=.
const SPOTIFY_OUTCOME: Record<string, { ok: boolean; text: string }> = {
  connected: { ok: true, text: "Spotify is connected. Your recent plays are being imported." },
  denied: { ok: false, text: "Spotify was not connected: access was declined." },
  expired: { ok: false, text: "That sign-in link expired. Try connecting again." },
  forbidden: {
    ok: false,
    text: "Spotify refused this account. If you signed in with a different Spotify account from the one that created the app, add it under User Management in the app's settings, then connect again.",
  },
  failed: { ok: false, text: "Spotify could not be connected. Check the client ID and try again." },
};
const SPOTIFY_DASHBOARD = "https://developer.spotify.com/dashboard";

const selectContents = (e: MouseEvent<HTMLElement>) => {
  const r = document.createRange();
  r.selectNodeContents(e.currentTarget);
  getSelection()?.removeAllRanges();
  getSelection()?.addRange(r);
};

function SpotifySetup({
  redirectUri,
  initial,
  playback,
  onConnect,
  busy,
  note,
}: {
  redirectUri: string;
  initial: string;
  playback: boolean;
  onConnect: (clientId: string, playback: boolean) => void;
  busy: boolean;
  note: ReactNode;
}) {
  const [id, setId] = useState(initial);
  const [copied, setCopied] = useState(false);
  const [play, setPlay] = useState(playback);

  const copy = () =>
    copyText(redirectUri).then((ok) => {
      if (!ok) return;
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onConnect(id.trim(), play);
  };

  return (
    <>
      <p>
        Spotify only lets each app be used by a few people, so you connect through your own free Spotify app. It takes
        about two minutes:
      </p>
      <ol className="steps">
        <li>
          Open the{" "}
          <a href={SPOTIFY_DASHBOARD} target="_blank" rel="noreferrer">
            Spotify developer dashboard
          </a>{" "}
          and log in with your Spotify account. Accept the developer terms if asked.
        </li>
        <li>
          Click <b>Create app</b>. Any name and description will do, such as "My Sonosphere scrobbler".
        </li>
        <li>
          Under <b>Redirect URIs</b>, paste this address exactly and click <b>Add</b>:
          <span className="copy-row">
            <code onClick={selectContents}>{redirectUri}</code>
            <Button kind="btn ghost small" type="button" onClick={copy}>
              {copied ? "Copied" : "Copy"}
            </Button>
          </span>
        </li>
        <li>
          Under <b>Which API/SDKs are you planning to use?</b>, tick <b>Web API</b> (and <b>Web Playback SDK</b> to play
          music here), agree to the terms and click <b>Save</b>.
        </li>
        <li>
          Open the app's <b>Settings</b>, copy its <b>Client ID</b> and paste it below. You don't need the client
          secret.
        </li>
      </ol>
      <form className="form" onSubmit={submit}>
        <label>
          Client ID
          <Input
            value={id}
            onChange={(e) => setId(e.target.value)}
            required
            maxLength={64}
            placeholder="32 letters and numbers"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label className="check">
          <Input type="checkbox" checked={play} onChange={(e) => setPlay(e.target.checked)} /> Also play music here
          through Spotify instead of videos (needs Spotify Premium)
        </label>
        {note}
        <div className="row">
          <Button kind="btn" loading={busy}>
            Connect Spotify
          </Button>
        </div>
      </form>
      <p className="muted small">
        Only the Spotify account that created the app can use it straight away. To connect a different one, add it under{" "}
        <b>User Management</b> in the app's settings first.
      </p>
    </>
  );
}

type SpotifyOn = Extract<SpotifyStatus, { enabled: true }>;

function SpotifySettings() {
  const q = useApi<SpotifyStatus>("/spotify");
  const act = useAction();
  const [sp, setSp] = useSearchParams();
  const [redo, setRedo] = useState(false);
  const outcome = SPOTIFY_OUTCOME[sp.get("spotify") ?? ""];

  const connect = (clientId: string, playback: boolean) =>
    act.run(async () => {
      const body: SpotifyConnectBody = { clientId, playback };
      const r = await api<SpotifyConnect>("/spotify/connect", { body });
      window.location.href = r.url;
    });

  const sync = (s: SpotifyOn) =>
    act.run(async () => {
      const r = await api<SpotifySynced>("/spotify/sync", { method: "POST" });
      q.setData({ ...s, link: r.link });
      if (r.imported) return `Imported ${plural(r.imported, "play")}.`;
      return r.link.restingUntil ? "Spotify asked us to wait, so nothing was imported." : "Nothing new to import.";
    });

  const disconnect = () =>
    act.run(async () => {
      await api<Ok>("/spotify", { method: "DELETE" });
      setSp({}, { replace: true });
      setRedo(false);
      q.reload();
    });

  const linked = (s: SpotifyOn, l: SpotifyLink) => (
    <>
      <p>
        Connected as <b>{l.account.name}</b> <span className="muted small">since {date(l.connectedAt)}</span>
      </p>
      {l.broken ? (
        <p className="form-error">{l.broken}</p>
      ) : (
        <>
          <p className="muted small">
            {l.lastImport ? (
              <>
                Last import {ago(l.lastImport)} · {num(l.imported)} plays imported
              </>
            ) : (
              "Importing your recent plays..."
            )}
            . New plays are picked up every few minutes.
          </p>
          {l.restingUntil && (
            <p className="muted small">
              Spotify asked us to slow down, so importing resumes around {clock(l.restingUntil)}.
            </p>
          )}
          <p className="muted small">
            {l.playback
              ? "The player plays through Spotify when it has the track."
              : "The player uses videos. To play through Spotify (Premium) instead, choose Change app and tick the playback option."}
          </p>
        </>
      )}
      {l.broken || redo ? (
        <SpotifySetup
          redirectUri={s.redirectUri}
          initial={l.clientId}
          playback={l.playback}
          onConnect={connect}
          busy={act.busy}
          note={act.note}
        />
      ) : (
        act.note
      )}
      <div className="row">
        {!l.broken && !redo && (
          <>
            <Button kind="btn" loading={act.busy} onClick={() => sync(s)}>
              Import now
            </Button>
            <Button kind="btn ghost" onClick={() => setRedo(true)}>
              Change app
            </Button>
          </>
        )}
        <Button kind="btn ghost" onClick={disconnect}>
          Disconnect
        </Button>
      </div>
    </>
  );

  let badge = null;
  if (q.data) {
    if (!q.data.enabled) badge = <span className="badge off">Disabled</span>;
    else if (q.data.link?.broken) badge = <span className="badge warn">Needs attention</span>;
    else if (q.data.link) badge = <span className="badge">Connected</span>;
    else badge = <span className="badge off">Not connected</span>;
  }

  return (
    <Service name="Spotify" blurb="Import what you play on Spotify" badge={badge} open={!!outcome}>
      <Async q={q}>
        {(d) =>
          !d.enabled ? (
            <p className="muted">Scrobbling from Spotify is disabled.</p>
          ) : (
            <div className="spotify">
              {outcome && !(outcome.ok && d.link?.broken) && (
                <p className={outcome.ok ? "form-ok" : "form-error"}>{outcome.text}</p>
              )}
              {d.link ? (
                linked(d, d.link)
              ) : (
                <SpotifySetup
                  redirectUri={d.redirectUri}
                  initial=""
                  playback={false}
                  onConnect={connect}
                  busy={act.busy}
                  note={act.note}
                />
              )}
            </div>
          )
        }
      </Async>
    </Service>
  );
}

function Service({
  name,
  blurb,
  badge,
  open,
  children,
}: {
  name: string;
  blurb: string;
  badge: ReactNode;
  open: boolean;
  children: ReactNode;
}) {
  const [shown, setShown] = useState(open);
  return (
    <div className={`card service${shown ? " open" : ""}`}>
      <button type="button" className="service-head" aria-expanded={shown} onClick={() => setShown((v) => !v)}>
        <span className="service-name">
          <b>{name}</b>
          <span className="muted small">{blurb}</span>
        </span>
        {badge}
        <Ico.ChevDown />
      </button>
      {shown && <div className="service-body">{children}</div>}
    </div>
  );
}

const EMPTY_APP = { name: "", description: "", callbackUrl: "" };

function AppSettings() {
  const q = useApi<Apps>("/apps");
  const c = useConfirm();
  const [adding, setAdding] = useState(false);
  const [tokenOpened, setTokenOpened] = useState(false);

  const revoke = (key: string) => api<AppOk>("/apps/revoke", { body: { key } }).then(q.reload);

  const askDelete = (a: ApiApp) =>
    c.ask({
      title: `Delete “${a.name}”?`,
      body: "Apps using this key will stop working.",
      action: "Delete",
      danger: true,
      run: () => api<AppOk>(`/apps/${a.id}`, { method: "DELETE" }).then(q.reload),
    });

  return (
    <>
      {c.dialog}
      <Section title="Streaming services">
        <div className="services">
          <SpotifySettings />
        </div>
      </Section>
      <Section title="Connected applications">
        <div className="connect-card">
          <p>
            Pano Scrobbler and other players with a custom Last.fm or ListenBrainz server option can scrobble here. No
            API account is needed.
          </p>
          <div className="connect-method">
            <CopyField label="Last.fm-compatible server URL" value={`${window.location.origin}/2.0/`} />
            <span className="muted small">Sign in with your Sonosphere username and password.</span>
          </div>
          <div className="connect-method">
            <CopyField label="ListenBrainz server URL" value={window.location.origin} />
            <span className="muted small">Paste a token instead of a password.</span>
          </div>
          <details className="api-app connect-drop" onToggle={(e) => e.currentTarget.open && setTokenOpened(true)}>
            <summary>
              <Ico.Chevron />
              <b>Create ListenBrainz token</b>
            </summary>
            {tokenOpened && <NewToken onCreated={q.reload} />}
          </details>
          <Link className="connect-more" to="/help#pano-scrobbler">
            Setup details <Arrow />
          </Link>
        </div>
        <Async q={q}>
          {(d) =>
            d.sessions.length ? (
              <ul className="plain connected-apps">
                {d.sessions.map((s) => (
                  <li key={s.key}>
                    <span className="grow">
                      <b>{s.app}</b>
                      <span className="muted small">
                        Connected {date(s.createdAt)}, last used {date(s.lastUsedAt)}
                      </span>
                    </span>
                    <Button kind="btn ghost small" onClick={() => revoke(s.key)}>
                      Disconnect
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No applications can scrobble to your account yet.</p>
            )
          }
        </Async>
      </Section>
      <Section title="Your API accounts" more="/developers" moreLabel="API docs">
        <Async q={q}>
          {(d) => (
            <>
              {!d.items.length && <p className="muted">Create an API account to get a key and shared secret.</p>}
              <ul className="plain api-apps">
                {d.items.map((a) => (
                  <li key={a.id}>
                    <details className="api-app">
                      <summary>
                        <Ico.Chevron />
                        <b>{a.name}</b>
                        <span className="muted small">{a.apiKey.slice(0, 8)}…</span>
                      </summary>
                      {a.description && <p className="muted small">{a.description}</p>}
                      <dl className="keys">
                        <dt>API key</dt>
                        <dd>
                          <code>{a.apiKey}</code>
                        </dd>
                        <dt>Shared secret</dt>
                        <dd>
                          <code>{a.secret}</code>
                        </dd>
                        <dt>Callback URL</dt>
                        <dd>
                          <CallbackField app={a} onSaved={q.reload} />
                        </dd>
                      </dl>
                      <Button kind="link small" onClick={() => askDelete(a)}>
                        Delete API account
                      </Button>
                    </details>
                  </li>
                ))}
                <li>
                  <details className="api-app" onToggle={(e) => setAdding(e.currentTarget.open)}>
                    <summary>
                      <Ico.Chevron />
                      <b>New API account</b>
                    </summary>
                    {adding && <NewApp onCreated={q.reload} />}
                  </details>
                </li>
              </ul>
            </>
          )}
        </Async>
      </Section>
    </>
  );
}

function NewToken({ onCreated }: { onCreated: () => void }) {
  const act = useAction();
  const robot = useTurnstile("listentoken");
  const [token, setToken] = useState("");

  const create = () =>
    act.run(async () => {
      if (robot.on && !robot.token) throw new Error("Complete the check that you are not a robot");
      try {
        setToken((await api<ListenToken>("/apps/listen-token", { body: { turnstile: robot.token } })).token);
      } finally {
        robot.reset();
      }
      onCreated();
    });

  if (token) {
    return (
      <div className="token-reveal">
        <CopyField label="Your token" value={token} />
        <p>Copy it now: it's shown only this once.</p>
      </div>
    );
  }
  return (
    <div className="new-token">
      {robot.view}
      {act.note}
      <Button kind="btn small" loading={act.busy} onClick={create}>
        Create ListenBrainz token
      </Button>
    </div>
  );
}

function NewApp({ onCreated }: { onCreated: () => void }) {
  const [f, setF] = useState(EMPTY_APP);
  const act = useAction();
  const robot = useTurnstile("apiapp");

  const create = (e: FormEvent) => {
    e.preventDefault();
    act.run(async () => {
      if (robot.on && !robot.token) throw new Error("Complete the check that you are not a robot");
      try {
        await api<AppOk>("/apps", { body: { ...f, turnstile: robot.token } });
      } finally {
        robot.reset();
      }
      setF(EMPTY_APP);
      onCreated();
      return "API account created.";
    });
  };

  return (
    <form className="form new-app" onSubmit={create}>
      <label>
        Application name
        <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required maxLength={60} />
      </label>
      <label>
        Description (optional)
        <Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={300} />
      </label>
      <label>
        Callback URL (optional)
        <Input
          value={f.callbackUrl}
          onChange={(e) => setF({ ...f, callbackUrl: e.target.value })}
          maxLength={500}
          placeholder="https://example.com/callback"
        />
      </label>
      <p className="muted small">
        For web sign-in: where people go back to, with <code>?token=</code>, after they approve your app.
      </p>
      {robot.view}
      {act.note}
      <Button kind="btn" loading={act.busy}>
        Create API account
      </Button>
    </form>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () =>
    copyText(value).then((ok) => {
      if (!ok) return;
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  return (
    <div className="copy-field">
      <span className="copy-label">{label}</span>
      <span className="copy-value">
        <span onClick={selectContents}>{value}</span>
        <Button kind="btn ghost small" type="button" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </Button>
      </span>
    </div>
  );
}

function CallbackField({ app, onSaved }: { app: ApiApp; onSaved: () => void }) {
  const saved = app.callbackUrl;
  const [v, setV] = useState(saved);
  const act = useAction();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    act.run(async () => {
      await api<AppOk>(`/apps/${app.id}`, { method: "PATCH", body: { callbackUrl: v.trim() } });
      onSaved();
      return "Saved.";
    });
  };

  return (
    <form className="callback-field" onSubmit={submit}>
      <Input
        value={v}
        onChange={(e) => setV(e.target.value)}
        maxLength={500}
        placeholder="None"
        aria-label="Callback URL"
      />
      {v.trim() !== saved && (
        <Button kind="btn small" loading={act.busy}>
          Save
        </Button>
      )}
      {act.note}
    </form>
  );
}

// Accounts made through another site have no password, so they confirm with their username.
function ConfirmField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { me } = useAuth();
  if (me!.hasPassword) {
    return (
      <label>
        Confirm with your password
        <Input
          type="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          autoComplete="current-password"
        />
      </label>
    );
  }
  return (
    <label>
      Type your username (<Username user={me!} />) to confirm
      <Input value={value} onChange={(e) => onChange(e.target.value)} required autoComplete="off" />
    </label>
  );
}

function DataSettings() {
  const { me } = useAuth();
  const [pw, setPw] = useState("");
  const act = useAction();
  const c = useConfirm();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    c.ask({
      title: me?.impersonating ? `Delete all of ${me.username}'s scrobbles?` : "Delete all of your scrobbles?",
      body: me?.impersonating
        ? `${me.username}'s whole listening history will be removed. This can't be undone and is logged in the audit log.`
        : "Your whole listening history will be removed. This can't be undone.",
      action: "Delete all scrobbles",
      danger: true,
      run: () =>
        act.run(async () => {
          const r = await api<ScrobblesCleared>("/me/clear-scrobbles", { body: { password: pw } });
          setPw("");
          return `Deleted ${plural(r.deleted, "scrobble")}.`;
        }),
    });
  };

  return (
    <>
      {c.dialog}
      <Section title="Import listening history">
        <p>Bring in scrobbles and loved tracks from Last.fm, CSV, or JSON.</p>
        <Button kind="btn" href="/import">
          Import listening history
        </Button>
      </Section>
      <Section title="Export your scrobbles">
        <p>Download every scrobble with artist, album, track and timestamp.</p>
        <div className="row">
          <Button kind="btn" href="/api/me/export?format=csv" download>
            Download CSV
          </Button>
          <Button kind="btn ghost" href="/api/me/export?format=json" download>
            Download JSON
          </Button>
        </div>
      </Section>
      <Section title="Export your loved tracks">
        <p>Download the tracks you’ve loved, with the date you loved each one.</p>
        <div className="row">
          <Button kind="btn" href="/api/me/export?format=csv&what=loved" download>
            Download CSV
          </Button>
          <Button kind="btn ghost" href="/api/me/export?format=json&what=loved" download>
            Download JSON
          </Button>
        </div>
      </Section>
      <Section title="Clear listening history">
        <form className="form" onSubmit={submit}>
          <p>
            Removes every scrobble from {me?.impersonating ? `${me.username}'s` : "your"} library. Loved tracks, tags
            and playlists are kept.
          </p>
          {me?.impersonating ? (
            <p className="muted small">
              You are acting as <Username user={me} />; no password is needed. This deletion is logged in the audit log.
            </p>
          ) : (
            <ConfirmField value={pw} onChange={setPw} />
          )}
          {act.note}
          <Button kind="btn danger" loading={act.busy}>
            Delete all scrobbles
          </Button>
        </form>
      </Section>
    </>
  );
}
