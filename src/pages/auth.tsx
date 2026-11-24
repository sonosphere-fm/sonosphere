import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Button, Input } from "../kit";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { api, qs, TITLES, useApi, useAuth, useTitle } from "../lib";
import { useAction } from "../ui/base";
import type { AuthConfig, OAuthCreated, OAuthPending, Ok, Session } from "../../shared/auth";
import { oauthError as oauthErrorText, OAuthButtons } from "../ui/oauth";
import { t, tx } from "../i18n";

const safeNext = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/");

type Turnstile = {
  render: (el: HTMLElement, o: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};

let script: Promise<Turnstile> | null = null;

const loadTurnstile = () =>
  (script ??= new Promise<Turnstile>((ok, no) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => {
      const turnstile = (window as unknown as { turnstile?: Turnstile }).turnstile;
      if (turnstile) ok(turnstile);
      else no(new Error("no turnstile"));
    };
    s.onerror = () => {
      script = null;
      no(new Error("Turnstile did not load"));
    };
    document.head.append(s);
  }));

// Each token works once, so callers reset after a refused submit.
export function useTurnstile(action: string) {
  const { data } = useApi<AuthConfig>("/auth/config");
  const key = data?.turnstile ?? null;
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<{ t: Turnstile; id: string } | null>(null);
  const [token, setToken] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!key || !box.current) return;
    let gone = false;
    loadTurnstile().then(
      (turnstile) => {
        if (gone || !box.current) return;
        const theme = document.documentElement.dataset.theme;
        const id = turnstile.render(box.current, {
          sitekey: key,
          action,
          size: "flexible",
          theme: theme === "dark" || theme === "light" ? theme : "auto",
          callback: (v: string) => {
            setToken(v);
            setFailed(false);
          },
          "expired-callback": () => setToken(""),
          "error-callback": () => {
            setToken("");
            setFailed(true);
          },
        });
        widget.current = { t: turnstile, id };
      },
      () => setFailed(true)
    );
    return () => {
      gone = true;
      if (widget.current) widget.current.t.remove(widget.current.id);
      widget.current = null;
    };
  }, [key, action]);

  const reset = () => {
    setToken("");
    if (widget.current) widget.current.t.reset(widget.current.id);
  };

  const view = key ? (
    <div className="turnstile">
      <div ref={box} />
      {failed && (
        <p className="form-error" role="alert">
          {t("auth.robotFailed")}
        </p>
      )}
    </div>
  ) : null;

  return { on: !!key, token, reset, view };
}

function Agreement() {
  return (
    <p className="muted small">
      {tx("auth.agreement", {
        terms: (
          <Link to="/terms" target="_blank">
            {t("auth.termsLink")}
          </Link>
        ),
        privacy: (
          <Link to="/privacy" target="_blank">
            {t("auth.privacyLink")}
          </Link>
        ),
      })}
    </p>
  );
}

export function AuthPage({ mode }: { mode: "login" | "join" }) {
  const { me, setMe } = useAuth();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const next = safeNext(sp.get("next"));
  const [f, setF] = useState({ username: "", email: "", password: "" });
  const act = useAction();
  const robot = useTurnstile(mode === "login" ? "login" : "signup");
  const config = useApi<AuthConfig>("/auth/config").data;
  const oauthError = oauthErrorText(sp.get("oauth"));
  const login = mode === "login";
  useTitle(login ? TITLES.login : TITLES.join);
  if (me) return <Navigate to={next} replace />;

  const set = (k: keyof typeof f) => (e: ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    act.run(async () => {
      if (robot.on && !robot.token) throw new Error(t("auth.robotRequired"));
      try {
        const r = await api<Session>(`/auth/${login ? "login" : "signup"}`, { body: { ...f, turnstile: robot.token } });
        setMe(r.user);
        nav(login || next !== "/" ? next : "/welcome");
      } catch (err) {
        robot.reset();
        throw err;
      }
    });
  };

  return (
    <div className="wrap page narrow">
      <h1 className="page-title">{login ? t("auth.logIn") : t("auth.joinSonosphere")}</h1>
      <form className="form card" onSubmit={submit}>
        {oauthError && (
          <p className="form-error" role="alert">
            {oauthError}
          </p>
        )}
        <OAuthButtons providers={config?.oauth ?? []} next={next} />
        <label>
          {login ? t("auth.usernameOrEmail") : t("auth.username")}
          <Input
            value={f.username}
            onChange={set("username")}
            autoComplete="username"
            required
            autoFocus
            maxLength={login ? 200 : 15}
          />
        </label>
        {!login && (
          <label>
            {t("auth.email")}
            <Input type="email" value={f.email} onChange={set("email")} autoComplete="email" required />
          </label>
        )}
        <label>
          {t("auth.password")}
          <Input
            type="password"
            value={f.password}
            onChange={set("password")}
            autoComplete={login ? "current-password" : "new-password"}
            required
            minLength={login ? undefined : 8}
          />
        </label>
        {robot.view}
        {!login && <Agreement />}
        {act.note}
        <Button kind="btn" loading={act.busy}>
          {login ? t("auth.logIn") : t("auth.createAccount")}
        </Button>
      </form>
      {login ? (
        <>
          <p>
            <Link to="/forgot">{t("auth.forgotPassword")}</Link>
          </p>
          <p>
            {tx("auth.newHere", {
              link: <Link to={`/join${qs({ next: sp.get("next") })}`}>{t("auth.createAnAccount")}</Link>,
            })}
          </p>
        </>
      ) : (
        <p>
          {tx("auth.haveAccount", {
            link: <Link to={`/login${qs({ next: sp.get("next") })}`}>{t("auth.logIn")}</Link>,
          })}
        </p>
      )}
    </div>
  );
}

export function OAuthJoinPage() {
  const { me, setMe } = useAuth();
  const nav = useNavigate();
  const q = useApi<OAuthPending>("/auth/oauth/pending");
  const [name, setName] = useState<string | null>(null);
  const act = useAction();
  useTitle(TITLES.join);
  if (me) return <Navigate to="/" replace />;
  const username = name ?? q.data?.username ?? "";

  const submit = (e: FormEvent) => {
    e.preventDefault();
    act.run(async () => {
      const r = await api<OAuthCreated>("/auth/oauth/complete", { body: { username } });
      setMe(r.user);
      nav(r.next === "/" ? "/welcome" : r.next);
    });
  };

  let body = null;
  if (q.error) {
    body = (
      <div className="card form">
        <p className="form-error" role="alert">
          {q.error.message}
        </p>
        <p>
          <Link to="/join">{t("auth.backToJoin")}</Link>
        </p>
      </div>
    );
  } else if (q.data) {
    body = (
      <form className="form card" onSubmit={submit}>
        <p>{tx("auth.oauthSigningUp", { provider: q.data.provider, email: <strong>{q.data.email}</strong> })}</p>
        <label>
          {t("auth.username")}
          <Input
            value={username}
            onChange={(e) => setName(e.target.value)}
            autoComplete="username"
            required
            autoFocus
            maxLength={15}
          />
        </label>
        <p className="muted small">{t("auth.oauthUsernameHint")}</p>
        <Agreement />
        {act.note}
        <Button kind="btn" loading={act.busy}>
          {t("auth.createAccount")}
        </Button>
      </form>
    );
  }

  return (
    <div className="wrap page narrow">
      <h1 className="page-title">{t("auth.joinSonosphere")}</h1>
      {body}
    </div>
  );
}

export function ForgotPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState("");
  const act = useAction();
  const robot = useTurnstile("forgot");
  useTitle(TITLES.forgot);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    act.run(async () => {
      if (robot.on && !robot.token) throw new Error(t("auth.robotRequired"));
      try {
        await api<Ok>("/auth/forgot", { body: { email, turnstile: robot.token } });
        setSent(email);
      } catch (err) {
        robot.reset();
        throw err;
      }
    });
  };

  return (
    <div className="wrap page narrow">
      <h1 className="page-title">{t("auth.resetTitle")}</h1>
      {sent ? (
        <div className="card form">
          <p>{tx("auth.resetSent", { email: <strong>{sent}</strong> })}</p>
          <p className="muted small">{t("auth.resetSpam")}</p>
        </div>
      ) : (
        <form className="form card" onSubmit={submit}>
          <p>{t("auth.resetIntro")}</p>
          <label>
            {t("auth.email")}
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              autoFocus
            />
          </label>
          {robot.view}
          {act.note}
          <Button kind="btn" loading={act.busy}>
            {t("auth.sendResetLink")}
          </Button>
        </form>
      )}
      <p>
        <Link to="/login">{t("auth.backToLogIn")}</Link>
      </p>
    </div>
  );
}

export function ResetPage() {
  const [sp] = useSearchParams();
  const token = sp.get("token") || "";
  const { setMe } = useAuth();
  const nav = useNavigate();
  const [pw, setPw] = useState("");
  const act = useAction();
  useTitle(TITLES.reset);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    act.run(async () => {
      const r = await api<Session>("/auth/reset", { body: { token, password: pw } });
      setMe(r.user);
      nav("/");
    });
  };

  return (
    <div className="wrap page narrow">
      <h1 className="page-title">{t("auth.newPasswordTitle")}</h1>
      {token ? (
        <form className="form card" onSubmit={submit}>
          <label>
            {t("auth.newPassword")}
            <Input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
              autoFocus
            />
          </label>
          <p className="muted small">{t("auth.newPasswordHint")}</p>
          {act.note}
          <Button kind="btn" loading={act.busy}>
            {t("auth.savePassword")}
          </Button>
        </form>
      ) : (
        <div className="card form">
          <p>{tx("auth.resetMissingCode", { link: <Link to="/forgot">{t("auth.askForNewOne")}</Link> })}</p>
        </div>
      )}
    </div>
  );
}

export function VerifyPage() {
  const [approvalPending, setApprovalPending] = useState(false);
  const [sp] = useSearchParams();
  const token = sp.get("token") || "";
  const { me, refresh } = useAuth();
  const [state, setState] = useState<"working" | "done" | string>(token ? "working" : t("auth.verifyMissingCode"));
  useTitle(TITLES.verify);
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    api<Ok & { approvalPending: boolean }>("/auth/verify", { body: { token } }).then(
      (result) => {
        setApprovalPending(result.approvalPending);
        setState("done");
        refresh();
      },
      (e) => setState(e instanceof Error ? e.message : String(e))
    );
  }, [token]);

  let body;
  if (state === "working") {
    body = <p>{t("auth.confirming")}</p>;
  } else if (state === "done") {
    body = (
      <>
        <p>{approvalPending ? t("auth.emailChangeApproved") : t("auth.emailConfirmed")}</p>
        <p>{me ? <Link to="/">{t("auth.goHome")}</Link> : <Link to="/login">{t("auth.logIn")}</Link>}</p>
      </>
    );
  } else {
    body = (
      <>
        <p className="form-error" role="alert">
          {state}
        </p>
        <p>
          {me ? (
            tx("auth.sendNewLink", {
              link: <Link to="/settings/account">{t("auth.accountSettingsLink")}</Link>,
            })
          ) : (
            <Link to="/login">{t("auth.logIn")}</Link>
          )}
        </p>
      </>
    );
  }

  return (
    <div className="wrap page narrow">
      <h1 className="page-title">{t("auth.confirmEmailTitle")}</h1>
      <div className="card form">{body}</div>
    </div>
  );
}
