import { LanguagePicker } from "../ui/language-picker";
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
import { TotpSettings } from "../ui/totp";
import { ProfileLinksEditor } from "../ui/profile-links-editor";
import { ProfileStyleSettings } from "../ui/profile-style-settings";
import { Username } from "../ui/username";
import { Link, NavLink, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ago, api, copyText, date, imageUrl, invalidateAll, useApi, useAuth, useTitle, type Ok } from "../lib";
import type { ProfileEdit, ProfileSaved, ScrobblesCleared } from "../../shared/account";
import type { ApiApp, AppOk, Apps, ListenToken } from "../../shared/apps";
import { useTurnstile } from "./auth";
import { oauthError, OAuthMark, oauthStart } from "../ui/oauth";
import { locale, t, tx, type MessageKey } from "../i18n";
import type { Logins } from "../../shared/auth";
import { DISCORD_INVITE, type DiscordStatus, type DiscordToggle } from "../../shared/discord";
import type { BlockResult, Blocks } from "../../shared/blocks";
import type { ImageSaved } from "../../shared/images";
import { EMAIL_KINDS, EMAIL_MODES, type EmailKind } from "../../shared/notifications";
import type {
  SpotifyConnect,
  SpotifyConnectBody,
  SpotifyLink,
  SpotifyStatus,
  SpotifySynced,
} from "../../shared/spotify";
import type { MusicConnectBody, MusicKind, MusicStatus } from "../../shared/music";
import { Arrow, Ico, Spinner } from "../icons";
import { Art, Async, Pane, Section, useAction } from "../ui/base";
import { ImageWithFallback } from "../ui/image";
import { ImageCropper } from "../ui/image-cropper";
import { UserList } from "../ui/lists";
import { changeTheme, type ThemePref } from "../theme";

// The country picker carries every flag, so it loads separately.
const CountryInput = lazy(() => import("../ui/country").then((m) => ({ default: m.CountryInput })));

const clock = (at: number) => new Date(at * 1000).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });

const TABS: [string, MessageKey][] = [
  ["", "settings.tabProfile"],
  ["/appearance", "settings.appearance"],
  ["/privacy", "settings.tabPrivacy"],
  ["/notifications", "settings.tabNotifications"],
  ["/account", "settings.tabAccount"],
  ["/applications", "settings.tabApplications"],
  ["/data", "settings.tabData"],
];

export function Settings() {
  const tab = useParams().tab || "profile";
  useTitle(t("settings.title"));
  return (
    <div className="wrap page">
      <h1 className="page-title">{t("settings.title")}</h1>
      <nav className="tabs">
        {TABS.map(([p, l]) => (
          <NavLink key={p} to={`/settings${p}`} end>
            {t(l)}
          </NavLink>
        ))}
      </nav>
      <div className="narrow-col">
        <Pane>
          {tab === "profile" && <ProfileSettings />}
          {tab === "appearance" && <AppearanceSettings />}
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
      return t("settings.saved");
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
      return t("settings.profileSaved");
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
      <Section title={t("settings.avatar")}>
        <div className="avatar-edit">
          <button
            type="button"
            className="avatar avatar-pick"
            aria-label={t("settings.changeAvatar")}
            onClick={() => file.current?.click()}
            disabled={img.busy}
          >
            <Art image={me!.image} kind="user" />
          </button>
          <Input ref={file} type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif" onChange={upload} />
          <div className="avatar-side">
            <div className="avatar-actions">
              <Button kind="btn small" loading={img.busy} onClick={() => file.current?.click()}>
                {me!.image ? t("settings.changePicture") : t("settings.uploadPicture")}
              </Button>
              {me!.image && (
                <button type="button" className="linklike muted" onClick={removeImage}>
                  {t("settings.remove")}
                </button>
              )}
            </div>
            <p className="muted small">{t("settings.avatarFormats")}</p>
            {img.note}
          </div>
        </div>
      </Section>
      <BannerSettings />
      <Section title={t("settings.profile")}>
        <form className="form" onSubmit={submit}>
          <ProfileStyleSettings value={f} onChange={(style) => setF((f) => ({ ...f, ...style }))} disabled={act.busy} />
          <label>
            {t("settings.displayName")}
            <Input value={f.realname} onChange={set("realname")} maxLength={60} />
          </label>
          <label>
            {t("settings.pronouns")}
            <Input
              value={f.pronouns}
              onChange={set("pronouns")}
              placeholder={t("settings.pronounsPlaceholder")}
              maxLength={30}
            />
          </label>
          <label>
            {t("settings.country")}
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
              <span className="field-label">{t("settings.aboutMe")}</span>
              <Button
                type="button"
                kind="btn ghost small"
                aria-pressed={previewAbout}
                onClick={() => setPreviewAbout(!previewAbout)}
              >
                {previewAbout ? t("settings.write") : t("settings.preview")}
              </Button>
            </div>
            {previewAbout ? (
              <div className="border border-site-line p-3 min-h-[140px] [overflow-wrap:anywhere]">
                <Markdown text={f.about} images />
              </div>
            ) : (
              <MdEditor
                label={t("settings.aboutMe")}
                rows={5}
                value={f.about}
                onChange={(about) => setF((f) => ({ ...f, about }))}
                maxLength={2000}
                images
                imageUpload="about"
              />
            )}
            <p className="muted small">{t("settings.aboutHint")}</p>
          </div>
          <ProfileLinksEditor links={f.links} onChange={(links) => setF({ ...f, links })} />
          {act.note}
          <Button kind="btn" loading={act.busy}>
            {t("settings.saveProfile")}
          </Button>
        </form>
      </Section>
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
      return t("settings.bannerRemoved");
    });

  return (
    <Section title={t("settings.banner")}>
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
            alt={t("settings.bannerAlt")}
            fallback={<span className="image-placeholder">{t("settings.bannerLoading")}</span>}
            errorFallback={<span className="image-placeholder">{t("settings.imageUnavailable")}</span>}
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
            {me!.banner ? t("settings.changeBanner") : t("settings.uploadBanner")}
          </Button>
          {me!.banner && (
            <button type="button" className="linklike muted" disabled={act.busy} onClick={remove}>
              {t("settings.removeBanner")}
            </button>
          )}
        </div>
        <p className="muted small">{t("settings.bannerHint")}</p>
        {act.note}
      </div>
    </Section>
  );
}

const THEMES: [ThemePref, MessageKey][] = [
  ["light", "settings.themeLight"],
  ["system", "settings.themeAutomatic"],
  ["dark", "settings.themeDark"],
];

function AppearanceSettings() {
  const { me, setMe } = useAuth();
  const act = useAction();
  const profileTheme = useSaveProfile();
  const useProfileTheme = me!.useProfileTheme ?? false;

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
    <Section title={t("settings.appearance")}>
      <div className="theme-pick" role="group" aria-label={t("settings.theme")}>
        {THEMES.map(([v, name]) => (
          <button key={v} type="button" aria-pressed={me!.theme === v} onClick={() => pick(v)}>
            {t(name)}
          </button>
        ))}
      </div>
      {act.note}
      <button
        type="button"
        role="checkbox"
        aria-checked={useProfileTheme}
        disabled={profileTheme.act.busy}
        className="profile-theme-check"
        onClick={() => profileTheme.save({ useProfileTheme: !useProfileTheme })}
      >
        <span className="profile-theme-check-box" aria-hidden="true">
          {useProfileTheme && <Ico.Check />}
        </span>
        <span>{t("settings.useProfileTheme")}</span>
      </button>
      {profileTheme.act.note}
      <LanguagePicker />
    </Section>
  );
}

const DM_POLICIES: [string, MessageKey][] = [
  ["everyone", "settings.dmEveryone"],
  ["requests", "settings.dmRequests"],
  ["following", "settings.dmFollowing"],
  ["nobody", "settings.dmNobody"],
];

const EMAIL_MODE_LABELS: Record<(typeof EMAIL_MODES)[number][0], MessageKey> = {
  instant: "settings.emailInstant",
  daily: "settings.emailDaily",
  weekly: "settings.emailWeekly",
  off: "settings.emailOff",
};

const EMAIL_KIND_LABELS: Record<EmailKind, MessageKey> = {
  follow: "settings.emailKindFollow",
  shout: "settings.emailKindShout",
  comment: "settings.emailKindComment",
  message: "settings.emailKindMessage",
};

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
      <Section title={t("settings.privacy")}>
        <div className="form">
          <CheckOption
            title={t("settings.hideRecent")}
            checked={me!.hideRecent || me!.privateListening}
            disabled={me!.privateListening}
            onChange={(hideRecent) => save({ hideRecent })}
          >
            {t("settings.hideRecentHint")}
          </CheckOption>
          <CheckOption
            title={t("settings.privateListening")}
            checked={me!.privateListening}
            onChange={(privateListening) => save({ privateListening })}
          >
            {t("settings.privateListeningHint")}
          </CheckOption>
          <CheckOption
            title={t("settings.shoutsEnabled")}
            checked={me!.shoutsEnabled}
            onChange={(shoutsEnabled) => save({ shoutsEnabled })}
          >
            {t("settings.shoutsEnabledHint")}
          </CheckOption>
          <label>
            {t("settings.dmPolicy")}
            <Select
              label={t("settings.dmPolicyLabel")}
              value={me!.dmPolicy}
              onChange={(v) => save({ dmPolicy: v })}
              options={DM_POLICIES.map(([v, l]) => [v, t(l)])}
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
    <>
      <Section title={t("settings.onScreenAlerts")}>
        <div className="form">
          <CheckOption
            title={t("settings.notifyPopups")}
            checked={me!.notifyPopups}
            onChange={(notifyPopups) => save({ notifyPopups })}
          >
            {t("settings.notifyPopupsHint")}
          </CheckOption>
        </div>
      </Section>
      <Section title={t("settings.emailNotifications")}>
        <div className="form">
          {!me!.emailVerified && (
            <p className="muted small">
              {tx("settings.emailUnconfirmed", {
                email: me!.email,
                account: <Link to="/settings/account">{t("settings.tabAccount")}</Link>,
              })}
            </p>
          )}
          <label>
            {t("settings.sendMeEmails")}
            <Select
              label={t("settings.emailFrequency")}
              value={me!.emailNotify}
              onChange={(v) => save({ emailNotify: v })}
              options={EMAIL_MODES.map(([v]) => [v, t(EMAIL_MODE_LABELS[v])])}
            />
          </label>
          {me!.emailNotify !== "instant" && !off && (
            <p className="muted small">
              {me!.emailNotify === "daily" ? t("settings.digestDaily") : t("settings.digestWeekly")}
            </p>
          )}
          <p className="field-label">{t("settings.emailMeWhen")}</p>
          {EMAIL_KINDS.map(([k]) => (
            <label key={k} className="check">
              <Input
                type="checkbox"
                checked={!off && !muted.has(k)}
                disabled={off}
                onChange={(e) => toggle(k, e.target.checked)}
              />{" "}
              {t(EMAIL_KIND_LABELS[k])}
            </label>
          ))}
          {act.note}
        </div>
      </Section>
    </>
  );
}

function BlockedUsers() {
  const q = useApi<Blocks>("/blocks");
  const unblock = (username: string) => api<BlockResult>("/block", { body: { username, block: false } }).then(q.reload);
  return (
    <Section title={t("settings.blockedUsers")}>
      <p className="muted small">{t("settings.blockedHint")}</p>
      <Async q={q}>
        {(d) =>
          d.items.length ? (
            <UserList
              items={d.items}
              extra={(u) => (
                <span>
                  <Button kind="link small" type="button" onClick={() => unblock(u.username)}>
                    {t("settings.unblock")}
                  </Button>
                </span>
              )}
            />
          ) : (
            <p className="muted">{t("settings.noBlocks")}</p>
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
  const error = oauthError(sp.get("oauth"));
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
    <Section title={t("settings.signInMethods")}>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {linked && !error && <p className="form-ok">{t("settings.linkedOk")}</p>}
      <ul className="plain">
        {q.data.providers.map((p) => (
          <li key={p.id} className="row between">
            <span className="oauth-row">
              <span className={`oauth-chip oauth-${p.id}`}>
                <OAuthMark id={p.id} />
              </span>
              <b>{p.label}</b>{" "}
              <span className="muted small">
                {p.connected
                  ? t("settings.loginConnectedSince", {
                      name: p.connected.name || t("settings.loginConnected"),
                      date: date(p.connected.since),
                    })
                  : t("settings.loginNotConnected")}
              </span>
            </span>
            {p.connected ? (
              <Button
                kind="btn ghost small"
                disabled={lastWayIn}
                title={lastWayIn ? t("settings.setPasswordFirst") : undefined}
                onClick={() => disconnect(p.id)}
              >
                {t("settings.disconnect")}
              </Button>
            ) : (
              <Button kind="btn ghost small" href={oauthStart(p.id, "link")}>
                {t("settings.connect")}
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
      return t("settings.verifyResent", { email: me!.email });
    });

  const submitEmail = (e: FormEvent) => {
    e.preventDefault();
    emailAct.run(async () => {
      if (email.trim().toLowerCase() === me!.email) return t("settings.emailSame");
      const u = (await api<ProfileSaved>("/me", { method: "PATCH", body: { email } })).user;
      setMe(u);
      setEmail(u.email);
      return t("settings.emailApproveFirst", { email: u.pendingEmail ?? email });
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
        return t("settings.passwordSet");
      }
      return t("settings.passwordChanged");
    });
  };

  const submitDelete = (e: FormEvent) => {
    e.preventDefault();
    c.ask({
      title: t("settings.deleteAccountConfirmTitle"),
      body: t("settings.deleteAccountConfirmBody"),
      action: t("settings.deleteMyAccount"),
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
      <Section title={t("settings.email")}>
        <form className="form" onSubmit={submitEmail}>
          <p className="muted small">
            {me!.emailVerified ? (
              t("settings.emailConfirmed", { email: me!.email })
            ) : (
              <>
                {t("settings.emailNotConfirmed", { email: me!.email })}{" "}
                <Button kind="link small" type="button" onClick={resendLink}>
                  {t("settings.sendLinkAgain")}
                </Button>
              </>
            )}
            {me!.pendingEmail && <> {t("settings.emailPending", { email: me!.pendingEmail })}</>}
          </p>
          {resend.note}
          <label>
            {t("settings.emailAddress")}
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          {emailAct.note}
          <Button kind="btn" loading={emailAct.busy}>
            {t("settings.updateEmail")}
          </Button>
        </form>
      </Section>
      <Section title={t("settings.password")}>
        <form className="form" onSubmit={submitPassword}>
          {!me!.hasPassword && <p className="muted small">{t("settings.noPasswordHint")}</p>}
          {me!.hasPassword && (
            <label>
              {t("settings.currentPassword")}
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
            {t("settings.newPassword")}
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
            {me!.hasPassword ? t("settings.changePassword") : t("settings.setPassword")}
          </Button>
        </form>
      </Section>
      <SignInMethods />
      <TotpSettings />
      <Section title={t("settings.deleteAccount")}>
        <form className="form" onSubmit={submitDelete}>
          <p>{t("settings.deleteAccountHint")}</p>
          <ConfirmField value={del} onChange={setDel} />
          {delAct.note}
          <Button kind="btn danger" loading={delAct.busy}>
            {t("settings.deleteMyAccount")}
          </Button>
        </form>
      </Section>
    </>
  );
}

// What /api/spotify/callback reports back in ?spotify=.
const SPOTIFY_OUTCOME: Record<string, { ok: boolean; text: MessageKey }> = {
  connected: { ok: true, text: "settings.spotifyConnected" },
  denied: { ok: false, text: "settings.spotifyDenied" },
  expired: { ok: false, text: "settings.spotifyExpired" },
  forbidden: { ok: false, text: "settings.spotifyForbidden" },
  failed: { ok: false, text: "settings.spotifyFailed" },
};
const SPOTIFY_DASHBOARD = "https://developer.spotify.com/dashboard";
const SPOTIFY_QUOTA_MODES = "https://developer.spotify.com/documentation/web-api/concepts/quota-modes";

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
        {tx("settings.spotifyIntro", {
          quotaModes: (
            <a href={SPOTIFY_QUOTA_MODES} target="_blank" rel="noreferrer">
              {t("settings.spotifyQuotaModes")}
            </a>
          ),
        })}
      </p>
      <ol className="steps">
        <li>
          {tx("settings.spotifyStep1", {
            dashboard: (
              <a href={SPOTIFY_DASHBOARD} target="_blank" rel="noreferrer">
                {t("settings.spotifyDashboard")}
              </a>
            ),
          })}
        </li>
        <li>{tx("settings.spotifyStep2", { create: <b>{t("settings.spotifyCreateApp")}</b> })}</li>
        <li>
          {tx("settings.spotifyStep3", {
            redirect: <b>{t("settings.spotifyRedirectUris")}</b>,
            add: <b>{t("settings.spotifyAdd")}</b>,
          })}
          <span className="copy-row">
            <code onClick={selectContents}>{redirectUri}</code>
            <Button kind="btn ghost small" type="button" onClick={copy}>
              {copied ? t("settings.copied") : t("settings.copy")}
            </Button>
          </span>
        </li>
        <li>
          {tx("settings.spotifyStep4", {
            question: <b>{t("settings.spotifyApiQuestion")}</b>,
            webApi: <b>Web API</b>,
            playbackSdk: <b>Web Playback SDK</b>,
            save: <b>{t("settings.spotifySave")}</b>,
          })}
        </li>
        <li>
          {tx("settings.spotifyStep5", {
            settings: <b>{t("settings.spotifySettings")}</b>,
            clientId: <b>{t("settings.spotifyClientId")}</b>,
          })}
        </li>
      </ol>
      <form className="form" onSubmit={submit}>
        <label>
          {t("settings.spotifyClientId")}
          <Input
            value={id}
            onChange={(e) => setId(e.target.value)}
            required
            maxLength={64}
            placeholder={t("settings.spotifyClientIdPlaceholder")}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label className="check">
          <Input type="checkbox" checked={play} onChange={(e) => setPlay(e.target.checked)} />{" "}
          {t("settings.spotifyPlayback")}
        </label>
        {note}
        <div className="row">
          <Button kind="btn" loading={busy}>
            {t("settings.connectSpotify")}
          </Button>
        </div>
      </form>
      <p className="muted small">
        {tx("settings.spotifyOtherAccount", { userManagement: <b>{t("settings.spotifyUserManagement")}</b> })}
      </p>
    </>
  );
}

type SpotifyOn = Extract<SpotifyStatus, { enabled: true }>;

const MUSIC_KINDS: [MusicKind, MessageKey][] = [
  ["subsonic", "settings.musicServerKindSubsonic"],
  ["jellyfin", "settings.musicServerKindJellyfin"],
];

function MusicServerSettings() {
  const q = useApi<MusicStatus>("/music");
  const act = useAction();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<MusicConnectBody>({
    kind: "subsonic",
    url: "",
    username: "",
    password: "",
  });

  const connect = () =>
    act.run(async () => {
      q.setData(await api<MusicStatus>("/music", { body: form }));
      setEditing(false);
      setForm({ ...form, url: "", username: "", password: "" });
      window.dispatchEvent(new Event("spin:playback-source"));
      return t("settings.musicServerConnected");
    });

  const disconnect = () =>
    act.run(async () => {
      await api<Ok>("/music", { method: "DELETE" });
      q.setData({ connected: false });
      setEditing(false);
      window.dispatchEvent(new Event("spin:playback-source"));
      return t("settings.musicServerDisconnected");
    });

  const edit = (d: Extract<MusicStatus, { connected: true }>) => {
    setForm({ kind: d.kind, url: d.url, username: d.username, password: "" });
    setEditing(true);
  };

  const kindName = (kind: MusicKind) =>
    t(MUSIC_KINDS.find(([value]) => value === kind)?.[1] ?? "settings.musicServerTitle");

  let badge = null;
  if (q.data)
    badge = q.data.connected ? (
      <span className="badge">{t("settings.badgeConnected")}</span>
    ) : (
      <span className="badge off">{t("settings.badgeNotConnected")}</span>
    );

  return (
    <Service name={t("settings.musicServerTitle")} blurb={t("settings.musicServerBlurb")} badge={badge} open={false}>
      <Async q={q}>
        {(d) =>
          d.connected && !editing ? (
            <div className="form">
              <p>
                {tx("settings.musicServerConnectedTo", { name: <b>{d.name || kindName(d.kind)}</b> })}{" "}
                {d.version && <span className="muted small">{d.version}</span>}
              </p>
              <p className="muted small">
                {kindName(d.kind)} · {d.url} · {d.username}
              </p>
              <p className="muted small">{t("settings.musicServerNote")}</p>
              {act.note}
              <div className="row">
                <Button kind="btn ghost" onClick={() => edit(d)}>
                  {t("settings.musicServerChange")}
                </Button>
                <Button kind="btn ghost" onClick={disconnect}>
                  {t("settings.disconnect")}
                </Button>
              </div>
            </div>
          ) : (
            <form
              className="form"
              onSubmit={(e) => {
                e.preventDefault();
                connect();
              }}
            >
              <p>{t("settings.musicServerIntro")}</p>
              <label>
                {t("settings.musicServerKind")}
                <Select
                  label={t("settings.musicServerKind")}
                  value={form.kind}
                  onChange={(v) => setForm({ ...form, kind: v as MusicKind })}
                  options={MUSIC_KINDS.map(([value, label]) => [value, t(label)])}
                />
              </label>
              <label>
                {t("settings.musicServerUrl")}
                <Input
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder="https://music.example.com"
                  required
                  maxLength={500}
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
              <label>
                {t("settings.musicServerUsername")}
                <Input
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  required
                  maxLength={100}
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
              <label>
                {t("settings.musicServerPassword")}
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  maxLength={500}
                  autoComplete="off"
                />
              </label>
              {act.note}
              <div className="row">
                <Button kind="btn" loading={act.busy}>
                  {t("settings.connect")}
                </Button>
                {editing && (
                  <Button kind="btn ghost" type="button" onClick={() => setEditing(false)}>
                    {t("common.cancel")}
                  </Button>
                )}
              </div>
              <p className="muted small">{t("settings.musicServerPasswordHint")}</p>
            </form>
          )
        }
      </Async>
    </Service>
  );
}

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
      if (r.imported) return t("settings.spotifyImported", { count: r.imported });
      return r.link.restingUntil ? t("settings.spotifyWaitNothing") : t("settings.spotifyNothingNew");
    });

  const disconnect = () =>
    act.run(async () => {
      await api<Ok>("/spotify", { method: "DELETE" });
      window.dispatchEvent(new Event("spin:playback-source"));
      setSp({}, { replace: true });
      setRedo(false);
      q.reload();
    });

  const linked = (s: SpotifyOn, l: SpotifyLink) => (
    <>
      <p>
        {tx("settings.spotifyConnectedAs", { name: <b>{l.account.name}</b> })}{" "}
        <span className="muted small">{t("settings.since", { date: date(l.connectedAt) })}</span>
      </p>
      {l.broken ? (
        <p className="form-error">{l.broken}</p>
      ) : (
        <>
          <p className="muted small">
            {l.lastImport
              ? t("settings.spotifyLastImport", { ago: ago(l.lastImport), count: l.imported })
              : t("settings.spotifyImporting")}
          </p>
          {l.restingUntil && (
            <p className="muted small">{t("settings.spotifyResting", { time: clock(l.restingUntil) })}</p>
          )}
          <p className="muted small">
            {l.playback ? t("settings.spotifyPlaybackOn") : t("settings.spotifyPlaybackOff")}
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
              {t("settings.importNow")}
            </Button>
            <Button kind="btn ghost" onClick={() => setRedo(true)}>
              {t("settings.changeApp")}
            </Button>
          </>
        )}
        <Button kind="btn ghost" onClick={disconnect}>
          {t("settings.disconnect")}
        </Button>
      </div>
    </>
  );

  let badge = null;
  if (q.data) {
    if (!q.data.enabled) badge = <span className="badge off">{t("settings.badgeDisabled")}</span>;
    else if (q.data.link?.broken) badge = <span className="badge warn">{t("settings.badgeNeedsAttention")}</span>;
    else if (q.data.link) badge = <span className="badge">{t("settings.badgeConnected")}</span>;
    else badge = <span className="badge off">{t("settings.badgeNotConnected")}</span>;
  }

  return (
    <Service name="Spotify" blurb={t("settings.spotifyBlurb")} badge={badge} open={!!outcome}>
      <Async q={q}>
        {(d) =>
          !d.enabled ? (
            <p className="muted">{t("settings.spotifyDisabled")}</p>
          ) : (
            <div className="spotify">
              {outcome && !(outcome.ok && d.link?.broken) && (
                <p className={outcome.ok ? "form-ok" : "form-error"}>{t(outcome.text)}</p>
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

type DiscordOn = Extract<DiscordStatus, { enabled: true }>;

function DiscordSettings() {
  const q = useApi<DiscordStatus>("/discord");
  const act = useAction();

  const toggle = (on: boolean) =>
    act.run(async () => {
      const body: DiscordToggle = { on };
      q.setData(await api<DiscordStatus>("/discord", { body }));
    });

  const steps = (d: DiscordOn) => {
    if (!d.linked)
      return (
        <>
          <p>{t("settings.discordLinkFirst")}</p>
          <div className="row">
            <Button kind="btn" href={oauthStart("discord", "link", "/settings/applications")}>
              {t("settings.linkDiscord")}
            </Button>
          </div>
        </>
      );
    if (!d.inServer)
      return (
        <>
          <p>{t("settings.discordJoinFirst")}</p>
          <div className="row">
            <Button kind="btn" href={DISCORD_INVITE}>
              {t("settings.joinDiscord")}
            </Button>
            <Button kind="btn ghost" onClick={q.reload}>
              {t("settings.checkAgain")}
            </Button>
          </div>
        </>
      );
    return (
      <>
        <CheckOption title={t("settings.discordToggle")} checked={d.on} disabled={act.busy} onChange={toggle}>
          {t("settings.discordToggleHint")}
        </CheckOption>
        {d.on && (
          <p className="muted small">
            {d.lastPlayAt ? t("settings.discordLastPlay", { ago: ago(d.lastPlayAt) }) : t("settings.discordNoPlays")}
          </p>
        )}
        {act.note}
      </>
    );
  };

  let badge = null;
  if (q.data) {
    if (!q.data.enabled) badge = <span className="badge off">{t("settings.badgeDisabled")}</span>;
    else if (q.data.on && q.data.inServer) badge = <span className="badge">{t("settings.badgeConnected")}</span>;
    else badge = <span className="badge off">{t("settings.badgeNotConnected")}</span>;
  }

  return (
    <Service name="Discord" blurb={t("settings.discordBlurb")} badge={badge} open={false}>
      <Async q={q}>
        {(d) =>
          !d.enabled ? (
            <p className="muted">{t("settings.discordDisabled")}</p>
          ) : (
            <div className="form">
              <p>{t("settings.discordIntro")}</p>
              {steps(d)}
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

  const revoke = (key: string) => api<AppOk>("/apps/revoke", { body: { key } }).then(q.reload);

  const askDelete = (a: ApiApp) =>
    c.ask({
      title: t("settings.deleteAppConfirmTitle", { name: a.name }),
      body: t("settings.deleteAppConfirmBody"),
      action: t("settings.delete"),
      danger: true,
      run: () => api<AppOk>(`/apps/${a.id}`, { method: "DELETE" }).then(q.reload),
    });

  return (
    <>
      {c.dialog}
      <Section title={t("settings.streamingServices")}>
        <div className="services">
          <MusicServerSettings />
          <SpotifySettings />
          <DiscordSettings />
        </div>
      </Section>
      <Section title={t("settings.connectedApplications")}>
        <div className="connect-card">
          <p>{t("settings.customServerIntro")}</p>
          <div className="connect-method">
            <CopyField label={t("settings.lastfmServerUrl")} value={`${window.location.origin}/2.0/`} />
            <span className="muted small">{t("settings.lastfmServerHint")}</span>
          </div>
          <div className="connect-method">
            <CopyField label={t("settings.listenbrainzServerUrl")} value={window.location.origin} />
            <span className="muted small">{t("settings.listenbrainzServerHint")}</span>
          </div>
          <Suspense fallback={<Spinner />}>
            <NewToken onCreated={q.reload} />
          </Suspense>
          <Link className="connect-more" to="/help#pano-scrobbler">
            {t("settings.setupDetails")} <Arrow />
          </Link>
          <Relay onCreated={q.reload} />
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
                        {t("settings.sessionDates", { created: date(s.createdAt), used: date(s.lastUsedAt) })}
                      </span>
                    </span>
                    <Button kind="btn ghost small" onClick={() => revoke(s.key)}>
                      {t("settings.disconnect")}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">{t("settings.noSessions")}</p>
            )
          }
        </Async>
      </Section>
      <Section title={t("settings.apiAccounts")} more="/developers" moreLabel={t("settings.apiDocs")}>
        <Async q={q}>
          {(d) => (
            <>
              {!d.items.length && <p className="muted">{t("settings.noApiAccounts")}</p>}
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
                        <dt>{t("settings.apiKey")}</dt>
                        <dd>
                          <code>{a.apiKey}</code>
                        </dd>
                        <dt>{t("settings.sharedSecret")}</dt>
                        <dd>
                          <code>{a.secret}</code>
                        </dd>
                        <dt>{t("settings.callbackUrl")}</dt>
                        <dd>
                          <CallbackField app={a} onSaved={q.reload} />
                        </dd>
                      </dl>
                      <Button kind="link small" onClick={() => askDelete(a)}>
                        {t("settings.deleteApiAccount")}
                      </Button>
                    </details>
                  </li>
                ))}
                <li>
                  <details className="api-app" onToggle={(e) => setAdding(e.currentTarget.open)}>
                    <summary>
                      <Ico.Chevron />
                      <b>{t("settings.newApiAccount")}</b>
                    </summary>
                    {adding && (
                      <Suspense fallback={<Spinner />}>
                        <NewApp onCreated={q.reload} />
                      </Suspense>
                    )}
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
      const turnstile = await robot.check();
      setToken((await api<ListenToken>("/apps/listen-token", { body: { turnstile } })).token);
      onCreated();
    });

  if (token) {
    return (
      <div className="token-reveal">
        <CopyField label={t("settings.yourToken")} value={token} />
        <p>{t("settings.tokenOnce")}</p>
      </div>
    );
  }
  return (
    <div className="new-token">
      {robot.view}
      {act.note}
      <Button kind="btn small" loading={act.busy} onClick={create}>
        {t("settings.createListenToken")}
      </Button>
    </div>
  );
}

function Relay({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <details className="relay" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        {t("settings.relayTitle")}
        <Ico.ChevDown />
      </summary>
      <p>{t("settings.relayIntro")}</p>
      <p className="muted small">{t("settings.relayPrivacy")}</p>
      {open && (
        <Suspense fallback={<Spinner />}>
          <RelayLink onCreated={onCreated} />
        </Suspense>
      )}
    </details>
  );
}

function RelayLink({ onCreated }: { onCreated: () => void }) {
  const act = useAction();
  const robot = useTurnstile("listentoken");
  const [link, setLink] = useState("");

  const create = () =>
    act.run(async () => {
      const turnstile = await robot.check();
      const { token } = await api<ListenToken>("/apps/relay-token", { body: { turnstile } });
      setLink(`${window.location.origin}/relay/${token}/2.0/`);
      onCreated();
    });

  if (link) {
    return (
      <div className="token-reveal">
        <CopyField label={t("settings.yourRelayLink")} value={link} />
        <p>{t("settings.tokenOnce")}</p>
      </div>
    );
  }
  return (
    <div className="new-token">
      {robot.view}
      {act.note}
      <Button kind="btn small" loading={act.busy} onClick={create}>
        {t("settings.createRelayLink")}
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
      const turnstile = await robot.check();
      await api<AppOk>("/apps", { body: { ...f, turnstile } });
      setF(EMPTY_APP);
      onCreated();
      return t("settings.apiAccountCreated");
    });
  };

  return (
    <form className="form new-app" onSubmit={create}>
      <label>
        {t("settings.applicationName")}
        <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required maxLength={60} />
      </label>
      <label>
        {t("settings.descriptionOptional")}
        <Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={300} />
      </label>
      <label>
        {t("settings.callbackUrlOptional")}
        <Input
          value={f.callbackUrl}
          onChange={(e) => setF({ ...f, callbackUrl: e.target.value })}
          maxLength={500}
          placeholder="https://example.com/callback"
        />
      </label>
      <p className="muted small">{tx("settings.callbackHint", { param: <code>?token=</code> })}</p>
      {robot.view}
      {act.note}
      <Button kind="btn" loading={act.busy}>
        {t("settings.createApiAccount")}
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
          {copied ? t("settings.copied") : t("settings.copy")}
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
      return t("settings.saved");
    });
  };

  return (
    <form className="callback-field" onSubmit={submit}>
      <Input
        value={v}
        onChange={(e) => setV(e.target.value)}
        maxLength={500}
        placeholder={t("settings.none")}
        aria-label={t("settings.callbackUrl")}
      />
      {v.trim() !== saved && (
        <Button kind="btn small" loading={act.busy}>
          {t("settings.save")}
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
        {t("settings.confirmWithPassword")}
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
      <span>{tx("settings.confirmWithUsername", { name: <Username user={me!} /> })}</span>
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
      title: me?.impersonating
        ? t("settings.clearConfirmTitleAs", { name: me.username })
        : t("settings.clearConfirmTitle"),
      body: me?.impersonating
        ? t("settings.clearConfirmBodyAs", { name: me.username })
        : t("settings.clearConfirmBody"),
      action: t("settings.deleteAllScrobbles"),
      danger: true,
      run: () =>
        act.run(async () => {
          const r = await api<ScrobblesCleared>("/me/clear-scrobbles", { body: { password: pw } });
          setPw("");
          return t("settings.scrobblesDeleted", { count: r.deleted });
        }),
    });
  };

  return (
    <>
      {c.dialog}
      <Section title={t("settings.importHistory")}>
        <p>{t("settings.importHint")}</p>
        <Button kind="btn" href="/import">
          {t("settings.importHistory")}
        </Button>
      </Section>
      <Section title={t("settings.exportScrobbles")}>
        <p>{t("settings.exportScrobblesHint")}</p>
        <div className="row">
          <Button kind="btn" href="/api/me/export?format=csv" download>
            {t("settings.downloadCsv")}
          </Button>
          <Button kind="btn ghost" href="/api/me/export?format=json" download>
            {t("settings.downloadJson")}
          </Button>
        </div>
      </Section>
      <Section title={t("settings.exportLoved")}>
        <p>{t("settings.exportLovedHint")}</p>
        <div className="row">
          <Button kind="btn" href="/api/me/export?format=csv&what=loved" download>
            {t("settings.downloadCsv")}
          </Button>
          <Button kind="btn ghost" href="/api/me/export?format=json&what=loved" download>
            {t("settings.downloadJson")}
          </Button>
        </div>
      </Section>
      <Section title={t("settings.clearHistory")}>
        <form className="form" onSubmit={submit}>
          <p>{me?.impersonating ? t("settings.clearHintAs", { name: me.username }) : t("settings.clearHint")}</p>
          {me?.impersonating ? (
            <p className="muted small">{tx("settings.clearImpersonating", { name: <Username user={me} /> })}</p>
          ) : (
            <ConfirmField value={pw} onChange={setPw} />
          )}
          {act.note}
          <Button kind="btn danger" loading={act.busy}>
            {t("settings.deleteAllScrobbles")}
          </Button>
        </form>
      </Section>
    </>
  );
}
