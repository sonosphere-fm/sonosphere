import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Button, Input } from "../kit";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { api, qs, useApi, useAuth, useTitle } from "../lib";
import { useAction } from "../ui/base";
import type { AuthConfig, OAuthCreated, OAuthPending, Ok, Session } from "../../shared/auth";
import { OAUTH_ERRORS, OAuthButtons } from "../ui/oauth";

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
      const t = (window as unknown as { turnstile?: Turnstile }).turnstile;
      if (t) ok(t);
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
      (t) => {
        if (gone || !box.current) return;
        const theme = document.documentElement.dataset.theme;
        const id = t.render(box.current, {
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
        widget.current = { t, id };
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
          The robot check could not load. Refresh the page and try again.
        </p>
      )}
    </div>
  ) : null;

  return { on: !!key, token, reset, view };
}

function Agreement() {
  return (
    <p className="muted small">
      By creating an account you agree to the{" "}
      <Link to="/terms" target="_blank">
        Terms of Service
      </Link>{" "}
      and{" "}
      <Link to="/privacy" target="_blank">
        Privacy Policy
      </Link>
      , and confirm you are at least 13.
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
  const oauthError = OAUTH_ERRORS[sp.get("oauth") ?? ""];
  const login = mode === "login";
  useTitle(login ? "Log in" : "Join");
  if (me) return <Navigate to={next} replace />;

  const set = (k: keyof typeof f) => (e: ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    act.run(async () => {
      if (robot.on && !robot.token) throw new Error("Complete the check that you are not a robot");
      try {
        const r = await api<Session>(`/auth/${login ? "login" : "signup"}`, { body: { ...f, turnstile: robot.token } });
        setMe(r.user);
        nav(next);
      } catch (err) {
        robot.reset();
        throw err;
      }
    });
  };

  return (
    <div className="wrap page narrow">
      <h1 className="page-title">{login ? "Log in" : "Join Sonosphere"}</h1>
      <form className="form card" onSubmit={submit}>
        {oauthError && (
          <p className="form-error" role="alert">
            {oauthError}
          </p>
        )}
        <OAuthButtons providers={config?.oauth ?? []} next={next} />
        <label>
          {login ? "Username or email" : "Username"}
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
            Email
            <Input type="email" value={f.email} onChange={set("email")} autoComplete="email" required />
          </label>
        )}
        <label>
          Password
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
          {login ? "Log in" : "Create account"}
        </Button>
      </form>
      {login ? (
        <>
          <p>
            <Link to="/forgot">Forgot your password?</Link>
          </p>
          <p>
            New here? <Link to={`/join${qs({ next: sp.get("next") })}`}>Create an account</Link>.
          </p>
        </>
      ) : (
        <p>
          Already have an account? <Link to={`/login${qs({ next: sp.get("next") })}`}>Log in</Link>.
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
  useTitle("Join Sonosphere");
  if (me) return <Navigate to="/" replace />;
  const username = name ?? q.data?.username ?? "";

  const submit = (e: FormEvent) => {
    e.preventDefault();
    act.run(async () => {
      const r = await api<OAuthCreated>("/auth/oauth/complete", { body: { username } });
      setMe(r.user);
      nav(r.next);
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
          <Link to="/join">Back to the join page</Link>
        </p>
      </div>
    );
  } else if (q.data) {
    body = (
      <form className="form card" onSubmit={submit}>
        <p>
          You're signing up with {q.data.provider} as <strong>{q.data.email}</strong>. Pick a username to finish.
        </p>
        <label>
          Username
          <Input
            value={username}
            onChange={(e) => setName(e.target.value)}
            autoComplete="username"
            required
            autoFocus
            maxLength={15}
          />
        </label>
        <p className="muted small">
          2 to 15 characters: letters, numbers, - and _, starting with a letter. You can set a password later in
          Settings, which some scrobbler apps need.
        </p>
        <Agreement />
        {act.note}
        <Button kind="btn" loading={act.busy}>
          Create account
        </Button>
      </form>
    );
  }

  return (
    <div className="wrap page narrow">
      <h1 className="page-title">Join Sonosphere</h1>
      {body}
    </div>
  );
}

export function ForgotPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState("");
  const act = useAction();
  const robot = useTurnstile("forgot");
  useTitle("Reset your password");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    act.run(async () => {
      if (robot.on && !robot.token) throw new Error("Complete the check that you are not a robot");
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
      <h1 className="page-title">Reset your password</h1>
      {sent ? (
        <div className="card form">
          <p>
            If an account uses <strong>{sent}</strong>, a link to choose a new password is on its way. It works for one
            hour.
          </p>
          <p className="muted small">
            Nothing after a few minutes? Check your spam folder, or make sure you used the address you signed up with.
          </p>
        </div>
      ) : (
        <form className="form card" onSubmit={submit}>
          <p>Enter the email address on your account and we will send you a link to choose a new password.</p>
          <label>
            Email
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
            Send reset link
          </Button>
        </form>
      )}
      <p>
        <Link to="/login">Back to log in</Link>
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
  useTitle("Choose a new password");

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
      <h1 className="page-title">Choose a new password</h1>
      {token ? (
        <form className="form card" onSubmit={submit}>
          <label>
            New password
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
          <p className="muted small">At least 8 characters. You will be signed out everywhere else.</p>
          {act.note}
          <Button kind="btn" loading={act.busy}>
            Save password
          </Button>
        </form>
      ) : (
        <div className="card form">
          <p>
            This link is missing its code. Open the link from the email again, or{" "}
            <Link to="/forgot">ask for a new one</Link>.
          </p>
        </div>
      )}
    </div>
  );
}

export function VerifyPage() {
  const [sp] = useSearchParams();
  const token = sp.get("token") || "";
  const { me, refresh } = useAuth();
  const [state, setState] = useState<"working" | "done" | string>(
    token ? "working" : "This link is missing its code. Open the link from the email again."
  );
  useTitle("Confirm your email");
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    api<Ok>("/auth/verify", { body: { token } }).then(
      () => {
        setState("done");
        refresh();
      },
      (e) => setState(e instanceof Error ? e.message : String(e))
    );
  }, [token]);

  let body;
  if (state === "working") {
    body = <p>Confirming...</p>;
  } else if (state === "done") {
    body = (
      <>
        <p>Your email is confirmed. Thanks!</p>
        <p>{me ? <Link to="/">Go to your home page</Link> : <Link to="/login">Log in</Link>}</p>
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
            <>
              You can send a new link from <Link to="/settings/account">your account settings</Link>.
            </>
          ) : (
            <Link to="/login">Log in</Link>
          )}
        </p>
      </>
    );
  }

  return (
    <div className="wrap page narrow">
      <h1 className="page-title">Confirm your email</h1>
      <div className="card form">{body}</div>
    </div>
  );
}
