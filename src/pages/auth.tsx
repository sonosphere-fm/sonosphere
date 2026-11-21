import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Button, Input } from "../kit";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { api, qs, useApi, useAuth, useTitle } from "../lib";
import { useAction } from "../ui/base";
import type { AuthConfig, Session } from "../../shared/auth";

const safeNext = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/");

// ---------- robot check ----------
type Turnstile = {
  render: (el: HTMLElement, o: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
let script: Promise<Turnstile> | null = null;
const loadTurnstile = () => script ??= new Promise<Turnstile>((ok, no) => {
  const s = document.createElement("script");
  s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  s.async = true;
  s.onload = () => { const t = (window as unknown as { turnstile?: Turnstile }).turnstile; if (t) ok(t); else no(new Error("no turnstile")); };
  s.onerror = () => { script = null; no(new Error("Turnstile did not load")); };
  document.head.append(s);
});

/** Cloudflare's robot check, when the site has it on. `token` is empty until it passes; `reset` asks for a new one
 *  (each token works once, so after a refused submit). */
function useTurnstile(action: string) {
  const { data } = useApi<AuthConfig>("/auth/config");
  const key = data?.turnstile ?? null;
  const box = useRef<HTMLDivElement>(null), widget = useRef<{ t: Turnstile; id: string } | null>(null);
  const [token, setToken] = useState(""), [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!key || !box.current) return;
    let gone = false;
    loadTurnstile().then(t => {
      if (gone || !box.current) return;
      const theme = document.documentElement.dataset.theme;
      const id = t.render(box.current, {
        sitekey: key, action, size: "flexible", theme: theme === "dark" || theme === "light" ? theme : "auto",
        callback: (v: string) => { setToken(v); setFailed(false); },
        "expired-callback": () => setToken(""),
        "error-callback": () => { setToken(""); setFailed(true); },
      });
      widget.current = { t, id };
    }, () => setFailed(true));
    return () => { gone = true; if (widget.current) widget.current.t.remove(widget.current.id); widget.current = null; };
  }, [key, action]);
  const reset = () => { setToken(""); if (widget.current) widget.current.t.reset(widget.current.id); };
  const view = key ? <div className="turnstile">
    <div ref={box} />
    {failed && <p className="form-error" role="alert">The robot check could not load. Refresh the page and try again.</p>}
  </div> : null;
  return { on: !!key, token, reset, view };
}

// ---------- auth ----------
export function AuthPage({ mode }: { mode: "login" | "join" }) {
  const { me, setMe } = useAuth(), nav = useNavigate(), [sp] = useSearchParams(), next = safeNext(sp.get("next"));
  const [f, setF] = useState({ username: "", email: "", password: "" }), act = useAction(), robot = useTurnstile(mode === "login" ? "login" : "signup");
  useTitle(mode === "login" ? "Log in" : "Join");
  if (me) return <Navigate to={next} replace />;
  const set = (k: keyof typeof f) => (e: ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    act.run(async () => {
      if (robot.on && !robot.token) throw new Error("Complete the check that you are not a robot");
      try {
        const r = await api<Session>(`/auth/${mode === "login" ? "login" : "signup"}`, { body: { ...f, turnstile: robot.token } });
        setMe(r.user); nav(next);
      } catch (err) { robot.reset(); throw err; }
    });
  };
  return (
    <div className="wrap page narrow">
      <h1 className="page-title">{mode === "login" ? "Log in" : "Join Sonosphere"}</h1>
      <form className="form card" onSubmit={submit}>
        <label>{mode === "login" ? "Username or email" : "Username"}<Input value={f.username} onChange={set("username")} autoComplete="username" required autoFocus maxLength={mode === "login" ? 200 : 15} /></label>
        {mode === "join" && <label>Email<Input type="email" value={f.email} onChange={set("email")} autoComplete="email" required /></label>}
        <label>Password<Input type="password" value={f.password} onChange={set("password")} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "join" ? 8 : undefined} /></label>
        {robot.view}
        {act.note}
        <Button kind="btn" loading={act.busy}>{mode === "login" ? "Log in" : "Create account"}</Button>
      </form>
      {mode === "login"
        ? <><p>New here? <Link to={`/join${qs({ next: sp.get("next") })}`}>Create an account</Link>.</p></>
        : <p>Already have an account? <Link to={`/login${qs({ next: sp.get("next") })}`}>Log in</Link>.</p>}
    </div>
  );
}
